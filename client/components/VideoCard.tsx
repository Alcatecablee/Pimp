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

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  const formatViews = (views?: number) => {
    if (!views) return "";
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  return (
    <div className="group cursor-pointer">
      <div className="relative overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800 aspect-video mb-3 shadow-sm hover:shadow-md transition-shadow duration-300">
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
          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-white text-xs font-semibold">
            {formatDuration(video.duration)}
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors break-words">
          {video.title}
        </h3>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {video.views !== undefined && (
            <span>{formatViews(video.views)} views</span>
          )}
          {video.views !== undefined && video.created_at && (
            <span>•</span>
          )}
          {video.created_at && (
            <span>{formatDate(video.created_at)}</span>
          )}
        </div>

        {video.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {video.description}
          </p>
        )}

        {video.size && (
          <p className="text-xs text-muted-foreground">
            {(video.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        )}
      </div>
    </div>
  );
}
