/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * Video from UPNshare API
 */
export interface Video {
  id: string;
  title: string;
  description?: string;
  duration: number;
  thumbnail?: string;
  poster?: string;
  preview?: string;
  assetUrl?: string;
  assetPath?: string;
  created_at?: string;
  updated_at?: string;
  views?: number;
  size?: number;
  folder_id?: string;
  width?: number;
  height?: number;
  tags?: string[];
}

/**
 * Folder from UPNshare API
 */
export interface VideoFolder {
  id: string;
  name: string;
  description?: string;
  video_count?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Response from /api/videos endpoint - lists all videos from all folders
 */
export interface VideosResponse {
  videos: Video[];
  folders: VideoFolder[];
  total: number;
}

/**
 * Realtime viewing statistics for a video
 */
export interface RealtimeVideoStats {
  videoId: string;
  viewers: number;
}

/**
 * Response from /api/realtime endpoint
 */
export interface RealtimeResponse {
  data: Array<{
    id: string;
    realtime: number;
  }>;
}
