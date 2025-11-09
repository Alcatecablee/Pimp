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
import { startBackgroundRefresh } from "./utils/background-refresh";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping pong";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

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

  // Start background refresh on server startup (non-blocking)
  // Schedule it to run after a short delay to not interfere with first request
  setTimeout(() => {
    startBackgroundRefresh();
  }, 1000);

  return app;
}
