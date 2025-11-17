import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-config";
import { Loader2, RefreshCw, Video, FolderOpen, HardDrive, Users, FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsHelp } from "@/components/admin/KeyboardShortcutsHelp";
import { DashboardSkeleton } from "@/components/admin/DashboardSkeleton";
import {
  exportAnalyticsToCSV,
  exportAnalyticsToJSON,
  exportFolderBreakdownToCSV,
  AdminOverview as IAdminOverview,
} from "@/utils/exportUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AdminOverview = IAdminOverview;

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export default function AdminDashboard() {
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<AdminOverview>({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const response = await apiFetch("/api/admin/overview");
      if (!response.ok) {
        throw new Error("Failed to fetch admin overview");
      }
      return response.json();
    },
    refetchInterval: 60000,
  });

  const handleExport = (format: "csv" | "json", type: "overview" | "folders") => {
    if (!data) return;

    if (type === "overview") {
      if (format === "csv") {
        exportAnalyticsToCSV(data);
        toast.success("Analytics exported to CSV");
      } else {
        exportAnalyticsToJSON(data);
        toast.success("Analytics exported to JSON");
      }
    } else {
      exportFolderBreakdownToCSV(data.folderBreakdown);
      toast.success("Folder breakdown exported to CSV");
    }
  };

  useKeyboardShortcuts([
    {
      key: "r",
      description: "Refresh dashboard",
      action: () => {
        refetch();
        toast.success("Dashboard refreshed");
      },
    },
    {
      key: "e",
      ctrl: true,
      description: "Export overview (CSV)",
      action: () => handleExport("csv", "overview"),
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
      action: () => setShortcutsHelpOpen(false),
    },
  ]);

  const keyboardShortcuts = [
    { key: "R", description: "Refresh dashboard" },
    { key: "E", ctrl: true, description: "Export overview (CSV)" },
    { key: "?", shift: true, description: "Show keyboard shortcuts" },
    { key: "ESC", description: "Close dialogs" },
  ];

  useEffect(() => {
    if (data) {
      console.log("Admin overview data loaded:", data);
    }
  }, [data]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">Failed to load admin dashboard</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6" role="main" aria-label="Admin Dashboard">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            Your video management dashboard
          </p>
        </div>
        <div className="flex gap-2" role="toolbar" aria-label="Dashboard actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Export dashboard data">
                <FileDown className="h-4 w-4 mr-2" aria-hidden="true" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv", "overview")}>
                Export Overview (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json", "overview")}>
                Export Overview (JSON)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv", "folders")}>
                Export Folder Stats (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetch();
              toast.success("Dashboard refreshed");
            }}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Dashboard statistics">
        <Card role="article" aria-labelledby="stat-videos">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle id="stat-videos" className="text-sm font-medium">Total Videos</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" aria-live="polite">{data?.totalVideos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all folders
            </p>
          </CardContent>
        </Card>

        <Card role="article" aria-labelledby="stat-folders">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle id="stat-folders" className="text-sm font-medium">Total Folders</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" aria-live="polite">{data?.totalFolders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Video collections
            </p>
          </CardContent>
        </Card>

        <Card role="article" aria-labelledby="stat-storage">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle id="stat-storage" className="text-sm font-medium">Total Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" aria-live="polite">
              {formatBytes(data?.totalStorage || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Video storage used
            </p>
          </CardContent>
        </Card>

        <Card role="article" aria-labelledby="stat-viewers">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle id="stat-viewers" className="text-sm font-medium">Active Viewers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" aria-live="polite">{data?.activeViewers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently watching
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Folder Breakdown */}
      <Card role="region" aria-labelledby="folder-breakdown-title">
        <CardHeader>
          <CardTitle id="folder-breakdown-title">Videos by Folder</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4" role="list">
            {data?.folderBreakdown.map((folder) => (
              <li
                key={folder.folderId}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="font-medium">{folder.folderName}</p>
                    <p className="text-sm text-muted-foreground">
                      {folder.videoCount} videos
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatBytes(folder.totalSize)}</p>
                  <p className="text-xs text-muted-foreground">storage</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Cache Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Hit Rate</p>
              <p className="text-2xl font-bold">
                {data?.cacheMetrics.hitRate.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold">
                {data?.cacheMetrics.totalRequests.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cache Hits</p>
              <p className="text-2xl font-bold">
                {data?.cacheMetrics.cacheHits.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer info */}
      <div className="text-sm text-muted-foreground text-center">
        Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "N/A"}
      </div>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        open={shortcutsHelpOpen}
        onOpenChange={setShortcutsHelpOpen}
        shortcuts={keyboardShortcuts}
      />
    </div>
  );
}
