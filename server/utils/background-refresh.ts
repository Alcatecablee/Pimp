import { Video, VideoFolder, VideosResponse } from "@shared/api";
import { setRedisCache } from "./redis-cache";
import {
  UPNSHARE_API_BASE,
  fetchWithAuth,
  normalizeVideo,
  fetchAllVideosFromFolder,
} from "./upnshare";

const REFRESH_INTERVAL = 5 * 60 * 1000;

let refreshTimer: NodeJS.Timeout | null = null;
let isRefreshing = false;
let lastRefreshTime = 0;

interface CacheEntry {
  data: VideosResponse;
  timestamp: number;
}

export let sharedCache: CacheEntry | null = null;

export async function refreshVideoCache(): Promise<{
  success: boolean;
  message: string;
  videosCount?: number;
}> {
  const API_TOKEN = process.env.UPNSHARE_API_TOKEN || "";

  if (!API_TOKEN) {
    return { success: false, message: "UPNSHARE_API_TOKEN not set" };
  }

  if (isRefreshing) {
    return { success: false, message: "Refresh already in progress" };
  }

  isRefreshing = true;
  const startTime = Date.now();

  try {
    console.log("🔄 Background refresh: Starting...");

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

    // Fetch ALL pages from each folder using shared helper with concurrency limiting
    const MAX_CONCURRENT = 2; // Limit concurrent requests
    const FOLDER_TIMEOUT = 10000; // 10 second timeout per folder
    const REFRESH_TIMEOUT = 4 * 60 * 1000; // 4 minute overall timeout

    const folderPromises = folders.map(async (folder: any, index: number) => {
      try {
        // Add staggered delay based on batch
        const batchIndex = Math.floor(index / MAX_CONCURRENT);
        const delayMs = batchIndex * 100;
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        const result = await fetchAllVideosFromFolder(folder.id);

        if (result.error) {
          console.warn(
            `  ⚠️  Partial data from ${folder.name}: ${result.error}`,
          );
        }

        console.log(
          `  ✓ Fetched ${result.videos.length} videos from ${folder.name}`,
        );

        return result.videos.map((video: any) =>
          normalizeVideo(video, folder.id, folder.name),
        );
      } catch (error) {
        console.error(`  ❌ Error fetching ${folder.name}:`, error);
        return [];
      }
    });

    const videoArrays = await Promise.allSettled(folderPromises).then(
      (results) =>
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

    for (const videos of videoArrays) {
      allVideos.push(...videos);
    }

    const response: VideosResponse = {
      videos: allVideos,
      folders: allFolders,
      total: allVideos.length,
    };

    sharedCache = {
      data: response,
      timestamp: Date.now(),
    };

    await setRedisCache(response);

    const duration = Date.now() - startTime;
    lastRefreshTime = Date.now();

    console.log(
      `✅ Background refresh: Completed in ${duration}ms (${allVideos.length} videos)`,
    );

    return {
      success: true,
      message: `Refreshed ${allVideos.length} videos in ${duration}ms`,
      videosCount: allVideos.length,
    };
  } catch (error) {
    console.error("❌ Background refresh failed:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    isRefreshing = false;
  }
}

export function startBackgroundRefresh() {
  if (refreshTimer) {
    console.log("⚠️  Background refresh already running");
    return;
  }

  console.log(
    `🔄 Starting background refresh (interval: ${REFRESH_INTERVAL / 1000}s)`,
  );

  refreshVideoCache();

  refreshTimer = setInterval(() => {
    refreshVideoCache();
  }, REFRESH_INTERVAL);
}

export function stopBackgroundRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    console.log("🛑 Stopped background refresh");
  }
}

export function getRefreshStatus() {
  return {
    isRunning: refreshTimer !== null,
    isRefreshing,
    lastRefreshTime,
    nextRefreshIn: refreshTimer
      ? REFRESH_INTERVAL - (Date.now() - lastRefreshTime)
      : null,
  };
}
