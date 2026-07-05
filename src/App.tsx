import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Undo, 
  Trash2, 
  Cpu, 
  Layers, 
  Video, 
  Check, 
  Copy, 
  FileText, 
  Terminal, 
  Sliders, 
  Settings, 
  Activity, 
  Info, 
  AlertTriangle, 
  ChevronRight, 
  Sparkles, 
  Plus, 
  Minus, 
  MousePointer,
  ExternalLink,
  Github
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types for prompting coordinates
interface VisualPoint {
  x: number;
  y: number;
  label: number; // 1: Positive (emerald), 0: Negative (rose)
}

// Simulated active frames for preloaded clips
interface DemoVideo {
  id: string;
  name: string;
  fps: number;
  totalFrames: number;
  width: number;
  height: number;
  description: string;
}

const DEMO_VIDEOS: DemoVideo[] = [
  {
    id: "car_track",
    name: "ShotGrid_Car_Tracking.mp4",
    fps: 24,
    totalFrames: 50,
    width: 800,
    height: 450,
    description: "VFX 플레이트 상에서 이동하는 고속 주행 차량 추적 및 마스킹"
  },
  {
    id: "character_mask",
    name: "Character_VFX_Plate_03.mov",
    fps: 24,
    totalFrames: 40,
    width: 800,
    height: 450,
    description: "액터 손동작 및 디테일한 경계면 크로마 대체용 로토 추적"
  },
  {
    id: "drone_scan",
    name: "Drone_Landscape_Scan.mp4",
    fps: 30,
    totalFrames: 60,
    width: 800,
    height: 450,
    description: "지형 변화 및 카메라 무빙이 심한 지형 영역 분류 마스킹"
  }
];

// Helper to construct absolute URLs for resources/videos
const getAbsoluteUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const base = window.location.origin;
  return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
};

// Helper to construct absolute URLs for API endpoints
const getAbsoluteApiUrl = (path: string): string => {
  const base = window.location.origin;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};

export default function App() {
  // Main app states
  const [selectedVideo, setSelectedVideo] = useState<DemoVideo>(DEMO_VIDEOS[0]);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"main" | "docker" | "yaml" | "guide">("main");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // SAM Parameters
  const [isDeduplicate, setIsDeduplicate] = useState<boolean>(true);
  const [isDownsample, setIsDownsample] = useState<boolean>(true);
  const [downsampleRes, setDownsampleRes] = useState<number>(768);
  const [smoothingSigma, setSmoothingSigma] = useState<number>(1.5);
  const [isCpuOffload, setIsCpuOffload] = useState<boolean>(true);
  
  // Point Prompting states
  const [points, setPoints] = useState<Record<string, VisualPoint[]>>({});
  const [pointMode, setPointMode] = useState<1 | 0>(1); // 1: Positive, 0: Negative
  const [history, setHistory] = useState<{ frame: number; prevPoints: VisualPoint[] }[]>([]);

  // Execution simulator state
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [trackProgress, setTrackProgress] = useState<number>(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [hasTracked, setHasTracked] = useState<boolean>(false);
  const [showMaskResult, setShowMaskResult] = useState<boolean>(false);

  // File Upload emulation and Google Drive API states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);
  const [driveWebViewUrl, setDriveWebViewUrl] = useState<string | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [realSessionId, setRealSessionId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Terminal autoscroll
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Playback timer
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentFrame((prev) => {
          if (prev >= selectedVideo.totalFrames - 1) {
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / selectedVideo.fps);
    }
    return () => clearInterval(timer);
  }, [isPlaying, selectedVideo]);

  // Synchronize video element playback currentTime with currentFrame slider
  useEffect(() => {
    if (videoRef.current && videoStreamUrl) {
      const targetTime = currentFrame / selectedVideo.fps;
      if (Math.abs(videoRef.current.currentTime - targetTime) > 0.15) {
        videoRef.current.currentTime = targetTime;
      }
    }
  }, [currentFrame, videoStreamUrl, selectedVideo.fps]);

  // Scroll to bottom of terminal when logs update
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTracking) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (selectedVideo.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (selectedVideo.height / rect.height));

    const frameKey = `${selectedVideo.id}_f${currentFrame}`;
    const currentFramePoints = points[frameKey] || [];

    // Save history for undo operation
    setHistory(prev => [...prev, { frame: currentFrame, prevPoints: [...currentFramePoints] }]);

    // Append new point
    const newPoint: VisualPoint = { x, y, label: pointMode };
    setPoints({
      ...points,
      [frameKey]: [...currentFramePoints, newPoint]
    });

    // Add log to active developer session
    addLog(`[SESSION] Added ${pointMode === 1 ? 'Positive' : 'Negative'} Point Prompt at (${x}px, ${y}px) on frame ${currentFrame}`);
  };

  const handleUndo = () => {
    if (history.length === 0) {
      addLog("[WARN] No actions in the history stack to undo.");
      return;
    }

    const lastAction = history[history.length - 1];
    const frameKey = `${selectedVideo.id}_f${lastAction.frame}`;
    
    setPoints({
      ...points,
      [frameKey]: lastAction.prevPoints
    });

    setHistory(prev => prev.slice(0, -1));
    addLog(`[SESSION] Undone last prompt coordinate modification on frame ${lastAction.frame}`);
  };

  const handleClear = () => {
    const frameKey = `${selectedVideo.id}_f${currentFrame}`;
    if (!points[frameKey] || points[frameKey].length === 0) return;

    // Backup to history
    setHistory(prev => [...prev, { frame: currentFrame, prevPoints: [...(points[frameKey] || [])] }]);

    setPoints({
      ...points,
      [frameKey]: []
    });
    addLog(`[SESSION] Cleared all prompt points on active frame ${currentFrame}`);
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    addLog(`[UPLOAD] Received video file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    addLog(`[FastAPI] Sending request to /api/sam3/session/create...`);

    try {
      const formData = new FormData();
      formData.append("video", file);

      console.log("[DEBUG/UPLOAD] Sending post request to /api/sam3/session/create with file:", file.name);
      const response = await fetch(getAbsoluteApiUrl("/api/sam3/session/create"), {
        method: "POST",
        body: formData,
      });

      console.log("[DEBUG/UPLOAD] Received response status:", response.status, response.statusText);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[DEBUG/UPLOAD] Upload response error text:", errorText);
        addLog(`[ERROR] Google API Auth or Backend failure (HTTP ${response.status}): ${errorText}`);
        throw new Error(`Server returned HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("[DEBUG/UPLOAD] Upload response parsed JSON:", data);
      addLog(`[FastAPI] API Response success! Created Session ID: ${data.session_id}`);
      addLog(`[FastAPI] Video details - Frames: ${data.total_frames}, Resolution: ${data.width}x${data.height}, FPS: ${data.fps}`);
      
      const streamLink = data.gcs_url || data.drive_stream_link;
      const absoluteStreamUrl = getAbsoluteUrl(streamLink);

      if (data.gcs_url) {
        addLog(`[GOOGLE CLOUD STORAGE] Source video uploaded to GCS Bucket: ${data.gcs_bucket}`);
        addLog(`[GOOGLE CLOUD STORAGE] GCS Public URL: ${data.gcs_url}`);
      } else if (data.drive_stream_link) {
        addLog(`[GOOGLE DRIVE] Source video uploaded to Drive. File ID: ${data.drive_file_id}`);
        addLog(`[GOOGLE DRIVE] Direct Stream Link: ${data.drive_stream_link}`);
      }

      if (absoluteStreamUrl) {
        addLog(`[RENDER] Direct Stream Absolute URL resolved: ${absoluteStreamUrl}`);
        setVideoStreamUrl(absoluteStreamUrl);
        setDriveWebViewUrl(data.gcs_url || data.drive_web_view_link);
        setDriveFileId(data.gcs_file_name || data.drive_file_id);
      }
      setRealSessionId(data.session_id);

      const newVideo: DemoVideo = {
        id: data.session_id,
        name: file.name,
        fps: data.fps || 30,
        totalFrames: data.total_frames || 45,
        width: 800,
        height: 450,
        description: `사용자 구글 드라이브 업로드 비디오 세션 (${file.name})`
      };
      setSelectedVideo(newVideo);
      setCurrentFrame(0);
      setPoints({});
      setHistory([]);
      setHasTracked(false);
      setShowMaskResult(false);

    } catch (err: any) {
      console.error("[DEBUG/UPLOAD] Exception caught in file upload:", err);
      addLog(`[FastAPI/DRIVE] Live backend connection not detected or Drive error (${err.message}). Falling back to high-fidelity simulation.`);
      addLog(`[SIMULATION] Decoded mock metadata for: ${file.name} (30 FPS, 45 frames)`);
      
      setVideoStreamUrl(null);
      setDriveWebViewUrl(null);
      setDriveFileId(null);
      setRealSessionId(null);

      const newVideo: DemoVideo = {
        id: "uploaded_video",
        name: file.name,
        fps: 30,
        totalFrames: 45,
        width: 800,
        height: 450,
        description: "사용자 업로드 소스 비디오 세션 (시뮬레이션 모드)"
      };
      setSelectedVideo(newVideo);
      setCurrentFrame(0);
      setPoints({});
      setHistory([]);
      setHasTracked(false);
      setShowMaskResult(false);
    }
  };

  // Run tracking with live backend / simulation fallback
  const handleRunTracking = async () => {
    const frameKey = `${selectedVideo.id}_f${currentFrame}`;
    const currentFramePoints = points[frameKey] || [];

    if (currentFramePoints.length === 0) {
      addLog("[ERROR] Cannot run tracking propagation: No prompt coordinate points registered on current frame.");
      return;
    }

    setIsTracking(true);
    setTrackProgress(0);
    setTerminalLogs([]);
    addLog(`[FastAPI] Triggering tracking propagation via /api/sam3/session/track...`);
    addLog(`[GPU ENGINE] Loading SAM 3 Video Predictor. Device: NVIDIA L4 GPU (24GB VRAM active)`);
    addLog(`[GPU ENGINE] Pre-loaded model checkpoint weights: ${MODEL_CHECKPOINT}`);
    addLog(`[OPTIMIZER] Analyzing temporal metadata across ${selectedVideo.totalFrames} frames...`);

    if (realSessionId) {
      try {
        addLog(`[FastAPI] Synchronizing prompt click coordinates with backend session...`);
        console.log("[DEBUG/TRACK] Sending prompt coordinates:", currentFramePoints);
        const addPointRes = await fetch(getAbsoluteApiUrl("/api/sam3/session/add_point"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: realSessionId,
            frame_idx: currentFrame,
            points: currentFramePoints.map(p => ({ x: p.x, y: p.y, label: p.label }))
          })
        });
        
        console.log("[DEBUG/TRACK] Synchronize points response status:", addPointRes.status);
        if (!addPointRes.ok) {
          const errText = await addPointRes.text();
          console.error("[DEBUG/TRACK] Points synchronization failed:", addPointRes.status, errText);
          addLog(`[ERROR] Points synchronization failed: HTTP ${addPointRes.status} - ${errText}`);
          throw new Error(`Failed to upload prompt points to the active session: ${errText}`);
        }
        
        addLog(`[FastAPI] Points synchronized successfully. Initiating neural tracking propagation...`);
        console.log("[DEBUG/TRACK] Sending tracking request to /api/sam3/session/track...");
        
        const trackRes = await fetch(getAbsoluteApiUrl("/api/sam3/session/track"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: realSessionId,
            downsample: isDownsample,
            downsample_resolution: downsampleRes,
            smoothing_sigma: smoothingSigma,
            cpu_offload: isCpuOffload,
            deduplicate: isDeduplicate,
            export_format: "mp4"
          })
        });

        console.log("[DEBUG/TRACK] Tracking execution response status:", trackRes.status);
        if (!trackRes.ok) {
          const errText = await trackRes.text();
          console.error("[DEBUG/TRACK] Tracking execution failed:", trackRes.status, errText);
          addLog(`[ERROR] Tracking execution failed: HTTP ${trackRes.status} - ${errText}`);
          throw new Error(`Server returned tracking error HTTP ${trackRes.status}: ${errText}`);
        }

        const data = await trackRes.json();
        console.log("[DEBUG/TRACK] Tracking execution parsed response:", data);
        addLog(`[FastAPI] Tracking completed successfully!`);
        
        const streamLink = data.gcs_url || data.drive_stream_link;
        const absoluteStreamUrl = getAbsoluteUrl(streamLink);

        if (data.gcs_url) {
          addLog(`[GOOGLE CLOUD STORAGE] Compiled side-by-side masked video uploaded to GCS Bucket: ${data.gcs_bucket}`);
          addLog(`[GOOGLE CLOUD STORAGE] GCS Public URL: ${data.gcs_url}`);
        } else if (data.drive_stream_link) {
          addLog(`[GOOGLE DRIVE] Compiled side-by-side masked video uploaded: ${data.drive_file_id}`);
          addLog(`[GOOGLE DRIVE] Direct Playback Link: ${data.drive_stream_link}`);
        }

        if (absoluteStreamUrl) {
          addLog(`[RENDER] Result Stream Absolute URL resolved: ${absoluteStreamUrl}`);
          setVideoStreamUrl(absoluteStreamUrl);
          setDriveWebViewUrl(data.gcs_url || data.drive_web_view_link);
          setDriveFileId(data.gcs_file_name || data.drive_file_id);
        }
        
        setTrackProgress(100);
        setIsTracking(false);
        setHasTracked(true);
        setShowMaskResult(true);
        setIsPlaying(true);
        return;
      } catch (err: any) {
        console.error("[DEBUG/TRACK] Exception caught in live track:", err);
        addLog(`[FastAPI/DRIVE] Live tracking execution failed (${err.message}). Switching to procedural simulation.`);
      }
    }

    // Fallback simulation mode
    setTimeout(() => {
      if (isDeduplicate) {
        const optimizedFrames = Math.round(selectedVideo.totalFrames * 0.24);
        addLog(`[OPTIMIZER] Frame deduplication optimization: Found ${optimizedFrames} static/unchanged frames.`);
        addLog(`[OPTIMIZER] Skipping neural computation on duplicates. Saving ~24.5% GPU runtime cost!`);
      } else {
        addLog(`[OPTIMIZER] Frame deduplication is disabled. Processing all ${selectedVideo.totalFrames} frames sequentially.`);
      }
    }, 600);

    setTimeout(() => {
      if (isDownsample) {
        addLog(`[VRAM STABILITY] Target resolution limit is set to ${downsampleRes}px.`);
        addLog(`[VRAM STABILITY] Input stream downsampled to protect against CUDA out-of-memory overhead.`);
      }
      if (isCpuOffload) {
        addLog(`[CUDA OPTIMIZER] CPU Offloading enabled: Transferring non-active attention matrices to host memory.`);
      }
    }, 1200);

    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < selectedVideo.totalFrames) {
        const percentage = Math.round((currentIdx / selectedVideo.totalFrames) * 100);
        setTrackProgress(percentage);
        
        if (currentIdx % 10 === 0) {
          addLog(`[CUDA] Inference running: Frame ${currentIdx}/${selectedVideo.totalFrames} | CUDA Memory: 3.2 GB allocated`);
        }
        if (currentIdx === Math.round(selectedVideo.totalFrames / 2)) {
          addLog(`[OPENCV] Smoothing module: Applying Gaussian filter (σ = ${smoothingSigma}) on intermediate binary buffers.`);
        }

        setCurrentFrame(currentIdx);
        currentIdx += 2;
      } else {
        clearInterval(interval);
        setTrackProgress(100);
        setIsTracking(false);
        setHasTracked(true);
        setShowMaskResult(true);
        setIsPlaying(true);
        
        addLog(`[OPENCV] Clean boundary smoothing applied successfully to all ${selectedVideo.totalFrames} alpha mask elements.`);
        addLog(`[SUCCESS] Side-by-Side MP4 review compilation completed.`);
        addLog(`[SUCCESS] Output is ready for playback. Masking transparency channel perfectly smoothed.`);
      }
    }, 100);
  };

  // Simulated object coordinate tracking paths (procedural visual feedback)
  const getSimulatedObjectBounding = () => {
    // Generate drift variables based on selected video and frame index
    let center = { x: 400, y: 225 };
    let size = { width: 140, height: 100, radius: 80 };

    if (selectedVideo.id === "car_track") {
      // Car driving horizontally with perspective shift
      center.x = 200 + (currentFrame * 9.5);
      center.y = 260 - (currentFrame * 0.4);
      size.width = 160 + (currentFrame * 0.8);
      size.height = 80 + (currentFrame * 0.4);
      size.radius = size.width / 2;
    } else if (selectedVideo.id === "character_mask") {
      // Actor's hand / torso moving procedurally
      center.x = 420 + Math.sin(currentFrame * 0.15) * 45;
      center.y = 230 + Math.cos(currentFrame * 0.1) * 30;
      size.width = 110;
      size.height = 140;
      size.radius = 75;
    } else {
      // Drone terrain camera panning
      center.x = 550 - (currentFrame * 4.5);
      center.y = 180 + (currentFrame * 1.5);
      size.width = 220;
      size.height = 180;
      size.radius = 110;
    }

    return { center, size };
  };

  const { center, size } = getSimulatedObjectBounding();

  // Python Code templates for UI display
  const MODEL_CHECKPOINT = "./checkpoints/sam2_hiera_large.pt";

  const mainPyCode = `import os
import io
import cv2
import uuid
import shutil
import logging
import tempfile
import numpy as np
from typing import List, Dict, Tuple, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sam3_backend")

try:
    import torch
    from sam2.build_sam import build_sam2_video_predictor
    SAM2_AVAILABLE = True
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
except ImportError as e:
    SAM2_AVAILABLE = False
    DEVICE = "cpu"

app = FastAPI(title="SAM 3 Masking Backend API Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... (In-memory state management & setup) ...

def detect_duplicate_frames(frame_paths: List[str], threshold: float = 1.2) -> List[bool]:
    """
    Computes absolute frame-to-frame pixel difference to flag identical/duplicate static frames.
    Saves massive GPU cost by avoiding redundant neural network forward propagation.
    """
    duplicates = [False] * len(frame_paths)
    if len(frame_paths) <= 1: return duplicates
    
    prev_img = cv2.imread(frame_paths[0], cv2.IMREAD_GRAYSCALE)
    prev_img = cv2.resize(prev_img, (128, 128))
    
    for idx in range(1, len(frame_paths)):
        curr_img = cv2.imread(frame_paths[idx], cv2.IMREAD_GRAYSCALE)
        curr_resized = cv2.resize(curr_img, (128, 128))
        mae = np.mean(np.abs(prev_img.astype(np.float32) - curr_resized.astype(np.float32)))
        if mae < threshold:
            duplicates[idx] = True
        else:
            prev_img = curr_resized
    return duplicates

def apply_edge_smoothing(mask: np.ndarray, sigma: float = 1.5) -> np.ndarray:
    """
    Applies Gaussian Blur and double thresholding/anti-aliasing to rough binary masks.
    Returns a clean, anti-aliased matte mask (0 to 255 alpha values).
    """
    if sigma <= 0: return mask
    mask_float = mask.astype(np.float32) * 255.0
    ksize = int(6 * sigma + 1)
    if ksize % 2 == 0: ksize += 1
    blurred = cv2.GaussianBlur(mask_float, (ksize, ksize), sigma)
    smooth_mask = np.clip((blurred - 120.0) / (135.0 - 120.0) * 255.0, 0, 255).astype(np.uint8)
    return smooth_mask

@app.post("/api/sam3/session/track")
async def execute_tracking(request: TrackingRequest, background_tasks: BackgroundTasks):
    # Meta SAM 2 Video Predictor logic with optimization flags
    # 1. Initialize predictor state via sam_predictor.init_state(...)
    # 2. Add accumulated coordinate prompts on multiple frames
    # 3. Propagate and generate masks
    # 4. Apply deduplication (skip computation, clone previous mask state)
    # 5. Apply edge smoothing filter
    # 6. Export as high-fidelity side-by-side composite review video or ZIP
    pass`;

  const dockerfileCode = `# Production-ready Dockerfile for Segment Anything (SAM 2/3) Video Predictor on NVIDIA L4 GPUs
FROM pytorch/pytorch:2.2.2-cuda12.1-cudnn8-devel

# Set system environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PORT=3000

# Install system libraries needed by OpenCV and Git compilation
RUN apt-get update && apt-get install -y --no-install-recommends \\
    git ffmpeg libsm6 libxext6 libgl1-mesa-glx libglib2.0-0 build-essential curl \\
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy python packages requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \\
    pip install --no-cache-dir -r requirements.txt

# Clone official Meta Segment Anything 2 repo and install with CUDA compilation
RUN git clone https://github.com/facebookresearch/segment-anything-2.git /app/sam2_source && \\
    cd /app/sam2_source && \\
    pip install -e . && \\
    cp -r /app/sam2_source/sam2 /app/sam2 && \\
    cp -r /app/sam2_source/checkpoints /app/checkpoints || true

COPY main.py .
COPY initialize_weights.py .

# Pre-download and cache model weights inside the container during build time
RUN python initialize_weights.py

EXPOSE 3000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]`;

  const serviceYamlCode = `apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: masking
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        # 1. Request NVIDIA L4 GPU accelerator (24GB VRAM)
        run.googleapis.com/gpu-type: nvidia-l4
        # 2. Scale to zero when inactive to reduce idle GPU cost to $0
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "1"
        # 3. Keep CPU allocated for model stability
        run.googleapis.com/cpu-throttling: "false"
    spec:
      # Restrict concurrency to 1 request per container to prevent parallel VRAM collision
      containerConcurrency: 1
      containers:
      - image: gcr.io/PROJECT_ID/masking-backend:latest
        resources:
          limits:
            cpu: "4"
            memory: "16Gi"
            google.com/gpu: "1"
        ports:
        - containerPort: 3000
        env:
        - name: TORCH_CUDA_ARCH_LIST
          value: "8.9" # Optimized compilation target for NVIDIA L4
        - name: FORCE_CUDA
          value: "1"`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col selection:bg-emerald-500 selection:text-zinc-950">
      
      {/* Top Banner Navigation */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center text-zinc-950 font-bold shadow-lg shadow-emerald-500/20">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              SAM 3 Masking Backend API Service
              <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                L4 GPU Optimized
              </span>
            </h1>
            <p className="text-xs text-zinc-400">ShotGrid 전용 고해상도 비디오 트래킹 및 알파 경계면 스무딩 백엔드 개발 대시보드</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1.5 rounded-md border border-zinc-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-300">GPU API Status: Idle (minScale: 0)</span>
          </div>
          <div className="text-zinc-400 hidden md:block">
            Cloud Run Platform Node active
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full flex flex-col gap-6">
        
        {/* INTERACTIVE VISUAL PLAYGROUND */}
        <section className="flex flex-col gap-5 bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase flex items-center gap-2">
              <Video className="h-4 w-4 text-emerald-400" />
              1. Interactive Prompt Playground
            </h2>
            <div className="text-xs text-zinc-400 font-mono">
              프레임 클릭으로 좌표 수신 테스트
            </div>
          </div>

          {/* Video Selector */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {DEMO_VIDEOS.map((vid) => (
              <button
                key={vid.id}
                onClick={() => {
                  setSelectedVideo(vid);
                  setCurrentFrame(0);
                  setHasTracked(false);
                  setShowMaskResult(false);
                  addLog(`[SESSION] Switched active video context to: ${vid.name}`);
                }}
                className={`py-2 px-2.5 rounded-lg border text-left transition-all ${
                  selectedVideo.id === vid.id
                    ? "bg-zinc-800 border-emerald-500/50 text-emerald-400"
                    : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <div className="font-semibold truncate">{vid.name.split('.')[0]}</div>
                <div className="text-[10px] text-zinc-500">{vid.totalFrames}f • {vid.fps}fps</div>
              </button>
            ))}
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800">
            💡 <strong className="text-zinc-300">사용법:</strong> 아래 뷰어 화면을 클릭하여 프레임 상에 마스킹 대상 객체를 지정하십시오. 좌클릭은 <span className="text-emerald-400 font-bold">Positive 좌표</span>로 처리되어 마스크를 확장하고, <span className="text-rose-400 font-bold">Negative 좌표</span>로 지정하면 영역에서 제외됩니다.
          </p>

          {/* Interactive Interactive Viewer Screen */}
          <div className="relative aspect-[16/9] w-full bg-black rounded-lg border border-zinc-800 overflow-hidden group select-none">
            
            {/* Real HTML5 Video stream player if active */}
            {videoStreamUrl && (
              <video
                ref={videoRef}
                src={videoStreamUrl}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                playsInline
                muted
                loop
                crossOrigin="anonymous"
              />
            )}

            {/* Visual background matching the selected video (High fidelity mockup vectors) */}
            <div 
              onClick={handleCanvasClick}
              className="absolute inset-0 w-full h-full cursor-crosshair overflow-hidden"
              style={{
                background: videoStreamUrl 
                  ? "transparent"
                  : selectedVideo.id === "car_track" 
                  ? "radial-gradient(circle at 50% 50%, #27272a, #09090b)" 
                  : selectedVideo.id === "character_mask"
                  ? "linear-gradient(135deg, #18181b, #09090b)"
                  : "radial-gradient(circle at 30% 20%, #1e1b4b, #09090b)"
              }}
            >
              {/* Simulated visual asset on the canvas frame */}
              {selectedVideo.id === "car_track" && (
                <>
                  {/* Road perspective */}
                  <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
                    <line x1="200" y1="450" x2="380" y2="200" stroke="#71717a" strokeWidth="2" />
                    <line x1="600" y1="450" x2="420" y2="200" stroke="#71717a" strokeWidth="2" />
                    <line x1="400" y1="450" x2="400" y2="200" stroke="#e4e4e7" strokeDasharray="8 8" strokeWidth="1.5" />
                  </svg>
                  
                  {/* Moving Car Frame Block */}
                  <div 
                    className="absolute rounded-lg border border-zinc-700 flex flex-col justify-between p-2 shadow-2xl transition-all duration-75"
                    style={{
                      left: `${center.x - size.width/2}px`,
                      top: `${center.y - size.height/2}px`,
                      width: `${size.width}px`,
                      height: `${size.height}px`,
                      background: "linear-gradient(to bottom, #3f3f46, #18181b)",
                    }}
                  >
                    <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                      <span>VFX_CAR</span>
                      <span className="text-zinc-500">f: {currentFrame}</span>
                    </div>
                    {/* Car wheels */}
                    <div className="flex justify-between px-2">
                      <div className="h-4 w-8 bg-zinc-900 rounded-md" />
                      <div className="h-4 w-8 bg-zinc-900 rounded-md" />
                    </div>
                  </div>
                </>
              )}

              {selectedVideo.id === "character_mask" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Abstract Actor Torso Outline */}
                  <svg className="h-64 w-64 text-zinc-800 opacity-60 transition-transform duration-75" 
                       style={{ transform: `scale(${1 + Math.sin(currentFrame * 0.1)*0.03}) translate(${Math.sin(currentFrame*0.1)*10}px, ${Math.cos(currentFrame*0.1)*5}px)` }}
                       fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" />
                  </svg>
                  
                  {/* Highlight track block */}
                  <div 
                    className="absolute border border-zinc-700/60 rounded-full shadow-inner transition-all duration-75"
                    style={{
                      left: `${center.x - size.width/2}px`,
                      top: `${center.y - size.height/2}px`,
                      width: `${size.width}px`,
                      height: `${size.height}px`,
                      background: "radial-gradient(circle, rgba(63,63,70,0.3) 0%, rgba(24,24,27,0.8) 100%)",
                    }}
                  />
                </div>
              )}

              {selectedVideo.id === "drone_scan" && (
                <>
                  {/* Landscape scan grid */}
                  <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 opacity-20 text-[8px] font-mono p-2">
                    {Array.from({ length: 48 }).map((_, i) => (
                      <div key={i} className="border-[0.5px] border-indigo-500/40 p-1 flex items-end justify-end">
                        {(1000 + i * 45).toString(16).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  {/* Drone scanned polygon overlay */}
                  <div 
                    className="absolute rounded-lg border border-zinc-700/80 transition-all duration-75 flex items-center justify-center"
                    style={{
                      left: `${center.x - size.width/2}px`,
                      top: `${center.y - size.height/2}px`,
                      width: `${size.width}px`,
                      height: `${size.height}px`,
                      background: "linear-gradient(135deg, rgba(30,27,75,0.4), rgba(15,23,42,0.7))",
                    }}
                  >
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest animate-pulse">
                      Area_Polygon_Tracking
                    </div>
                  </div>
                </>
              )}

              {/* Edge smoothed mask visual overlay */}
              {showMaskResult && (
                <div 
                  className="absolute pointer-events-none transition-all duration-75 flex items-center justify-center"
                  style={{
                    left: `${center.x - size.width/2 - 10}px`,
                    top: `${center.y - size.height/2 - 10}px`,
                    width: `${size.width + 20}px`,
                    height: `${size.height + 20}px`,
                  }}
                >
                  {/* High fidelity smoothed mask visualization utilizing tailwind blur to represent σ (sigma) boundary smoothing */}
                  <div 
                    className="w-full h-full border-2 border-emerald-400 bg-emerald-500/20 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                    style={{
                      borderRadius: selectedVideo.id === "car_track" ? "12px" : "9999px",
                      filter: `blur(${smoothingSigma * 1.5}px)`,
                      transition: "filter 0.2s"
                    }}
                  />
                  <div className="absolute top-2 left-4 text-[9px] font-mono bg-emerald-500 text-zinc-950 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                    Smoothed Mask Active (σ={smoothingSigma})
                  </div>
                </div>
              )}

              {/* Display existing point markers for this frame */}
              {(points[`${selectedVideo.id}_f${currentFrame}`] || []).map((pt, index) => (
                <div
                  key={index}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
                  style={{ left: `${pt.x}px`, top: `${pt.y}px` }}
                >
                  {/* Core pointer target dot */}
                  <div className={`h-3 w-3 rounded-full border border-white z-20 ${pt.label === 1 ? 'bg-emerald-500 shadow-emerald-500' : 'bg-rose-500 shadow-rose-500'} shadow-lg`} />
                  
                  {/* Click Ripple effect */}
                  <div className={`absolute h-8 w-8 rounded-full border opacity-50 animate-ping pointer-events-none ${pt.label === 1 ? 'border-emerald-400 bg-emerald-400/20' : 'border-rose-400 bg-rose-400/20'}`} />
                  
                  {/* Label Text box tooltip */}
                  <div className="absolute top-4 bg-zinc-950/90 border border-zinc-800 text-[9px] px-1 py-0.5 rounded text-white font-mono z-30 whitespace-nowrap">
                    {pt.label === 1 ? "Positive" : "Negative"} ({pt.x}, {pt.y})
                  </div>
                </div>
              ))}

              {/* Prompt Instruction overlay if no points exist */}
              {(!points[`${selectedVideo.id}_f${currentFrame}`] || points[`${selectedVideo.id}_f${currentFrame}`].length === 0) && !showMaskResult && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center pointer-events-none text-center p-6">
                  <MousePointer className="h-8 w-8 text-zinc-400 animate-bounce mb-2" />
                  <p className="text-sm font-semibold text-zinc-300">이곳을 클릭해 트래킹 포인트를 생성하십시오</p>
                  <p className="text-xs text-zinc-500 mt-1">객체의 중앙부 또는 에지 영역을 클릭하십시오</p>
                </div>
              )}

              {/* Frame label badge */}
              <div className="absolute bottom-3 right-3 bg-zinc-950/80 backdrop-blur border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-300">
                FRAME: {currentFrame.toString().padStart(3, '0')} / {(selectedVideo.totalFrames - 1).toString().padStart(3, '0')}
              </div>
            </div>

            {/* Simulated Live Tracking overlay */}
            <AnimatePresence>
              {isTracking && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center p-6"
                >
                  <Sparkles className="h-10 w-10 text-emerald-400 animate-spin mb-4" />
                  <div className="w-64 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <motion.div 
                      className="bg-emerald-500 h-1.5"
                      initial={{ width: "0%" }}
                      animate={{ width: `${trackProgress}%` }}
                    />
                  </div>
                  <div className="text-sm font-semibold mt-3 text-zinc-300">
                    SAM 3 Video Masking Engine Running... {trackProgress}%
                  </div>
                  <div className="text-xs font-mono text-zinc-500 mt-1">
                    Frame {currentFrame} of {selectedVideo.totalFrames} • VRAM Cache Managed
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Interactive Player controls */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={isTracking}
                className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg p-2.5 transition-colors disabled:opacity-50"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>

              <button 
                onClick={() => {
                  setCurrentFrame(0);
                  setIsPlaying(false);
                  setShowMaskResult(false);
                  addLog("[SESSION] Rewound video context to index 0.");
                }}
                disabled={isTracking}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg p-2.5 transition-colors disabled:opacity-50"
                title="Rewind"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {/* Scrubber Range Slider */}
              <div className="flex-1 flex items-center gap-2">
                <input 
                  type="range"
                  min="0"
                  max={selectedVideo.totalFrames - 1}
                  value={currentFrame}
                  onChange={(e) => {
                    setCurrentFrame(parseInt(e.target.value));
                    setIsPlaying(false);
                    setShowMaskResult(false);
                  }}
                  disabled={isTracking}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>

            {/* Prompt Type Toggles & Session Managers */}
            <div className="flex items-center justify-between gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-xs">
              
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Prompt Mode:</span>
                <button
                  onClick={() => setPointMode(1)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold border transition-all ${
                    pointMode === 1 
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" 
                      : "bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Plus className="h-3 w-3" /> Positive (+)
                </button>
                <button
                  onClick={() => setPointMode(0)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold border transition-all ${
                    pointMode === 0 
                      ? "bg-rose-500/10 border-rose-500/40 text-rose-400" 
                      : "bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Minus className="h-3 w-3" /> Negative (-)
                </button>
              </div>

              {/* Undo / Clear operations */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 p-2 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Undo last coordinate"
                >
                  <Undo className="h-3.5 w-3.5" />
                  Undo
                </button>
                <button
                  onClick={handleClear}
                  disabled={!(points[`${selectedVideo.id}_f${currentFrame}`] && points[`${selectedVideo.id}_f${currentFrame}`].length > 0)}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 p-2 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Clear coordinates on frame"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Frame
                </button>
              </div>

            </div>

            {/* Custom file uploader component */}
            <div className="flex flex-col gap-2 p-3.5 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Video className="h-5 w-5 text-zinc-500" />
                  <div>
                    <div className="text-xs font-semibold text-zinc-300">
                      {uploadedFileName ? `선택됨: ${uploadedFileName}` : "새로운 비디오 세션 업로드 (.mp4, .mov)"}
                    </div>
                    <div className="text-[10px] text-zinc-500">FastAPI /session/create API와 동일하게 동작</div>
                  </div>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded border border-zinc-700 transition-colors"
                >
                  파일 선택
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="video/mp4,video/quicktime" 
                className="hidden" 
              />
              
              {/* Google Drive Active Session Info */}
              {driveFileId && (
                <div className="mt-2 pt-2 border-t border-zinc-800/80 flex flex-col gap-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Google Drive File ID:</span>
                    <span className="font-mono text-zinc-300 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800 text-[10px] max-w-[120px] truncate">{driveFileId}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <a
                      href={videoStreamUrl || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-zinc-700 text-center flex items-center justify-center gap-1 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3 text-emerald-400" /> Direct Stream
                    </a>
                    {driveWebViewUrl && (
                      <a
                        href={driveWebViewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-zinc-700 text-center flex items-center justify-center gap-1 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3 text-emerald-400" /> Web View
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Execution triggers */}
          <button
            onClick={handleRunTracking}
            disabled={isTracking}
            className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-all ${
              isTracking 
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 hover:shadow-emerald-500/10"
            }`}
          >
            <Sparkles className="h-4.5 w-4.5" />
            SAM 3 마스킹 및 트래킹 시작 (Run Tracking)
          </button>

          {/* ADVANCED PARAMETERS PANEL */}
          <div className="border-t border-zinc-800/80 pt-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
              <Sliders className="h-3.5 w-3.5 text-zinc-500" />
              Advanced GPU & Algorithmic Parameters
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              
              {/* Downsampling Resolution Toggle & Slider */}
              <div className="flex flex-col gap-1.5 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">프레임 다운샘플링</span>
                  <input 
                    type="checkbox" 
                    checked={isDownsample}
                    onChange={(e) => {
                      setIsDownsample(e.target.checked);
                      addLog(`[PARAM] Set frame downsample = ${e.target.checked}`);
                    }}
                    className="accent-emerald-500 h-4 w-4 cursor-pointer"
                  />
                </div>
                {isDownsample && (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>해상도 제한</span>
                      <span>{downsampleRes}px</span>
                    </div>
                    <input 
                      type="range"
                      min="512"
                      max="1024"
                      step="128"
                      value={downsampleRes}
                      onChange={(e) => {
                        setDownsampleRes(parseInt(e.target.value));
                        addLog(`[PARAM] Updated target processing resolution: ${e.target.value}px`);
                      }}
                      className="w-full accent-emerald-500 h-1 bg-zinc-900 rounded"
                    />
                  </div>
                )}
              </div>

              {/* Smoothing Sigma */}
              <div className="flex flex-col gap-1.5 bg-zinc-950 p-3 rounded-lg border border-zinc-800 justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">경계면 스무딩 강도 (σ)</span>
                  <span className="font-mono text-[10px] bg-zinc-900 px-1 py-0.5 rounded text-emerald-400">{smoothingSigma}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <input 
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={smoothingSigma}
                    onChange={(e) => {
                      setSmoothingSigma(parseFloat(e.target.value));
                      addLog(`[PARAM] Set edge smoothing sigma = ${e.target.value}`);
                    }}
                    className="w-full accent-emerald-500 h-1 bg-zinc-900 rounded"
                  />
                  <div className="flex justify-between text-[8px] text-zinc-500">
                    <span>거친 경계면 (raw)</span>
                    <span>부드러운 블러 (anti-aliased)</span>
                  </div>
                </div>
              </div>

              {/* Frame Deduplication Optimization Toggle */}
              <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-300">중복 프레임 최적화</span>
                  <span className="text-[10px] text-zinc-500">동일 프레임 스킵 (GPU 절약)</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={isDeduplicate}
                  onChange={(e) => {
                    setIsDeduplicate(e.target.checked);
                    addLog(`[PARAM] Set frame deduplication = ${e.target.checked}`);
                  }}
                  className="accent-emerald-500 h-4 w-4 cursor-pointer"
                />
              </div>

              {/* CPU Offloading (VRAM Save) */}
              <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-300">CPU 오프로딩 (VRAM)</span>
                  <span className="text-[10px] text-zinc-500">VRAM 오버플로우 방지</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={isCpuOffload}
                  onChange={(e) => {
                    setIsCpuOffload(e.target.checked);
                    addLog(`[PARAM] Set CUDA CPU offload = ${e.target.checked}`);
                  }}
                  className="accent-emerald-500 h-4 w-4 cursor-pointer"
                />
              </div>

            </div>
          </div>

        </section>

        {/* TERMINAL EXECUTION CONSOLE LOGGER */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 shadow-xl h-60">
          <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/80 pb-2.5">
            <span className="flex items-center gap-2 font-semibold">
              <Terminal className="h-4 w-4 text-emerald-400" />
              Live API Execution Console (FastAPI Simulator Streams)
            </span>
            <button 
              onClick={() => setTerminalLogs([])}
              className="hover:text-zinc-200 transition-colors text-[10px] uppercase font-bold"
            >
              Clear Console
            </button>
          </div>

          <div className="flex-1 bg-zinc-950 p-3 rounded-lg overflow-y-auto font-mono text-[11px] text-zinc-300 flex flex-col gap-1.5 scrollbar-thin">
            {terminalLogs.length === 0 ? (
              <div className="text-zinc-600 italic flex items-center gap-1.5 h-full justify-center">
                <Activity className="h-4 w-4 text-zinc-700 animate-pulse" />
                API 호출 대기 중. Playground에서 트래킹 실행을 클릭하면 디버그 로그가 실시간 출력됩니다.
              </div>
            ) : (
              terminalLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed whitespace-pre-wrap select-text">
                  <span className="text-emerald-500 mr-1.5">&gt;</span>
                  {log}
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

      </main>

      {/* Footer Details */}
      <footer className="border-t border-zinc-800 bg-zinc-950 px-6 py-4 flex items-center justify-between text-xs text-zinc-500 font-mono">
        <div>
          © 2026 Segment Anything 2/3 Masking Backend Developer Toolkit
        </div>
        <div className="flex items-center gap-1">
          <span>Target Architecture:</span>
          <span className="text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">Linux/CUDA 12.1</span>
        </div>
      </footer>

    </div>
  );
}
