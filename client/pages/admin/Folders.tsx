import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-config";
import {
  Folder,
  Plus,
  Edit,
  Trash2,
  HardDrive,
  Video as VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface FolderData {
  id: string;
  name: string;
  videoCount: number;
  totalSize: number;
}

interface FolderStats {
  folders: FolderData[];
  totalFolders: number;
  totalVideos: number;
  totalStorage: number;
}

export default function Folders() {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderData | null>(null);
  const [folderToRename, setFolderToRename] = useState<FolderData | null>(null);
  const [newFolderName, setNewFolderName] = useState("");

  const { data, isLoading, error } = useQuery<FolderStats>({
    queryKey: ["admin", "folders"],
    queryFn: async () => {
      const response = await apiFetch("/api/admin/folders");
      if (!response.ok) {
        throw new Error("Failed to fetch folders");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (folderId: string) => {
      const response = await apiFetch(`/api/admin/folders/${folderId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || "Failed to delete folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "folders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      toast.success("Folder deleted successfully");
      setDeleteDialogOpen(false);
      setFolderToDelete(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete folder");
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ folderId, name }: { folderId: string; name: string }) => {
      const response = await apiFetch(`/api/admin/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || "Failed to rename folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "folders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      toast.success("Folder renamed successfully");
      setRenameDialogOpen(false);
      setFolderToRename(null);
      setNewFolderName("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to rename folder");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiFetch("/api/admin/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || "Failed to create folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "folders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      toast.success("Folder created successfully");
      setCreateDialogOpen(false);
      setNewFolderName("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create folder");
    },
  });

  const handleDelete = (folder: FolderData) => {
    setFolderToDelete(folder);
    setDeleteDialogOpen(true);
  };

  const handleRename = (folder: FolderData) => {
    setFolderToRename(folder);
    setNewFolderName(folder.name);
    setRenameDialogOpen(true);
  };

  const handleCreate = () => {
    setNewFolderName("");
    setCreateDialogOpen(true);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
      return `${mb.toFixed(2)} MB`;
    }
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading folders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load folders</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Folder Management</h2>
          <p className="text-muted-foreground mt-1">
            Manage and organize your video folders
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Folder
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Folders</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalFolders || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
            <VideoIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalVideos || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatSize(data?.totalStorage || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Folders</CardTitle>
          <CardDescription>
            {data?.folders.length} folder{data?.folders.length !== 1 ? "s" : ""} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Videos</TableHead>
                <TableHead className="text-right">Storage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.folders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No folders found
                  </TableCell>
                </TableRow>
              ) : (
                data?.folders.map((folder) => (
                  <TableRow key={folder.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{folder.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground">{folder.videoCount}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground">
                        {formatSize(folder.totalSize)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRename(folder)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(folder)}
                          disabled={folder.videoCount > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{folderToDelete?.name}"? This action cannot be undone.
              {folderToDelete?.videoCount ? (
                <span className="block mt-2 text-destructive">
                  This folder contains {folderToDelete.videoCount} video(s). Please move or delete them first.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => folderToDelete && deleteMutation.mutate(folderToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
              disabled={folderToDelete && folderToDelete.videoCount > 0}
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
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for this folder
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (folderToRename) {
                  renameMutation.mutate({ folderId: folderToRename.id, name: newFolderName });
                }
              }}
              disabled={!newFolderName.trim() || renameMutation.isPending}
            >
              {renameMutation.isPending ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newFolderName">Folder Name</Label>
              <Input
                id="newFolderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newFolderName)}
              disabled={!newFolderName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
