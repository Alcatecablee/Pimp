import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Webhook,
  Link,
  Trash2,
  Edit,
  Plus,
  TestTube,
  CheckCircle2,
  XCircle,
  Activity,
} from "lucide-react";
import type { WebhookConfig, WebhooksResponse } from "@shared/api";

export default function Webhooks() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);

  const { data, isLoading, error } = useQuery<WebhooksResponse>({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const response = await apiFetch("/api/admin/webhooks");
      if (!response.ok) throw new Error("Failed to fetch webhooks");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (webhookData: Partial<WebhookConfig>) => {
      const response = await apiFetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookData),
      });
      if (!response.ok) throw new Error("Failed to create webhook");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setCreateDialogOpen(false);
      toast.success("Webhook created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create webhook: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WebhookConfig> }) => {
      const response = await apiFetch(`/api/admin/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update webhook");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setEditDialogOpen(false);
      toast.success("Webhook updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update webhook: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/admin/webhooks/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete webhook");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setDeleteDialogOpen(false);
      setSelectedWebhook(null);
      toast.success("Webhook deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete webhook: ${error.message}`);
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/admin/webhooks/${id}/test`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to test webhook");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Test webhook sent successfully");
      } else {
        toast.error(`Test webhook failed: ${data.message}`);
      }
    },
    onError: (error) => {
      toast.error(`Failed to test webhook: ${error.message}`);
    },
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">Failed to load webhooks</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["webhooks"] })}>
          Try Again
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6">Loading webhooks...</div>;
  }

  return (
    <div className="space-y-6" role="main" aria-label="Webhooks Management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" id="page-title">Webhooks</h1>
          <p className="text-muted-foreground" id="page-description">
            Manage webhook integrations for external services
          </p>
        </div>
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          aria-label="Create new webhook"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create Webhook
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3" role="region" aria-label="Webhook statistics">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Webhooks</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" aria-label={`${data?.total || 0} total webhooks`}>
              {data?.total || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" aria-label={`${data?.webhooks.filter((w) => w.active).length || 0} active webhooks`}>
              {data?.webhooks.filter((w) => w.active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" aria-label={`${data?.webhooks.filter((w) => !w.active).length || 0} inactive webhooks`}>
              {data?.webhooks.filter((w) => !w.active).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhooks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Webhooks</CardTitle>
          <CardDescription>
            Webhooks will be triggered when specific events occur in your application
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.webhooks.length === 0 ? (
            <div className="text-center py-12">
              <Webhook className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No webhooks configured</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get started by creating your first webhook
              </p>
              <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Webhook
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <a
                        href={webhook.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-sm hover:underline"
                      >
                        <Link className="mr-1 h-3 w-3" />
                        {webhook.url}
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.slice(0, 2).map((event) => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                        {webhook.events.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{webhook.events.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.active ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => testMutation.mutate(webhook.id!)}
                          title="Test webhook"
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedWebhook(webhook);
                            setEditDialogOpen(true);
                          }}
                          title="Edit webhook"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedWebhook(webhook);
                            setDeleteDialogOpen(true);
                          }}
                          title="Delete webhook"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <WebhookFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        title="Create Webhook"
        description="Configure a new webhook to receive notifications about events"
      />

      {/* Edit Dialog */}
      {selectedWebhook && (
        <WebhookFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSubmit={(data) => updateMutation.mutate({ id: selectedWebhook.id!, data })}
          title="Edit Webhook"
          description="Update webhook configuration"
          initialData={selectedWebhook}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedWebhook?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedWebhook && deleteMutation.mutate(selectedWebhook.id!)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Webhook Form Dialog Component
function WebhookFormDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  description,
  initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<WebhookConfig>) => void;
  title: string;
  description: string;
  initialData?: WebhookConfig;
}) {
  const [formData, setFormData] = useState<Partial<WebhookConfig>>(
    initialData || {
      name: "",
      url: "",
      events: [],
      active: true,
      description: "",
      retryCount: 3,
    }
  );

  const availableEvents = [
    "video.uploaded",
    "video.deleted",
    "video.updated",
    "folder.created",
    "folder.deleted",
    "folder.updated",
    "analytics.milestone",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const toggleEvent = (event: string) => {
    const events = formData.events || [];
    if (events.includes(event)) {
      setFormData({ ...formData, events: events.filter((e) => e !== event) });
    } else {
      setFormData({ ...formData, events: [...events, event] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Webhook"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL *</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com/webhook"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label>Events *</Label>
            <div className="grid grid-cols-2 gap-2">
              {availableEvents.map((event) => (
                <div key={event} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`event-${event}`}
                    checked={formData.events?.includes(event) || false}
                    onChange={() => toggleEvent(event)}
                    className="rounded"
                  />
                  <Label htmlFor={`event-${event}`} className="text-sm font-normal cursor-pointer">
                    {event}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
            />
            <Label htmlFor="active">Active</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="retryCount">Retry Count</Label>
            <Input
              id="retryCount"
              type="number"
              min="0"
              max="10"
              value={formData.retryCount}
              onChange={(e) => setFormData({ ...formData, retryCount: parseInt(e.target.value) })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name || !formData.url || formData.events?.length === 0}>
              {initialData ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
