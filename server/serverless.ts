import "dotenv/config";
import serverless from "serverless-http";
import { createServer } from "./index";
import type { Handler } from "aws-lambda";

console.log("[serverless] Loading serverless function");
console.log(
  "[serverless] UPNSHARE_API_TOKEN:",
  process.env.UPNSHARE_API_TOKEN
    ? process.env.UPNSHARE_API_TOKEN.substring(0, 5) + "..."
    : "NOT SET",
);

// Initialize app once for serverless environment
let handler: Handler | null = null;

async function getHandler(): Promise<Handler> {
  if (!handler) {
    const app = await createServer();
    handler = serverless(app);
  }
  return handler;
}

// Export handler that lazily initializes the app
export default async (event: any, context: any, callback?: any) => {
  const h = await getHandler();
  return h(event, context, callback || (() => {}));
};
