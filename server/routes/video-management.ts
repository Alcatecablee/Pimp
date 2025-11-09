import { Request, Response } from "express";
import { fetchWithAuth } from "../utils/upnshare";

const UPNSHARE_API_BASE = "https://upnshare.com/api/v1";

/**
 * Delete a video
 * DELETE /api/admin/videos/:id
 */
export async function handleDeleteVideo(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: "Video ID is required" });
      return;
    }

    const API_TOKEN = process.env.UPNSHARE_API_TOKEN;
    if (!API_TOKEN) {
      res.status(500).json({ error: "API token not configured" });
      return;
    }

    console.log(`[handleDeleteVideo] Deleting video: ${id}`);

    const response = await fetch(`${UPNSHARE_API_BASE}/video/manage/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[handleDeleteVideo] Error:`, errorText);
      res.status(response.status).json({
        error: `Failed to delete video: ${response.statusText}`,
      });
      return;
    }

    console.log(`[handleDeleteVideo] Successfully deleted video: ${id}`);
    res.status(204).send();
  } catch (error) {
    console.error("[handleDeleteVideo] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Rename a video
 * PATCH /api/admin/videos/:id
 */
export async function handleRenameVideo(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!id) {
      res.status(400).json({ error: "Video ID is required" });
      return;
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Video name is required" });
      return;
    }

    const API_TOKEN = process.env.UPNSHARE_API_TOKEN;
    if (!API_TOKEN) {
      res.status(500).json({ error: "API token not configured" });
      return;
    }

    console.log(`[handleRenameVideo] Renaming video ${id} to: ${name}`);

    const response = await fetch(`${UPNSHARE_API_BASE}/video/manage/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[handleRenameVideo] Error:`, errorText);
      res.status(response.status).json({
        error: `Failed to rename video: ${response.statusText}`,
      });
      return;
    }

    console.log(`[handleRenameVideo] Successfully renamed video: ${id}`);
    res.status(204).send();
  } catch (error) {
    console.error("[handleRenameVideo] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Move video(s) to a folder
 * POST /api/admin/videos/move
 */
export async function handleMoveVideosToFolder(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { videoIds, folderId } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      res.status(400).json({ error: "Video IDs array is required" });
      return;
    }

    if (!folderId || typeof folderId !== "string") {
      res.status(400).json({ error: "Folder ID is required" });
      return;
    }

    const API_TOKEN = process.env.UPNSHARE_API_TOKEN;
    if (!API_TOKEN) {
      res.status(500).json({ error: "API token not configured" });
      return;
    }

    console.log(
      `[handleMoveVideosToFolder] Moving ${videoIds.length} video(s) to folder: ${folderId}`
    );

    const response = await fetch(
      `${UPNSHARE_API_BASE}/video/folder/${folderId}/link`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId: videoIds }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[handleMoveVideosToFolder] Error:`, errorText);
      res.status(response.status).json({
        error: `Failed to move videos: ${response.statusText}`,
      });
      return;
    }

    console.log(
      `[handleMoveVideosToFolder] Successfully moved ${videoIds.length} video(s)`
    );
    res.status(204).send();
  } catch (error) {
    console.error("[handleMoveVideosToFolder] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Bulk delete videos
 * POST /api/admin/videos/bulk-delete
 */
export async function handleBulkDeleteVideos(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { videoIds } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      res.status(400).json({ error: "Video IDs array is required" });
      return;
    }

    const API_TOKEN = process.env.UPNSHARE_API_TOKEN;
    if (!API_TOKEN) {
      res.status(500).json({ error: "API token not configured" });
      return;
    }

    console.log(`[handleBulkDeleteVideos] Deleting ${videoIds.length} videos`);

    const results = await Promise.allSettled(
      videoIds.map((id) =>
        fetch(`${UPNSHARE_API_BASE}/video/manage/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
          },
        })
      )
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(
      `[handleBulkDeleteVideos] Deleted ${successful}/${videoIds.length} videos (${failed} failed)`
    );

    res.json({
      successful,
      failed,
      total: videoIds.length,
    });
  } catch (error) {
    console.error("[handleBulkDeleteVideos] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
