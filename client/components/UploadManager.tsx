import { useState, useCallback, useRef } from "react";
import * as Upload from "tus-js-client";
import { apiFetch } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload as UploadIcon, X, CheckCircle2, AlertCircle, Pause, Play, FileVideo } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "paused" | "completed" | "error";
  error?: string;
  upload?: Upload.Upload;
  folderId?: string;
}

interface Folder {
  id: string;
  name: string;
}

interface UploadManagerProps {
  folders: Folder[];
  onUploadComplete?: () => void;
}

export function UploadManager({ folders, onUploadComplete }: UploadManagerProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>("root");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith("video/")
    );

    if (files.length === 0) {
      toast.error("Please drop video files only");
      return;
    }

    addFilesToQueue(files);
  }, [selectedFolder]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(file =>
      file.type.startsWith("video/")
    );

    if (files.length === 0) {
      toast.error("Please select video files only");
      return;
    }

    addFilesToQueue(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [selectedFolder]);

  const addFilesToQueue = async (files: File[]) => {
    const newUploads: UploadItem[] = files.map(file => ({
      id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: "pending" as const,
      folderId: selectedFolder !== "root" ? selectedFolder : undefined,
    }));

    setUploads(prev => [...prev, ...newUploads]);

    for (const upload of newUploads) {
      startUpload(upload);
    }
  };

  const startUpload = async (uploadItem: UploadItem) => {
    try {
      const response = await apiFetch("/api/upload/credentials");
      if (!response.ok) {
        throw new Error("Failed to get upload credentials");
      }

      const { tusUrl, accessToken } = await response.json();

      setUploads(prev =>
        prev.map(u =>
          u.id === uploadItem.id ? { ...u, status: "uploading" as const } : u
        )
      );

      const metadata: Record<string, string> = {
        accessToken,
        filename: uploadItem.file.name,
        filetype: uploadItem.file.type,
      };

      if (uploadItem.folderId) {
        metadata.folderId = uploadItem.folderId;
      }

      const tusUpload = new Upload.Upload(uploadItem.file, {
        endpoint: tusUrl,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: 52428800, // 50MB as per UPnShare docs
        metadata,
        onError: (error) => {
          console.error(`[Upload ${uploadItem.id}] Error:`, error);
          setUploads(prev =>
            prev.map(u =>
              u.id === uploadItem.id
                ? { ...u, status: "error" as const, error: error.message }
                : u
            )
          );
          toast.error(`Upload failed: ${uploadItem.file.name}`);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploads(prev =>
            prev.map(u =>
              u.id === uploadItem.id ? { ...u, progress: percentage } : u
            )
          );
        },
        onSuccess: () => {
          console.log(`[Upload ${uploadItem.id}] Completed successfully`);
          setUploads(prev =>
            prev.map(u =>
              u.id === uploadItem.id ? { ...u, status: "completed" as const, progress: 100 } : u
            )
          );
          toast.success(`Upload complete: ${uploadItem.file.name}`);
          onUploadComplete?.();
        },
      });

      setUploads(prev =>
        prev.map(u =>
          u.id === uploadItem.id ? { ...u, upload: tusUpload } : u
        )
      );

      tusUpload.start();
    } catch (error) {
      console.error(`[Upload ${uploadItem.id}] Failed to start:`, error);
      setUploads(prev =>
        prev.map(u =>
          u.id === uploadItem.id
            ? { ...u, status: "error" as const, error: error instanceof Error ? error.message : "Unknown error" }
            : u
        )
      );
      toast.error("Failed to start upload");
    }
  };

  const pauseUpload = (uploadId: string) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (upload?.upload && upload.status === "uploading") {
      upload.upload.abort();
      setUploads(prev =>
        prev.map(u =>
          u.id === uploadId ? { ...u, status: "paused" as const } : u
        )
      );
    }
  };

  const resumeUpload = (uploadId: string) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (upload?.upload && upload.status === "paused") {
      upload.upload.start();
      setUploads(prev =>
        prev.map(u =>
          u.id === uploadId ? { ...u, status: "uploading" as const } : u
        )
      );
    }
  };

  const cancelUpload = (uploadId: string) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (upload?.upload) {
      upload.upload.abort(true);
    }
    setUploads(prev => prev.filter(u => u.id !== uploadId));
    toast.info("Upload cancelled");
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getStatusIcon = (status: UploadItem["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "uploading":
        return <UploadIcon className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <FileVideo className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Videos</CardTitle>
        <CardDescription>
          Upload videos to your UPnShare library. Max file size: 20GB
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">No folder (root)</SelectItem>
              {folders.map(folder => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-gray-300 dark:border-gray-700"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <UploadIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">
            Drop video files here or click to browse
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Supports: MP4, MOV, AVI, MKV, and more
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <Button asChild>
            <label htmlFor="file-upload" className="cursor-pointer">
              Browse Files
            </label>
          </Button>
        </div>

        {uploads.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Upload Queue ({uploads.length})</h3>
            <div className="space-y-2">
              {uploads.map(upload => (
                <Card key={upload.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(upload.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium truncate">
                            {upload.file.name}
                          </p>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(upload.file.size)}
                          </span>
                        </div>
                        {upload.status === "error" && upload.error && (
                          <p className="text-xs text-red-500 mb-2">{upload.error}</p>
                        )}
                        {(upload.status === "uploading" || upload.status === "paused") && (
                          <div className="space-y-1">
                            <Progress value={upload.progress} className="h-2" />
                            <p className="text-xs text-gray-500">{upload.progress}%</p>
                          </div>
                        )}
                        {upload.status === "completed" && (
                          <p className="text-xs text-green-600">Upload complete</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {upload.status === "uploading" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => pauseUpload(upload.id)}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {upload.status === "paused" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => resumeUpload(upload.id)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {upload.status === "error" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startUpload(upload)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {upload.status !== "completed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => cancelUpload(upload.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
