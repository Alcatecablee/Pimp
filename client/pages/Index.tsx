import { useEffect, useState, useMemo } from "react";
import { VideosResponse, Video, VideoFolder, RealtimeResponse } from "@shared/api";
import { VideoCard } from "@/components/VideoCard";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Index() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [folders, setFolders] = useState<VideoFolder[]>([]);
  const [realtimeStats, setRealtimeStats] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Default to closed on mobile, open on desktop
    return window.innerWidth >= 1024;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const VIDEOS_PER_PAGE = 20;

  useEffect(() => {
    fetchVideos();
    fetchRealtimeStats();

    // Poll for realtime stats every 30 seconds
    const interval = setInterval(() => {
      fetchRealtimeStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchRealtimeStats = async () => {
    try {
      const response = await fetch("/api/realtime");
      if (response.ok) {
        const data: RealtimeResponse = await response.json();
        const statsMap = new Map<string, number>();
        data.data?.forEach((item) => {
          if (item.realtime > 0) {
            statsMap.set(item.id, item.realtime);
          }
        });
        setRealtimeStats(statsMap);
      }
    } catch (error) {
      console.error("Error fetching realtime stats:", error);
    }
  };

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

    if (selectedTag) {
      filtered = filtered.filter((video) => video.tags?.includes(selectedTag));
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
  }, [videos, searchQuery, selectedFolder, selectedTag]);

  const paginatedVideos = useMemo(() => {
    const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE;
    const endIndex = startIndex + VIDEOS_PER_PAGE;
    return filteredVideos.slice(startIndex, endIndex);
  }, [filteredVideos, currentPage]);

  const totalPages = Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    videos.forEach((video) => {
      video.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [videos]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFolder, selectedTag]);

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
            ) : (
              <>
                {/* Tags Filter */}
                {allTags.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by tag:</span>
                      <Button
                        variant={selectedTag === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTag(null)}
                        className="rounded-full"
                      >
                        All
                      </Button>
                      {allTags.map((tag) => (
                        <Button
                          key={tag}
                          variant={selectedTag === tag ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedTag(tag)}
                          className="rounded-full"
                        >
                          {tag}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {filteredVideos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24">
                    <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
                      <AlertCircle className="w-16 h-16 text-gray-400 dark:text-gray-600" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                      {searchQuery || selectedFolder !== "all" || selectedTag
                        ? "No videos found"
                        : "No videos available"}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 text-center max-w-md">
                      {searchQuery || selectedFolder !== "all" || selectedTag
                        ? "Try adjusting your search or filters"
                        : "No videos have been uploaded yet"}
                    </p>
                    {(searchQuery || selectedFolder !== "all" || selectedTag) && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedFolder("all");
                          setSelectedTag(null);
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
                    {(searchQuery || selectedFolder !== "all" || selectedTag) && (
                      <div className="mb-6 flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {filteredVideos.length}{" "}
                          {filteredVideos.length === 1 ? "result" : "results"}
                          {searchQuery && ` for "${searchQuery}"`}
                          {selectedFolder !== "all" &&
                            ` in ${getFolderById(selectedFolder)?.name}`}
                          {selectedTag && ` tagged with "${selectedTag}"`}
                        </p>
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedFolder("all");
                            setSelectedTag(null);
                          }}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Clear filters
                        </button>
                      </div>
                    )}

                    {/* Video Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8">
                      {paginatedVideos.map((video) => (
                        <VideoCard
                          key={video.id}
                          video={video}
                          folder={getFolderById(video.folder_id)}
                          liveViewers={realtimeStats.get(video.id)}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-12 flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="rounded-full"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 7) {
                              pageNum = i + 1;
                            } else if (currentPage <= 4) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 3) {
                              pageNum = totalPages - 6 + i;
                            } else {
                              pageNum = currentPage - 3 + i;
                            }

                            return (
                              <Button
                                key={i}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="icon"
                                onClick={() => setCurrentPage(pageNum)}
                                className="rounded-full w-10 h-10"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="rounded-full"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>

                        <span className="ml-4 text-sm text-gray-600 dark:text-gray-400">
                          Page {currentPage} of {totalPages}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
