import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from '../Button';
import { 
  Upload, Video, Scissors, Gauge, Music, Play, Pause, X, Maximize2, Lock, Unlock, 
  Crop as CropIcon, StretchHorizontal, Maximize, Minimize, Zap, Layers, Download, 
  Trash2, CheckCircle2, AlertCircle, RefreshCw, FileVideo, Sliders, Plus, FolderPlus 
} from 'lucide-react';
import TextInput from '../TextInput';
import Spinner from '../Spinner';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';

type TabMode = 'single' | 'bulk';
type VideoTool = 'trim' | 'speed' | 'audio' | 'resize' | 'crop';
type ResizeCategory = 'pixel' | 'percentage' | 'resolution' | 'ratio' | 'social';
type FitMode = 'stretch' | 'cover' | 'contain-white' | 'contain-black' | 'contain-blur';

type BulkPresetType = 'balanced' | 'small' | 'high' | 'custom';

interface BulkVideoItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  duration: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  compressedBlob: Blob | null;
  compressedUrl: string | null;
  compressedSize: number;
  errorMsg?: string;
}

interface ResizeConfig {
  category: ResizeCategory;
  width: number;
  height: number;
  percentage: number;
  fit: FitMode;
  aspectRatioLocked: boolean;
}

const SOCIAL_PRESETS = [
    { name: 'Instagram Post', w: 1080, h: 1080, icon: '📸' },
    { name: 'Instagram Story', w: 1080, h: 1920, icon: '📖' },
    { name: 'Facebook Post', w: 1200, h: 630, icon: 'fb' },
    { name: 'TikTok / Reels', w: 1080, h: 1920, icon: '🎵' },
    { name: 'YouTube', w: 1920, h: 1080, icon: '▶️' },
];

const RES_PRESETS = [
    { name: 'HD', w: 1280, h: 720 },
    { name: 'FHD', w: 1920, h: 1080 },
    { name: '2K', w: 2560, h: 1440 },
    { name: '4K', w: 3840, h: 2160 },
];

const RATIO_PRESETS = [
    { name: '1:1', ratio: 1 },
    { name: '16:9', ratio: 16/9 },
    { name: '9:16', ratio: 9/16 },
    { name: '4:3', ratio: 4/3 },
    { name: '3:4', ratio: 3/4 },
];

const CROP_RATIO_PRESETS = [
    { label: 'Tự do', ratio: undefined },
    { label: '1:1', ratio: 1 },
    { label: '16:9', ratio: 16/9 },
    { label: '9:16', ratio: 9/16 },
    { label: '4:3', ratio: 4/3 },
    { label: '3:4', ratio: 3/4 },
];

const formatFileSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const ModernSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  formatLabel?: (val: number) => string;
}> = ({ value, min, max, step, onChange, disabled, formatLabel }) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  return (
    <div className="relative w-full h-8 flex items-center select-none touch-none group">
      <div className="absolute w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div 
            className="h-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-150 ease-out" 
            style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
      />
      <div 
        className="absolute h-4 w-4 bg-white border-2 border-sky-500 rounded-full shadow-md pointer-events-none transition-all duration-150 ease-out z-0 group-hover:scale-110"
        style={{ left: `calc(${percentage}% - 8px)` }}
      />
      {formatLabel && (
          <div className="absolute -top-6 right-0 text-xs font-mono font-medium text-sky-400 bg-sky-900/50 px-2 py-0.5 rounded border border-sky-500/20 backdrop-blur-sm opacity-80 group-hover:opacity-100 transition-opacity">
              {formatLabel(value)}
          </div>
      )}
    </div>
  );
};

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

const VideoEditorTab: React.FC = () => {
  const [tabMode, setTabMode] = useState<TabMode>('single');

  // Single Video State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<VideoTool>('trim');
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [originalDimensions, setOriginalDimensions] = useState({ w: 0, h: 0 });
  
  // Editing State
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);

  // Resize State
  const [resizeConfig, setResizeConfig] = useState<ResizeConfig>({
      category: 'pixel',
      width: 1280,
      height: 720,
      percentage: 100,
      fit: 'contain-black',
      aspectRatioLocked: true,
  });

  // Crop State
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [appliedCrop, setAppliedCrop] = useState<PixelCrop | null>(null);
  const [cropAspect, setCropAspect] = useState<number | undefined>(undefined);

  // UI Dragging State
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastUiUpdateRef = useRef<number>(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);

  // ================= Bulk Compression State =================
  const [bulkItems, setBulkItems] = useState<BulkVideoItem[]>([]);
  const [bulkPreset, setBulkPreset] = useState<BulkPresetType>('balanced');
  const [customWidthPercent, setCustomWidthPercent] = useState<number>(75);
  const [customBitrateMbps, setCustomBitrateMbps] = useState<number>(2.5);
  const [bulkMuteAudio, setBulkMuteAudio] = useState<boolean>(false);
  const [bulkSpeedMultiplier, setBulkSpeedMultiplier] = useState<number>(1.0);
  const [isBulkCompressing, setIsBulkCompressing] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const bulkCancelRef = useRef<boolean>(false);

  const formatTime = (seconds: number) => {
      if (!isFinite(seconds) || isNaN(seconds)) return "00:00.0";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 10);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const parseTimeString = (str: string): number | null => {
      const parts = str.split(':');
      if (parts.length === 2) {
          const min = parseFloat(parts[0]);
          const sec = parseFloat(parts[1]);
          if (!isNaN(min) && !isNaN(sec)) {
              return (min * 60) + sec;
          }
      } else if (parts.length === 1) {
          const val = parseFloat(parts[0]);
          if (!isNaN(val)) return val;
      }
      return null;
  };

  const safePlay = (element: HTMLMediaElement | null) => {
      if (!element) return;
      const promise = element.play();
      if (promise !== undefined) {
          promise.catch(error => {
              if (error.name !== 'AbortError') {
                  console.warn("Playback prevented:", error);
              }
          });
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length > 1) {
        // Automatically switch to Bulk Mode if user selects multiple videos
        handleBulkFilesSelected(Array.from(e.target.files));
        setTabMode('bulk');
        return;
      }

      const file = e.target.files[0];
      if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        setVideoFile(file);
        setVideoUrl(url);
        
        setTrimStart(0);
        setTrimEnd(0);
        setPlaybackRate(1);
        setAudioFile(null);
        setIsMuted(false);
        setIsPlaying(false);
        setIsExporting(false);
        setAppliedCrop(null);
        setCompletedCrop(undefined);
        setCrop(undefined);
        
        const v = document.createElement('video');
        v.src = url;
        v.onloadedmetadata = () => {
            setOriginalDimensions({ w: v.videoWidth, h: v.videoHeight });
            setResizeConfig(prev => ({ ...prev, width: v.videoWidth, height: v.videoHeight }));
        };
      } else {
        toast.error("Vui lòng chọn file video hợp lệ.");
      }
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          if (file.type.startsWith('audio/')) {
              setAudioFile(file);
              if (audioRef.current) {
                  audioRef.current.src = URL.createObjectURL(file);
                  setIsMuted(true); 
              }
          }
      }
  }

  const handleClear = () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoFile(null);
      setVideoUrl(null);
      setIsExporting(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }

  const updateResize = (field: keyof ResizeConfig, value: any) => {
      setResizeConfig(prev => {
          const updated = { ...prev, [field]: value };
          if (field === 'width' && prev.aspectRatioLocked && originalDimensions.w > 0) {
              const ratio = originalDimensions.h / originalDimensions.w;
              updated.height = Math.round(Number(value) * ratio);
          } else if (field === 'height' && prev.aspectRatioLocked && originalDimensions.h > 0) {
              const ratio = originalDimensions.w / originalDimensions.h;
              updated.width = Math.round(Number(value) * ratio);
          } else if (field === 'percentage') {
              const pct = Number(value) / 100;
              updated.width = Math.round(originalDimensions.w * pct);
              updated.height = Math.round(originalDimensions.h * pct);
          }
          return updated;
      });
  };

  const setResizePreset = (w: number, h: number) => {
      setResizeConfig(prev => ({ ...prev, width: w, height: h }));
  };

  const drawCanvas = useCallback(() => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d', { alpha: false });
      if (!ctx) return;

      const video = videoRef.current;
      const { width: targetW, height: targetH, fit } = resizeConfig;
      
      let srcX = 0, srcY = 0, srcW = video.videoWidth, srcH = video.videoHeight;
      if (appliedCrop) {
          srcX = appliedCrop.x;
          srcY = appliedCrop.y;
          srcW = appliedCrop.width;
          srcH = appliedCrop.height;
      }

      if (srcW === 0 || srcH === 0) return;

      if (canvasRef.current.width !== targetW) canvasRef.current.width = targetW;
      if (canvasRef.current.height !== targetH) canvasRef.current.height = targetH;

      let drawX = 0, drawY = 0, drawW = targetW, drawH = targetH;
      const srcRatio = srcW / srcH;
      const targetRatio = targetW / targetH;

      if (fit === 'stretch') {
          drawW = targetW;
          drawH = targetH;
      } else if (fit === 'cover') {
          if (srcRatio > targetRatio) {
              drawH = targetH;
              drawW = targetH * srcRatio;
              drawX = (targetW - drawW) / 2;
          } else {
              drawW = targetW;
              drawH = targetW / srcRatio;
              drawY = (targetH - drawH) / 2;
          }
      } else {
          if (srcRatio > targetRatio) {
              drawW = targetW;
              drawH = targetW / srcRatio;
              drawY = (targetH - drawH) / 2;
          } else {
              drawH = targetH;
              drawW = targetH * srcRatio;
              drawX = (targetW - drawW) / 2;
          }
      }

      if (fit === 'contain-white') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
      } else if (fit === 'contain-black') {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, targetW, targetH);
      } else if (fit === 'contain-blur') {
          ctx.filter = 'blur(20px)';
          const coverW = (srcRatio > targetRatio) ? targetH * srcRatio : targetW;
          const coverH = (srcRatio > targetRatio) ? targetH : targetW / srcRatio;
          const coverX = (targetW - coverW) / 2;
          const coverY = (targetH - coverH) / 2;
          ctx.drawImage(video, srcX, srcY, srcW, srcH, coverX, coverY, coverW, coverH);
          ctx.filter = 'none';
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(0, 0, targetW, targetH);
      }

      ctx.drawImage(video, srcX, srcY, srcW, srcH, drawX, drawY, drawW, drawH);

  }, [resizeConfig, appliedCrop]);

  const loop = useCallback(() => {
      if (!videoRef.current) return;

      if (activeTool === 'crop' && cropVideoRef.current) {
          if (Math.abs(cropVideoRef.current.currentTime - videoRef.current.currentTime) > 0.1) {
              cropVideoRef.current.currentTime = videoRef.current.currentTime;
          }
          if (!videoRef.current.paused) safePlay(cropVideoRef.current);
          else cropVideoRef.current.pause();
      }

      if (!videoRef.current.paused && !videoRef.current.ended) {
          const time = videoRef.current.currentTime;
          
          if (isExporting) {
              drawCanvas();
              
              const now = performance.now();
              if (now - lastUiUpdateRef.current > 200) {
                  setExportProgress(Math.min(100, Math.max(0, ((time - trimStart) / (trimEnd - trimStart)) * 100)));
                  lastUiUpdateRef.current = now;
              }

              if (time >= trimEnd) {
                  finishExport();
                  return;
              }
          } else {
              setCurrentTime(time);
              drawCanvas();
              if (time >= trimEnd) {
                  videoRef.current.currentTime = trimStart;
                  if (audioRef.current) audioRef.current.currentTime = 0;
              }
          }
          animationFrameRef.current = requestAnimationFrame(loop);
      } else {
          drawCanvas();
      }
  }, [drawCanvas, activeTool, isExporting, trimStart, trimEnd]);

  useEffect(() => {
      requestAnimationFrame(drawCanvas);
  }, [resizeConfig, appliedCrop, drawCanvas, videoUrl]);

  const onLoadedMetadata = () => {
      if (videoRef.current) {
          const vidDuration = videoRef.current.duration;
          setDuration(vidDuration);
          setTrimEnd(vidDuration);
          setTrimStart(0);
          drawCanvas();
      }
  };

  const togglePlay = () => {
      if (isExporting) return;

      if (videoRef.current) {
          if (isPlaying) {
              videoRef.current.pause();
              audioRef.current?.pause();
              cropVideoRef.current?.pause();
              if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          } else {
              if (videoRef.current.currentTime >= trimEnd) {
                  videoRef.current.currentTime = trimStart;
                  if(audioRef.current) audioRef.current.currentTime = 0;
              }
              safePlay(videoRef.current);
              safePlay(audioRef.current);
              safePlay(cropVideoRef.current);
              animationFrameRef.current = requestAnimationFrame(loop);
          }
          setIsPlaying(!isPlaying);
      }
  };

  const onCropVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const { width, height } = e.currentTarget;
      if (!crop && !appliedCrop) {
          setCrop(centerAspectCrop(width, height, 16 / 9));
      }
  };

  const handleCropAspectChange = (value: number | undefined) => {
      setCropAspect(value);
      if (cropVideoRef.current) {
          const { width, height } = cropVideoRef.current.getBoundingClientRect();
          if (value) {
              setCrop(centerAspectCrop(width, height, value));
          } else {
              setCrop(centerCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 }, width, height));
          }
      }
  };

  const handleApplyCrop = () => {
      if (completedCrop) {
          const videoElement = cropVideoRef.current;
          if (videoElement) {
              const scaleX = videoElement.videoWidth / videoElement.width;
              const scaleY = videoElement.videoHeight / videoElement.height;
              
              const finalCrop: PixelCrop = {
                  x: completedCrop.x * scaleX,
                  y: completedCrop.y * scaleY,
                  width: completedCrop.width * scaleX,
                  height: completedCrop.height * scaleY,
                  unit: 'px'
              };
              
              setAppliedCrop(finalCrop);
              setResizeConfig(prev => ({
                  ...prev,
                  width: Math.round(finalCrop.width),
                  height: Math.round(finalCrop.height),
                  category: 'pixel'
              }));
          }
      }
      setActiveTool('resize');
  };

  const handleCancelCrop = () => {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setActiveTool('resize');
  };

  const finishExport = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      
      setIsExporting(false);
      setIsPlaying(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const handleSave = async () => {
      if (!videoRef.current || !canvasRef.current || isExporting) return;

      setIsExporting(true);
      setIsPlaying(true);
      setExportProgress(0);
      lastUiUpdateRef.current = 0;
      chunksRef.current = [];

      try {
          const canvasStream = canvasRef.current.captureStream(30); 
          let finalStream = canvasStream;

          if (audioFile && audioRef.current) {
              const audioEl = audioRef.current as any;
              const audioStream = audioEl.captureStream ? audioEl.captureStream() : (audioEl.mozCaptureStream ? audioEl.mozCaptureStream() : null);
              
              if (audioStream) {
                  const videoTrack = canvasStream.getVideoTracks()[0];
                  const audioTrack = audioStream.getAudioTracks()[0];
                  if (videoTrack && audioTrack) {
                      finalStream = new MediaStream([videoTrack, audioTrack]);
                  }
              }
          } else if (!isMuted) {
              const videoEl = videoRef.current as any;
              const vidStream = videoEl.captureStream ? videoEl.captureStream() : videoEl.mozCaptureStream();
              const audioTrack = vidStream.getAudioTracks()[0];
              const videoTrack = canvasStream.getVideoTracks()[0];
              
              if (audioTrack && videoTrack) {
                  finalStream = new MediaStream([videoTrack, audioTrack]);
              }
          }

          const mimeTypes = ['video/webm; codecs=vp9', 'video/webm', 'video/mp4'];
          let selectedMimeType = '';
          for (const type of mimeTypes) {
              if (MediaRecorder.isTypeSupported(type)) {
                  selectedMimeType = type;
                  break;
              }
          }
          
          const options = selectedMimeType ? { mimeType: selectedMimeType, videoBitsPerSecond: 5000000 } : undefined;
          const recorder = new MediaRecorder(finalStream, options);

          recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.onstop = () => {
              const blob = new Blob(chunksRef.current, { type: selectedMimeType || 'video/webm' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const ext = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
              a.download = `video_edited_${resizeConfig.width}x${resizeConfig.height}_${Date.now()}.${ext}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
          };

          mediaRecorderRef.current = recorder;

          videoRef.current.currentTime = trimStart;
          if (audioRef.current) audioRef.current.currentTime = 0;
          await new Promise(r => setTimeout(r, 300)); 

          recorder.start();
          try {
            await videoRef.current.play();
            if(audioRef.current && !isMuted) await audioRef.current.play();
            animationFrameRef.current = requestAnimationFrame(loop);
          } catch(e) {
              console.error("Export playback failed", e);
              finishExport();
          }

      } catch (e) {
          console.error("Export initialization failed", e);
          toast.error("Lỗi khởi tạo quá trình xuất video.");
          setIsExporting(false);
          setIsPlaying(false);
      }
  };

  // ==================== Bulk Compression Helpers & Logic ====================

  const handleBulkFilesSelected = async (files: File[]) => {
      const validFiles = files.filter(f => f.type.startsWith('video/'));
      if (validFiles.length === 0) {
          toast.error("Không tìm thấy file video hợp lệ.");
          return;
      }

      const newItems: BulkVideoItem[] = [];

      for (let i = 0; i < validFiles.length; i++) {
          const file = validFiles[i];
          const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          
          let duration = 0;
          let width = 0;
          let height = 0;

          try {
              const url = URL.createObjectURL(file);
              const tempVid = document.createElement('video');
              tempVid.src = url;
              await new Promise((res) => {
                  tempVid.onloadedmetadata = () => {
                      duration = tempVid.duration || 0;
                      width = tempVid.videoWidth || 0;
                      height = tempVid.videoHeight || 0;
                      res(true);
                  };
                  tempVid.onerror = () => res(false);
              });
              URL.revokeObjectURL(url);
          } catch (e) {
              console.warn("Could not load metadata for", file.name);
          }

          newItems.push({
              id,
              file,
              name: file.name,
              originalSize: file.size,
              originalWidth: width,
              originalHeight: height,
              duration,
              status: 'pending',
              progress: 0,
              compressedBlob: null,
              compressedUrl: null,
              compressedSize: 0,
          });
      }

      setBulkItems(prev => [...prev, ...newItems]);
      toast.success(`Đã thêm ${newItems.length} video vào danh sách nén`);
  };

  const handleRemoveBulkItem = (id: string) => {
      setBulkItems(prev => {
          const item = prev.find(x => x.id === id);
          if (item && item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
          return prev.filter(x => x.id !== id);
      });
  };

  const handleClearAllBulk = () => {
      bulkItems.forEach(item => {
          if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
      });
      setBulkItems([]);
  };

  const compressSingleVideoCore = async (
      item: BulkVideoItem,
      onProgress: (pct: number) => void
  ): Promise<{ blob: Blob; size: number }> => {
      const video = document.createElement('video');
      const fileUrl = URL.createObjectURL(item.file);
      video.src = fileUrl;
      video.muted = true;
      video.playsInline = true;

      await new Promise((resolve, reject) => {
          video.onloadedmetadata = () => resolve(true);
          video.onerror = () => reject(new Error("Lỗi đọc file video"));
      });

      const origW = video.videoWidth || 1280;
      const origH = video.videoHeight || 720;
      const dur = video.duration || 1;

      let scale = 1;
      let targetBitrate = 2500000; 

      if (bulkPreset === 'balanced') {
          scale = origW > 1280 ? 1280 / origW : 1;
          targetBitrate = 2500000;
      } else if (bulkPreset === 'small') {
          scale = origW > 854 ? 854 / origW : 0.6;
          targetBitrate = 1200000;
      } else if (bulkPreset === 'high') {
          scale = 1;
          targetBitrate = 5000000;
      } else {
          scale = customWidthPercent / 100;
          targetBitrate = customBitrateMbps * 1000000;
      }

      let targetW = Math.max(160, Math.round((origW * scale) / 2) * 2);
      let targetH = Math.max(120, Math.round((origH * scale) / 2) * 2);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error("Không thể khởi tạo Canvas Context");

      const canvasStream = canvas.captureStream(30);
      let finalStream = canvasStream;

      if (!bulkMuteAudio) {
          try {
              const vidAny = video as any;
              const vidStream = vidAny.captureStream ? vidAny.captureStream() : (vidAny.mozCaptureStream ? vidAny.mozCaptureStream() : null);
              if (vidStream) {
                  const audioTrack = vidStream.getAudioTracks()[0];
                  const videoTrack = canvasStream.getVideoTracks()[0];
                  if (audioTrack && videoTrack) {
                      finalStream = new MediaStream([videoTrack, audioTrack]);
                  }
              }
          } catch (e) {
              console.warn("Audio track capture omitted", e);
          }
      }

      const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
      let selectedMime = '';
      for (const t of mimeTypes) {
          if (MediaRecorder.isTypeSupported(t)) {
              selectedMime = t;
              break;
          }
      }

      const options = selectedMime ? { mimeType: selectedMime, videoBitsPerSecond: targetBitrate } : undefined;
      const recorder = new MediaRecorder(finalStream, options);

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
      };

      const recordPromise = new Promise<Blob>((resolve, reject) => {
          recorder.onstop = () => {
              const outBlob = new Blob(chunks, { type: selectedMime || 'video/webm' });
              resolve(outBlob);
          };
          recorder.onerror = (err) => reject(err);
      });

      video.playbackRate = Math.min(3, Math.max(0.5, bulkSpeedMultiplier));
      video.currentTime = 0;
      await new Promise(r => setTimeout(r, 150));

      recorder.start(100);
      await video.play();

      let animId = 0;
      const renderLoop = () => {
          if (bulkCancelRef.current || video.paused || video.ended || video.currentTime >= dur) {
              if (recorder.state !== 'inactive') recorder.stop();
              cancelAnimationFrame(animId);
              return;
          }

          ctx.drawImage(video, 0, 0, origW, origH, 0, 0, targetW, targetH);
          const pct = Math.min(100, Math.round((video.currentTime / dur) * 100));
          onProgress(pct);

          animId = requestAnimationFrame(renderLoop);
      };

      renderLoop();

      const outBlob = await recordPromise;
      URL.revokeObjectURL(fileUrl);
      return { blob: outBlob, size: outBlob.size };
  };

  const handleStartBulkCompression = async () => {
      const pendingItems = bulkItems.filter(x => x.status === 'pending' || x.status === 'error');
      if (pendingItems.length === 0) {
          toast.error("Không có video nào trong hàng chờ nén.");
          return;
      }

      setIsBulkCompressing(true);
      bulkCancelRef.current = false;
      setBulkProgress({ current: 0, total: pendingItems.length });

      for (let i = 0; i < pendingItems.length; i++) {
          if (bulkCancelRef.current) break;

          const item = pendingItems[i];
          setBulkProgress({ current: i + 1, total: pendingItems.length });

          // Mark active
          setBulkItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'processing', progress: 0 } : x));

          try {
              const { blob, size } = await compressSingleVideoCore(item, (pct) => {
                  setBulkItems(prev => prev.map(x => x.id === item.id ? { ...x, progress: pct } : x));
              });

              const compressedUrl = URL.createObjectURL(blob);
              setBulkItems(prev => prev.map(x => x.id === item.id ? {
                  ...x,
                  status: 'completed',
                  progress: 100,
                  compressedBlob: blob,
                  compressedUrl,
                  compressedSize: size
              } : x));

          } catch (e: any) {
              console.error("Bulk compression error for file:", item.name, e);
              setBulkItems(prev => prev.map(x => x.id === item.id ? {
                  ...x,
                  status: 'error',
                  errorMsg: e.message || 'Lỗi nén video'
              } : x));
          }
      }

      setIsBulkCompressing(false);
      toast.success("Hoàn tất quá trình nén video hàng loạt!");
  };

  const handleDownloadZipAll = async () => {
      const completed = bulkItems.filter(x => x.status === 'completed' && x.compressedBlob);
      if (completed.length === 0) {
          toast.error("Chưa có video nào hoàn thành nén để tải về.");
          return;
      }

      toast.loading("Đang đóng gói file ZIP...", { id: 'zip' });
      try {
          const zip = new JSZip();
          const folder = zip.folder("videos_compressed");

          completed.forEach((item, index) => {
              const nameParts = item.name.split('.');
              const ext = item.compressedBlob?.type.includes('mp4') ? 'mp4' : 'webm';
              const baseName = nameParts.slice(0, -1).join('.') || `video_${index + 1}`;
              const fileName = `${baseName}_compressed.${ext}`;
              folder?.file(fileName, item.compressedBlob!);
          });

          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, `video_compressed_batch_${Date.now()}.zip`);
          toast.success("Đã tải về file ZIP thành công!", { id: 'zip' });
      } catch (e) {
          console.error("ZIP creation error", e);
          toast.error("Lỗi tạo file ZIP", { id: 'zip' });
      }
  };

  // Stats
  const totalOriginalSize = bulkItems.reduce((acc, curr) => acc + curr.originalSize, 0);
  const totalCompressedSize = bulkItems.reduce((acc, curr) => acc + (curr.compressedSize || curr.originalSize), 0);
  const totalSavedPercent = totalOriginalSize > 0 && totalCompressedSize < totalOriginalSize
      ? Math.round(((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Tab Header Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-2">
              <button
                  onClick={() => setTabMode('single')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      tabMode === 'single'
                      ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                  <Video className="w-4 h-4" />
                  Chỉnh Sửa Video (Đơn lẻ)
              </button>
              <button
                  onClick={() => setTabMode('bulk')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      tabMode === 'bulk'
                      ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                  Nén Video Hàng Loạt (Bulk Compress)
              </button>
          </div>

          <div className="text-xs text-zinc-400 flex items-center gap-2">
              <span className="bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-700">
                  {tabMode === 'single' ? 'Cắt, Crop, Đổi kích thước, Âm thanh' : 'Nén nhiều Video siêu nhanh & Tải ZIP'}
              </span>
          </div>
      </div>

      {/* Mode 2: BULK VIDEO COMPRESSOR */}
      {tabMode === 'bulk' && (
          <div className="space-y-6">
              {/* Presets & Settings Controls */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                          <Sliders className="w-5 h-5 text-sky-400" />
                          Cấu hình Mức Nén Video Hàng Loạt
                      </h3>
                      <span className="text-xs text-zinc-400">Áp dụng cho tất cả các file trong danh sách</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <button
                          onClick={() => setBulkPreset('balanced')}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                              bulkPreset === 'balanced'
                              ? 'bg-sky-950/60 border-sky-500 text-sky-300 ring-1 ring-sky-500/50'
                              : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                          }`}
                      >
                          <div className="font-bold text-sm text-zinc-200 flex items-center gap-1.5 mb-1">
                              <span>⚖️ Cân bằng</span>
                              <span className="text-[10px] bg-sky-900/80 text-sky-300 px-1.5 py-0.2 rounded">Đề xuất</span>
                          </div>
                          <p className="text-xs text-zinc-400">Nén 720p • Bitrate 2.5Mbps</p>
                          <p className="text-[11px] text-emerald-400 mt-1 font-medium">Giảm ~ 50% - 70% dung lượng</p>
                      </button>

                      <button
                          onClick={() => setBulkPreset('small')}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                              bulkPreset === 'small'
                              ? 'bg-sky-950/60 border-sky-500 text-sky-300 ring-1 ring-sky-500/50'
                              : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                          }`}
                      >
                          <div className="font-bold text-sm text-zinc-200 mb-1">📉 Nén Siêu Nhỏ</div>
                          <p className="text-xs text-zinc-400">Nén 480p • Bitrate 1.2Mbps</p>
                          <p className="text-[11px] text-emerald-400 mt-1 font-medium">Giảm ~ 70% - 85% dung lượng</p>
                      </button>

                      <button
                          onClick={() => setBulkPreset('high')}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                              bulkPreset === 'high'
                              ? 'bg-sky-950/60 border-sky-500 text-sky-300 ring-1 ring-sky-500/50'
                              : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                          }`}
                      >
                          <div className="font-bold text-sm text-zinc-200 mb-1">🎬 Chất Lượng Sắc Nét</div>
                          <p className="text-xs text-zinc-400">Giữ 1080p • Bitrate 5.0Mbps</p>
                          <p className="text-[11px] text-emerald-400 mt-1 font-medium">Giảm ~ 30% - 50% dung lượng</p>
                      </button>

                      <button
                          onClick={() => setBulkPreset('custom')}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                              bulkPreset === 'custom'
                              ? 'bg-sky-950/60 border-sky-500 text-sky-300 ring-1 ring-sky-500/50'
                              : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                          }`}
                      >
                          <div className="font-bold text-sm text-zinc-200 mb-1">🛠️ Tùy Chỉnh Chi Tiết</div>
                          <p className="text-xs text-zinc-400">Tự chỉnh Kích thước & Bitrate</p>
                          <p className="text-[11px] text-sky-400 mt-1 font-medium">Thiết lập thông số riêng</p>
                      </button>
                  </div>

                  {/* Custom Settings Sub-Panel */}
                  {bulkPreset === 'custom' && (
                      <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                          <div>
                              <label className="text-xs text-zinc-300 font-medium block mb-2">Tỷ lệ kích thước ({customWidthPercent}%)</label>
                              <ModernSlider
                                  min={25} max={100} step={5}
                                  value={customWidthPercent}
                                  onChange={setCustomWidthPercent}
                                  formatLabel={(v) => `${v}%`}
                              />
                          </div>

                          <div>
                              <label className="text-xs text-zinc-300 font-medium block mb-2">Bitrate ({customBitrateMbps} Mbps)</label>
                              <ModernSlider
                                  min={0.5} max={10} step={0.5}
                                  value={customBitrateMbps}
                                  onChange={setCustomBitrateMbps}
                                  formatLabel={(v) => `${v} Mbps`}
                              />
                          </div>

                          <div className="flex items-center gap-6 pt-2">
                              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                                  <input 
                                      type="checkbox" 
                                      checked={bulkMuteAudio}
                                      onChange={e => setBulkMuteAudio(e.target.checked)}
                                      className="rounded bg-zinc-800 border-zinc-700 text-sky-500 focus:ring-0 w-4 h-4"
                                  />
                                  <span>Tắt tiếng (Mute audio để nén nhỏ hơn)</span>
                              </label>
                          </div>
                      </div>
                  )}
              </div>

              {/* Upload Dropzone */}
              <div className="bg-zinc-900/70 border-2 border-dashed border-zinc-700 rounded-2xl p-8 text-center hover:border-sky-500 transition-colors relative overflow-hidden group">
                  <input 
                      type="file" 
                      accept="video/*" 
                      multiple 
                      onChange={(e) => {
                          if (e.target.files) handleBulkFilesSelected(Array.from(e.target.files));
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center">
                      <div className="p-4 bg-sky-950/50 rounded-full border border-sky-500/30 text-sky-400 mb-3 group-hover:scale-110 transition-transform">
                          <FolderPlus className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">
                          Kéo thả nhiều Video vào đây hoặc Nhấp để chọn File
                      </h3>
                      <p className="text-sm text-zinc-400 max-w-md">
                          Hỗ trợ định dạng MP4, MOV, WEBM, MKV, AVI... Nén đồng thời nhiều file với tốc độ cao.
                      </p>
                  </div>
              </div>

              {/* File List & Progress Overview */}
              {bulkItems.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden space-y-4">
                      {/* Top Action Bar */}
                      <div className="p-4 bg-zinc-800/50 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                              <div>
                                  <span className="text-sm font-bold text-white">Danh sách Video ({bulkItems.length})</span>
                                  <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                                      <span>Tổng dung lượng gốc: <strong className="text-zinc-200">{formatFileSize(totalOriginalSize)}</strong></span>
                                      {totalCompressedSize > 0 && totalCompressedSize < totalOriginalSize && (
                                          <span className="text-emerald-400 font-semibold">
                                               Sau nén: {formatFileSize(totalCompressedSize)} (Tiết kiệm {totalSavedPercent}%)
                                          </span>
                                      )}
                                  </div>
                              </div>
                          </div>

                          <div className="flex items-center gap-2">
                              <Button 
                                  onClick={handleClearAllBulk} 
                                  disabled={isBulkCompressing} 
                                  colorScheme="ghost" 
                                  className="!w-auto !py-2 !px-3 !text-xs text-red-400 hover:text-red-300"
                              >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Xóa tất cả
                              </Button>

                              <Button 
                                  onClick={handleDownloadZipAll} 
                                  disabled={isBulkCompressing || !bulkItems.some(x => x.status === 'completed')}
                                  colorScheme="slate"
                                  className="!w-auto !py-2 !px-4 !text-xs"
                              >
                                  <Download className="w-4 h-4 mr-1 text-sky-400" />
                                  Tải tất cả (.ZIP)
                              </Button>

                              <Button 
                                  onClick={handleStartBulkCompression} 
                                  disabled={isBulkCompressing}
                                  className="!w-auto !py-2 !px-5 !text-xs bg-amber-500 hover:bg-amber-600 text-black font-bold"
                              >
                                  {isBulkCompressing ? (
                                      <>
                                          <Spinner /> Đang nén ({bulkProgress.current}/{bulkProgress.total})...
                                      </>
                                  ) : (
                                      <>
                                          <Zap className="w-4 h-4 mr-1 fill-black" />
                                          Bắt đầu Nén Hàng Loạt
                                      </>
                                  )}
                              </Button>
                          </div>
                      </div>

                      {/* Items List */}
                      <div className="divide-y divide-zinc-800 max-h-[500px] overflow-y-auto px-4">
                          {bulkItems.map((item) => {
                              const isSaved = item.compressedSize > 0 && item.compressedSize < item.originalSize;
                              const savedPct = isSaved ? Math.round(((item.originalSize - item.compressedSize) / item.originalSize) * 100) : 0;

                              return (
                                  <div key={item.id} className="py-3.5 flex flex-wrap items-center justify-between gap-4">
                                      <div className="flex items-center gap-3 min-w-[240px] max-w-md">
                                          <div className="p-2.5 bg-zinc-800 rounded-lg border border-zinc-700 text-sky-400 shrink-0">
                                              <FileVideo className="w-5 h-5" />
                                          </div>
                                          <div className="overflow-hidden">
                                              <p className="text-sm font-semibold text-zinc-200 truncate">{item.name}</p>
                                              <p className="text-xs text-zinc-400">
                                                  Gốc: {formatFileSize(item.originalSize)}
                                                  {item.originalWidth > 0 && ` • ${item.originalWidth}x${item.originalHeight}`}
                                              </p>
                                          </div>
                                      </div>

                                      {/* Status & Progress */}
                                      <div className="flex-1 max-w-xs px-2">
                                          {item.status === 'pending' && (
                                              <span className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-full border border-zinc-700">
                                                  Chờ nén...
                                              </span>
                                          )}

                                          {item.status === 'processing' && (
                                              <div className="space-y-1">
                                                  <div className="flex justify-between text-xs text-amber-400 font-medium">
                                                      <span>Đang nén...</span>
                                                      <span>{item.progress}%</span>
                                                  </div>
                                                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                      <div 
                                                          className="bg-amber-400 h-1.5 rounded-full transition-all duration-150"
                                                          style={{ width: `${item.progress}%` }}
                                                      />
                                                  </div>
                                              </div>
                                          )}

                                          {item.status === 'completed' && (
                                              <div className="flex items-center gap-2 text-xs">
                                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                  <div>
                                                      <span className="text-emerald-400 font-bold">
                                                          {formatFileSize(item.compressedSize)}
                                                      </span>
                                                      {isSaved && (
                                                          <span className="ml-1.5 bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded text-[10px]">
                                                              -{savedPct}%
                                                          </span>
                                                      )}
                                                  </div>
                                              </div>
                                          )}

                                          {item.status === 'error' && (
                                              <div className="flex items-center gap-1.5 text-xs text-red-400">
                                                  <AlertCircle className="w-4 h-4 shrink-0" />
                                                  <span>{item.errorMsg || 'Lỗi nén'}</span>
                                              </div>
                                          )}
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex items-center gap-2">
                                          {item.status === 'completed' && item.compressedUrl && (
                                              <a
                                                  href={item.compressedUrl}
                                                  download={`compressed_${item.name}`}
                                                  className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors"
                                              >
                                                  <Download className="w-3.5 h-3.5" />
                                                  Tải về
                                              </a>
                                          )}

                                          <button
                                              onClick={() => handleRemoveBulkItem(item.id)}
                                              disabled={isBulkCompressing && item.status === 'processing'}
                                              className="p-1.5 text-zinc-500 hover:text-red-400 rounded transition-colors"
                                              title="Xóa"
                                          >
                                              <X className="w-4 h-4" />
                                          </button>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* Mode 1: SINGLE VIDEO EDITOR */}
      {tabMode === 'single' && (
          <>
              {!videoFile ? (
                  <div className="flex flex-col items-center justify-center text-center p-8 bg-zinc-800/30 rounded-2xl border border-zinc-700 h-[60vh]">
                      <Video className="w-16 h-16 text-zinc-500 mb-4" />
                      <h3 className="text-lg font-semibold text-zinc-300">Trình chỉnh sửa Video Đơn Lẻ</h3>
                      <p className="text-zinc-400 mb-6">Cắt, cắt xén, thay đổi kích thước, tốc độ và âm thanh.</p>
                      <label className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-3 px-6 rounded-md cursor-pointer transition-colors flex items-center gap-2">
                          <Upload className="w-5 h-5" />
                          Tải Video lên
                          <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                      </label>
                  </div>
              ) : (
                  <div className="flex flex-col h-[calc(100vh-12rem)] bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl relative">
                      {isExporting && (
                          <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center">
                              <Spinner />
                              <h3 className="text-xl font-bold text-white mt-4">Đang kết xuất video...</h3>
                              <p className="text-zinc-400 text-sm mt-2">Kích thước: {resizeConfig.width}x{resizeConfig.height}</p>
                              <div className="mt-6 w-64 bg-zinc-700 rounded-full h-2 overflow-hidden">
                                  <div 
                                    className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${exportProgress}%` }}
                                  ></div>
                              </div>
                              <p className="text-xs text-zinc-500 mt-2">{Math.round(exportProgress)}%</p>
                              <button 
                                onClick={finishExport}
                                className="mt-8 px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/50 rounded hover:bg-red-600/40 transition-colors text-sm"
                              >
                                  Hủy bỏ
                              </button>
                          </div>
                      )}

                      <div className="flex items-center justify-between p-3 bg-zinc-900 border-b border-zinc-700">
                          <div className="flex items-center gap-2 text-zinc-300">
                              <Video className="w-5 h-5" />
                              <span className="font-medium truncate max-w-[200px]">{videoFile.name}</span>
                              <span className="text-xs text-zinc-500 ml-2">({originalDimensions.w}x{originalDimensions.h})</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <Button onClick={handleClear} disabled={isExporting} colorScheme="ghost" className="!w-auto !py-1.5 !px-3 !text-xs">
                                  Đóng
                              </Button>
                              <Button onClick={handleSave} disabled={isExporting} className="!w-auto !py-1.5 !px-4 !text-xs">
                                  {isExporting ? 'Đang lưu...' : 'Lưu Video'}
                              </Button>
                          </div>
                      </div>

                      <div className="flex flex-1 min-h-0">
                          <div className="flex-1 flex flex-col bg-black relative">
                              <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-zinc-950/50">
                                  <video
                                      ref={videoRef}
                                      src={videoUrl!}
                                      className="hidden"
                                      onLoadedMetadata={onLoadedMetadata}
                                      onEnded={() => { setIsPlaying(false); if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); }}
                                      crossOrigin="anonymous"
                                      playsInline
                                  />
                                  <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
                                  
                                  {activeTool === 'crop' ? (
                                      <ReactCrop
                                          crop={crop}
                                          onChange={(_, percentCrop) => setCrop(percentCrop)}
                                          onComplete={(c) => setCompletedCrop(c)}
                                          aspect={cropAspect}
                                          className="max-h-full"
                                      >
                                          <video
                                              ref={cropVideoRef}
                                              src={videoUrl!}
                                              style={{ maxHeight: 'calc(100vh - 350px)', maxWidth: '100%' }}
                                              onLoadedMetadata={onCropVideoLoad}
                                              className="block"
                                          />
                                      </ReactCrop>
                                  ) : (
                                      <canvas 
                                        ref={canvasRef} 
                                        className="max-w-full max-h-full shadow-2xl object-contain bg-[#111]"
                                        style={{ aspectRatio: `${resizeConfig.width} / ${resizeConfig.height}` }}
                                        onClick={togglePlay}
                                      />
                                  )}

                                  {!isPlaying && !isExporting && activeTool !== 'crop' && (
                                      <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors group z-20">
                                          <div className="p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-full group-hover:scale-110 transition-transform">
                                              <Play className="w-12 h-12 text-white drop-shadow-md" />
                                          </div>
                                      </button>
                                  )}
                              </div>

                              <div className="h-40 bg-zinc-900 border-t border-zinc-700 p-4 flex flex-col justify-end gap-2 select-none relative z-10">
                                  <div className="flex justify-between text-xs text-zinc-400 font-mono mb-1">
                                      <span>{formatTime(currentTime)}</span>
                                      <span>{formatTime(duration)}</span>
                                  </div>

                                  <div 
                                    ref={timelineRef}
                                    className="relative h-14 bg-zinc-800 rounded-lg mb-3 group cursor-pointer border border-zinc-700 overflow-visible"
                                    onMouseDown={(e) => {
                                        if (!isDraggingStart && !isDraggingEnd && !isExporting) {
                                            setIsScrubbing(true);
                                            // scrub logic
                                        }
                                    }}
                                  >
                                        <div className="absolute inset-0 flex overflow-hidden opacity-20 pointer-events-none rounded-lg">
                                            {Array.from({length: 30}).map((_, i) => (
                                                <div key={i} className="flex-1 border-r border-white/20 bg-zinc-600"></div>
                                            ))}
                                        </div>

                                        <div className="absolute top-0 bottom-0 left-0 bg-black/70 pointer-events-none rounded-l-lg" style={{ width: `${(trimStart / duration) * 100}%` }}></div>
                                        <div className="absolute top-0 bottom-0 right-0 bg-black/70 pointer-events-none rounded-r-lg" style={{ width: `${100 - (trimEnd / duration) * 100}%` }}></div>

                                        <div 
                                            className="absolute top-0 bottom-0 border-y-2 border-sky-500/50 bg-sky-500/5 pointer-events-none"
                                            style={{ left: `${(trimStart / duration) * 100}%`, right: `${100 - (trimEnd / duration) * 100}%` }}
                                        ></div>

                                        <div 
                                            className="absolute top-0 bottom-0 w-px bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10 pointer-events-none"
                                            style={{ left: `${(currentTime / duration) * 100}%` }}
                                        >
                                            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-full shadow-sm border border-zinc-300"></div>
                                        </div>
                                  </div>

                                  <div className="flex justify-center">
                                      <button onClick={togglePlay} disabled={isExporting} className={`text-zinc-200 hover:text-white p-2 transition-transform active:scale-95 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                          {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                                      </button>
                                  </div>
                              </div>
                          </div>

                          <div className="w-16 bg-zinc-900 border-l border-zinc-700 flex flex-col items-center py-4 gap-4 z-20">
                              <button onClick={() => setActiveTool('trim')} className={`p-3 rounded-xl transition-all ${activeTool === 'trim' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`} title="Trim">
                                  <Scissors className="w-6 h-6" />
                              </button>
                              <button onClick={() => setActiveTool('crop')} className={`p-3 rounded-xl transition-all ${activeTool === 'crop' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`} title="Crop">
                                  <CropIcon className="w-6 h-6" />
                              </button>
                              <button onClick={() => setActiveTool('resize')} className={`p-3 rounded-xl transition-all ${activeTool === 'resize' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`} title="Resize">
                                  <Maximize2 className="w-6 h-6" />
                              </button>
                              <button onClick={() => setActiveTool('speed')} className={`p-3 rounded-xl transition-all ${activeTool === 'speed' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`} title="Speed">
                                  <Gauge className="w-6 h-6" />
                              </button>
                              <button onClick={() => setActiveTool('audio')} className={`p-3 rounded-xl transition-all ${activeTool === 'audio' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`} title="Audio">
                                  <Music className="w-6 h-6" />
                              </button>
                          </div>

                          <div className="w-80 bg-zinc-900 border-l border-zinc-700 p-4 overflow-y-auto">
                              {activeTool === 'trim' && (
                                  <div className="space-y-6">
                                      <h3 className="text-lg font-bold text-zinc-200 mb-2 flex items-center gap-2">
                                          <Scissors className="w-5 h-5"/> Cắt Video
                                      </h3>
                                      <div className="space-y-3">
                                          <label className="block text-sm font-medium text-zinc-300">Bắt đầu</label>
                                          <TextInput 
                                            placeholder="00:00.0"
                                            value={formatTime(trimStart)} 
                                            disabled={isExporting}
                                            onBlur={e => {
                                                const val = parseTimeString(e.target.value);
                                                if (val !== null) setTrimStart(Math.max(0, Math.min(val, trimEnd - 0.1)));
                                                else e.target.value = formatTime(trimStart);
                                            }}
                                          />
                                      </div>
                                      <div className="space-y-3">
                                          <label className="block text-sm font-medium text-zinc-300">Kết thúc</label>
                                          <TextInput 
                                            placeholder="00:00.0"
                                            value={formatTime(trimEnd)} 
                                            disabled={isExporting}
                                            onBlur={e => {
                                                const val = parseTimeString(e.target.value);
                                                if (val !== null) setTrimEnd(Math.min(Math.max(val, trimStart + 0.1), duration));
                                                else e.target.value = formatTime(trimEnd);
                                            }}
                                          />
                                      </div>
                                  </div>
                              )}

                              {activeTool === 'crop' && (
                                  <div className="space-y-6 animate-fade-in">
                                      <h3 className="text-lg font-bold text-zinc-200 mb-2 flex items-center gap-2">
                                          <CropIcon className="w-5 h-5"/> Cắt Hình
                                      </h3>
                                      
                                      <div className="space-y-3">
                                          <label className="text-sm font-medium text-zinc-300">Tỷ lệ khung hình</label>
                                          <div className="grid grid-cols-3 gap-2">
                                              {CROP_RATIO_PRESETS.map((preset) => (
                                                  <button
                                                      key={preset.label}
                                                      onClick={() => handleCropAspectChange(preset.ratio)}
                                                      className={`py-2 px-1 text-xs rounded border transition-colors ${cropAspect === preset.ratio && cropAspect !== undefined ? 'bg-sky-600 border-sky-500 text-white' : (preset.ratio === undefined && cropAspect === undefined ? 'bg-sky-600 border-sky-500 text-white' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300')}`}
                                                  >
                                                      {preset.label}
                                                  </button>
                                              ))}
                                          </div>
                                      </div>

                                      {completedCrop && (
                                          <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                                              <p className="text-xs text-zinc-400">Kích thước vùng chọn:</p>
                                              <p className="text-sm font-mono text-sky-300">
                                                  {Math.round(completedCrop.width)} x {Math.round(completedCrop.height)} px
                                              </p>
                                          </div>
                                      )}

                                      <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800">
                                          <Button onClick={handleApplyCrop} className="!w-full">
                                              Áp dụng
                                          </Button>
                                          <Button onClick={handleCancelCrop} colorScheme="ghost" className="!w-full">
                                              Hủy bỏ
                                          </Button>
                                      </div>
                                  </div>
                              )}

                              {activeTool === 'resize' && (
                                  <div className="space-y-6 animate-fade-in">
                                      <h3 className="text-lg font-bold text-zinc-200 mb-2 flex items-center gap-2">
                                          <Maximize2 className="w-5 h-5"/> Kích thước
                                      </h3>

                                      {appliedCrop && (
                                          <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-800/50 rounded-lg mb-4">
                                              <CropIcon className="w-4 h-4 text-green-400" />
                                              <span className="text-xs text-green-300">Đã áp dụng cắt hình</span>
                                              <button 
                                                onClick={() => { setAppliedCrop(null); setActiveTool('crop'); }}
                                                className="ml-auto text-xs underline text-green-400 hover:text-green-300"
                                              >
                                                  Chỉnh sửa
                                              </button>
                                          </div>
                                      )}

                                      <div className="space-y-3">
                                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => updateResize('category', 'pixel')}>
                                              <div className={`w-4 h-4 rounded-full border ${resizeConfig.category === 'pixel' ? 'border-sky-500 bg-sky-500' : 'border-zinc-500'}`}></div>
                                              <span className="font-semibold text-sm text-zinc-200">Thay đổi theo pixel</span>
                                          </div>
                                          {resizeConfig.category === 'pixel' && (
                                              <div className="pl-6 space-y-3">
                                                  <div className="flex items-center gap-2">
                                                      <div className="flex-1">
                                                          <label className="text-xs text-zinc-400">Rộng</label>
                                                          <TextInput type="number" value={resizeConfig.width} onChange={e => updateResize('width', parseInt(e.target.value))} />
                                                      </div>
                                                      <div className="flex-1">
                                                          <label className="text-xs text-zinc-400">Cao</label>
                                                          <TextInput type="number" value={resizeConfig.height} onChange={e => updateResize('height', parseInt(e.target.value))} />
                                                      </div>
                                                      <button onClick={() => updateResize('aspectRatioLocked', !resizeConfig.aspectRatioLocked)} className={`mt-4 p-2 rounded ${resizeConfig.aspectRatioLocked ? 'text-sky-400' : 'text-zinc-500'}`}>
                                                          {resizeConfig.aspectRatioLocked ? <Lock className="w-4 h-4"/> : <Unlock className="w-4 h-4"/>}
                                                      </button>
                                                  </div>
                                                  
                                                  <label className="text-xs text-zinc-400 block mt-2 mb-1">Tùy chọn hiển thị:</label>
                                                  <div className="grid grid-cols-5 gap-1">
                                                      {[
                                                          { id: 'stretch', icon: <StretchHorizontal className="w-5 h-5"/>, label: 'Kéo giãn' },
                                                          { id: 'cover', icon: <Maximize className="w-5 h-5"/>, label: 'Lấp đầy' },
                                                          { id: 'contain-white', icon: <Minimize className="w-5 h-5 text-white"/>, label: 'Trắng' },
                                                          { id: 'contain-black', icon: <Minimize className="w-5 h-5 text-black fill-current"/>, label: 'Đen' },
                                                          { id: 'contain-blur', icon: <Minimize className="w-5 h-5 text-zinc-400"/>, label: 'Mờ' },
                                                      ].map((mode) => (
                                                          <button
                                                              key={mode.id}
                                                              onClick={() => updateResize('fit', mode.id)}
                                                              className={`flex flex-col items-center justify-center p-2 rounded border transition-colors ${resizeConfig.fit === mode.id ? 'bg-sky-900/50 border-sky-500 text-sky-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                                                              title={mode.label}
                                                          >
                                                              {mode.icon}
                                                          </button>
                                                      ))}
                                                  </div>
                                              </div>
                                          )}
                                      </div>

                                      <div className="space-y-3 pt-3 border-t border-zinc-800">
                                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => updateResize('category', 'percentage')}>
                                              <div className={`w-4 h-4 rounded-full border ${resizeConfig.category === 'percentage' ? 'border-sky-500 bg-sky-500' : 'border-zinc-500'}`}></div>
                                              <span className="font-semibold text-sm text-zinc-200">Theo phần trăm</span>
                                          </div>
                                          {resizeConfig.category === 'percentage' && (
                                              <div className="pl-6 pr-2">
                                                  <ModernSlider 
                                                      min={10} max={400} step={10} value={resizeConfig.percentage}
                                                      onChange={val => updateResize('percentage', val)}
                                                      formatLabel={val => `${val}%`}
                                                  />
                                              </div>
                                          )}
                                      </div>

                                      <div className="space-y-3 pt-3 border-t border-zinc-800">
                                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => updateResize('category', 'resolution')}>
                                              <div className={`w-4 h-4 rounded-full border ${resizeConfig.category === 'resolution' ? 'border-sky-500 bg-sky-500' : 'border-zinc-500'}`}></div>
                                              <span className="font-semibold text-sm text-zinc-200">Độ phân giải</span>
                                          </div>
                                          {resizeConfig.category === 'resolution' && (
                                              <div className="pl-6 grid grid-cols-4 gap-2">
                                                  {RES_PRESETS.map(p => (
                                                      <button key={p.name} onClick={() => setResizePreset(p.w, p.h)} className="px-2 py-2 bg-zinc-800 rounded border border-zinc-700 hover:border-sky-500 text-xs font-mono transition-colors">
                                                          <div className="font-bold text-zinc-200">{p.name}</div>
                                                          <div className="text-[10px] text-zinc-500">{p.w}x{p.h}</div>
                                                      </button>
                                                  ))}
                                              </div>
                                          )}
                                      </div>

                                      <div className="space-y-3 pt-3 border-t border-zinc-800">
                                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => updateResize('category', 'ratio')}>
                                              <div className={`w-4 h-4 rounded-full border ${resizeConfig.category === 'ratio' ? 'border-sky-500 bg-sky-500' : 'border-zinc-500'}`}></div>
                                              <span className="font-semibold text-sm text-zinc-200">Theo tỷ lệ</span>
                                          </div>
                                          {resizeConfig.category === 'ratio' && (
                                              <div className="pl-6 grid grid-cols-5 gap-2">
                                                  {RATIO_PRESETS.map(p => (
                                                      <button 
                                                        key={p.name} 
                                                        onClick={() => {
                                                            const newH = Math.round(resizeConfig.width / p.ratio);
                                                            updateResize('height', newH);
                                                        }} 
                                                        className="py-2 bg-zinc-800 rounded border border-zinc-700 hover:border-sky-500 text-xs font-mono"
                                                      >
                                                          {p.name}
                                                      </button>
                                                  ))}
                                              </div>
                                          )}
                                      </div>

                                      <div className="space-y-3 pt-3 border-t border-zinc-800">
                                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => updateResize('category', 'social')}>
                                              <div className={`w-4 h-4 rounded-full border ${resizeConfig.category === 'social' ? 'border-sky-500 bg-sky-500' : 'border-zinc-500'}`}></div>
                                              <span className="font-semibold text-sm text-zinc-200">Mạng xã hội</span>
                                          </div>
                                          {resizeConfig.category === 'social' && (
                                              <div className="pl-6 grid grid-cols-3 gap-2">
                                                  {SOCIAL_PRESETS.map(p => (
                                                      <button key={p.name} onClick={() => setResizePreset(p.w, p.h)} className="p-2 bg-zinc-800 rounded border border-zinc-700 hover:border-sky-500 flex flex-col items-center gap-1 transition-colors">
                                                          <span className="text-lg">{p.icon}</span>
                                                          <span className="text-[10px] text-center text-zinc-300 leading-tight">{p.name}</span>
                                                      </button>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              )}

                              {activeTool === 'speed' && (
                                  <div className="space-y-6">
                                      <h3 className="text-lg font-bold text-zinc-200 mb-2 flex items-center gap-2">
                                          <Gauge className="w-5 h-5"/> Tốc độ
                                      </h3>
                                      <div className="grid grid-cols-3 gap-2">
                                          {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                              <button
                                                  key={rate}
                                                  disabled={isExporting}
                                                  onClick={() => setPlaybackRate(rate)}
                                                  className={`py-2 rounded-md text-sm font-medium border transition-colors ${
                                                      playbackRate === rate 
                                                      ? 'bg-sky-600 border-sky-500 text-white' 
                                                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                                                  } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                              >
                                                  {rate}x
                                              </button>
                                          ))}
                                      </div>
                                      <div className="pt-6">
                                          <label className="block text-sm font-medium text-zinc-300 mb-3">Tùy chỉnh tốc độ</label>
                                          <ModernSlider 
                                              min={0.25} max={3} step={0.25} value={playbackRate}
                                              onChange={setPlaybackRate}
                                              disabled={isExporting}
                                              formatLabel={(val) => `${val}x`}
                                          />
                                      </div>
                                  </div>
                              )}

                              {activeTool === 'audio' && (
                                  <div className="space-y-6">
                                      <h3 className="text-lg font-bold text-zinc-200 mb-2 flex items-center gap-2">
                                          <Music className="w-5 h-5"/> Âm thanh
                                      </h3>
                                      <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                                          <span className="text-sm text-zinc-300">Âm thanh gốc</span>
                                          <button 
                                              onClick={() => setIsMuted(!isMuted)}
                                              disabled={isExporting}
                                              className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${isMuted ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}
                                          >
                                              {isMuted ? 'Đã tắt' : 'Đang bật'}
                                          </button>
                                      </div>

                                      <div className="border-t border-zinc-800 pt-4">
                                          <label className="block text-sm font-medium text-zinc-300 mb-3">Thêm nhạc nền</label>
                                          {!audioFile ? (
                                              <label className="flex flex-col items-center justify-center w-full h-24 px-4 transition bg-zinc-800/50 border-2 border-zinc-600 border-dashed rounded-lg appearance-none cursor-pointer hover:border-sky-500 hover:bg-zinc-800">
                                                  <Upload className="w-6 h-6 text-zinc-500 mb-1" />
                                                  <span className="text-xs text-zinc-400">Chọn file MP3, WAV</span>
                                                  <input type="file" accept="audio/*" disabled={isExporting} className="hidden" onChange={handleAudioUpload} />
                                              </label>
                                          ) : (
                                              <div className="space-y-3">
                                                  <div className="flex items-center justify-between p-2 bg-zinc-800 rounded-md border border-zinc-700">
                                                      <div className="flex items-center gap-2 overflow-hidden">
                                                          <Music className="w-4 h-4 text-sky-400 flex-shrink-0" />
                                                          <span className="text-xs text-zinc-300 truncate">{audioFile.name}</span>
                                                      </div>
                                                      <button onClick={() => { setAudioFile(null); setIsMuted(false); }} disabled={isExporting} className="text-zinc-500 hover:text-red-400">
                                                          <X className="w-4 h-4" />
                                                      </button>
                                                  </div>
                                                  <div className="pt-2">
                                                      <div className="flex justify-between mb-3">
                                                          <span className="text-sm font-medium text-zinc-300">Âm lượng nhạc</span>
                                                      </div>
                                                      <ModernSlider 
                                                          min={0} max={100} step={1} value={volume}
                                                          onChange={setVolume}
                                                          disabled={isExporting}
                                                          formatLabel={(val) => `${val}%`}
                                                      />
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              )}
          </>
      )}
    </div>
  );
};

export default VideoEditorTab;
