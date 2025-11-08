import { useEffect, useState, useMemo } from "react";
import { VideosResponse, Video, VideoFolder } from "@shared/api";
import { VideoCard } from "@/components/VideoCard";
import { Loader2, AlertCircle, Search, Filter, SortAsc, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function Index() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [folders, setFolders] = useState<VideoFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "views" | "az">("recent");

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async (retryCount = 0) => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 2000; // 2 seconds
    
    try {
      setLoading(true);
      setError(null);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
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
          // Response is not JSON, try to read as text
          try {
            const text = await response.text();
            if (text) {
              errorMessage = text.substring(0, 200);
            }
          } catch {
            // Fallback to status message
          }
        }
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as VideosResponse;
      setVideos(data.videos);
      setFolders(data.folders);
      toast.success(`Loaded ${data.videos.length} videos successfully`);
    } catch (err) {
      // Retry logic for network errors
      if (retryCount < MAX_RETRIES && err instanceof Error && 
          (err.name === 'AbortError' || err.message.includes('fetch'))) {
        console.log(`Retrying... Attempt ${retryCount + 1} of ${MAX_RETRIES}`);
        toast.info(`Connection issue, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return fetchVideos(retryCount + 1);
      }
      
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while fetching videos";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error fetching videos:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort videos
  const filteredAndSortedVideos = useMemo(() => {
    let filtered = videos;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (video) =>
          video.title.toLowerCase().includes(query) ||
          video.description?.toLowerCase().includes(query),
      );
    }

    // Filter by folder
    if (selectedFolder !== "all") {
      filtered = filtered.filter((video) => video.folder_id === selectedFolder);
    }

    // Sort videos
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return (
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
          );
        case "views":
          return (b.views || 0) - (a.views || 0);
        case "az":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return sorted;
  }, [videos, searchQuery, selectedFolder, sortBy]);

  // Group videos by folder for display
  const videosByFolder = useMemo(() => {
    if (selectedFolder !== "all") {
      return [
        {
          folder: folders.find((f) => f.id === selectedFolder)!,
          videos: filteredAndSortedVideos,
        },
      ];
    }

    return folders
      .map((folder) => ({
        folder,
        videos: filteredAndSortedVideos.filter(
          (v) => v.folder_id === folder.id,
        ),
      }))
      .filter((group) => group.videos.length > 0);
  }, [folders, filteredAndSortedVideos, selectedFolder]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">▶</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">VideoHub</h1>
              <p className="text-xs text-muted-foreground">Video Library</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Search and Filter Controls */}
        {!loading && videos.length > 0 && (
          <div className="mb-8 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search videos by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-12 text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Filters and Sort */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Filter className="w-5 h-5 text-muted-foreground" />
                <Select
                  value={selectedFolder}
                  onValueChange={setSelectedFolder}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All Folders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Folders</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name} (
                        {videos.filter((v) => v.folder_id === folder.id).length}
                        )
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <SortAsc className="w-5 h-5 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="views">Most Viewed</SelectItem>
                    <SelectItem value="az">A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results summary */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Showing {filteredAndSortedVideos.length} of {videos.length}{" "}
                videos
              </p>
              {(searchQuery || selectedFolder !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedFolder("all");
                  }}
                  className="text-primary hover:text-primary/80 font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-gap gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive mb-1">
                Error Loading Videos
              </h3>
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
          <div className="space-y-12">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-8 w-48 mb-6" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="space-y-3">
                      <Skeleton className="aspect-video rounded-lg" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedVideos.length === 0 ? (
          <div className="text-center py-24">
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-secondary rounded-lg">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">
              {searchQuery || selectedFolder !== "all"
                ? "No Results Found"
                : "No Videos Found"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {searchQuery || selectedFolder !== "all"
                ? "Try adjusting your search or filters"
                : "No videos are available in the folders yet."}
            </p>
            {(searchQuery || selectedFolder !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedFolder("all");
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            {videosByFolder.map(({ folder, videos: folderVideos }) => (
              <div key={folder.id}>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">{folder.name}</h2>
                  {folder.description && (
                    <p className="text-muted-foreground">
                      {folder.description}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    {folderVideos.length} video
                    {folderVideos.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {folderVideos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              </div>
            ))}
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
