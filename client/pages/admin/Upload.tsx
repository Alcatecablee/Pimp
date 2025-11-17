import { useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api-config";
import { Upload as UploadIcon, X, Pause, Play, Trash2, CheckCircle, AlertCircle, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import * as tus from "tus-js-client";

interface UploadCredentials {
  tusUrl: string;
  accessToken: string;
}

interface UploadTask {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "paused" | "completed" | "failed";
  upload: tus.Upload | null;
  bytesUploaded: number;
  bytesTotal: number;
  error?: string;
  folderId?: string;
  uploadUrl?: string;
}

interface FolderData {
  id: string;
  name: string;
  videoCount: number;
  totalSize: number;
}

export default function Upload() {
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: folders } = useQuery<{ folders: FolderData[] }>({
    queryKey: ["admin", "folders"],
    queryFn: async () => {
      const response = await apiFetch("/api/admin/folders");
      if (!response.ok) {
        throw new Error("Failed to fetch folders");
      }
      return response.json();
    },
  });

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter((file) =>
      file.type.startsWith("video/")
    );

    if (videoFiles.length === 0) {
      toast.error("Please drop video files only");
      return;
    }

    addFilesToQueue(videoFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFilesToQueue(files);
    }
  }, []);

  const addFilesToQueue = (files: File[]) => {
    const newUploads: UploadTask[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: "pending",
      upload: null,
      bytesUploaded: 0,
      bytesTotal: file.size,
    }));

    setUploads((prev) => [...prev, ...newUploads]);
    toast.success(`Added ${files.length} file(s) to upload queue`);
  };

  const startUpload = async (task: UploadTask) => {
    try {
      const credentialsResponse = await apiFetch("/api/upload/credentials");
      if (!credentialsResponse.ok) {
        throw new Error("Failed to get upload credentials");
      }

      const credentials: UploadCredentials = await credentialsResponse.json();

      const upload = new tus.Upload(task.file, {
        endpoint: credentials.tusUrl,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: 52428800,
        metadata: {
          accessToken: credentials.accessToken,
          filename: task.file.name,
          filetype: task.file.type,
          ...(task.folderId && { folderId: task.folderId }),
        },
        onError: (error) => {
          console.error(`Upload failed for ${task.file.name}:`, error);
          setUploads((prev) =>
            prev.map((u) =>
              u.id === task.id
                ? { ...u, status: "failed", error: error.message }
                : u
            )
          );
          toast.error(`Upload failed: ${task.file.name}`);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = ((bytesUploaded / bytesTotal) * 100);
          setUploads((prev) =>
            prev.map((u) =>
              u.id === task.id
                ? { ...u, progress, bytesUploaded, bytesTotal, status: "uploading" }
                : u
            )
          );
        },
        onSuccess: () => {
          console.log(`Upload complete for ${task.file.name}: ${upload.url}`);
          setUploads((prev) =>
            prev.map((u) =>
              u.id === task.id
                ? { ...u, status: "completed", progress: 100, uploadUrl: upload.url }
                : u
            )
          );
          toast.success(`Upload completed: ${task.file.name}`);
        },
      });

      setUploads((prev) =>
        prev.map((u) =>
          u.id === task.id
            ? { ...u, upload, status: "uploading" }
            : u
        )
      );

      upload.start();
    } catch (error) {
      console.error("Upload error:", error);
      setUploads((prev) =>
        prev.map((u) =>
          u.id === task.id
            ? { ...u, status: "failed", error: error instanceof Error ? error.message : "Unknown error" }
            : u
        )
      );
      toast.error(`Failed to start upload: ${task.file.name}`);
    }
  };

  const pauseUpload = (task: UploadTask) => {
    if (task.upload) {
      task.upload.abort();
      setUploads((prev) =>
        prev.map((u) =>
          u.id === task.id ? { ...u, status: "paused" } : u
        )
      );
      toast.info(`Upload paused: ${task.file.name}`);
    }
  };

  const resumeUpload = async (task: UploadTask) => {
    if (task.upload) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === task.id ? { ...u, status: "uploading" } : u
        )
      );
      task.upload.start();
      toast.info(`Upload resumed: ${task.file.name}`);
    }
  };

  const retryUpload = (task: UploadTask) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.id === task.id ? { ...u, status: "pending", error: undefined, progress: 0 } : u
      )
    );
    startUpload(task);
  };

  const removeUpload = (task: UploadTask) => {
    if (task.upload && task.status === "uploading") {
      task.upload.abort();
    }
    setUploads((prev) => prev.filter((u) => u.id !== task.id));
  };

  const setUploadFolder = (taskId: string, folderId: string) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.id === taskId ? { ...u, folderId } : u
      )
    );
  };

  const startAllPendingUploads = () => {
    uploads
      .filter((u) => u.status === "pending")
      .forEach((u) => startUpload(u));
  };

  const clearCompletedUploads = () => {
    setUploads((prev) => prev.filter((u) => u.status !== "completed"));
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const pendingCount = uploads.filter((u) => u.status === "pending").length;
  const uploadingCount = uploads.filter((u) => u.status === "uploading").length;
  const completedCount = uploads.filter((u) => u.status === "completed").length;
  const failedCount = uploads.filter((u) => u.status === "failed").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Upload Manager</h1>
        <p className="text-muted-foreground">
          Upload videos with drag-and-drop, resume support, and progress tracking
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Uploading</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{uploadingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <CardHeader>
          <CardTitle>Drop Zone</CardTitle>
          <CardDescription>
            Drag and drop video files here or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UploadIcon className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            Drag video files here or click the button below
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            Select Files
          </Button>
        </CardContent>
      </Card>

      {uploads.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upload Queue ({uploads.length})</CardTitle>
              <CardDescription>
                Manage your upload queue and track progress
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {pendingCount > 0 && (
                <Button onClick={startAllPendingUploads} size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Start All
                </Button>
              )}
              {completedCount > 0 && (
                <Button onClick={clearCompletedUploads} variant="outline" size="sm">
                  Clear Completed
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploads.map((task) => (
              <div
                key={task.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <FileVideo className="h-10 w-10 text-muted-foreground mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatBytes(task.bytesUploaded)} / {formatBytes(task.bytesTotal)}
                      </p>
                      {task.status === "pending" && (
                        <div className="mt-2">
                          <Select
                            value={task.folderId || ""}
                            onValueChange={(value) => setUploadFolder(task.id, value)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select folder" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Root Folder</SelectItem>
                              {folders?.folders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  {folder.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.status === "completed" && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {task.status === "failed" && (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    {task.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => startUpload(task)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start
                      </Button>
                    )}
                    {task.status === "uploading" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pauseUpload(task)}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </Button>
                    )}
                    {task.status === "paused" && (
                      <Button
                        size="sm"
                        onClick={() => resumeUpload(task)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </Button>
                    )}
                    {task.status === "failed" && (
                      <Button
                        size="sm"
                        onClick={() => retryUpload(task)}
                      >
                        Retry
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeUpload(task)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {task.status !== "pending" && task.status !== "failed" && (
                  <Progress value={task.progress} className="h-2" />
                )}
                {task.error && (
                  <p className="text-sm text-red-600">{task.error}</p>
                )}
                {task.status === "uploading" && (
                  <p className="text-sm text-muted-foreground">
                    {task.progress.toFixed(1)}% complete
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
