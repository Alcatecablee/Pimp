import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Server,
  Database,
  HardDrive,
  Cpu,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface SystemHealth {
  status: string;
  timestamp: number;
  system: {
    memory: {
      total: number;
      used: number;
      free: number;
      usagePercent: number;
    };
    cpu: {
      loadAverage: {
        '1m': number;
        '5m': number;
        '15m': number;
      };
      cores: number;
    };
    uptime: {
      system: number;
      process: number;
      metricsSince: number;
    };
  };
  database: {
    status: string;
    responseTime: number;
  };
  cache: {
    type: string;
    hits: number;
    misses: number;
    hitRate: number;
    timeouts: number;
    timeoutRate: number;
    videosCount: number;
    lastRefresh: number | null;
  };
  api: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    avgResponseTime: number;
  };
}

interface EndpointMetrics {
  endpoints: Array<{
    path: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    avgResponseTime: number;
    lastAccessed: number;
  }>;
  summary: {
    totalEndpoints: number;
    totalRequests: number;
    avgResponseTime: number;
  };
}

interface RecentErrors {
  errors: Array<{
    timestamp: number;
    endpoint: string;
    error: string;
    statusCode: number;
  }>;
  summary: {
    totalErrors: number;
    recentErrors: number;
    topErrorEndpoints: Array<{
      endpoint: string;
      count: number;
    }>;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function Health() {
  const { data: health, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useQuery<SystemHealth>({
    queryKey: ['/api/admin/health'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: endpoints, isLoading: endpointsLoading, refetch: refetchEndpoints } = useQuery<EndpointMetrics>({
    queryKey: ['/api/admin/health/endpoints'],
    refetchInterval: 10000,
  });

  const { data: errors, isLoading: errorsLoading, refetch: refetchErrors } = useQuery<RecentErrors>({
    queryKey: ['/api/admin/health/errors'],
    refetchInterval: 10000,
  });

  const handleResetMetrics = async () => {
    try {
      const response = await fetch('/api/admin/health/reset', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to reset metrics');
      
      toast.success('Metrics reset successfully');
      refetchHealth();
      refetchEndpoints();
      refetchErrors();
    } catch (error) {
      toast.error('Failed to reset metrics');
      console.error('Error resetting metrics:', error);
    }
  };

  if (healthLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Health</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and performance metrics
          </p>
        </div>
        <div className="text-center py-12">Loading health metrics...</div>
      </div>
    );
  }

  if (healthError || !health) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Health</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and performance metrics
          </p>
        </div>
        <div className="text-center py-12 text-destructive">
          Failed to load health metrics. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Health</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and performance metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchHealth(); refetchEndpoints(); refetchErrors(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetMetrics}>
            Reset Metrics
          </Button>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">Healthy</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Uptime: {formatUptime(health.system.uptime.system)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {health.database.status === 'healthy' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-2xl font-bold">Error</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Response: {health.database.responseTime}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.cache.hitRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {health.cache.type} · {health.cache.videosCount.toLocaleString()} videos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Performance</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.api.avgResponseTime.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground mt-1">
              {health.api.totalRequests.toLocaleString()} requests · {health.api.successRate.toFixed(1)}% success
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  CPU Usage
                </CardTitle>
                <CardDescription>Load average across all cores</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">1 minute</span>
                  <Badge variant="outline">{health.system.cpu.loadAverage['1m'].toFixed(2)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">5 minutes</span>
                  <Badge variant="outline">{health.system.cpu.loadAverage['5m'].toFixed(2)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">15 minutes</span>
                  <Badge variant="outline">{health.system.cpu.loadAverage['15m'].toFixed(2)}</Badge>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    {health.system.cpu.cores} CPU cores available
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Memory Usage
                </CardTitle>
                <CardDescription>RAM allocation and usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used: {formatBytes(health.system.memory.used)}</span>
                    <span className="text-muted-foreground">{health.system.memory.usagePercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${health.system.memory.usagePercent}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-lg font-semibold">{formatBytes(health.system.memory.total)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Free</p>
                    <p className="text-lg font-semibold">{formatBytes(health.system.memory.free)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Uptime & Metrics
              </CardTitle>
              <CardDescription>Server and process uptime tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">System Uptime</p>
                  <p className="text-2xl font-bold">{formatUptime(health.system.uptime.system)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Process Uptime</p>
                  <p className="text-2xl font-bold">{formatUptime(health.system.uptime.process)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Metrics Since</p>
                  <p className="text-2xl font-bold">{formatUptime(health.system.uptime.metricsSince / 1000)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          {endpointsLoading ? (
            <div className="text-center py-12">Loading endpoint metrics...</div>
          ) : endpoints ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Endpoints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{endpoints.summary.totalEndpoints}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{endpoints.summary.totalRequests.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{endpoints.summary.avgResponseTime.toFixed(0)}ms</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Endpoint Performance</CardTitle>
                  <CardDescription>Request metrics by endpoint</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {endpoints.endpoints.slice(0, 20).map((endpoint) => (
                      <div key={endpoint.path} className="flex items-center justify-between border-b pb-3 last:border-0">
                        <div className="flex-1">
                          <p className="font-mono text-sm">{endpoint.path}</p>
                          <p className="text-xs text-muted-foreground">
                            Last accessed {formatDistanceToNow(endpoint.lastAccessed, { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-right">
                            <p className="font-semibold">{endpoint.totalRequests}</p>
                            <p className="text-xs text-muted-foreground">requests</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{endpoint.successRate.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">success</p>
                          </div>
                          <div className="text-right min-w-[60px]">
                            <p className="font-semibold">{endpoint.avgResponseTime.toFixed(0)}ms</p>
                            <p className="text-xs text-muted-foreground">avg time</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No endpoint metrics available</div>
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          {errorsLoading ? (
            <div className="text-center py-12">Loading error logs...</div>
          ) : errors && errors.errors.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{errors.summary.totalErrors}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Top Error Endpoint</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-mono">{errors.summary.topErrorEndpoints[0]?.endpoint || 'N/A'}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {errors.summary.topErrorEndpoints[0]?.count || 0} errors
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Recent Errors
                  </CardTitle>
                  <CardDescription>Last {errors.errors.length} errors tracked</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {errors.errors.map((error, index) => (
                      <div key={index} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{error.endpoint}</span>
                          <Badge variant="destructive">{error.statusCode}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground break-all">{error.error.substring(0, 200)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(error.timestamp, { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Errors Detected</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    All systems operating normally
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Cache Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{health.cache.type}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{health.cache.hitRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {health.cache.hits} hits / {health.cache.misses} misses
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Cached Videos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{health.cache.videosCount.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Last Refresh</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {health.cache.lastRefresh
                    ? formatDistanceToNow(health.cache.lastRefresh, { addSuffix: true })
                    : 'Never'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cache Performance</CardTitle>
              <CardDescription>Detailed cache statistics and performance metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Requests</span>
                <span className="text-lg font-semibold">{(health.cache.hits + health.cache.misses).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Cache Hits</span>
                <span className="text-lg font-semibold text-green-600">{health.cache.hits.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Cache Misses</span>
                <span className="text-lg font-semibold text-amber-600">{health.cache.misses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Timeouts</span>
                <span className="text-lg font-semibold text-red-600">{health.cache.timeouts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Timeout Rate</span>
                <span className="text-lg font-semibold">{health.cache.timeoutRate.toFixed(2)}%</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
