import { createServer } from "./index";

// Async initialization for Replit Auth
async function startServer() {
  const app = await createServer();
  const port = process.env.PORT || 3000;

  // VPS backend serves API only (frontend is served by Vercel)
  app.listen(port, () => {
    console.log(`🚀 VideoHub API server running on port ${port}`);
    console.log(`🔧 API: http://localhost:${port}/api`);
    console.log(`📍 Mode: VPS Backend (API-only)`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
