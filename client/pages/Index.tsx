import { useEffect, useState } from "react";
import { VideosResponse, Video, VideoFolder } from "@shared/api";
import { VideoCard } from "@/components/VideoCard";
import { Loader2, AlertCircle } from "lucide-react";

export default function Index() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [folders, setFolders] = useState<VideoFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/videos");

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as VideosResponse;
      setVideos(data.videos);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred while fetching videos";
      setError(errorMessage);
      console.error("Error fetching videos:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">▶</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              VideoHub
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {error && (
          <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-gap gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive mb-1">Error Loading Videos</h3>
              <p className="text-sm text-destructive/80">{error}</p>
              <button
                onClick={fetchVideos}
                className="mt-3 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-24">
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-secondary rounded-lg">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No Videos Found</h2>
            <p className="text-muted-foreground mb-6">
              No videos are available in the folders yet.
            </p>
            <button
              onClick={fetchVideos}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">All Videos</h2>
              <p className="text-muted-foreground">
                {videos.length} video{videos.length !== 1 ? "s" : ""} available
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-16 py-8 bg-secondary/30">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>&copy; 2024 VideoHub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
