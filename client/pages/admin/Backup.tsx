import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Database,
  FileText,
  Users,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface BackupInfo {
  automated: {
    isRunning: boolean;
    intervalHours: number;
    retentionDays: number;
    lastBackup: number | null;
    nextBackup: number | null;
    backupCount: number;
  };
  storage: {
    totalSizeBytes: number;
    totalSizeMB: string;
    oldestBackup: number | null;
    newestBackup: number | null;
  };
}

export default function Backup() {
  const [includeVideos, setIncludeVideos] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [includeUsers, setIncludeUsers] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [isExporting, setIsExporting] = useState(false);

  const { data: backupInfo, isLoading, refetch } = useQuery<BackupInfo>({
    queryKey: ['/api/admin/backup/info'],
    queryFn: async () => {
      const response = await apiFetch('/api/admin/backup/info');
      if (!response.ok) throw new Error('Failed to fetch backup info');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const params = new URLSearchParams({
        format: exportFormat,
        includeVideos: includeVideos.toString(),
        includeLogs: includeLogs.toString(),
        includeUsers: includeUsers.toString(),
      });

      const response = await apiFetch(`/api/admin/backup/export?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `videohub-backup-${timestamp}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Backup exported successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to export backup');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Backup & Recovery</h2>
          <p className="text-muted-foreground">
            Export and manage system backups
          </p>
        </div>
        <div className="text-center py-12">Loading backup information...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Backup & Recovery</h2>
          <p className="text-muted-foreground">
            Export and manage system backups
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Automated Backup Status */}
      {backupInfo && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Automated Backup Status</CardTitle>
                <CardDescription>
                  Scheduled backups run every {backupInfo.automated.intervalHours} hours
                </CardDescription>
              </div>
              <Badge variant={backupInfo.automated.isRunning ? 'default' : 'secondary'}>
                {backupInfo.automated.isRunning ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Active</>
                ) : (
                  <><AlertCircle className="h-3 w-3 mr-1" /> Inactive</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Backups</p>
                <p className="text-2xl font-bold">{backupInfo.automated.backupCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Retention Period</p>
                <p className="text-2xl font-bold">{backupInfo.automated.retentionDays} days</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Storage Used</p>
                <p className="text-2xl font-bold">
                  {formatBytes(backupInfo.storage.totalSizeBytes)}
                </p>
              </div>
            </div>

            {backupInfo.automated.lastBackup && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Last backup: {formatDistanceToNow(new Date(backupInfo.automated.lastBackup), { addSuffix: true })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Export */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Export</CardTitle>
          <CardDescription>
            Create a backup with custom options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Export Options */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3">Include Data</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="videos"
                    checked={includeVideos}
                    onCheckedChange={(checked) => setIncludeVideos(!!checked)}
                  />
                  <Label
                    htmlFor="videos"
                    className="text-sm font-normal cursor-pointer flex items-center"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Video Metadata (titles, descriptions, folders)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="logs"
                    checked={includeLogs}
                    onCheckedChange={(checked) => setIncludeLogs(!!checked)}
                  />
                  <Label
                    htmlFor="logs"
                    className="text-sm font-normal cursor-pointer flex items-center"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    System Logs (last 10,000 entries)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="users"
                    checked={includeUsers}
                    onCheckedChange={(checked) => setIncludeUsers(!!checked)}
                  />
                  <Label
                    htmlFor="users"
                    className="text-sm font-normal cursor-pointer flex items-center"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    User Data (excluding passwords)
                  </Label>
                </div>
              </div>
            </div>

            {/* Export Format */}
            <div>
              <h4 className="text-sm font-medium mb-3">Export Format</h4>
              <div className="flex gap-2">
                <Button
                  variant={exportFormat === 'json' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExportFormat('json')}
                >
                  JSON (Full Backup)
                </Button>
                <Button
                  variant={exportFormat === 'csv' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExportFormat('csv')}
                  disabled={!includeVideos}
                >
                  CSV (Videos Only)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {exportFormat === 'json'
                  ? 'Complete backup in JSON format including all selected data'
                  : 'Spreadsheet-friendly export of video metadata only'}
              </p>
            </div>
          </div>

          {/* Export Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleExport}
              disabled={isExporting || (!includeVideos && !includeLogs && !includeUsers)}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Backup
                </>
              )}
            </Button>
            {!includeVideos && !includeLogs && !includeUsers && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Please select at least one data type to export
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Backup Information */}
      <Card>
        <CardHeader>
          <CardTitle>Backup Information</CardTitle>
          <CardDescription>
            Important details about system backups
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <HardDrive className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Automated Backups</p>
                <p className="text-muted-foreground">
                  Backups are automatically created every {backupInfo?.automated.intervalHours || 24} hours and stored for {backupInfo?.automated.retentionDays || 7} days
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Data Included</p>
                <p className="text-muted-foreground">
                  Backups include video metadata, system logs, and user information (passwords are never included)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Restore Process</p>
                <p className="text-muted-foreground">
                  Contact system administrator to restore from backup. Manual restoration requires database access
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
