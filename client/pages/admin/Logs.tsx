import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Trash2,
  Download,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Log {
  id: number;
  timestamp: string;
  level: string;
  message: string;
  context: any;
  requestId: string | null;
  userId: string | null;
  endpoint: string | null;
  statusCode: number | null;
  errorStack: string | null;
}

interface LogsResponse {
  logs: Log[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface LogStats {
  totalLogs: number;
  byLevel: {
    info: number;
    warn: number;
    error: number;
    fatal: number;
    debug: number;
  };
  recentErrors: Array<{
    timestamp: string;
    message: string;
    endpoint: string | null;
  }>;
  topErrorEndpoints: Array<{
    endpoint: string;
    count: number;
  }>;
}

const getLevelIcon = (level: string) => {
  switch (level.toLowerCase()) {
    case 'fatal':
      return <XCircle className="h-4 w-4" />;
    case 'error':
      return <AlertCircle className="h-4 w-4" />;
    case 'warn':
      return <AlertTriangle className="h-4 w-4" />;
    case 'debug':
      return <Bug className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
};

const getLevelColor = (level: string) => {
  switch (level.toLowerCase()) {
    case 'fatal':
      return 'destructive';
    case 'error':
      return 'destructive';
    case 'warn':
      return 'warning';
    case 'debug':
      return 'secondary';
    default:
      return 'default';
  }
};

export default function Logs() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [level, setLevel] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

  const queryParams = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    ...(level && { level }),
    ...(search && { search }),
  });

  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery<LogsResponse>({
    queryKey: [`/api/admin/logs?${queryParams}`],
    refetchInterval: 5000,
  });

  const { data: stats, refetch: refetchStats } = useQuery<LogStats>({
    queryKey: ['/api/admin/logs/stats'],
    refetchInterval: 10000,
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const handleLevelChange = (value: string) => {
    setLevel(value === 'all' ? '' : value);
    setPage(1);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const exportParams = new URLSearchParams({
        format,
        ...(level && { level }),
        ...(search && { search }),
      });

      const response = await apiFetch(`/api/admin/logs/export?${exportParams}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Logs exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export logs');
      console.error('Export error:', error);
    }
  };

  const handleClearLogs = async () => {
    try {
      const clearParams = new URLSearchParams({
        ...(level && { level }),
      });

      const response = await apiFetch(`/api/admin/logs?${clearParams}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to clear logs');

      toast.success('Logs cleared successfully');
      refetchLogs();
      refetchStats();
      setClearDialogOpen(false);
    } catch (error) {
      toast.error('Failed to clear logs');
      console.error('Clear logs error:', error);
    }
  };

  if (logsLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Logs</h2>
          <p className="text-muted-foreground">View and analyze application logs</p>
        </div>
        <div className="text-center py-12">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Logs</h2>
          <p className="text-muted-foreground">View and analyze application logs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setClearDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Logs
          </Button>
        </div>
      </div>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          {/* Stats Cards */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalLogs}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Errors</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {stats.byLevel.error + stats.byLevel.fatal}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Warnings</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-500">{stats.byLevel.warn}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Info</CardTitle>
                  <Info className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.byLevel.info}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Debug</CardTitle>
                  <Bug className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.byLevel.debug}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter logs by level and search text</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Select value={level || 'all'} onValueChange={handleLevelChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="fatal">Fatal</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warn">Warn</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={handleSearch}>Search</Button>
                  {search && (
                    <Button variant="outline" onClick={handleClearSearch}>
                      Clear
                    </Button>
                  )}
                </div>

                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                    <SelectItem value="200">200 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Logs{' '}
                {logsData && (
                  <span className="text-sm text-muted-foreground font-normal">
                    ({logsData.pagination.total} total)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsData && logsData.logs.length > 0 ? (
                <div className="space-y-2">
                  {logsData.logs.map((log) => (
                    <div
                      key={log.id}
                      className="border rounded-lg p-3 hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getLevelIcon(log.level)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={getLevelColor(log.level) as any}>
                              {log.level.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </span>
                            {log.endpoint && (
                              <code className="text-xs bg-muted px-2 py-0.5 rounded">
                                {log.endpoint}
                              </code>
                            )}
                            {log.statusCode && (
                              <Badge variant="outline" className="text-xs">
                                {log.statusCode}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium">{log.message}</p>
                          {log.requestId && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Request ID: {log.requestId}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No logs found matching your filters
                </div>
              )}

              {/* Pagination */}
              {logsData && logsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Page {logsData.pagination.page} of {logsData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= logsData.pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {stats && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Errors</CardTitle>
                    <CardDescription>Latest error and fatal log entries</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats.recentErrors.length > 0 ? (
                      <div className="space-y-3">
                        {stats.recentErrors.slice(0, 10).map((error, idx) => (
                          <div key={idx} className="border-l-2 border-red-500 pl-3">
                            <p className="text-sm font-medium">{error.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(error.timestamp), {
                                  addSuffix: true,
                                })}
                              </span>
                              {error.endpoint && (
                                <code className="text-xs bg-muted px-1 rounded">
                                  {error.endpoint}
                                </code>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent errors</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Error Endpoints</CardTitle>
                    <CardDescription>Endpoints with most errors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats.topErrorEndpoints.length > 0 ? (
                      <div className="space-y-3">
                        {stats.topErrorEndpoints.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {item.endpoint}
                            </code>
                            <Badge variant="destructive">{item.count} errors</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No error endpoints</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Log Detail Dialog */}
      {selectedLog && (
        <AlertDialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                {getLevelIcon(selectedLog.level)}
                Log Details
              </AlertDialogTitle>
              <AlertDialogDescription>
                {new Date(selectedLog.timestamp).toLocaleString()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Level</p>
                <Badge variant={getLevelColor(selectedLog.level) as any}>
                  {selectedLog.level.toUpperCase()}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Message</p>
                <p className="text-sm">{selectedLog.message}</p>
              </div>
              {selectedLog.endpoint && (
                <div>
                  <p className="text-sm font-medium mb-1">Endpoint</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded">{selectedLog.endpoint}</code>
                </div>
              )}
              {selectedLog.statusCode && (
                <div>
                  <p className="text-sm font-medium mb-1">Status Code</p>
                  <Badge variant="outline">{selectedLog.statusCode}</Badge>
                </div>
              )}
              {selectedLog.requestId && (
                <div>
                  <p className="text-sm font-medium mb-1">Request ID</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded break-all">
                    {selectedLog.requestId}
                  </code>
                </div>
              )}
              {selectedLog.userId && (
                <div>
                  <p className="text-sm font-medium mb-1">User ID</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded break-all">
                    {selectedLog.userId}
                  </code>
                </div>
              )}
              {selectedLog.context && Object.keys(selectedLog.context).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Context</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedLog.context, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.errorStack && (
                <div>
                  <p className="text-sm font-medium mb-1">Stack Trace</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.errorStack}
                  </pre>
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogAction>Close</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Clear Logs Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Logs</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear {level ? `${level.toUpperCase()}` : 'all'} logs? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearLogs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear Logs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
