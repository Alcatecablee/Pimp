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
import {
  getAnalyticsOverview,
  getStorageAnalytics,
} from "./routes/admin-analytics";
import {
  handleGetSystemHealth,
  handleGetEndpointMetrics,
  handleGetRecentErrors,
  handleResetMetrics,
  trackRequest,
  trackError,
} from "./routes/admin-health";
import {
  handleGetLogs,
  handleGetLogStats,
  handleClearLogs,
  handleExportLogs,
} from "./routes/admin-logs";
import {
  handleExportBackup,
  handleBackupInfo,
  handleVerifyBackup,
} from "./routes/admin-backup";
import webhooksRouter from "./routes/webhooks";
import { startBackgroundRefresh } from "./utils/background-refresh";
import { startLogRetentionCleanup } from "./utils/log-retention";
import { startScheduledBackup } from "./utils/scheduled-backup";
import { initializeDatabase } from "./utils/database";
import { setupAuth, isAuthenticated } from "./supabaseAuth";
import { storage } from "./storage";
import { requestIdMiddleware, pinoHttpMiddleware } from "./middleware/request-id";

export async function createServer() {
  const app = express();

  // Middleware - CORS with secure origin policy
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5000', 'http://127.0.0.1:5000', 'https://*.replit.dev'];
  
  app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin matches allowed patterns
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.includes('*')) {
          // Escape dots and replace * with .* for proper regex matching
          const pattern = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
          return pattern.test(origin);
        }
        return origin === allowed;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.error(`CORS blocked origin: ${origin}, allowed: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request ID and Pino HTTP logging middleware
  app.use(requestIdMiddleware);
  app.use(pinoHttpMiddleware);

  // Request tracking middleware
  app.use((req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function (data) {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      trackRequest(req.path, success, responseTime);
      
      if (!success && res.statusCode >= 400) {
        trackError(req.path, data?.toString() || 'Unknown error', res.statusCode);
      }

      return originalSend.call(this, data);
    };

    next();
  });

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
  
  // Admin analytics routes - Protected with authentication
  app.get("/api/admin/analytics/overview", isAuthenticated, getAnalyticsOverview);
  app.get("/api/admin/analytics/storage", isAuthenticated, getStorageAnalytics);

  // Admin health routes - Protected with authentication
  app.get("/api/admin/health", isAuthenticated, handleGetSystemHealth);
  app.get("/api/admin/health/endpoints", isAuthenticated, handleGetEndpointMetrics);
  app.get("/api/admin/health/errors", isAuthenticated, handleGetRecentErrors);
  app.post("/api/admin/health/reset", isAuthenticated, handleResetMetrics);

  // Admin log routes - Protected with authentication
  app.get("/api/admin/logs", isAuthenticated, handleGetLogs);
  app.get("/api/admin/logs/stats", isAuthenticated, handleGetLogStats);
  app.delete("/api/admin/logs", isAuthenticated, handleClearLogs);
  app.post("/api/admin/logs/export", isAuthenticated, handleExportLogs);

  // Admin backup routes - Protected with authentication
  app.get("/api/admin/backup/export", isAuthenticated, handleExportBackup);
  app.get("/api/admin/backup/info", isAuthenticated, handleBackupInfo);
  app.post("/api/admin/backup/verify", isAuthenticated, handleVerifyBackup);

  // Webhook routes - Protected with authentication
  app.use("/api/admin/webhooks", isAuthenticated, webhooksRouter);

  // Initialize database schemas on server startup
  initializeDatabase().catch((error) => {
    console.error("❌ Failed to initialize database:", error);
  });

  // Start background refresh on server startup (non-blocking)
  // Schedule it to run after a short delay to not interfere with first request
  setTimeout(() => {
    startBackgroundRefresh();
  }, 1000);

  // Start log retention cleanup (runs daily)
  setTimeout(() => {
    startLogRetentionCleanup();
  }, 2000);

  // Start scheduled backup (runs every 24 hours by default)
  setTimeout(() => {
    startScheduledBackup();
  }, 3000);

  return app;
}
