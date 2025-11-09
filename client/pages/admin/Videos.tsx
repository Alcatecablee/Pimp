import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { Video, VideosResponse } from "@shared/api";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsHelp } from "@/components/admin/KeyboardShortcutsHelp";
import { VideoTableSkeleton } from "@/components/admin/VideoTableSkeleton";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
  MoveRight,
  FileDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  exportVideosToCSV,
  exportVideosToJSON,
} from "@/utils/exportUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [videoToRename, setVideoToRename] = useState<Video | null>(null);
  const [newVideoName, setNewVideoName] = useState("");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState("");
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const ITEMS_PER_PAGE = 20;
  const searchInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<VideosResponse>({
    queryKey: ["videos"],
    queryFn: async () => {
      const response = await fetch("/api/videos");
      if (!response.ok) throw new Error("Failed to fetch videos");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete video");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success("Video deleted successfully");
      setDeleteDialogOpen(false);
      setVideoToDelete(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete video: ${error.message}`);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ videoId, name }: { videoId: string; name: string }) => {
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Failed to rename video");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success("Video renamed successfully");
      setRenameDialogOpen(false);
      setVideoToRename(null);
      setNewVideoName("");
    },
    onError: (error) => {
      toast.error(`Failed to rename video: ${error.message}`);
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ videoIds, folderId }: { videoIds: string[]; folderId: string }) => {
      const response = await fetch("/api/admin/videos/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds, folderId }),
      });
      if (!response.ok) throw new Error("Failed to move videos");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success("Videos moved successfully");
      setMoveDialogOpen(false);
      setSelectedVideos(new Set());
      setTargetFolderId("");
    },
    onError: (error) => {
      toast.error(`Failed to move videos: ${error.message}`);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      const response = await fetch("/api/admin/videos/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds }),
      });
      if (!response.ok) throw new Error("Failed to delete videos");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success(`Deleted ${data.successful} videos successfully`);
      if (data.failed > 0) {
        toast.warning(`Failed to delete ${data.failed} videos`);
      }
      setSelectedVideos(new Set());
    },
    onError: (error) => {
      toast.error(`Failed to delete videos: ${error.message}`);
    },
  });

  const handleDelete = (video: Video) => {
    setVideoToDelete(video);
    setDeleteDialogOpen(true);
  };

  const handleRename = (video: Video) => {
    setVideoToRename(video);
    setNewVideoName(video.title || "");
    setRenameDialogOpen(true);
  };

  const handleBulkMove = () => {
    if (selectedVideos.size === 0) {
      toast.error("Please select videos to move");
      return;
    }
    setMoveDialogOpen(true);
  };

  const handleBulkDelete = () => {
    if (selectedVideos.size === 0) {
      toast.error("Please select videos to delete");
      return;
    }
    if (confirm(`Are you sure you want to delete ${selectedVideos.size} videos?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedVideos));
    }
  };

  const toggleVideoSelection = (videoId: string) => {
    const newSelection = new Set(selectedVideos);
    if (newSelection.has(videoId)) {
      newSelection.delete(videoId);
    } else {
      newSelection.add(videoId);
    }
    setSelectedVideos(newSelection);
  };

  const toggleAllVideos = () => {
    if (selectedVideos.size === paginatedVideos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(paginatedVideos.map((v) => v.id)));
    }
  };

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

  const handleExport = (format: "csv" | "json") => {
    const videosToExport = selectedVideos.size > 0
      ? filteredAndSortedVideos.filter(v => selectedVideos.has(v.id))
      : filteredAndSortedVideos;

    if (format === "csv") {
      exportVideosToCSV(videosToExport);
      toast.success(`Exported ${videosToExport.length} videos to CSV`);
    } else {
      exportVideosToJSON(videosToExport);
      toast.success(`Exported ${videosToExport.length} videos to JSON`);
    }
  };

  useKeyboardShortcuts([
    {
      key: "/",
      description: "Focus search",
      action: () => searchInputRef.current?.focus(),
    },
    {
      key: "r",
      description: "Refresh videos",
      action: () => {
        queryClient.invalidateQueries({ queryKey: ["videos"] });
        toast.success("Videos refreshed");
      },
    },
    {
      key: "e",
      ctrl: true,
      description: "Export videos (CSV)",
      action: () => handleExport("csv"),
    },
    {
      key: "?",
      shift: true,
      description: "Show keyboard shortcuts",
      action: () => setShortcutsHelpOpen(true),
    },
    {
      key: "Escape",
      description: "Close dialogs",
      action: () => {
        setDeleteDialogOpen(false);
        setRenameDialogOpen(false);
        setMoveDialogOpen(false);
        setShortcutsHelpOpen(false);
      },
    },
  ]);

  const keyboardShortcuts = [
    { key: "/", description: "Focus search" },
    { key: "R", description: "Refresh videos" },
    { key: "E", ctrl: true, description: "Export videos (CSV)" },
    { key: "?", shift: true, description: "Show keyboard shortcuts" },
    { key: "ESC", description: "Close dialogs" },
  ];

  if (isLoading) {
    return <VideoTableSkeleton />;
  }

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
    <div className="space-y-6" role="main" aria-label="Video Management">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Video Management</h1>
          <p className="text-muted-foreground mt-1" aria-live="polite">
            {filteredAndSortedVideos.length} videos total
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Export videos">
              <FileDown className="h-4 w-4 mr-2" aria-hidden="true" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("csv")}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("json")}>
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {selectedVideos.size > 0 && (
        <Card className="p-4 bg-muted" role="status" aria-live="polite" aria-label={`${selectedVideos.size} video${selectedVideos.size > 1 ? 's' : ''} selected`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {selectedVideos.size} video{selectedVideos.size > 1 ? "s" : ""} selected
            </p>
            <div className="flex gap-2" role="toolbar" aria-label="Bulk actions">
              <Button variant="outline" size="sm" onClick={handleBulkMove} aria-label="Move selected videos to folder">
                <MoveRight className="h-4 w-4 mr-2" aria-hidden="true" />
                Move to Folder
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} aria-label="Delete selected videos">
                <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                Delete Selected
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4" role="search" aria-label="Search and filter videos">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={searchInputRef}
              placeholder="Search videos... (press / to focus)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
              aria-label="Search videos"
              type="search"
            />
          </div>

          <Select
            value={selectedFolder}
            onValueChange={(value) => {
              setSelectedFolder(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-[200px]" aria-label="Filter by folder">
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

      <Card role="region" aria-label="Videos table">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedVideos.size === paginatedVideos.length && paginatedVideos.length > 0}
                    onCheckedChange={toggleAllVideos}
                    aria-label="Select all videos on this page"
                  />
                </TableHead>
                <TableHead className="w-[50px]" aria-label="Thumbnail"></TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("title")}
                    className="h-8 px-2"
                    aria-label={`Sort by title ${sortField === "title" ? (sortOrder === "asc" ? "ascending" : "descending") : ""}`}
                  >
                    Title
                    <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </TableHead>
                <TableHead>Folder</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("duration")}
                    className="h-8 px-2"
                    aria-label={`Sort by duration ${sortField === "duration" ? (sortOrder === "asc" ? "ascending" : "descending") : ""}`}
                  >
                    Duration
                    <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("size")}
                    className="h-8 px-2"
                    aria-label={`Sort by size ${sortField === "size" ? (sortOrder === "asc" ? "ascending" : "descending") : ""}`}
                  >
                    Size
                    <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("created_at")}
                    className="h-8 px-2"
                    aria-label={`Sort by created date ${sortField === "created_at" ? (sortOrder === "asc" ? "ascending" : "descending") : ""}`}
                  >
                    Created
                    <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </TableHead>
                <TableHead className="text-right" aria-label="Actions">Actions</TableHead>
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
                      <Checkbox
                        checked={selectedVideos.has(video.id)}
                        onCheckedChange={() => toggleVideoSelection(video.id)}
                        aria-label={`Select video ${video.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      {video.poster && (
                        <img
                          src={video.poster}
                          alt={`Thumbnail for ${video.title}`}
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
                        <FolderOpen className="h-3 w-3" aria-hidden="true" />
                        {getFolderName(video.folder_id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        {formatDuration(video.duration)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <HardDrive className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        {formatBytes(video.size || 0)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {video.created_at ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
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
                          aria-label={`View video ${video.title}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRename(video)}
                          aria-label={`Rename video ${video.title}`}
                        >
                          <Edit className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(video)}
                          aria-label={`Delete video ${video.title}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{videoToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => videoToDelete && deleteMutation.mutate(videoToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Video</DialogTitle>
            <DialogDescription>
              Enter a new name for this video
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="videoName">Video Name</Label>
              <Input
                id="videoName"
                value={newVideoName}
                onChange={(e) => setNewVideoName(e.target.value)}
                placeholder="Enter video name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (videoToRename) {
                  renameMutation.mutate({ videoId: videoToRename.id, name: newVideoName });
                }
              }}
              disabled={!newVideoName.trim() || renameMutation.isPending}
            >
              {renameMutation.isPending ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to Folder Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Videos to Folder</DialogTitle>
            <DialogDescription>
              Select a folder to move {selectedVideos.size} video{selectedVideos.size > 1 ? "s" : ""} to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="targetFolder">Target Folder</Label>
              <Select value={targetFolderId} onValueChange={setTargetFolderId}>
                <SelectTrigger id="targetFolder">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {data?.folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (targetFolderId) {
                  moveMutation.mutate({
                    videoIds: Array.from(selectedVideos),
                    folderId: targetFolderId,
                  });
                }
              }}
              disabled={!targetFolderId || moveMutation.isPending}
            >
              {moveMutation.isPending ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        open={shortcutsHelpOpen}
        onOpenChange={setShortcutsHelpOpen}
        shortcuts={keyboardShortcuts}
      />
    </div>
  );
}
