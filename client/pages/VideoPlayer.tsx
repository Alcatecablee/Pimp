import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Video } from "@shared/api";
import { ArrowLeft, Play, Volume2, Maximize, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import Hls from "hls.js";

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

  // Setup video player with direct MP4 playback
  useEffect(() => {
    if (!video || !videoRef.current) return;

    const videoElement = videoRef.current;

    const initPlayer = () => {
      try {
        // Use direct video stream through our proxy
        if (video.assetUrl && video.assetPath) {
          const mp4Url = `${video.assetUrl}${video.assetPath}/video.mp4`;
          videoElement.src = mp4Url;
          console.log("Loading video from:", mp4Url);
        } else {
          setStreamError("Video source not available");
        }
      } catch (error) {
        console.error("Error initializing video player:", error);
        setStreamError("Failed to load video");
      }
    };

    initPlayer();
  }, [video]);

  // Load saved progress and setup progress tracking
  useEffect(() => {
    if (!video || !videoRef.current) return;

    const videoElement = videoRef.current;

    // Load saved progress
    const saved = localStorage.getItem(`video-progress-${video.id}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (
          data.currentTime &&
          data.currentTime > 5 &&
          data.currentTime < video.duration - 10
        ) {
          videoElement.currentTime = data.currentTime;
          toast.info(
            `Resuming from ${Math.floor(data.currentTime / 60)}:${String(Math.floor(data.currentTime % 60)).padStart(2, "0")}`,
          );
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
          }),
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
            {streamError ? (
              <div className="flex items-center justify-center h-full bg-slate-900">
                <div className="text-center text-white">
                  <div className="mb-4 inline-flex items-center justify-center w-12 h-12 bg-red-500/20 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <p className="font-semibold mb-2">{streamError}</p>
                  <button
                    onClick={() => {
                      setStreamError(null);
                      if (videoRef.current) {
                        videoRef.current.load();
                      }
                    }}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <video
                ref={videoRef}
                controls
                className="w-full h-full"
                poster={video.poster || video.thumbnail}
                preload="metadata"
                onLoadedMetadata={() => {
                  console.log("Video metadata loaded");
                }}
              >
                Your browser does not support video playback.
              </video>
            )}
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
