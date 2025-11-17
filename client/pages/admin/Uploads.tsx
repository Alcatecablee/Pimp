import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-config";
import { UploadManager } from "@/components/UploadManager";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Folder {
  id: string;
  name: string;
  description?: string;
  videoCount: number;
  totalSize: number;
}

export default function Uploads() {
  const { data: folders, isLoading, refetch } = useQuery<{ folders: Folder[] }>({
    queryKey: ["admin-folders"],
    queryFn: async () => {
      const response = await apiFetch("/api/admin/folders");
      if (!response.ok) {
        throw new Error("Failed to fetch folders");
      }
      return response.json();
    },
  });

  const handleUploadComplete = () => {
    toast.success("Video uploaded successfully! It may take a few moments to appear.");
    setTimeout(() => {
      refetch();
    }, 3000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Videos</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Upload new videos to your UPnShare library
        </p>
      </div>

      <UploadManager
        folders={folders?.folders || []}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
