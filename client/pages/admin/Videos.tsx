import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Video, VideosResponse } from "@shared/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Search,
  ArrowUpDown,
  Eye,
  Edit,
  Trash2,
  Loader2,
  FolderOpen,
  Calendar,
  HardDrive,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

type SortField = "title" | "duration" | "size" | "created_at" | "views";
type SortOrder = "asc" | "desc";

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function VideosManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const { data, isLoading, error } = useQuery<VideosResponse>({
    queryKey: ["videos"],
    queryFn: async () => {
      const response = await fetch("/api/videos");
      if (!response.ok) throw new Error("Failed to fetch videos");
      return response.json();
    },
  });

  const filteredAndSortedVideos = useMemo(() => {
    if (!data?.videos) return [];

    let filtered = [...data.videos];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.title?.toLowerCase().includes(query) ||
          v.description?.toLowerCase().includes(query)
      );
    }

    if (selectedFolder !== "all") {
      filtered = filtered.filter((v) => v.folder_id === selectedFolder);
    }

    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case "title":
          aVal = a.title || "";
          bVal = b.title || "";
          break;
        case "duration":
          aVal = a.duration || 0;
          bVal = b.duration || 0;
          break;
        case "size":
          aVal = a.size || 0;
          bVal = b.size || 0;
          break;
        case "created_at":
          aVal = new Date(a.created_at || 0).getTime();
          bVal = new Date(b.created_at || 0).getTime();
          break;
        case "views":
          aVal = a.views || 0;
          bVal = b.views || 0;
          break;
        default:
          return 0;
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [data?.videos, searchQuery, selectedFolder, sortField, sortOrder]);

  const paginatedVideos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredAndSortedVideos.slice(start, end);
  }, [filteredAndSortedVideos, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedVideos.length / ITEMS_PER_PAGE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const getFolderName = (folderId?: string) => {
    if (!folderId || !data?.folders) return "Unknown";
    const folder = data.folders.find((f) => f.id === folderId);
    return folder?.name || "Unknown";
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">Video Management</h2>
        <Card className="p-6">
          <p className="text-destructive">Failed to load videos</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Video Management</h2>
          <p className="text-muted-foreground mt-1">
            {filteredAndSortedVideos.length} videos total
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>

          <Select
            value={selectedFolder}
            onValueChange={(value) => {
              setSelectedFolder(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="All Folders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Folders</SelectItem>
              {data?.folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("title")}
                    className="h-8 px-2"
                  >
                    Title
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Folder</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("duration")}
                    className="h-8 px-2"
                  >
                    Duration
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("size")}
                    className="h-8 px-2"
                  >
                    Size
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("created_at")}
                    className="h-8 px-2"
                  >
                    Created
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : paginatedVideos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No videos found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedVideos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell>
                      {video.poster && (
                        <img
                          src={video.poster}
                          alt={video.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium max-w-md">
                      <div className="truncate">{video.title}</div>
                      {video.description && (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {video.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <FolderOpen className="h-3 w-3" />
                        {getFolderName(video.folder_id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatDuration(video.duration)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <HardDrive className="h-3 w-3 text-muted-foreground" />
                        {formatBytes(video.size || 0)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {video.created_at ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(video.created_at), {
                            addSuffix: true,
                          })}
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/video/${video.id}`, "_blank")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" disabled>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" disabled>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedVideos.length)} of{" "}
              {filteredAndSortedVideos.length} videos
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
