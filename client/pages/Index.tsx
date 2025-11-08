import { useEffect, useState, useMemo } from "react";
import { VideosResponse, Video, VideoFolder } from "@shared/api";
import { VideoCard } from "@/components/VideoCard";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Index() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [folders, setFolders] = useState<VideoFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Default to closed on mobile, open on desktop
    return window.innerWidth >= 1024;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1500;
    const REQUEST_TIMEOUT = 20000; // 20 seconds - gives server 15s + 5s buffer

    try {
      if (retryCount === 0) {
        setLoading(true);
        setError(null);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch("/api/videos", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          try {
            const text = await response.text();
            if (text) errorMessage = text.substring(0, 200);
          } catch {}
        }
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as VideosResponse;
      setVideos(data.videos);
      setFolders(data.folders);
      toast.success(`Loaded ${data.videos.length} videos successfully`);
      setLoading(false);
    } catch (err) {
      const isAbortError =
        err instanceof Error &&
        (err.name === "AbortError" ||
          err.message.includes("aborted") ||
          err.message.includes("timeout") ||
          err.message.includes("fetch"));

      if (retryCount < MAX_RETRIES && isAbortError) {
        const retryNum = retryCount + 1;
        toast.info(
          `Connection issue, retrying... (${retryNum}/${MAX_RETRIES})`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * retryNum),
        ); // Increase delay with each retry
        return fetchVideos(retryCount + 1);
      }

      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while fetching videos";
      setError(errorMessage);
      setLoading(false);
      toast.error(errorMessage);
      console.error("Error fetching videos:", err);
    }
  };

  const filteredVideos = useMemo(() => {
    let filtered = videos;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (video) =>
          video.title.toLowerCase().includes(query) ||
          video.description?.toLowerCase().includes(query),
      );
    }

    if (selectedFolder !== "all") {
      filtered = filtered.filter((video) => video.folder_id === selectedFolder);
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
  }, [videos, searchQuery, selectedFolder]);

  const getFolderById = (folderId: string) => {
    return folders.find((f) => f.id === folderId);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f0f]">
      <Header
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex">
        <Sidebar
          isOpen={sidebarOpen}
          folders={folders}
          selectedFolder={selectedFolder}
          onFolderSelect={setSelectedFolder}
          onClose={() => setSidebarOpen(false)}
        />

        <main
          className={cn(
            "flex-1 transition-all duration-300 pt-6",
            sidebarOpen ? "lg:ml-60" : "lg:ml-[72px]",
          )}
        >
          <div className="px-6 max-w-[2000px] mx-auto">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1">
                    Error Loading Videos
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {error}
                  </p>
                  <button
                    onClick={() => fetchVideos()}
                    className="mt-3 text-sm font-medium text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {[...Array(15)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="w-full aspect-video bg-gray-200 dark:bg-gray-800 rounded-xl mb-3" />
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
                  <AlertCircle className="w-16 h-16 text-gray-400 dark:text-gray-600" />
                </div>
                <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                  {searchQuery || selectedFolder !== "all"
                    ? "No videos found"
                    : "No videos available"}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-center max-w-md">
                  {searchQuery || selectedFolder !== "all"
                    ? "Try adjusting your search or filters"
                    : "No videos have been uploaded yet"}
                </p>
                {(searchQuery || selectedFolder !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedFolder("all");
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Filter Info */}
                {(searchQuery || selectedFolder !== "all") && (
                  <div className="mb-6 flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {filteredVideos.length}{" "}
                      {filteredVideos.length === 1 ? "result" : "results"}
                      {searchQuery && ` for "${searchQuery}"`}
                      {selectedFolder !== "all" &&
                        ` in ${getFolderById(selectedFolder)?.name}`}
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedFolder("all");
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {/* Video Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8">
                  {filteredVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      folder={getFolderById(video.folder_id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
