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
  return {
    id: video.id,
    title: (video.title || video.name || `Video ${video.id}`).trim(),
    description: video.description?.trim() || undefined,
    duration: video.duration || 0,
    thumbnail: video.thumbnail || undefined,
    poster: video.poster || video.thumbnail || undefined,
    created_at: video.created_at || undefined,
    updated_at: video.updated_at || undefined,
    views: video.views || 0,
    size: video.size || undefined,
    folder_id: folderId,
  };
}

// Fetch all videos from a folder with pagination
async function fetchAllVideosFromFolder(
  folderId: string,
): Promise<{ videos: any[]; error?: string }> {
  const allVideos: any[] = [];
  let page = 1;
  const perPage = 100; // Fetch 100 per page
  let hasMore = true;

  try {
    while (hasMore) {
      const url = `${UPNSHARE_API_BASE}/video/folder/${folderId}?page=${page}&per_page=${perPage}`;
      const response = await fetchWithAuth(url);

      const videos = Array.isArray(response)
        ? response
        : response.data || response.videos || [];

      if (videos.length > 0) {
        allVideos.push(...videos);
      }

      // Check if there are more pages
      hasMore = videos.length === perPage;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn(`Stopped fetching folder ${folderId} after 100 pages`);
        break;
      }
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

// Streaming proxy endpoint
export const handleVideoStream: RequestHandler = async (req, res) => {
  try {
    if (!API_TOKEN) {
      return res.status(500).json({
        error: "UPNSHARE_API_TOKEN environment variable is not set",
      });
    }

    const { id } = req.params;
    const streamUrl = `${UPNSHARE_API_BASE}/video/${id}/stream`;

    // Forward the stream with authentication
    const response = await fetch(streamUrl, {
      headers: {
        "api-token": API_TOKEN,
        // Forward range header for seeking support
        ...(req.headers.range && { Range: req.headers.range }),
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to stream video: ${response.statusText}`,
      });
    }

    // Forward response headers
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Stream the video data
    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        pump();
      };
      await pump();
    }
  } catch (error) {
    console.error(`Error streaming video ${req.params.id}:`, error);
    res.status(500).json({
      error: "Failed to stream video",
    });
  }
};
