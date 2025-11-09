import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Settings } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface VideoPlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
}

export function VideoPlayerControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
}: VideoPlayerControlsProps) {
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Format time (seconds to MM:SS)
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle mouse movement to show/hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }

      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };

    const container = containerRef.current?.parentElement;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", () => {
        if (isPlaying) setShowControls(false);
      });
    }

    return () => {
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          onPlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          onSeek(Math.max(0, currentTime - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          onSeek(Math.min(duration, currentTime + 5));
          break;
        case "j":
          e.preventDefault();
          onSeek(Math.max(0, currentTime - 10));
          break;
        case "l":
          e.preventDefault();
          onSeek(Math.min(duration, currentTime + 10));
          break;
        case "m":
          e.preventDefault();
          onMuteToggle();
          break;
        case "ArrowUp":
          e.preventDefault();
          onVolumeChange(Math.min(100, volume + 5));
          break;
        case "ArrowDown":
          e.preventDefault();
          onVolumeChange(Math.max(0, volume - 5));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, duration, volume, onPlayPause, onSeek, onVolumeChange, onMuteToggle]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
        showControls || !isPlaying ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Center Play/Pause Button - only show when paused or initially */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={onPlayPause}
            className="pointer-events-auto w-20 h-20 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-all hover:scale-110 active:scale-95"
          >
            <Play className="w-10 h-10 text-white ml-1" fill="white" />
          </button>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
        {/* Progress Bar */}
        <div className="group/progress px-3 pb-2">
          <div
            className="relative h-1 bg-white/30 rounded-full cursor-pointer hover:h-1.5 transition-all"
            onMouseDown={(e) => {
              setIsDraggingSeek(true);
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              onSeek(percent * duration);
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setHoveredTime(percent * duration);
              
              if (isDraggingSeek) {
                onSeek(percent * duration);
              }
            }}
            onMouseUp={() => setIsDraggingSeek(false)}
            onMouseLeave={() => {
              setIsDraggingSeek(false);
              setHoveredTime(null);
            }}
          >
            {/* Time tooltip on hover */}
            {hoveredTime !== null && (
              <div
                className="absolute bottom-full mb-2 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap"
                style={{ left: `${(hoveredTime / duration) * 100}%` }}
              >
                {formatTime(hoveredTime)}
              </div>
            )}
            
            <div
              className="absolute top-0 left-0 h-full bg-red-600 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover/progress:opacity-100 shadow-lg transition-opacity" />
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="bg-gradient-to-t from-black/90 via-black/70 to-transparent px-3 pb-2 pt-6">
          <div className="flex items-center justify-between gap-3">
            {/* Left Controls */}
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <button
                onClick={onPlayPause}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 text-white" fill="white" />
                ) : (
                  <Play className="w-7 h-7 text-white" fill="white" />
                )}
              </button>

              {/* Volume */}
              <div
                className="flex items-center gap-2 group/volume"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={onMuteToggle}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-6 h-6 text-white" />
                  ) : (
                    <Volume2 className="w-6 h-6 text-white" />
                  )}
                </button>

                {/* Volume Slider */}
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    showVolumeSlider ? "w-20 opacity-100" : "w-0 opacity-0"
                  }`}
                >
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    onValueChange={([val]) => onVolumeChange(val)}
                    max={100}
                    step={1}
                    className="w-20"
                  />
                </div>
              </div>

              {/* Time Display */}
              <div className="text-white text-sm font-medium whitespace-nowrap">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <Settings className="w-6 h-6 text-white" />
              </button>
              <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <Maximize className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
