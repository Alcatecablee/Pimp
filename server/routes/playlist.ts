import { Request, Response } from "express";
import { query } from "../utils/database";

interface Playlist {
  id: string;
  userId: string;
  name: string;
  description?: string;
  videoIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface PlaylistRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PlaylistVideoRow {
  video_id: string;
  position: number;
}

/**
 * Get user playlists
 * GET /api/playlists
 */
export async function getPlaylists(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.query.userId as string || "default";

    const result = await query<PlaylistRow & { video_ids: string[] }>(
      `SELECT 
        p.id, 
        p.user_id, 
        p.name, 
        p.description, 
        p.created_at, 
        p.updated_at,
        COALESCE(
          ARRAY_AGG(pv.video_id ORDER BY pv.position ASC) FILTER (WHERE pv.video_id IS NOT NULL),
          ARRAY[]::VARCHAR[]
        ) as video_ids
       FROM playlists p
       LEFT JOIN playlist_videos pv ON p.id = pv.playlist_id
       WHERE p.user_id = $1
       GROUP BY p.id, p.user_id, p.name, p.description, p.created_at, p.updated_at
       ORDER BY p.created_at DESC`,
      [userId]
    );

    const playlists: Playlist[] = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description || undefined,
      videoIds: row.video_ids || [],
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));

    res.json({ playlists });
  } catch (error) {
    console.error("[getPlaylists] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Create a new playlist
 * POST /api/playlists
 */
export async function createPlaylist(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { name, description, videoIds = [] } = req.body;
    const userId = req.query.userId as string || "default";

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Playlist name is required" });
      return;
    }

    if (!Array.isArray(videoIds)) {
      res.status(400).json({ error: "Video IDs must be an array" });
      return;
    }

    const playlistId = `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await query(
      `INSERT INTO playlists (id, user_id, name, description) 
       VALUES ($1, $2, $3, $4)`,
      [playlistId, userId, name.trim(), description?.trim() || null]
    );

    for (let i = 0; i < videoIds.length; i++) {
      await query(
        `INSERT INTO playlist_videos (playlist_id, video_id, position) 
         VALUES ($1, $2, $3)
         ON CONFLICT (playlist_id, video_id) DO NOTHING`,
        [playlistId, videoIds[i], i]
      );
    }

    const result = await query<PlaylistRow>(
      `SELECT * FROM playlists WHERE id = $1`,
      [playlistId]
    );

    const playlist: Playlist = {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      name: result.rows[0].name,
      description: result.rows[0].description || undefined,
      videoIds,
      createdAt: result.rows[0].created_at.toISOString(),
      updatedAt: result.rows[0].updated_at.toISOString(),
    };

    console.log(`[createPlaylist] Created playlist: ${playlist.name} for user: ${userId}`);
    res.status(201).json({ playlist });
  } catch (error) {
    console.error("[createPlaylist] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Update a playlist
 * PUT /api/playlists/:id
 */
export async function updatePlaylist(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.query.userId as string || "default";

    const checkResult = await query<PlaylistRow>(
      `SELECT * FROM playlists WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "Invalid playlist name" });
        return;
      }
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description?.trim() || null);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id, userId);

    await query(
      `UPDATE playlists SET ${updates.join(", ")} 
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}`,
      values
    );

    const result = await query<PlaylistRow>(
      `SELECT * FROM playlists WHERE id = $1`,
      [id]
    );

    const videosResult = await query<PlaylistVideoRow>(
      `SELECT video_id FROM playlist_videos 
       WHERE playlist_id = $1 
       ORDER BY position ASC`,
      [id]
    );

    const playlist: Playlist = {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      name: result.rows[0].name,
      description: result.rows[0].description || undefined,
      videoIds: videosResult.rows.map((v) => v.video_id),
      createdAt: result.rows[0].created_at.toISOString(),
      updatedAt: result.rows[0].updated_at.toISOString(),
    };

    console.log(`[updatePlaylist] Updated playlist: ${id}`);
    res.json({ playlist });
  } catch (error) {
    console.error("[updatePlaylist] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Delete a playlist
 * DELETE /api/playlists/:id
 */
export async function deletePlaylist(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string || "default";

    const result = await query(
      `DELETE FROM playlists WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }

    console.log(`[deletePlaylist] Deleted playlist: ${id}`);
    res.status(204).send();
  } catch (error) {
    console.error("[deletePlaylist] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Add video to playlist
 * POST /api/playlists/:id/videos
 */
export async function addVideoToPlaylist(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { videoId } = req.body;
    const userId = req.query.userId as string || "default";

    if (!videoId || typeof videoId !== "string") {
      res.status(400).json({ error: "Video ID is required" });
      return;
    }

    const checkResult = await query<PlaylistRow>(
      `SELECT * FROM playlists WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }

    const maxPositionResult = await query<{ max_position: number | null }>(
      `SELECT COALESCE(MAX(position), -1) as max_position 
       FROM playlist_videos 
       WHERE playlist_id = $1`,
      [id]
    );

    const nextPosition = (maxPositionResult.rows[0].max_position ?? -1) + 1;

    await query(
      `INSERT INTO playlist_videos (playlist_id, video_id, position) 
       VALUES ($1, $2, $3)
       ON CONFLICT (playlist_id, video_id) DO NOTHING`,
      [id, videoId, nextPosition]
    );

    await query(
      `UPDATE playlists SET updated_at = NOW() WHERE id = $1`,
      [id]
    );

    console.log(`[addVideoToPlaylist] Added video ${videoId} to playlist ${id} at position ${nextPosition}`);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("[addVideoToPlaylist] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Remove video from playlist
 * DELETE /api/playlists/:id/videos/:videoId
 */
export async function removeVideoFromPlaylist(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id, videoId } = req.params;
    const userId = req.query.userId as string || "default";

    const checkResult = await query<PlaylistRow>(
      `SELECT * FROM playlists WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }

    await query(
      `DELETE FROM playlist_videos WHERE playlist_id = $1 AND video_id = $2`,
      [id, videoId]
    );

    await query(
      `WITH ordered_videos AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY position ASC) - 1 AS new_position
        FROM playlist_videos
        WHERE playlist_id = $1
      )
      UPDATE playlist_videos pv
      SET position = ov.new_position
      FROM ordered_videos ov
      WHERE pv.id = ov.id`,
      [id]
    );

    await query(
      `UPDATE playlists SET updated_at = NOW() WHERE id = $1`,
      [id]
    );

    console.log(`[removeVideoFromPlaylist] Removed video ${videoId} from playlist ${id} and re-normalized positions`);
    res.status(204).send();
  } catch (error) {
    console.error("[removeVideoFromPlaylist] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
