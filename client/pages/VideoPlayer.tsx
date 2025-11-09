import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { Video, VideoFolder } from "@shared/api";
import { Header } from "@/components/Header";
import { ThumbsUp, ThumbsDown, Share2, Download, MoreHorizontal, Folder } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { VideoPlayerControls } from "@/components/VideoPlayerControls";

export default function VideoPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [folder, setFolder] = useState<VideoFolder | null>(null);
  const [loading, setLoading] = useState(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playerOrigin, setPlayerOrigin] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  // Send command to player
  const sendPlayerCommand = useCallback((command: string, value?: number) => {
    if (iframeRef.current && playerOrigin && playerReady) {
      iframeRef.current.contentWindow?.postMessage({ command, value }, playerOrigin);
    }
  }, [playerOrigin, playerReady]);

  // Handle player messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!playerOrigin || e.origin !== playerOrigin) return;

      console.log('Player message:', e.data);

      // Player ready
      if (e.data.playerStatus === 'Ready') {
        setPlayerReady(true);
        if (e.data.duration) setDuration(e.data.duration);
        // Auto-play on ready
        setTimeout(() => {
          sendPlayerCommand('play');
          setIsPlaying(true);
        }, 500);
      }

      // Playing state
      if (e.data.playerStatus === 'Playing') {
        setIsPlaying(true);
      }

      // Paused state
      if (e.data.playerStatus === 'Paused') {
        setIsPlaying(false);
      }

      // Current time update
      if (e.data.currentTime !== undefined) {
        setCurrentTime(e.data.currentTime);
      }

      // Duration update
      if (e.data.duration !== undefined) {
        setDuration(e.data.duration);
      }

      // Volume update
      if (e.data.volume !== undefined) {
        setVolume(e.data.volume);
      }

      // Muted update
      if (e.data.muted !== undefined) {
        setIsMuted(e.data.muted);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [playerOrigin, sendPlayerCommand]);

  // Poll for current time
  useEffect(() => {
    if (!playerReady) return;

    const interval = setInterval(() => {
      sendPlayerCommand('getTime');
      sendPlayerCommand('getStatus');
    }, 500);

    return () => clearInterval(interval);
  }, [playerReady, sendPlayerCommand]);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        const [videoResponse, videosResponse] = await Promise.all([
          fetch(`/api/videos/${id}`),
          fetch(`/api/videos`)
        ]);

        if (!videoResponse.ok) {
          toast.error("Failed to load video");
          throw new Error("Video not found");
        }

        const videoData = await videoResponse.json();
        setVideo(videoData);

        if (videosResponse.ok) {
          const videosData = await videosResponse.json();
          const matchedFolder = videosData.folders.find((f: VideoFolder) => f.id === videoData.folder_id);
          if (matchedFolder) setFolder(matchedFolder);
        }
      } catch (error) {
        console.error("Error fetching video:", error);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchVideo();
    }
  }, [id, navigate]);

  const formatViews = (views?: number) => {
    if (!views) return "No";
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f0f]">
        <Header />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading video...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f0f]">
      <Header />
      
      <div className="max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 p-6">
          {/* Main Content */}
          <div className="space-y-4">
            {/* Video Player */}
            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group">
              <iframe
                ref={iframeRef}
                src={`https://pib.upns.xyz/?api=all#${video.id}`}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; encrypted-media"
                title={video.title}
                onLoad={() => {
                  if (iframeRef.current) {
                    const origin = new URL(iframeRef.current.src).origin;
                    setPlayerOrigin(origin);
                  }
                }}
              />
              <VideoPlayerControls
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                isMuted={isMuted}
                onPlayPause={() => {
                  sendPlayerCommand(isPlaying ? 'pause' : 'play');
                  setIsPlaying(!isPlaying);
                }}
                onSeek={(time) => {
                  sendPlayerCommand('seek', time);
                  setCurrentTime(time);
                }}
                onVolumeChange={(vol) => {
                  sendPlayerCommand('volume', vol);
                  setVolume(vol);
                  if (vol > 0 && isMuted) setIsMuted(false);
                }}
                onMuteToggle={() => {
                  sendPlayerCommand(isMuted ? 'unmute' : 'mute');
                  setIsMuted(!isMuted);
                }}
              />
            </div>

            {/* Video Title */}
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              {video.title}
            </h1>

            {/* Video Meta + Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Channel Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Folder className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {folder?.name || "VideoHub"}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {folder?.video_count || 0} videos
                  </p>
                </div>
                <Button className="ml-4 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">
                  Subscribe
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full">
                  <Button variant="ghost" size="sm" className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ThumbsUp className="w-5 h-5 mr-2" />
                    Like
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <Button variant="ghost" size="sm" className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ThumbsDown className="w-5 h-5" />
                  </Button>
                </div>
                
                <Button variant="ghost" size="sm" className="rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">
                  <Share2 className="w-5 h-5 mr-2" />
                  Share
                </Button>
                
                <Button variant="ghost" size="sm" className="rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">
                  <Download className="w-5 h-5 mr-2" />
                  Download
                </Button>
                
                <Button variant="ghost" size="icon" className="rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Description Box */}
            <div className="bg-gray-100 dark:bg-[#272727] rounded-xl p-3">
              <div className="flex flex-wrap gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                <span>{formatViews(video.views)} views</span>
                {video.created_at && (
                  <>
                    <span>•</span>
                    <span>{formatDate(video.created_at)}</span>
                  </>
                )}
                {video.duration > 0 && (
                  <>
                    <span>•</span>
                    <span>
                      {Math.floor(video.duration / 60)}:
                      {String(video.duration % 60).padStart(2, "0")}
                    </span>
                  </>
                )}
              </div>
              
              {video.description && (
                <div>
                  <p className={`text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap ${!descriptionExpanded ? 'line-clamp-2' : ''}`}>
                    {video.description}
                  </p>
                  <button
                    onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                    className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-2 hover:opacity-80"
                  >
                    {descriptionExpanded ? 'Show less' : 'Show more'}
                  </button>
                </div>
              )}
            </div>

            {/* Comments Section Placeholder */}
            <div className="pt-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Comments
              </h2>
              <div className="text-center py-12 bg-gray-50 dark:bg-[#272727] rounded-xl">
                <p className="text-gray-600 dark:text-gray-400">
                  Comments are not available for this video
                </p>
              </div>
            </div>
          </div>

          {/* Suggested Videos Sidebar */}
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Related Videos
            </h2>
            <div className="text-center py-12 bg-gray-50 dark:bg-[#272727] rounded-xl">
              <p className="text-gray-600 dark:text-gray-400">
                No related videos available
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
