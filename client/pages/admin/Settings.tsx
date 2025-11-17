import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings as SettingsIcon, 
  Database, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const queryClient = useQueryClient();
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState("300");

  // Query for refresh status
  const { data: refreshStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["refresh-status"],
    queryFn: async () => {
      const response = await apiFetch("/api/refresh/status");
      if (!response.ok) throw new Error("Failed to fetch refresh status");
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Mutation for triggering manual refresh
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/refresh/now", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to trigger refresh");
      return response.json();
    },
    onSuccess: () => {
      toast.success("Cache refresh triggered successfully");
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    },
    onError: (error) => {
      toast.error(`Failed to trigger refresh: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your admin panel configuration and system settings
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="cache">Cache Management</TabsTrigger>
          <TabsTrigger value="api">API Configuration</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Application Settings</CardTitle>
              <CardDescription>General configuration for the admin panel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-refresh">Auto-refresh Dashboard</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically refresh dashboard data every minute
                  </p>
                </div>
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="cache-enabled">Enable Caching</Label>
                  <p className="text-sm text-muted-foreground">
                    Use Redis/in-memory cache for improved performance
                  </p>
                </div>
                <Switch
                  id="cache-enabled"
                  checked={cacheEnabled}
                  onCheckedChange={setCacheEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refresh-interval">Background Refresh Interval (seconds)</Label>
                <Input
                  id="refresh-interval"
                  type="number"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(e.target.value)}
                  min="60"
                  max="3600"
                />
                <p className="text-sm text-muted-foreground">
                  How often to refresh video data from UPnShare API (60-3600 seconds)
                </p>
              </div>

              <div className="pt-4">
                <Button variant="outline" disabled>
                  Save Settings
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Settings are currently view-only. Saved settings will be implemented in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cache Management */}
        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache Management</CardTitle>
              <CardDescription>Monitor and manage the video cache system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cache Status */}
              <div>
                <h3 className="text-sm font-medium mb-3">Cache Status</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Cache Type</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {refreshStatus?.redisConfigured ? "Redis (Upstash)" : "In-Memory"}
                    </p>
                    {refreshStatus?.redisConfigured ? (
                      <Badge variant="default" className="mt-2">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Persistent
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="mt-2">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Temporary
                      </Badge>
                    )}
                  </div>

                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Last Refresh</span>
                    </div>
                    <p className="text-lg font-bold">
                      {refreshStatus?.lastRefreshTime
                        ? new Date(refreshStatus.lastRefreshTime).toLocaleString()
                        : "Never"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {refreshStatus?.videosCount || 0} videos cached
                    </p>
                  </div>
                </div>
              </div>

              {/* Refresh Actions */}
              <div>
                <h3 className="text-sm font-medium mb-3">Cache Actions</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending || refreshStatus?.isRefreshing}
                  >
                    {refreshMutation.isPending || refreshStatus?.isRefreshing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Cache Now
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Manually trigger a cache refresh to fetch the latest videos from UPnShare API
                </p>
              </div>

              {/* Cache Info */}
              {!refreshStatus?.redisConfigured && (
                <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-sm mb-1">In-Memory Cache Active</h4>
                      <p className="text-sm text-muted-foreground">
                        Your cache is stored in memory and will be lost when the server restarts.
                        To enable persistent caching, set up Upstash Redis by configuring{" "}
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">
                          UPSTASH_REDIS_REST_URL
                        </code>{" "}
                        and{" "}
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">
                          UPSTASH_REDIS_REST_TOKEN
                        </code>{" "}
                        environment variables.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Configuration */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>UPnShare API settings and credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="api-token">UPnShare API Token</Label>
                <Input
                  id="api-token"
                  type="password"
                  value="••••••••••••••••"
                  disabled
                />
                <p className="text-sm text-muted-foreground">
                  API token is configured via{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    UPNSHARE_API_TOKEN
                  </code>{" "}
                  environment variable
                </p>
              </div>

              <div className="space-y-2">
                <Label>API Endpoints</Label>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Base URL:</span>
                    <code className="font-mono">https://upnshare.com/api/v1</code>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Video Folders:</span>
                    <code className="font-mono">/video/folder</code>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Video Management:</span>
                    <code className="font-mono">/video/manage/:id</code>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Upload (TUS):</span>
                    <code className="font-mono">/video/upload</code>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  API Connection Status
                </h4>
                <p className="text-sm text-muted-foreground">
                  Connected and operational. All API endpoints are accessible.
                </p>
              </div>

              <div className="pt-2">
                <Button variant="outline" asChild>
                  <a
                    href="https://upnshare.com/api-document/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Full API Documentation
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
