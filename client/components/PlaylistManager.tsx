import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Play, List } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Playlist {
  id: string;
  name: string;
  description?: string;
  videoIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface PlaylistManagerProps {
  currentVideoId?: string;
  onPlaylistSelect?: (playlistId: string) => void;
}

export function PlaylistManager({ currentVideoId, onPlaylistSelect }: PlaylistManagerProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  
  const queryClient = useQueryClient();

  // Fetch playlists
  const { data } = useQuery<{ playlists: Playlist[] }>({
    queryKey: ["playlists"],
    queryFn: async () => {
      const response = await apiFetch("/api/playlists");
      if (!response.ok) throw new Error("Failed to fetch playlists");
      return response.json();
    },
  });

  // Create playlist mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; videoIds: string[] }) => {
      const response = await apiFetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create playlist");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Playlist created successfully");
      setCreateDialogOpen(false);
      setNewPlaylistName("");
      setNewPlaylistDescription("");
    },
    onError: (error) => {
      toast.error(`Failed to create playlist: ${error.message}`);
    },
  });

  // Delete playlist mutation
  const deleteMutation = useMutation({
    mutationFn: async (playlistId: string) => {
      const response = await apiFetch(`/api/playlists/${playlistId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete playlist");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Playlist deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete playlist: ${error.message}`);
    },
  });

  // Add current video to playlist
  const addToPlaylistMutation = useMutation({
    mutationFn: async (playlistId: string) => {
      if (!currentVideoId) throw new Error("No video selected");
      const response = await apiFetch(`/api/playlists/${playlistId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: currentVideoId }),
      });
      if (!response.ok) throw new Error("Failed to add video to playlist");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Video added to playlist");
    },
    onError: (error) => {
      toast.error(`Failed to add video: ${error.message}`);
    },
  });

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) {
      toast.error("Please enter a playlist name");
      return;
    }

    createMutation.mutate({
      name: newPlaylistName.trim(),
      description: newPlaylistDescription.trim(),
      videoIds: currentVideoId ? [currentVideoId] : [],
    });
  };

  const playlists = data?.playlists || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <List className="w-5 h-5" />
          Playlists
        </h3>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Playlist
        </Button>
      </div>

      <div className="space-y-2">
        {playlists.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            <p>No playlists yet. Create one to get started!</p>
          </Card>
        ) : (
          playlists.map((playlist) => (
            <Card
              key={playlist.id}
              className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{playlist.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {playlist.videoIds.length} video{playlist.videoIds.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {currentVideoId && !playlist.videoIds.includes(currentVideoId) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addToPlaylistMutation.mutate(playlist.id)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                  )}
                  {onPlaylistSelect && playlist.videoIds.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPlaylistSelect(playlist.id)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Play
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(playlist.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create Playlist Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Playlist</DialogTitle>
            <DialogDescription>
              {currentVideoId
                ? "The current video will be added to this playlist"
                : "Create an empty playlist"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="My Playlist"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={newPlaylistDescription}
                onChange={(e) => setNewPlaylistDescription(e.target.value)}
                placeholder="Description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePlaylist}>Create Playlist</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
