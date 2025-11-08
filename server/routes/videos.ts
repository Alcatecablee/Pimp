import { RequestHandler } from "express";
import { Video, VideoFolder, VideosResponse } from "@shared/api";
import { performanceMonitor } from "../utils/monitoring";
import { getFromRedisCache, setRedisCache } from "../utils/redis-cache";
import { sharedCache } from "../utils/background-refresh";
import {
  UPNSHARE_API_BASE,
  fetchWithAuth,
  normalizeVideo,
  fetchAllVideosFromFolder,
} from "../utils/upnshare";

const API_TOKEN = process.env.UPNSHARE_API_TOKEN || "";

// In-memory cache with TTL
interface CacheEntry {
  data: VideosResponse;
  timestamp: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const handleGetVideos: RequestHandler = async (req, res) => {
  const startTime = Date.now();
  const GLOBAL_TIMEOUT = 15000; // 15 seconds - be very conservative to avoid Vercel's 30s limit

  try {
    performanceMonitor.recordRequest();

    console.log("[handleGetVideos] Starting request");
    console.log("[handleGetVideos] API_TOKEN present:", !!API_TOKEN);
    console.log(
      "[handleGetVideos] API_TOKEN value:",
      API_TOKEN ? API_TOKEN.substring(0, 5) + "..." : "NOT SET",
    );

    if (!API_TOKEN) {
      console.error("[handleGetVideos] API_TOKEN is not set in environment");
      performanceMonitor.recordError("missing_api_token");
      return res.status(500).json({
        error: "UPNSHARE_API_TOKEN environment variable is not set",
      });
    }

    // Check in-memory cache first (fastest)
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      console.log("✅ Returning in-memory cached video data");
      performanceMonitor.recordCacheHit();
      performanceMonitor.logStats();
      return res.json(cache.data);
    }

    // Check shared cache from background refresh
    if (sharedCache && Date.now() - sharedCache.timestamp < CACHE_TTL) {
      console.log("✅ Returning background refresh cached video data");
      performanceMonitor.recordCacheHit();

      // Update in-memory cache for next request
      cache = {
        data: sharedCache.data,
        timestamp: sharedCache.timestamp,
      };

      performanceMonitor.logStats();
      return res.json(sharedCache.data);
    }

    // Check Redis cache (persistent, survives restarts)
    const redisData = await getFromRedisCache();
    if (redisData) {
      console.log("✅ Returning Redis cached video data");
      performanceMonitor.recordCacheHit();

      // Update in-memory cache for next request
      cache = {
        data: redisData,
        timestamp: Date.now(),
      };

      performanceMonitor.logStats();
      return res.json(redisData);
    }

    performanceMonitor.recordCacheMiss();
    console.log("Fetching fresh video data from UPNshare...");

    // Wrap the entire fetching logic in a timeout promise
    const fetchPromise = (async () => {
      const allVideos: Video[] = [];
      const allFolders: VideoFolder[] = [];

      // Fetch folders
      const foldersData = await fetchWithAuth(
        `${UPNSHARE_API_BASE}/video/folder`,
        5000, // 5 second timeout for folder list
      );

      const folders = Array.isArray(foldersData)
        ? foldersData
        : foldersData.data || [];

      console.log(`Found ${folders.length} folders`);

      // Process folders and prepare folder metadata
      for (const folder of folders) {
        allFolders.push({
          id: folder.id,
          name: folder.name?.trim() || "Unnamed Folder",
          description: folder.description?.trim() || undefined,
          video_count: folder.video_count,
          created_at: folder.created_at,
          updated_at: folder.updated_at,
        });
      }

      // Fetch ALL videos from all folders with smart concurrency and timeout handling
      console.log(`Fetching all videos from ${folders.length} folders...`);
      const MAX_CONCURRENT = 2; // Limit concurrent requests to prevent overwhelming the API
      const FOLDER_TIMEOUT = 8000; // 8 second timeout per folder

      const folderPromises = folders.map(async (folder, index) => {
        const folderStartTime = Date.now();
        try {
          // Check if we're running out of time before starting
          const timeRemaining = GLOBAL_TIMEOUT - (Date.now() - startTime);
          if (timeRemaining < 4000) {
            console.log(
              `⏭️  Skipping ${folder.name} - running out of time (${timeRemaining}ms remaining)`,
            );
            return [];
          }

          // Implement concurrency limiting: add a delay based on batch position
          const batchIndex = Math.floor(index / MAX_CONCURRENT);
          const delayMs = batchIndex * 50; // Small stagger between batches
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          // Check if we have enough time to fetch this folder
          const timeBeforeFetch = GLOBAL_TIMEOUT - (Date.now() - startTime);
          if (timeBeforeFetch < 2000) {
            console.log(
              `⏭️  Skipping ${folder.name} - not enough time remaining (${timeBeforeFetch}ms)`,
            );
            return [];
          }

          const result = await fetchAllVideosFromFolder(folder.id);

          const folderDuration = Date.now() - folderStartTime;
          performanceMonitor.recordFolderFetch(
            folder.id,
            folder.name,
            folderDuration,
          );

          if (result.error) {
            console.warn(
              `  ⚠️  Partial data from ${folder.name}: ${result.error}`,
            );
          }

          console.log(
            `  ✓ Found ${result.videos.length} videos in ${folder.name} (${folderDuration}ms)`,
          );

          return result.videos.map((video: any) =>
            normalizeVideo(video, folder.id),
          );
        } catch (error) {
          const folderDuration = Date.now() - folderStartTime;

          if (error instanceof Error && error.message.includes("timeout")) {
            performanceMonitor.recordTimeout();
            console.error(
              `  ⏱️  Timeout fetching ${folder.name} after ${folderDuration}ms`,
            );
          } else {
            performanceMonitor.recordError(`folder_fetch_${folder.id}`);
            console.error(`  ❌ Error fetching ${folder.name}:`, error);
          }

          return []; // Return empty array on error, don't fail entire request
        }
      });

      // Wait for all folder requests to complete, but don't wait longer than GLOBAL_TIMEOUT
      let videoArrays: any[] = [];
      try {
        videoArrays = await Promise.allSettled(folderPromises).then((results) =>
          results.map((result, index) => {
            if (result.status === "fulfilled") {
              return result.value || [];
            } else {
              console.error(
                `  ❌ Folder ${index} promise rejected:`,
                result.reason,
              );
              return [];
            }
          }),
        );
      } catch (error) {
        console.error("Error waiting for folder promises:", error);
        videoArrays = [];
      }

      // Flatten all videos into single array
      for (const videos of videoArrays) {
        allVideos.push(...videos);
      }

      return { allVideos, allFolders };
    })();

    // Execute the fetch with a hard timeout - return partial results if timeout
    let allVideos: Video[] = [];
    let allFolders: VideoFolder[] = [];

    try {
      const result = await Promise.race([
        fetchPromise,
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Global timeout reached")),
            GLOBAL_TIMEOUT - 2000, // Leave 2s buffer for response handling
          );
        }),
      ]);
      allVideos = result.allVideos;
      allFolders = result.allFolders;
    } catch (timeoutError) {
      if (
        timeoutError instanceof Error &&
        timeoutError.message === "Global timeout reached"
      ) {
        console.warn(
          "[handleGetVideos] ⏱️  Timeout reached, returning partial/cached data",
        );
        // Try to return what we have so far - better than failing
        if (cache && Date.now() - cache.timestamp < CACHE_TTL * 2) {
          // Even if cache is stale, return it rather than fail
          performanceMonitor.logStats();
          return res.json(cache.data);
        }
        // Return empty result rather than error - client can retry
        allVideos = [];
        allFolders = [];
      } else {
        throw timeoutError;
      }
    }

    const response: VideosResponse = {
      videos: allVideos,
      folders: allFolders,
      total: allVideos.length,
    };

    // Update in-memory cache
    cache = {
      data: response,
      timestamp: Date.now(),
    };

    // Update Redis cache (fire and forget, don't wait)
    setRedisCache(response).catch((err) =>
      console.error("Failed to update Redis cache:", err),
    );

    const duration = Date.now() - startTime;
    console.log(
      `✅ Total videos fetched: ${allVideos.length} in ${duration}ms`,
    );

    performanceMonitor.logStats();

    const alertCheck = performanceMonitor.shouldAlert();
    if (alertCheck.alert) {
      console.warn(`⚠️  PERFORMANCE ALERT: ${alertCheck.reason}`);
    }

    res.json(response);
  } catch (error) {
    // If we timeout, try to return stale cache if available
    if (error instanceof Error && error.message === "Global timeout reached") {
      console.error(
        "[handleGetVideos] ⏱️  Global timeout reached, checking for stale cache",
      );
      performanceMonitor.recordTimeout();
      if (cache) {
        console.log("Returning stale cached data due to timeout");
        return res.json(cache.data);
      }
    }

    performanceMonitor.recordError("general_error");
    console.error(
      "[handleGetVideos] Error fetching videos from UPNshare:",
      error,
    );
    if (error instanceof Error) {
      console.error("[handleGetVideos] Error message:", error.message);
      console.error("[handleGetVideos] Error stack:", error.stack);
    }
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch videos from UPNshare",
    });
  }
};

// Paginated videos endpoint - lazy loads data incrementally
export const handleGetVideosPaginated: RequestHandler = async (req, res) => {
  try {
    performanceMonitor.recordRequest();

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const folderId = req.query.folder as string;

    if (!API_TOKEN) {
      performanceMonitor.recordError("missing_api_token");
      return res.status(500).json({
        error: "UPNSHARE_API_TOKEN environment variable is not set",
      });
    }

    // Helper to paginate from full cache
    const paginateFromCache = (cacheData: VideosResponse) => {
      let filteredVideos = cacheData.videos;
      if (folderId) {
        filteredVideos = filteredVideos.filter((v) => v.folder_id === folderId);
      }

      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedVideos = filteredVideos.slice(startIndex, endIndex);

      return {
        videos: paginatedVideos,
        folders: cacheData.folders,
        pagination: {
          page,
          limit,
          total: filteredVideos.length,
          totalPages: Math.ceil(filteredVideos.length / limit),
          hasMore: endIndex < filteredVideos.length,
        },
      };
    };

    // Check in-memory cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      performanceMonitor.recordCacheHit();
      return res.json(paginateFromCache(cache.data));
    }

    // Check shared cache from background refresh
    if (sharedCache && Date.now() - sharedCache.timestamp < CACHE_TTL) {
      performanceMonitor.recordCacheHit();
      cache = { data: sharedCache.data, timestamp: sharedCache.timestamp };
      return res.json(paginateFromCache(sharedCache.data));
    }

    // Check Redis cache
    const redisData = await getFromRedisCache();
    if (redisData) {
      performanceMonitor.recordCacheHit();
      cache = { data: redisData, timestamp: Date.now() };
      return res.json(paginateFromCache(redisData));
    }

    performanceMonitor.recordCacheMiss();

    // No cache available - fetch all data to populate cache
    console.log("Pagination: No cache available, fetching all data...");
    const allVideos: Video[] = [];
    const allFolders: VideoFolder[] = [];

    const foldersData = await fetchWithAuth(
      `${UPNSHARE_API_BASE}/video/folder`,
      5000,
    );
    const folders = Array.isArray(foldersData)
      ? foldersData
      : foldersData.data || [];

    for (const folder of folders) {
      allFolders.push({
        id: folder.id,
        name: folder.name?.trim() || "Unnamed Folder",
        description: folder.description?.trim() || undefined,
        video_count: folder.video_count,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
      });
    }

    // Fetch ALL videos from ALL folders to build accurate pagination
    const folderPromises = folders.map(async (folder: any) => {
      const folderStartTime = Date.now();
      try {
        const result = await fetchAllVideosFromFolder(folder.id);

        const folderDuration = Date.now() - folderStartTime;
        performanceMonitor.recordFolderFetch(
          folder.id,
          folder.name,
          folderDuration,
        );

        if (result.error) {
          console.warn(`⚠️ Partial data from ${folder.name}: ${result.error}`);
        }

        return result.videos.map((video: any) =>
          normalizeVideo(video, folder.id),
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("timeout")) {
          performanceMonitor.recordTimeout();
        } else {
          performanceMonitor.recordError(`folder_fetch_${folder.id}`);
        }
        return [];
      }
    });

    const videoArrays = await Promise.all(folderPromises);
    for (const videos of videoArrays) {
      allVideos.push(...videos);
    }

    const fullResponse: VideosResponse = {
      videos: allVideos,
      folders: allFolders,
      total: allVideos.length,
    };

    // Update cache
    cache = { data: fullResponse, timestamp: Date.now() };
    setRedisCache(fullResponse).catch((err) =>
      console.error("Failed to update Redis:", err),
    );

    // Return paginated result from full dataset
    res.json(paginateFromCache(fullResponse));
  } catch (error) {
    performanceMonitor.recordError("pagination_error");
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch paginated videos",
    });
  }
};

// Get individual video by ID
export const handleGetVideoById: RequestHandler = async (req, res) => {
  try {
    if (!API_TOKEN) {
      return res.status(500).json({
        error: "UPNSHARE_API_TOKEN environment variable is not set",
      });
    }

    const { id } = req.params;

    // Check cache first
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      const video = cache.data.videos.find((v) => v.id === id);
      if (video) {
        return res.json(video);
      }
    }

    // Fetch video details from API
    const videoData = await fetchWithAuth(
      `${UPNSHARE_API_BASE}/video/manage/${id}`,
    );

    const video: Video = normalizeVideo(videoData, videoData.folder_id || "");

    res.json(video);
  } catch (error) {
    console.error(`Error fetching video ${req.params.id}:`, error);
    res.status(404).json({
      error: "Video not found",
    });
  }
};

// Get video stream URL endpoint
// Returns the video's playable source URL (proxied through our server to avoid CORS)
export const handleGetStreamUrl: RequestHandler = async (req, res) => {
  try {
    if (!API_TOKEN) {
      return res.status(500).json({
        error: "UPNSHARE_API_TOKEN environment variable is not set",
      });
    }

    const { id } = req.params;

    // Return our proxy URL instead of direct URL to avoid CORS issues
    res.json({
      url: `/api/videos/${id}/hls-proxy`,
      poster: cache?.data.videos.find((v) => v.id === id)?.poster,
    });
  } catch (error) {
    console.error(`Error getting video stream URL ${req.params.id}:`, error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to get video stream URL",
    });
  }
};

// HLS Proxy endpoint - proxies HLS manifest and segments with CORS headers
export const handleHlsProxy: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const pathParam = req.query.path;
    const path = typeof pathParam === "string" ? pathParam : "";

    // Check cache first to get video details
    let video = cache?.data.videos.find((v) => v.id === id);

    if (!video) {
      const videoData = await fetchWithAuth(
        `${UPNSHARE_API_BASE}/video/manage/${id}`,
      );
      video = normalizeVideo(videoData, videoData.folder_id || "");
    }

    if (!video?.assetUrl || !video?.assetPath) {
      return res.status(404).json({ error: "Video not found" });
    }

    const assetUrl = video.assetUrl;
    const assetPath = video.assetPath.startsWith("/")
      ? video.assetPath
      : "/" + video.assetPath;

    // Construct the full URL to the asset
    const targetUrl = path
      ? `${assetUrl}${assetPath}/${path}`
      : `${assetUrl}${assetPath}/index.m3u8`;

    // Fetch the resource with authentication headers
    const response = await fetch(targetUrl, {
      headers: {
        "api-token": API_TOKEN,
        Referer: "https://upnshare.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Resource not found" });
    }

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");

    // Copy content type
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    // For m3u8 files, modify the URLs to point to our proxy
    const isManifest =
      path === "" || (typeof path === "string" && path.endsWith(".m3u8"));

    if (isManifest) {
      const text = await response.text();
      const modifiedText = text.replace(
        /(^|[\r\n])([^#\r\n][^\r\n]*\.ts|[^\r\n]*\.m3u8)/gm,
        (match, prefix, filename) => {
          return `${prefix}/api/videos/${id}/hls-proxy?path=${filename}`;
        },
      );
      res.send(modifiedText);
    } else {
      // For video segments, stream them directly
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (error) {
    console.error(`Error proxying HLS for video ${req.params.id}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to proxy HLS",
    });
  }
};

// Streaming proxy endpoint - redirects to the actual video source
export const handleVideoStream: RequestHandler = async (req, res) => {
  try {
    if (!API_TOKEN) {
      return res.status(500).json({
        error: "UPNSHARE_API_TOKEN environment variable is not set",
      });
    }

    const { id } = req.params;
    const { format } = req.query; // Support format query param (hls, mp4)

    // Check cache first
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      const video = cache.data.videos.find((v) => v.id === id);
      if (video?.assetUrl && video?.assetPath) {
        const assetUrl = video.assetUrl;
        const assetPath = video.assetPath.startsWith("/")
          ? video.assetPath
          : "/" + video.assetPath;

        if (format === "mp4") {
          return res.redirect(`${assetUrl}${assetPath}/video.mp4`);
        }

        // Default to HLS
        return res.redirect(`${assetUrl}${assetPath}/index.m3u8`);
      }
    }

    // Fetch video details from API
    const videoData = await fetchWithAuth(
      `${UPNSHARE_API_BASE}/video/manage/${id}`,
    );

    if (!videoData?.poster) {
      return res.status(404).json({
        error: "Video not found",
      });
    }

    // Extract asset path from poster URL
    // e.g., "https://assets.upns.net/ilwWC4Mp5.../poster.png" -> "/ilwWC4Mp5..."
    // or "/ilwWC4Mp5.../poster.png" -> "/ilwWC4Mp5..."
    let assetPath: string | undefined;
    const posterUrl = videoData.poster.startsWith("http")
      ? videoData.poster
      : (videoData.assetUrl || "https://assets.upns.net") + videoData.poster;

    const pathMatch = posterUrl.match(
      /^https?:\/\/[^/]+(\/.*)\/(poster|preview|[^/]+\.(png|jpg|jpeg|webp))$/i,
    );
    if (pathMatch) {
      assetPath = pathMatch[1];
    }

    if (!assetPath) {
      return res.status(404).json({
        error: "Video source path not available",
      });
    }

    const assetUrl = videoData.assetUrl || "https://assets.upns.net";

    if (format === "mp4") {
      return res.redirect(`${assetUrl}${assetPath}/video.mp4`);
    }

    // Default to HLS stream
    res.redirect(`${assetUrl}${assetPath}/index.m3u8`);
  } catch (error) {
    console.error(`Error streaming video ${req.params.id}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to stream video",
    });
  }
};
