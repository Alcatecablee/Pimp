import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  Eye, 
  Clock, 
  TrendingUp, 
  Users, 
  Play,
  Loader2,
  HardDrive,
  PieChart as PieChartIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

interface TopVideo {
  videoId: string;
  videoName: string;
  totalViews: number;
  totalWatchTime: number;
  averageWatchTime: number;
  completionRate: number;
}

interface AnalyticsTrend {
  date: string;
  views: number;
  watchTime: number;
  uniqueViewers: number;
}

interface EngagementMetrics {
  averagePauseCount: number;
  averageSeekCount: number;
  averageSessionDuration: number;
}

interface AdminAnalyticsOverview {
  totalSessions: number;
  totalWatchTime: number;
  uniqueViewers: number;
  averageCompletionRate: number;
  topVideos: TopVideo[];
  viewTrends: AnalyticsTrend[];
  engagementMetrics: EngagementMetrics;
}

interface StorageData {
  name: string;
  count: number;
  percentage: number;
}

interface FolderBreakdown {
  name: string;
  size: number;
  count: number;
  sizeGB: number;
}

interface StorageAnalytics {
  totalStorage: number;
  videoCount: number;
  sizeDistribution: StorageData[];
  folderBreakdown: FolderBreakdown[];
}

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export default function Analytics() {
  const { data, isLoading, error, refetch } = useQuery<AdminAnalyticsOverview>({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const response = await apiFetch("/api/admin/analytics/overview");
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: storageData, isLoading: storageLoading } = useQuery<StorageAnalytics>({
    queryKey: ["admin-storage"],
    queryFn: async () => {
      const response = await apiFetch("/api/admin/analytics/storage");
      if (!response.ok) {
        throw new Error("Failed to fetch storage analytics");
      }
      return response.json();
    },
    refetchInterval: 60000,
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">Failed to load analytics</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive insights into your video performance
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetch();
            toast.success("Analytics refreshed");
          }}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="videos">Top Videos</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.totalSessions.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total video sessions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Watch Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(data?.totalWatchTime || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total playback time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Viewers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.uniqueViewers.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Different users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.averageCompletionRate.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Videos completed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* View Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>View Trends (Last 7 Days)</CardTitle>
              <CardDescription>Daily views and watch time</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.viewTrends && data.viewTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.viewTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: any, name: string) => {
                        if (name === 'watchTime') return [formatDuration(value), 'Watch Time'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="views" stroke="#ef4444" name="Views" />
                    <Line yAxisId="left" type="monotone" dataKey="uniqueViewers" stroke="#3b82f6" name="Unique Viewers" />
                    <Line yAxisId="right" type="monotone" dataKey="watchTime" stroke="#10b981" name="Watch Time (s)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No data available yet. Start watching videos to see trends!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Videos Tab */}
        <TabsContent value="videos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Videos</CardTitle>
              <CardDescription>Most viewed videos with engagement metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.topVideos && data.topVideos.length > 0 ? (
                <div className="space-y-4">
                  {data.topVideos.map((video, index) => (
                    <div key={video.videoId} className="flex items-center gap-4 p-4 rounded-lg border">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{video.videoName}</p>
                        <p className="text-sm text-muted-foreground">
                          {video.totalViews} views • {formatDuration(video.totalWatchTime)} total watch time
                        </p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className="text-right">
                          <p className="text-muted-foreground">Avg Watch</p>
                          <p className="font-medium">{formatDuration(video.averageWatchTime)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Completion</p>
                          <p className="font-medium">{video.completionRate.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] gap-4 text-muted-foreground">
                  <Play className="h-12 w-12" />
                  <p>No video analytics yet</p>
                  <p className="text-sm">Videos will appear here once users start watching</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Videos Chart */}
          {data?.topVideos && data.topVideos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Views Distribution</CardTitle>
                <CardDescription>Comparison of top video views</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.topVideos.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="videoName" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalViews" fill="#ef4444" name="Total Views" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Storage Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Storage Overview</CardTitle>
                <CardDescription>Total storage usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Storage</p>
                  <p className="text-3xl font-bold">{formatBytes(storageData?.totalStorage || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Videos</p>
                  <p className="text-2xl font-bold">{storageData?.videoCount.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Size</p>
                  <p className="text-xl font-bold">
                    {storageData && storageData.videoCount > 0
                      ? formatBytes(storageData.totalStorage / storageData.videoCount)
                      : "0 Bytes"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Size Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Size Distribution</CardTitle>
                <CardDescription>Videos by file size</CardDescription>
              </CardHeader>
              <CardContent>
                {storageData?.sizeDistribution && storageData.sizeDistribution.some(d => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={storageData.sizeDistribution}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                      >
                        {storageData.sizeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    <PieChartIcon className="h-12 w-12" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Folder Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Storage by Folder</CardTitle>
              <CardDescription>Breakdown of storage usage by folder</CardDescription>
            </CardHeader>
            <CardContent>
              {storageData?.folderBreakdown && storageData.folderBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={storageData.folderBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'sizeGB') return [`${value.toFixed(2)} GB`, 'Storage'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="#3b82f6" name="Video Count" />
                    <Bar dataKey="sizeGB" fill="#10b981" name="Storage (GB)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] gap-4 text-muted-foreground">
                  <HardDrive className="h-12 w-12" />
                  <p>No storage data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Avg Session Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatDuration(data?.engagementMetrics.averageSessionDuration || 0)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Average time per viewing session
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Avg Pause Count</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {data?.engagementMetrics.averagePauseCount.toFixed(1) || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Pauses per session
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Avg Seek Count</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {data?.engagementMetrics.averageSeekCount.toFixed(1) || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Seeks per session
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Engagement Insights</CardTitle>
              <CardDescription>Understanding viewer behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Session Duration</h4>
                <p className="text-sm text-muted-foreground">
                  On average, viewers watch for{" "}
                  <span className="font-semibold text-foreground">
                    {formatDuration(data?.engagementMetrics.averageSessionDuration || 0)}
                  </span>{" "}
                  per session. {data && data.engagementMetrics.averageSessionDuration > 300
                    ? "This indicates strong content engagement!"
                    : "Consider creating shorter, more engaging content."}
                </p>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Interaction Rate</h4>
                <p className="text-sm text-muted-foreground">
                  Viewers pause{" "}
                  <span className="font-semibold text-foreground">
                    {data?.engagementMetrics.averagePauseCount.toFixed(1) || 0}
                  </span>{" "}
                  times and seek{" "}
                  <span className="font-semibold text-foreground">
                    {data?.engagementMetrics.averageSeekCount.toFixed(1) || 0}
                  </span>{" "}
                  times per session. {data && data.engagementMetrics.averageSeekCount > 3
                    ? "High seeking may indicate viewers are looking for specific content."
                    : "Low seeking indicates linear viewing patterns."}
                </p>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Completion Rate</h4>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {data?.averageCompletionRate.toFixed(1) || 0}%
                  </span>{" "}
                  of videos are watched to completion. {data && data.averageCompletionRate > 50
                    ? "Excellent! Your content keeps viewers engaged until the end."
                    : "Consider analyzing drop-off points to improve retention."}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
