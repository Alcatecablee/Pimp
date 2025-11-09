import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  handleGetVideos,
  handleGetVideosPaginated,
  handleGetVideoById,
  handleGetStreamUrl,
  handleVideoStream,
  handleHlsProxy,
} from "./routes/videos";
import { handleRefreshNow, handleRefreshStatus } from "./routes/refresh";
import { handleGetRealtime } from "./routes/realtime";
import { handleGetAdminOverview } from "./routes/admin";
import {
  handleDeleteVideo,
  handleRenameVideo,
  handleMoveVideosToFolder,
  handleBulkDeleteVideos,
} from "./routes/video-management";
import {
  handleGetFolders,
  handleCreateFolder,
  handleDeleteFolder,
  handleRenameFolder,
} from "./routes/folder-management";
import { getUploadCredentials } from "./routes/upload";
import {
  getPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
} from "./routes/playlist";
import {
  startSession,
  updateProgress,
  endSession,
  getVideoAnalytics,
  getEngagementHeatmap,
} from "./routes/analytics";
import { startBackgroundRefresh } from "./utils/background-refresh";
import { initializeDatabase } from "./utils/database";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";

export async function createServer() {
  const app = express();

  // Middleware - CORS with secure origin policy
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5000', 'https://*.replit.dev'];
  
  app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin matches allowed patterns
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.includes('*')) {
          const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
          return pattern.test(origin);
        }
        return origin === allowed;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Setup Replit Auth (must be before routes)
  await setupAuth(app);

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping pong";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auth routes - must be defined before protected routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Video routes
  app.get("/api/videos", handleGetVideos);
  app.get("/api/videos/paginated", handleGetVideosPaginated);
  app.get("/api/videos/:id", handleGetVideoById);
  app.get("/api/videos/:id/stream-url", handleGetStreamUrl);
  app.get("/api/videos/:id/stream", handleVideoStream);
  app.get("/api/videos/:id/hls-proxy", handleHlsProxy);

  // Background refresh routes
  app.post("/api/refresh/now", handleRefreshNow);
  app.get("/api/refresh/status", handleRefreshStatus);

  // Realtime stats
  app.get("/api/realtime", handleGetRealtime);

  // Admin routes - Protected with authentication
  app.get("/api/admin/overview", isAuthenticated, handleGetAdminOverview);
  app.delete("/api/admin/videos/:id", isAuthenticated, handleDeleteVideo);
  app.patch("/api/admin/videos/:id", isAuthenticated, handleRenameVideo);
  app.post("/api/admin/videos/move", isAuthenticated, handleMoveVideosToFolder);
  app.post("/api/admin/videos/bulk-delete", isAuthenticated, handleBulkDeleteVideos);
  
  // Admin folder routes - Protected with authentication
  app.get("/api/admin/folders", isAuthenticated, handleGetFolders);
  app.post("/api/admin/folders", isAuthenticated, handleCreateFolder);
  app.delete("/api/admin/folders/:id", isAuthenticated, handleDeleteFolder);
  app.patch("/api/admin/folders/:id", isAuthenticated, handleRenameFolder);

  // Upload routes - Protected with authentication
  app.get("/api/upload/credentials", isAuthenticated, getUploadCredentials);

  // Playlist routes
  app.get("/api/playlists", getPlaylists);
  app.post("/api/playlists", createPlaylist);
  app.patch("/api/playlists/:id", updatePlaylist);
  app.delete("/api/playlists/:id", deletePlaylist);
  app.post("/api/playlists/:id/videos", addVideoToPlaylist);
  app.delete("/api/playlists/:id/videos/:videoId", removeVideoFromPlaylist);

  // Analytics routes
  app.post("/api/analytics/session/start", startSession);
  app.post("/api/analytics/session/progress", updateProgress);
  app.post("/api/analytics/session/end", endSession);
  app.get("/api/analytics/video/:videoId", getVideoAnalytics);
  app.get("/api/analytics/video/:videoId/heatmap", getEngagementHeatmap);

  // Initialize database schemas on server startup
  initializeDatabase().catch((error) => {
    console.error("❌ Failed to initialize database:", error);
  });

  // Start background refresh on server startup (non-blocking)
  // Schedule it to run after a short delay to not interfere with first request
  setTimeout(() => {
    startBackgroundRefresh();
  }, 1000);

  return app;
}
