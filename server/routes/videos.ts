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

  // Extract asset path from poster (e.g., "/Kt5MSAs88.../poster.png" -> "/Kt5MSAs88...")
  const posterPath = video.poster ? video.poster.replace(/\/[^/]*$/, "") : undefined;

  return {
    id: video.id,
    title: (video.title || video.name || `Video ${video.id}`).trim(),
    description: video.description?.trim() || undefined,
    duration: video.duration || 0,
    thumbnail: video.thumbnail || undefined,
    poster: video.poster || video.thumbnail || undefined,
    assetUrl: video.assetUrl || "https://assets.upns.net",
    assetPath: posterPath,
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
      const videos = Array.isArray(response)
        ? response
        : response.data || [];

      const metadata = response.metadata || {};

      if (videos.length > 0) {
        allVideos.push(...videos);
      }

      // Check if there are more pages using maxPage from metadata
      const currentPage = metadata.currentPage || page;
      const maxPage = metadata.maxPage || Math.ceil((metadata.total || 0) / perPage);

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
    return { videos: allVideos, error: error instanceof Error ? error.message : "Unknown error" };
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
// Returns the video's playable source URL
export const handleGetStreamUrl: RequestHandler = async (req, res) => {
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
      if (video?.assetUrl && video?.assetPath) {
        // Try HLS stream first (most common for video streaming)
        const hslUrl = `${video.assetUrl}${video.assetPath}/index.m3u8`;
        return res.json({
          url: hslUrl,
          fallback: `${video.assetUrl}${video.assetPath}/video.mp4`,
          poster: video.poster,
        });
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

    // Extract asset path from poster
    const posterPath = videoData.poster
      ? videoData.poster.replace(/\/[^/]*$/, "")
      : null;

    if (!posterPath) {
      return res.status(404).json({
        error: "Video source path not available",
      });
    }

    const assetUrl = videoData.assetUrl || "https://assets.upns.net";
    const hslUrl = `${assetUrl}${posterPath}/index.m3u8`;

    res.json({
      url: hslUrl,
      fallback: `${assetUrl}${posterPath}/video.mp4`,
      poster: videoData.poster,
    });
  } catch (error) {
    console.error(`Error getting video stream URL ${req.params.id}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get video stream URL",
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
        const assetUrl = video.assetUrl || "https://assets.upns.net";

        if (format === "mp4") {
          return res.redirect(`${assetUrl}${video.assetPath}/video.mp4`);
        }

        // Default to HLS
        return res.redirect(`${assetUrl}${video.assetPath}/index.m3u8`);
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

    // Extract asset path from poster
    const posterPath = videoData.poster
      ? videoData.poster.replace(/\/[^/]*$/, "")
      : null;

    if (!posterPath) {
      return res.status(404).json({
        error: "Video source path not available",
      });
    }

    const assetUrl = videoData.assetUrl || "https://assets.upns.net";

    if (format === "mp4") {
      return res.redirect(`${assetUrl}${posterPath}/video.mp4`);
    }

    // Default to HLS stream
    res.redirect(`${assetUrl}${posterPath}/index.m3u8`);
  } catch (error) {
    console.error(`Error streaming video ${req.params.id}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to stream video",
    });
  }
};
