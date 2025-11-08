import { RequestHandler } from "express";
import { Video, VideoFolder, VideosResponse } from "@shared/api";

const UPNSHARE_API_BASE = "https://upnshare.com/api/v1";
const API_TOKEN = process.env.UPNSHARE_API_TOKEN || "";

// In-memory cache with TTL
interface CacheEntry {
  data: VideosResponse;
  timestamp: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchWithAuth(url: string) {
  // UPNshare uses api-token header (with hyphen, not underscore)
  const response = await fetch(url, {
    headers: {
      "api-token": API_TOKEN,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `UPNshare API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

// Normalize video metadata
function normalizeVideo(video: any, folderId: string): Video {
  // Log the first video to understand the data structure
  if (!loggedFirst) {
    loggedFirst = true;
    console.log("Sample video from API:", JSON.stringify(video, null, 2));
  }

  // Extract asset path from poster URL and construct full poster URL
  // e.g., "/ilwWC4Mp5MVI4.../poster.png" -> "/ilwWC4Mp5MVI4..."
  let assetPath: string | undefined;
  let posterUrl: string | undefined;

  if (video.poster) {
    const assetUrl = video.assetUrl || "https://assets.upns.net";

    // If poster is a relative path, make it absolute
    if (video.poster.startsWith("/")) {
      posterUrl = assetUrl + video.poster;
    } else {
      posterUrl = video.poster;
    }

    // Extract asset path by removing the filename
    // e.g., "/ilwWC4Mp5MVI4XuXNUu0tQ/db/j3t1qkoj/3iphd/poster.png" -> "/ilwWC4Mp5MVI4XuXNUu0tQ/db/j3t1qkoj/3iphd"
    const pathMatch = posterUrl.match(
      /^(https?:\/\/[^/]+)?(\/.*)\/(poster|preview|[^/]+\.(png|jpg|jpeg|webp))$/i,
    );
    if (pathMatch) {
      assetPath = pathMatch[2]; // Get the path without filename
    }
  }

  return {
    id: video.id,
    title: (video.title || video.name || `Video ${video.id}`).trim(),
    description: video.description?.trim() || undefined,
    duration: video.duration || 0,
    thumbnail: video.thumbnail || undefined,
    poster: posterUrl || video.thumbnail || undefined,
    assetUrl: video.assetUrl || "https://assets.upns.net",
    assetPath: assetPath,
    created_at: video.created_at || video.createdAt || undefined,
    updated_at: video.updated_at || video.updatedAt || undefined,
    views: video.views || video.play || 0,
    size: video.size || undefined,
    folder_id: folderId,
  };
}

let loggedFirst = false;

// Fetch all videos from a folder with pagination
async function fetchAllVideosFromFolder(
  folderId: string,
): Promise<{ videos: any[]; error?: string }> {
  const allVideos: any[] = [];
  let page = 1;
  const perPage = 100; // Fetch 100 per page

  try {
    while (true) {
      const url = `${UPNSHARE_API_BASE}/video/folder/${folderId}?page=${page}&perPage=${perPage}`;
      const response = await fetchWithAuth(url);

      // Handle the paginated response format: { data: [...], metadata: {...} }
      const videos = Array.isArray(response) ? response : response.data || [];

      const metadata = response.metadata || {};

      if (videos.length > 0) {
        allVideos.push(...videos);
      }

      // Check if there are more pages using maxPage from metadata
      const currentPage = metadata.currentPage || page;
      const maxPage =
        metadata.maxPage || Math.ceil((metadata.total || 0) / perPage);

      if (!videos.length || currentPage >= maxPage) {
        break;
      }

      page++;

      // Add delay between page requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return { videos: allVideos };
  } catch (error) {
    console.error(`Error fetching videos from folder ${folderId}:`, error);
    return {
      videos: allVideos,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const handleGetVideos: RequestHandler = async (req, res) => {
  try {
    if (!API_TOKEN) {
      return res.status(500).json({
        error: "UPNSHARE_API_TOKEN environment variable is not set",
      });
    }

    // Check cache first
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      console.log("Returning cached video data");
      return res.json(cache.data);
    }

    console.log("Fetching fresh video data from UPNshare...");
    const allVideos: Video[] = [];
    const allFolders: VideoFolder[] = [];

    // Fetch folders
    const foldersData = await fetchWithAuth(
      `${UPNSHARE_API_BASE}/video/folder`,
    );

    const folders = Array.isArray(foldersData)
      ? foldersData
      : foldersData.data || [];

    console.log(`Found ${folders.length} folders`);

    // Fetch videos from all folders with pagination
    for (const folder of folders) {
      allFolders.push({
        id: folder.id,
        name: folder.name?.trim() || "Unnamed Folder",
        description: folder.description?.trim() || undefined,
        video_count: folder.video_count,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
      });

      console.log(`Fetching videos from folder: ${folder.name} (${folder.id})`);
      const { videos, error } = await fetchAllVideosFromFolder(folder.id);

      if (error) {
        console.error(`Error in folder ${folder.name}:`, error);
      }

      console.log(`  Found ${videos.length} videos in ${folder.name}`);

      for (const video of videos) {
        allVideos.push(normalizeVideo(video, folder.id));
      }

      // Add delay between folder requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const response: VideosResponse = {
      videos: allVideos,
      folders: allFolders,
      total: allVideos.length,
    };

    // Update cache
    cache = {
      data: response,
      timestamp: Date.now(),
    };

    console.log(`Total videos fetched: ${allVideos.length}`);
    res.json(response);
  } catch (error) {
    console.error("Error fetching videos from UPNshare:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch videos from UPNshare",
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
        "Referer": "https://upnshare.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
    const isManifest = path === "" || (typeof path === "string" && path.endsWith(".m3u8"));
    
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
