import { useEffect, useState, useMemo, useCallback } from "react";
import { VideosResponse, Video, VideoFolder, RealtimeResponse } from "@shared/api";
import { VideoCard } from "@/components/VideoCard";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-config";

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function Index() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [folders, setFolders] = useState<VideoFolder[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Default to closed on mobile, open on desktop
    return window.innerWidth >= 1024;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const VIDEOS_PER_PAGE = 20;

  // Fetch all tags on mount
  useEffect(() => {
    fetchTags();
  }, []);

  // Retry tags when videos load successfully but tags are empty
  useEffect(() => {
    if (!loading && videos.length > 0 && allTags.length === 0) {
      console.log('Videos loaded but tags are empty, retrying tags fetch');
      const timer = setTimeout(() => fetchTags(), 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, videos.length, allTags.length]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch videos whenever filters or pagination changes
  useEffect(() => {
    fetchVideos();
  }, [currentPage, selectedFolder, debouncedSearch, selectedTag]);

  useEffect(() => {
    fetchRealtimeStats();

    // Poll for realtime stats every 30 seconds
    const interval = setInterval(() => {
      fetchRealtimeStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchTags = async (retryCount = 0) => {
    const MAX_TAG_RETRIES = 5;
    const TAG_RETRY_DELAY = 2000; // 2 seconds between retries
    
    try {
      const response = await apiFetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        setAllTags(data.tags || []);
        
        // If cache is warming and we have no tags yet, retry
        if (data.cacheWarming && retryCount < MAX_TAG_RETRIES) {
          console.log(`Tags cache warming, will retry in ${TAG_RETRY_DELAY/1000}s (${retryCount + 1}/${MAX_TAG_RETRIES})`);
          setTimeout(() => fetchTags(retryCount + 1), TAG_RETRY_DELAY);
        }
      }
    } catch (error) {
      console.error("Error fetching tags:", error);
      // Retry on error too
      if (retryCount < MAX_TAG_RETRIES) {
        setTimeout(() => fetchTags(retryCount + 1), TAG_RETRY_DELAY);
      }
    }
  };

  const fetchRealtimeStats = async () => {
    try {
      const response = await apiFetch("/api/realtime");
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
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000;
    const REQUEST_TIMEOUT = 10000; // 10 seconds - fast timeout for serverless

    try {
      if (retryCount === 0) {
        setLoading(true);
        setError(null);
      }

      // Build query params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: VIDEOS_PER_PAGE.toString(),
      });
      
      if (selectedFolder !== "all") {
        params.append("folder", selectedFolder);
      }
      
      if (debouncedSearch) {
        params.append("q", debouncedSearch);
      }
      
      if (selectedTag) {
        params.append("tags", selectedTag);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await apiFetch(`/api/videos/paginated?${params}`, {
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

      const data = await response.json();
      setVideos(data.videos);
      setFolders(data.folders || folders); // Keep existing folders if not returned
      setPagination(data.pagination);
      
      if (retryCount === 0) {
        toast.success(`Loaded ${data.videos.length} videos`);
      }
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
        console.log(`Retrying (${retryNum}/${MAX_RETRIES})...`);
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * retryNum),
        );
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFolder, selectedTag]);

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

                {videos.length === 0 && !loading ? (
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
                    {pagination && (searchQuery || selectedFolder !== "all" || selectedTag) && (
                      <div className="mb-6 flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {pagination.total}{" "}
                          {pagination.total === 1 ? "result" : "results"}
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
                      {videos.map((video) => (
                        <VideoCard
                          key={video.id}
                          video={video}
                          folder={getFolderById(video.folder_id)}
                          liveViewers={realtimeStats.get(video.id)}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
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
                          {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (pagination.totalPages <= 7) {
                              pageNum = i + 1;
                            } else if (currentPage <= 4) {
                              pageNum = i + 1;
                            } else if (currentPage >= pagination.totalPages - 3) {
                              pageNum = pagination.totalPages - 6 + i;
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
                          onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                          disabled={currentPage === pagination.totalPages}
                          className="rounded-full"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>

                        <span className="ml-4 text-sm text-gray-600 dark:text-gray-400">
                          Page {currentPage} of {pagination.totalPages}
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
