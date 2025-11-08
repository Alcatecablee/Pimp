import { Video } from "@shared/api";
import { Play } from "lucide-react";

interface VideoCardProps {
  video: Video;
}

export function VideoCard({ video }: VideoCardProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="group cursor-pointer">
      <div className="relative overflow-hidden rounded-xl bg-gray-200 dark:bg-gray-800 aspect-video mb-3 shadow-sm">
        {video.poster || video.thumbnail ? (
          <img
            src={video.poster || video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
            <Play className="w-16 h-16 text-white opacity-30" />
          </div>
        )}

        {video.duration > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-white text-xs font-medium">
            {formatDuration(video.duration)}
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
          <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 fill-white" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {video.title}
        </h3>

        {video.views !== undefined && (
          <p className="text-xs text-muted-foreground">
            {video.views.toLocaleString()} views
          </p>
        )}

        {video.created_at && (
          <p className="text-xs text-muted-foreground">
            {new Date(video.created_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
