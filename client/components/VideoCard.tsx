import { Video, VideoFolder } from "@shared/api";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Folder, Tag, Eye } from "lucide-react";

interface VideoCardProps {
  video: Video;
  folder?: VideoFolder;
  liveViewers?: number;
}

export function VideoCard({ video, folder, liveViewers }: VideoCardProps) {
  const videoLink = `/video/${video.id}`;
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const [watchProgress, setWatchProgress] = useState<number>(0);
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "50px" }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(`video-progress-${video.id}`);
    if (saved) {
      const data = JSON.parse(saved);
      const progressPercent = (data.currentTime / video.duration) * 100;
      setWatchProgress(progressPercent);
    }
  }, [video.id, video.duration]);

  const handleMouseEnter = () => {
    if (video.preview) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovering(true);
      }, 500);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovering(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

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
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const formatViews = (views?: number) => {
    if (!views) return "No";
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  return (
    <Link to={videoLink} className="group block">
      {/* Thumbnail */}
      <div 
        ref={imgRef}
        className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 mb-3"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {(video.poster || video.thumbnail) && isVisible ? (
          <>
            <img
              src={isHovering && video.preview ? video.preview : (video.poster || video.thumbnail)}
              alt={video.title}
              className="w-full h-full object-cover transition-all duration-300 ease-out group-hover:scale-105"
              loading="lazy"
            />
            {isHovering && video.preview && (
              <div className="absolute inset-0 bg-black/10 pointer-events-none" />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800" />
        )}

        {/* Watch Progress Bar */}
        {watchProgress > 5 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-400/50">
            <div
              className="h-full bg-red-600"
              style={{ width: `${watchProgress}%` }}
            />
          </div>
        )}

        {/* Live Viewers Badge */}
        {liveViewers && liveViewers > 0 && (
          <div className="absolute top-1 left-1 flex items-center gap-1 bg-red-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded">
            <Eye className="w-3 h-3" />
            <span>{liveViewers}</span>
          </div>
        )}

        {/* Duration Badge */}
        {video.duration > 0 && (
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs font-semibold px-1 py-0.5 rounded">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="flex gap-3">
        {/* Channel Avatar */}
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Folder className="w-5 h-5 text-white" />
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-sm font-semibold line-clamp-2 text-gray-900 dark:text-gray-100 mb-1 leading-snug">
            {video.title}
          </h3>

          {/* Channel Name */}
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <p className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
              {folder?.name || "VideoHub"}
            </p>
          </div>

          {/* Views and Date */}
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            <span>{formatViews(video.views)} views</span>
            {video.created_at && (
              <>
                <span>•</span>
                <span>{formatDate(video.created_at)}</span>
              </>
            )}
          </div>

          {/* Tags */}
          {video.tags && video.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {video.tags.slice(0, 2).map((tag, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
              {video.tags.length > 2 && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                  +{video.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
