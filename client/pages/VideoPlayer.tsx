import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { Video, VideoFolder, RealtimeResponse } from "@shared/api";
import { Header } from "@/components/Header";
import { ThumbsUp, ThumbsDown, Share2, Download, MoreHorizontal, Folder, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { VideoPlayerControls } from "@/components/VideoPlayerControls";
import { useAnalytics } from "@/hooks/use-analytics";
import { PlaylistManager } from "@/components/PlaylistManager";
import { apiFetch } from "@/lib/api-config";

export default function VideoPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [folder, setFolder] = useState<VideoFolder | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [currentViewers, setCurrentViewers] = useState<number>(0);
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
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const analytics = useAnalytics();

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
        // Start analytics session
        if (id) {
          analytics.startSession(id);
        }
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

  // Poll for current time and update analytics
  useEffect(() => {
    if (!playerReady) return;

    const interval = setInterval(() => {
      sendPlayerCommand('getTime');
      sendPlayerCommand('getStatus');
      
      // Update analytics
      if (isPlaying && id) {
        analytics.updateProgress({
          videoId: id,
          currentTime,
          duration,
          isPlaying,
        });
      }
    }, 1000); // Updated to 1s for analytics

    return () => clearInterval(interval);
  }, [playerReady, sendPlayerCommand, isPlaying, currentTime, duration, id]);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        const [videoResponse, videosResponse, realtimeResponse] = await Promise.all([
          apiFetch(`/api/videos/${id}`),
          apiFetch(`/api/videos`),
          apiFetch(`/api/realtime`).catch(() => null)
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

          // Get related videos from the same folder
          if (videoData.folder_id) {
            const folderVideos = videosData.videos
              .filter((v: Video) => v.folder_id === videoData.folder_id && v.id !== id)
              .slice(0, 10);
            setRelatedVideos(folderVideos);
          }
        }

        // Set realtime viewer count
        if (realtimeResponse && realtimeResponse.ok) {
          const realtimeData: RealtimeResponse = await realtimeResponse.json();
          const videoStats = realtimeData.data?.find((item) => item.id === id);
          if (videoStats) {
            setCurrentViewers(videoStats.realtime || 0);
          }
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

  // Poll for realtime stats every 30 seconds
  useEffect(() => {
    if (!id) return;

    const interval = setInterval(async () => {
      try {
        const response = await apiFetch(`/api/realtime`);
        if (response.ok) {
          const data: RealtimeResponse = await response.json();
          const videoStats = data.data?.find((item) => item.id === id);
          if (videoStats) {
            setCurrentViewers(videoStats.realtime || 0);
          }
        }
      } catch (error) {
        console.error("Error fetching realtime stats:", error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [id]);

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
                playbackSpeed={playbackSpeed}
                onPlayPause={() => {
                  const willBePlaying = !isPlaying;
                  sendPlayerCommand(isPlaying ? 'pause' : 'play');
                  setIsPlaying(willBePlaying);
                  
                  // Track pause event when video is paused (not when resuming)
                  if (!willBePlaying && id) {
                    analytics.trackPause({
                      videoId: id,
                      currentTime,
                      duration,
                      isPlaying: false,
                    });
                  }
                }}
                onSeek={(time) => {
                  sendPlayerCommand('seek', time);
                  setCurrentTime(time);
                  if (id) {
                    analytics.trackSeek({
                      videoId: id,
                      currentTime: time,
                      duration,
                      isPlaying,
                    });
                  }
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
                onPlaybackSpeedChange={(speed) => {
                  setPlaybackSpeed(speed);
                  toast.info(`Playback speed: ${speed}x`);
                  // Note: UPnShare iframe API may not support speed control
                  // This is for UI indication only
                }}
                onPictureInPictureToggle={() => {
                  if (document.pictureInPictureEnabled && iframeRef.current) {
                    if (document.pictureInPictureElement) {
                      document.exitPictureInPicture();
                    } else {
                      toast.info("Picture-in-picture mode not fully supported for iframes");
                      // Modern browsers don't allow PiP for cross-origin iframes
                    }
                  }
                }}
              />
            </div>

            {/* Video Title */}
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                {video.title}
              </h1>
              {currentViewers > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white rounded-md font-medium">
                    <Eye className="w-4 h-4" />
                    <span>{currentViewers} watching now</span>
                  </div>
                </div>
              )}
            </div>

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

          {/* Related Videos Sidebar */}
          <div className="space-y-6">
            {/* Playlist Manager */}
            <PlaylistManager currentVideoId={id} />
            
            <Separator />
            
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Related Videos
            </h2>
            {relatedVideos.length > 0 ? (
              <div className="space-y-2">
                {relatedVideos.map((relatedVideo) => (
                  <div
                    key={relatedVideo.id}
                    onClick={() => navigate(`/video/${relatedVideo.id}`)}
                    className="flex gap-2 cursor-pointer group"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-40 h-24 flex-shrink-0 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
                      {relatedVideo.thumbnail || relatedVideo.poster ? (
                        <img
                          src={relatedVideo.thumbnail || relatedVideo.poster}
                          alt={relatedVideo.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Folder className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      {relatedVideo.duration > 0 && (
                        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                          {Math.floor(relatedVideo.duration / 60)}:
                          {String(relatedVideo.duration % 60).padStart(2, "0")}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {relatedVideo.title}
                      </h3>
                      {folder && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {folder.name}
                        </p>
                      )}
                      {relatedVideo.views !== undefined && relatedVideo.views > 0 && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {formatViews(relatedVideo.views)} views
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 dark:bg-[#272727] rounded-xl">
                <p className="text-gray-600 dark:text-gray-400">
                  No related videos available
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
