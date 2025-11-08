import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Video } from "@shared/api";
import { ArrowLeft, Play, Volume2, Maximize } from "lucide-react";
import { toast } from "sonner";

export default function VideoPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/videos/${id}`);
        
        if (!response.ok) {
          toast.error("Failed to load video");
          throw new Error("Video not found");
        }
        
        const data = await response.json();
        setVideo(data);
      } catch (error) {
        console.error("Error fetching video:", error);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchVideo();
    }
  }, [id, navigate]);

  // Load saved progress and setup progress tracking
  useEffect(() => {
    if (!video || !videoRef.current) return;

    const videoElement = videoRef.current;

    // Load saved progress
    const saved = localStorage.getItem(`video-progress-${video.id}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.currentTime && data.currentTime > 5 && data.currentTime < video.duration - 10) {
          videoElement.currentTime = data.currentTime;
          toast.info(`Resuming from ${Math.floor(data.currentTime / 60)}:${String(Math.floor(data.currentTime % 60)).padStart(2, "0")}`);
        }
      } catch (e) {
        console.error("Error loading progress:", e);
      }
    }

    // Save progress periodically
    const saveProgress = () => {
      if (videoElement.currentTime > 0) {
        localStorage.setItem(
          `video-progress-${video.id}`,
          JSON.stringify({
            currentTime: videoElement.currentTime,
            duration: video.duration,
            lastWatched: new Date().toISOString(),
          })
        );
      }
    };

    // Save progress every 5 seconds
    const interval = setInterval(saveProgress, 5000);

    // Save on pause and ended
    videoElement.addEventListener("pause", saveProgress);
    videoElement.addEventListener("ended", () => {
      // Clear progress when video ends
      localStorage.removeItem(`video-progress-${video.id}`);
    });

    return () => {
      clearInterval(interval);
      saveProgress(); // Save on unmount
      videoElement.removeEventListener("pause", saveProgress);
    };
  }, [video]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin mb-4">
            <Play className="w-12 h-12 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading video...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-primary hover:text-primary/80 mb-6 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <p className="text-muted-foreground">Video not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-foreground">VideoHub</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-xl bg-black aspect-video mb-6 group">
            <video
              ref={videoRef}
              src={`/api/videos/${video.id}/stream`}
              controls
              className="w-full h-full"
              poster={video.poster || video.thumbnail}
              preload="metadata"
              onError={(e) => {
                const errorCode = videoRef.current?.error?.code;
                const errorMessages: Record<number, string> = {
                  1: "Loading aborted",
                  2: "Network error",
                  3: "Decoding failed",
                  4: "Video format not supported",
                };
                const errorMsg = errorMessages[errorCode || 0] || "Video playback failed";
                console.error("Video playback error:", errorMsg, e);
                toast.error(errorMsg);
              }}
              onLoadedMetadata={() => {
                toast.success("Video loaded successfully");
              }}
            >
              Your browser does not support video playback.
            </video>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-4">
                {video.title}
              </h1>

              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                {video.views !== undefined && (
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    <span>{video.views.toLocaleString()} views</span>
                  </div>
                )}

                {video.created_at && (
                  <span>
                    {new Date(video.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                )}

                {video.duration > 0 && (
                  <span>
                    {Math.floor(video.duration / 60)}:
                    {String(video.duration % 60).padStart(2, "0")}
                  </span>
                )}

                {video.size && (
                  <span>{(video.size / (1024 * 1024)).toFixed(2)} MB</span>
                )}
              </div>
            </div>

            {video.description && (
              <div className="border-t border-border pt-6">
                <h2 className="text-lg font-semibold mb-3 text-foreground">
                  Description
                </h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {video.description}
                </p>
              </div>
            )}

            <div className="border-t border-border pt-6">
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Videos
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
