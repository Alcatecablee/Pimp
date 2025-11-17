import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-config";

interface AnalyticsOptions {
  videoId: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

export function useAnalytics() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const lastProgressUpdate = useRef<number>(0);
  const analyticsInterval = useRef<NodeJS.Timeout | null>(null);

  const startSession = async (videoId: string) => {
    try {
      const response = await apiFetch("/api/analytics/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });

      if (response.ok) {
        const { sessionId: newSessionId } = await response.json();
        setSessionId(newSessionId);
        console.log("[Analytics] Session started:", newSessionId);
      }
    } catch (error) {
      console.error("[Analytics] Failed to start session:", error);
    }
  };

  const updateProgress = async (options: AnalyticsOptions, event?: string) => {
    if (!sessionId) return;

    // Don't throttle event tracking (pause/seek), only regular progress updates
    const now = Date.now();
    if (!event && now - lastProgressUpdate.current < 1000) return; // Throttle to 1s
    if (!event) lastProgressUpdate.current = now;

    try {
      await apiFetch("/api/analytics/session/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          currentTime: options.currentTime,
          duration: options.duration,
          event,
        }),
      });
    } catch (error) {
      console.error("[Analytics] Failed to update progress:", error);
    }
  };

  const endSession = async () => {
    if (!sessionId) return;

    try {
      await apiFetch("/api/analytics/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      console.log("[Analytics] Session ended:", sessionId);
      setSessionId(null);
    } catch (error) {
      console.error("[Analytics] Failed to end session:", error);
    }
  };

  // TODO: Listen for iframe Paused/Seeked messages to capture externally-induced events
  const trackSeek = (options: AnalyticsOptions) => {
    updateProgress(options, "seek");
    console.log("[Analytics] Seek event tracked");
  };

  const trackPause = (options: AnalyticsOptions) => {
    updateProgress(options, "pause");
    console.log("[Analytics] Pause event tracked");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analyticsInterval.current) {
        clearInterval(analyticsInterval.current);
      }
      if (sessionId) {
        endSession();
      }
    };
  }, [sessionId]);

  return {
    sessionId,
    startSession,
    updateProgress,
    endSession,
    trackSeek,
    trackPause,
  };
}
