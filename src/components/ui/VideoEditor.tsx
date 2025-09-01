import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Slider } from "./slider";
import { Input } from "./input";
import { apiService } from "../../lib/api";
import { audioStorageService } from "../../lib/audioStorage";
import { mediaStorageService } from "../../lib/mediaStorage";
import { AudioChunk } from "../../types/audio";
import {
  Plus,
  Scissors,
  Play,
  Pause,
  Volume2,

  Video as VideoIcon,
  Music,
  Type, 
  Bold,
  Italic,
  Settings,
  Move,
  ArrowLeft,
  CheckCircle,
  Loader2,
  X,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
  Square,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

interface MediaItem {
  id: string;
  name: string;
  type: "voiceover" | "video" | "image" | "audio" | "text";
  duration: number;
  filePath: string;
  fileName?: string; // File name for the media item
  // Stock media properties
  url?: string;
  description?: string; // Description for stock media items
  pexelsId?: number;
  photographer?: string;
  source?: string;
  searchQuery?: string;
  text?: string;
  thumbnailUrl?: string;
  previewUrl?: string; // Blob URL for browser preview
  paragraphNumber?: number; // Which paragraph this image represents (for OpenAI images)
  // Audio/Video properties
  volume?: number; // 0-100
  muted?: boolean; // Whether the audio/video is muted
  // Visual properties (for images, videos, text)
  x?: number; // Position X (0-1)
  y?: number; // Position Y (0-1)
  width?: number; // Width (0-1)
  height?: number; // Height (0-1)
  // Text properties
  fontFamily?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontStrikethrough?: boolean;
  fontColor?: string;
  backgroundColor?: string;
  backgroundTransparent?: boolean;
  // Enhanced subtitle styling options
  textOpacity?: number; // 0-100
  backgroundOpacity?: number; // 0-100
  textBorderColor?: string;
  textBorderThickness?: number; // 0-10px
  textAlignment?: "left" | "center" | "right";
  textCapitalization?: "AA" | "Aa" | "aa" | "--";
}

interface GeometricInfo {
  x: number; // X position (0-1, relative to canvas)
  y: number; // Y position (0-1, relative to canvas)
  width: number; // Width (0-1, relative to canvas)
  height: number; // Height (0-1, relative to canvas)
  rotation?: number; // Rotation in degrees (optional)
}

interface TimelineItem {
  id: string;
  mediaId: string;
  startTime: number;
  duration: number;
  track: number;
  geometry?: GeometricInfo; // Position and size information for images/videos
}

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  items: TimelineItem[];
  type?: string;
  duration?: number;
}

interface SavedMediaItem {
  id: string;
  name: string;
  type: "voiceover" | "video" | "image" | "audio" | "text";
  duration: number;
  filePath: string;
  text?: string;
  // Audio/Video properties
  volume?: number;
  muted?: boolean;
  // Visual properties
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Text properties
  fontFamily?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontStrikethrough?: boolean;
  fontColor?: string;
  backgroundColor?: string;
  backgroundTransparent?: boolean;
  // Enhanced subtitle styling options
  textOpacity?: number; // 0-100
  backgroundOpacity?: number; // 0-100
  textBorderColor?: string;
  textBorderThickness?: number; // 0-10px
  textAlignment?: "left" | "center" | "right";
  textCapitalization?: "AA" | "Aa" | "aa" | "--";
  thumbnailUrl?: string;
  previewUrl?: string;
}

interface SavedAudioChunk {
  id: string;
  name: string;
  text: string;
  duration: number;
  startTime: number;
  blobUrl: string;
  isGenerated: boolean;
  filePath?: string;
}

interface TimelineTrackItem {
  id: string;
  startTime: number;
  duration: number;
  mediaId: string;
  track: number;
}

interface SavedVideoAssets {
  // Debug info for saved video assets
  transcriptInfo?: {
    storyContent?: string;
    audioChunks?: AudioChunk[];
    totalAudioDuration?: number;
    voiceoverSettings?: {
      selectedVoiceId?: string;
      volume: number;
    };
    savedAt: string; // timestamp when saved
  };

  // Stock media info with OpenAI-generated images and timestamps
  stockMediaInfo?: {
    items: Array<{
      id: string;
      name: string;
      type: "image"; // OpenAI only generates images
      description: string;
      url: string; // OpenAI image URL
      fileName: string;
      duration: number;
      width: number;
      height: number;
      segmentId?: number; // Optional for strategic allocation
      startTime: number; // when it appears in timeline
      endTime: number; // when it ends in timeline
      searchQuery?: string; // Optional for strategic allocation
      prompt: string; // OpenAI prompt used to generate the image
      source: string; // 'openai-dalle'
      allocation: 'sequential' | 'strategic' | 'fallback' | 'story-based';
      priority?: string; // For strategic allocation
      strategicIndex?: number; // For strategic allocation
      downloadedAt: string; // timestamp when downloaded
    }>;
    savedAt: string; // timestamp when saved
  };
  mediaLibrary?: SavedMediaItem[];
  voice?: {
    id: string;
    name: string;
    isSelected: boolean;
  } | null;
  audioChunks?: SavedAudioChunk[];
  layers?: Layer[];
  timeline?: {
    totalDuration?: number;
    currentTime?: number;
    tracks?: Array<{
      id: string;
      name: string;
      type: string;
      items: TimelineTrackItem[];
    }>;
  };
  editorSettings?: {
    selectedLayerId?: string;
    volumeSettings?: {
      voiceover?: number;
      footage?: number;
      soundtrack?: number;
    };
    videoStyle?: "landscape" | "square" | "vertical";
  };
}

interface VideoEditorProps {
  className?: string;
  onPrevious?: () => void;
  onSaveAndFinish?: () => void;
  onRender?: () => void;
  storyContent?: string;
  selectedVoiceId?: string;
  videoStyle?: "landscape" | "square" | "vertical";
  savedVideoAssets?: SavedVideoAssets;
  audioChunks?: AudioChunk[];
  storyId?: string;
  initialStory?: any; // Add this to access sentence transcripts data
  onAudioDataUpdate?: (audioData: {
    audioChunks: AudioChunk[];
    totalAudioDuration: number;
  }) => void;
  onVideoAssetsUpdate?: (videoAssets: SavedVideoAssets) => void;
  onTranscriptInfoUpdate?: (transcriptInfo: any) => void;
  onStockMediaInfoUpdate?: (stockMediaInfo: any) => void;
  onSentenceTranscriptsUpdate?: (sentenceTranscripts: any) => void;
  // Render failure handling
  hasRenderFailed?: boolean;
  onRetryRender?: () => void;
  // Lifted state props for persistence across navigation
  mediaItems?: MediaItem[];
  setMediaItems?: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  timelineItems?: TimelineItem[];
  setTimelineItems?: React.Dispatch<React.SetStateAction<TimelineItem[]>>;
  layers?: Layer[];
  setLayers?: React.Dispatch<React.SetStateAction<Layer[]>>;
}

const VideoEditor: React.FC<VideoEditorProps> = ({
  className = "",
  onPrevious,
  onSaveAndFinish,
  onRender,
  storyContent = "",
  selectedVoiceId = "",
  videoStyle = "landscape",
  savedVideoAssets,
  audioChunks = [],
  storyId,
  initialStory,
  onVideoAssetsUpdate,
  onTranscriptInfoUpdate,
  onStockMediaInfoUpdate,
  onSentenceTranscriptsUpdate,
  // Render failure handling
  hasRenderFailed = false,
  onRetryRender,
  // Lifted state props
  mediaItems: propsMediaItems,
  setMediaItems: propsSetMediaItems,
  timelineItems: propsTimelineItems,
  setTimelineItems: propsSetTimelineItems,
  layers: propsLayers,
  setLayers: propsSetLayers,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeUpdateLoopRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const timelineRef = useRef<HTMLDivElement>(null);
  const timeRulerRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const dragUpdateThrottleRef = useRef<number | null>(null);
  const retryRenderRef = useRef<NodeJS.Timeout | null>(null);

  // Base64 image cache to avoid regenerating the same images
  const base64ImageCache = useRef<Map<string, string>>(new Map());


  const [isLoading, setIsLoading] = useState(true);
  // Error state for handling various error conditions
  const [error, setError] = useState<string | null>(null);
  // Use lifted state from props if available, otherwise use local state
  const [localMediaItems, setLocalMediaItems] = useState<MediaItem[]>([]);
  const [localTimelineItems, setLocalTimelineItems] = useState<TimelineItem[]>([]);
  
  const mediaItems = propsMediaItems ?? localMediaItems;
  const setMediaItems = propsSetMediaItems ?? setLocalMediaItems;
  const timelineItems = propsTimelineItems ?? localTimelineItems;
  const setTimelineItems = propsSetTimelineItems ?? setLocalTimelineItems;
  const [voiceoverVolume, setVoiceoverVolume] = useState(80);
  const [stockFootageVolume, setStockFootageVolume] = useState(60);
  const [soundtrackVolume, setSoundtrackVolume] = useState(40);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentlyPlayingAudios, setCurrentlyPlayingAudios] = useState<
    HTMLAudioElement[]
  >([]);
  const currentlyPlayingAudiosRef = useRef<HTMLAudioElement[]>([]);
  const [currentlyPlayingVideos, setCurrentlyPlayingVideos] = useState<
    HTMLVideoElement[]
  >([]);
  const currentlyPlayingVideosRef = useRef<HTMLVideoElement[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRestoringAudio, setIsRestoringAudio] = useState(false);
  const [isRestoringVideoAssets, setIsRestoringVideoAssets] = useState(false);
  const [audioRestored, setAudioRestored] = useState(false);
  const [transcriptRestored, setTranscriptRestored] = useState(false);
  const [autoTranscriptGenerated, setAutoTranscriptGenerated] = useState(false);
  const [isAutoGeneratingTranscripts, setIsAutoGeneratingTranscripts] = useState(false);
  const [autoTranscriptProgress, setAutoTranscriptProgress] = useState("");
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  
  // Add missing state variables for tracking transcript and stock media info
  const [transcriptInfo, setTranscriptInfo] = useState<any>(null);
  const [stockMediaInfo, setStockMediaInfo] = useState<any>(null);
  
  // Auto Stock Media generation state
  const [isAutoGeneratingStockMedia, setIsAutoGeneratingStockMedia] = useState(false);
  const [autoStockMediaGenerated, setAutoStockMediaGenerated] = useState(false);
  const [autoStockMediaProgress, setAutoStockMediaProgress] = useState("");
  
  // Cleanup effect to save transcript and stock media info when component unmounts
  useEffect(() => {
    return () => {
      if (onTranscriptInfoUpdate && transcriptInfo) {
        onTranscriptInfoUpdate(transcriptInfo);
      }
      
      if (onStockMediaInfoUpdate && stockMediaInfo) {
        onStockMediaInfoUpdate(stockMediaInfo);
      }
    };
  }, [onTranscriptInfoUpdate, onStockMediaInfoUpdate, transcriptInfo, stockMediaInfo]);
  
  const [preGeneratedProcessed, setPreGeneratedProcessed] = useState(false);
  const [lastProcessedAudioChunksLength, setLastProcessedAudioChunksLength] =
    useState(0);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  // Use lifted state from props if available, otherwise use local state
  const [localLayers, setLocalLayers] = useState<Layer[]>([
    {
      id: "voice-layer",
      name: "Voice Over",
      visible: true,
      locked: false,
      items: [],
      type: "voiceover",
      duration: 0,
    },
  ]);
  
  const layers = propsLayers ?? localLayers;
  const setLayers = propsSetLayers ?? setLocalLayers;
  const [selectedLayerId, setSelectedLayerId] = useState<string>("voice-layer");
  const [indicatorPosition, setIndicatorPosition] = useState(0);
  const [draggedMediaItem, setDraggedMediaItem] = useState<MediaItem | null>(
    null
  );
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  // Layer reordering drag states
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [layerDragOverId, setLayerDragOverId] = useState<string | null>(null);
  // Transcript modal state
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [transcriptProgress, setTranscriptProgress] =
    useState<string>("Initializing...");
  const [draggedTimelineItem, setDraggedTimelineItem] =
    useState<TimelineItem | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [originalStartTime, setOriginalStartTime] = useState<number>(0);

  // Selection and canvas interaction state
  const [selectedTimelineItem, setSelectedTimelineItem] =
    useState<TimelineItem | null>(null);
  const [canvasInteractionMode, setCanvasInteractionMode] = useState<
    "none" | "move" | "resize"
  >("none");
  const [resizeHandle, setResizeHandle] = useState<
    "tl" | "tr" | "bl" | "br" | "l" | "r" | "t" | "b" | null
  >(null);
  const [canvasDragStart, setCanvasDragStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [originalGeometry, setOriginalGeometry] =
    useState<GeometricInfo | null>(null);
  const [previewDragPosition, setPreviewDragPosition] = useState<number | null>(
    null
  );
  const [canvasCursor, setCanvasCursor] = useState<string>("default");
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

  // Timeline drag and drop state
  const [timelineDropTarget, setTimelineDropTarget] = useState<{
    layerId: string;
    time: number;
  } | null>(null);

  useEffect(() => {}, [selectedTimelineItem]);
  // Add new state for resize handling
  const [isResizing, setIsResizing] = useState<"left" | "right" | null>(null);
  const [resizingItem, setResizingItem] = useState<TimelineItem | null>(null);
  const [resizeStartX, setResizeStartX] = useState<number>(0);
  const [originalDuration, setOriginalDuration] = useState<number>(0);

  // Timeline scale state
  const [timelineScale, setTimelineScale] = useState(1);
  const [timelineScrollLeft, _setTimelineScrollLeft] = useState(0);

  const MAX_LAYERS = 5;
  const IMAGE_DURATION = 5;

  const syncTimelineItemsFromLayers = (updatedLayers: Layer[]) => {
    const allTimelineItems: TimelineItem[] = [];
    updatedLayers.forEach((layer) => {
      if (layer.items) {
        allTimelineItems.push(...layer.items);
      }
    });
    
    setTimelineItems(allTimelineItems);
  };

  // State for system fonts
  const [systemFonts, setSystemFonts] = useState<string[]>([
    "Arial",
    "Helvetica",
    "Times New Roman",
    "Courier New",
    "Verdana",
    "Georgia",
    "Palatino",
    "Garamond",
    "Bookman",
    "Comic Sans MS",
    "Trebuchet MS",
    "Arial Black",
    "Impact",
    "Lucida Sans Unicode",
    "Tahoma",
    "Lucida Console",
    "Monaco",
    "Courier",
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
  ]);

  // Expose system fonts for external use
  const getAvailableFonts = () => systemFonts;

  // Add fonts to window for global access
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).getVideoEditorFonts = getAvailableFonts;
    }
  }, [systemFonts]);

  const normalizePath = (path: string): string => {
    return path.replace(/\\/g, "/");
  };

  // Helper function to load image as base64
  const loadImageAsBase64 = async (filePath: string): Promise<string> => {
    // Check cache first
    if (base64ImageCache.current.has(filePath)) {
      return base64ImageCache.current.get(filePath)!;
    }

    try {
      // Use the new base64 loading method from mediaStorageService
      const base64Url = await mediaStorageService.loadImageAsBase64(filePath);
      
      // Cache the result
      base64ImageCache.current.set(filePath, base64Url);
      return base64Url;
    } catch (error) {
      console.error(`❌ Failed to create base64 for ${filePath}:`, error);
      throw error;
    }
  };

  // Helper function to convert external URL to base64 to avoid CORS issues
  const convertUrlToBase64 = async (url: string): Promise<string> => {
    // Check cache first
    if (base64ImageCache.current.has(url)) {
      return base64ImageCache.current.get(url)!;
    }

    try {
      console.log(`🔄 Converting external URL to base64: ${url.substring(0, 50)}...`);
      
      // Use backend proxy to avoid CORS issues
      const response = await fetch('http://localhost:5555/api/media/download-openai-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: url,
          storyId: storyId || 'temp',
          imageId: `temp_${Date.now()}`
        })
      });

      if (!response.ok) {
        throw new Error(`Backend proxy failed: ${response.status}`);
      }

      const blob = await response.blob();
      const base64Url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Cache the result
      base64ImageCache.current.set(url, base64Url);
      console.log(`✅ Successfully converted URL to base64: ${base64Url.substring(0, 50)}...`);
      return base64Url;
    } catch (error) {
      console.error(`❌ Failed to convert URL to base64: ${url}`, error);
      throw error;
    }
  };

  // Function to detect available system fonts
  const detectSystemFonts = async (): Promise<string[]> => {
    const commonFonts = [
      // Sans-serif fonts
      "Arial",
      "Helvetica",
      "Helvetica Neue",
      "Calibri",
      "Segoe UI",
      "Roboto",
      "Open Sans",
      "Lato",
      "Source Sans Pro",
      "Montserrat",
      "Poppins",
      "Inter",
      "System UI",
      "San Francisco",
      "Avenir",
      "Futura",
      "Century Gothic",
      "Trebuchet MS",
      "Verdana",
      "Tahoma",
      "Geneva",
      "Lucida Grande",
      "Lucida Sans Unicode",
      "Arial Black",
      "Impact",
      "Franklin Gothic Medium",
      "Arial Narrow",

      // Serif fonts
      "Times New Roman",
      "Times",
      "Georgia",
      "Garamond",
      "Palatino",
      "Book Antiqua",
      "Minion Pro",
      "Adobe Garamond Pro",
      "Baskerville",
      "Caslon",
      "Bodoni",
      "Didot",
      "Trajan Pro",
      "Optima",
      "Perpetua",
      "Rockwell",
      "Clarendon",
      "Playfair Display",
      "Merriweather",
      "Libre Baskerville",

      // Monospace fonts
      "Courier New",
      "Courier",
      "Monaco",
      "Menlo",
      "Consolas",
      "Inconsolata",
      "Source Code Pro",
      "Fira Code",
      "JetBrains Mono",
      "Roboto Mono",
      "SF Mono",
      "Lucida Console",
      "Liberation Mono",

      // Display fonts
      "Comic Sans MS",
      "Papyrus",
      "Brush Script MT",
      "Lucida Handwriting",
      "Marker Felt",
      "Chalkduster",
      "Noteworthy",
      "Snell Roundhand",
      "Bradley Hand",
      "Trattatello",
      "Zapfino",
      "Herculanum",

      // Google Fonts (commonly available)
      "Roboto",
      "Open Sans",
      "Lato",
      "Montserrat",
      "Oswald",
      "Source Sans Pro",
      "Slabo 27px",
      "Raleway",
      "PT Sans",
      "Lora",
      "Ubuntu",
      "PT Serif",
      "Playfair Display",
      "Merriweather",
      "Nunito",
      "Poppins",
      "Rubik",
      "Work Sans",
      "Fira Sans",
      "Noto Sans",
      "Mukti",
      "Karla",
    ];

    const availableFonts: string[] = [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return commonFonts.slice(0, 20); // Fallback to first 20 fonts

    // Test each font by comparing rendered text width
    const testText = "mmmmmmmmmmlli";
    const testSize = "72px";

    // Get baseline measurement with a standard font
    ctx.font = `${testSize} monospace`;
    const baselineWidth = ctx.measureText(testText).width;

    for (const fontName of commonFonts) {
      try {
        // Test the font
        ctx.font = `${testSize} "${fontName}", monospace`;
        const testWidth = ctx.measureText(testText).width;

        // If width differs significantly, the font is likely available
        if (Math.abs(testWidth - baselineWidth) > 1) {
          availableFonts.push(fontName);
        } else {
          // Double-check with serif fallback
          ctx.font = `${testSize} "${fontName}", serif`;
          const testWidthSerif = ctx.measureText(testText).width;
          if (Math.abs(testWidthSerif - baselineWidth) > 1) {
            availableFonts.push(fontName);
          }
        }
      } catch (error) {
        // Font name might have special characters, skip it
        continue;
      }
    }

    // Always include web-safe fonts as fallbacks
    const webSafeFonts = [
      "Arial",
      "Helvetica",
      "Times New Roman",
      "Courier New",
      "Verdana",
      "Georgia",
      "serif",
      "sans-serif",
      "monospace",
    ];
    const uniqueFonts = [...new Set([...availableFonts, ...webSafeFonts])];

    return uniqueFonts;
  };

  const loadAudioForPlayback = async (
    mediaId: string
  ): Promise<HTMLAudioElement | null> => {
    // Log current cache state

    const existingAudio = audioElementsRef.current.get(mediaId);
    if (existingAudio) {
      return existingAudio;
    }

    const mediaItem = mediaItems.find((item) => item.id === mediaId);
    if (!mediaItem) {
      return null;
    }

    if (mediaItem.type !== "voiceover" && mediaItem.type !== "audio") {
      return null;
    }

    try {
      let audioUrl = null;

      // Priority order for audio URL resolution:
      // 1. previewUrl (for split audio files)
      // 2. filePath if it's a blob URL
      // 3. filePath through storage service

      // Check if this is a split audio file with previewUrl (blob URL)
      if (mediaItem.previewUrl && mediaItem.previewUrl.startsWith("blob:")) {
        audioUrl = mediaItem.previewUrl;
      } else if (mediaItem.filePath) {
        if (mediaItem.filePath.startsWith("blob:")) {
          // Direct blob URL
          audioUrl = mediaItem.filePath;
        } else {
          // File system path - load through storage service
          const normalizedPath = normalizePath(mediaItem.filePath);
          const exists = await audioStorageService.fileExists(normalizedPath);
          if (!exists) {
            throw new Error(`Audio file not found: ${normalizedPath}`);
          }

          try {
            audioUrl = await audioStorageService.loadAudioFile(normalizedPath);
          } catch (storageError) {
            throw new Error(`Failed to load from storage: ${storageError}`);
          }
        }
      }

      if (!audioUrl) {
        throw new Error(`No valid audio URL for media ${mediaId}`);
      }

      const audio = new Audio(audioUrl);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Audio load timeout"));
        }, 5000);

        audio.onloadeddata = () => {
          clearTimeout(timeout);

          resolve(true);
        };

        audio.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };

        audio.load();
      });

      // Basic error handling
      audio.onerror = (e) => {
        console.error(`❌ Audio playback error for ${mediaItem.name}:`, e);
      };

      audioElementsRef.current.set(mediaId, audio);
      return audio;
    } catch (error) {
      throw new Error(`Failed to load audio for playback ${mediaId}: ${error}`);
    }
  };

  // Add refs for preview
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Add ref to track canvas initialization
  const canvasInitializedRef = useRef<boolean>(false);

  // Add function to initialize preview canvas
  const initializePreview = () => {
    console.log("🔧 INIT: Attempting to initialize preview canvas...");
    
    if (!previewCanvasRef.current) {
      console.error("❌ INIT FAIL: previewCanvasRef.current is null");
      return;
    }

    const ctx = previewCanvasRef.current.getContext("2d");
    if (!ctx) {
      console.error("❌ INIT FAIL: Cannot get 2D context from canvas");
      return;
    }

    previewContextRef.current = ctx;
    canvasInitializedRef.current = true;
    
    console.log("✅ INIT SUCCESS: Canvas initialized successfully");

    // Initial canvas setup
    updateCanvasSize();
  };

  // Add function to update canvas size
  const updateCanvasSize = () => {
    if (!previewCanvasRef.current) return;

    const container = previewCanvasRef.current.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    let canvasWidth, canvasHeight;

    switch (videoStyle) {
      case "square":
        canvasWidth = Math.min(containerWidth, containerHeight);
        canvasHeight = canvasWidth;
        break;
      case "vertical":
        canvasWidth = Math.min(containerWidth, (containerHeight * 9) / 16);
        canvasHeight = (canvasWidth * 16) / 9;
        break;
      case "landscape":
      default:
        canvasHeight = Math.min(containerHeight, (containerWidth * 9) / 16);
        canvasWidth = (canvasHeight * 16) / 9;
        break;
    }

    previewCanvasRef.current.width = canvasWidth;
    previewCanvasRef.current.height = canvasHeight;

    // Draw background
    const ctx = previewContextRef.current;
    if (ctx) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Use retry mechanism for canvas size updates
    renderPreviewFrame(currentTime, 0);
  };
  // Helper function to generate video thumbnail from blob URL
  const generateVideoThumbnail = async (
    videoBlobUrl: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = videoBlobUrl;

      video.onloadedmetadata = async () => {
        try {
          // Seek to 1 second for thumbnail
          video.currentTime = Math.min(1, video.duration * 0.1);

          await new Promise<void>((seekResolve) => {
            video.onseeked = () => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");

                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.7);
                  resolve(thumbnailDataUrl);
                } else {
                  reject(new Error("Could not get canvas context"));
                }
              } catch (error) {
                reject(error);
              }
              seekResolve();
            };

            // Fallback if seeking takes too long
            setTimeout(() => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth || 320;
                canvas.height = video.videoHeight || 240;
                const ctx = canvas.getContext("2d");

                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.7);
                  resolve(thumbnailDataUrl);
                } else {
                  reject(new Error("Could not get canvas context"));
                }
              } catch (error) {
                reject(error);
              }
              seekResolve();
            }, 2000);
          });
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => {
        reject(new Error("Failed to load video for thumbnail generation"));
      };

      // Start loading the video
      video.load();

      // Cleanup function
      const cleanup = () => {
        video.src = "";
        video.load();
      };

      // Ensure cleanup happens
      setTimeout(cleanup, 5000);
    });
  };

  // Add function to load media elements
  const loadMediaElement = async (
    mediaItem: MediaItem
  ): Promise<HTMLElement | null> => {
    if (mediaItem.type === "video") {
      const existingVideo = videoElementsRef.current.get(mediaItem.id);
      if (existingVideo) return existingVideo;

      try {
        const video = document.createElement("video");
        
        // Use filesystem path for video loading (no more blob URLs)
        let videoSrc: string;
        if (mediaItem.filePath) {
          console.log(`🎬 Loading video ${mediaItem.id} from filesystem: ${mediaItem.filePath}...`);
          try {
            // Load from filesystem using mediaStorageService (returns base64)
            videoSrc = await mediaStorageService.loadMediaFile(mediaItem.filePath);
            console.log(`✅ Loaded video ${mediaItem.id} as base64: ${videoSrc.substring(0, 50)}...`);
          } catch (loadError) {
            console.warn(`❌ Failed to load video ${mediaItem.id} from filesystem:`, loadError);
            throw new Error(`Cannot load video from ${mediaItem.filePath}`);
          }
        } else if (mediaItem.previewUrl) {
          videoSrc = mediaItem.previewUrl;
          console.log(`🎬 Loading video ${mediaItem.id} from previewUrl: ${videoSrc.substring(0, 50)}...`);
        } else {
          throw new Error(`No valid source for video ${mediaItem.id}`);
        }
        
        video.src = videoSrc;
        video.preload = "auto";
        video.muted = false; // Enable audio for video playback
        // Apply individual and global volume with mute consideration
        const individualVolume = mediaItem.volume || 100;
        const globalVolume = stockFootageVolume;
        video.volume = mediaItem.muted
          ? 0
          : (individualVolume * globalVolume) / 10000;

        // Debug logging for Pexels content
        if (mediaItem.source === "pexels") {
          if (videoSrc.startsWith("http")) {
            console.warn(
              `⚠️ NETWORK REQUEST DETECTED: Pexels video ${mediaItem.id} is using network URL instead of local file!`
            );
          }

          // CRITICAL: Ensure Pexels videos use same settings as manual imports
        }

        await new Promise<void>((resolve, reject) => {
          // Use more comprehensive loading detection
          const checkLoaded = () => {
            if (
              video.readyState >= 1 &&
              video.videoWidth > 0 &&
              video.videoHeight > 0
            ) {
              resolve();
              return true;
            }
            return false;
          };

          video.onloadedmetadata = () => {
            if (!checkLoaded()) {
              // Wait a bit more for video data
              setTimeout(() => {
                if (!checkLoaded()) {
                }
              }, 100);
            }
          };

          video.onloadeddata = () => {
            checkLoaded();
          };

          video.oncanplay = () => {
            checkLoaded();
          };

          video.onerror = () => {
            reject(new Error("Failed to load video"));
          };

          // Start loading
          video.load();

          // Fallback timeout
          setTimeout(() => {
            if (video.readyState >= 1) {
              resolve();
            } else {
              reject(new Error("Video loading timeout"));
            }
          }, 5000);
        });

        videoElementsRef.current.set(mediaItem.id, video);
        console.log(`✅ Video element loaded and set for ${mediaItem.id}`);
        
        // Trigger rendering with a small delay to ensure video is ready
        setTimeout(() => {
          if (canvasInitializedRef.current) {
            renderPreviewFrame(currentTime, 0);
          }
        }, 50);
        
        return video;
      } catch (error) {
        console.warn(`❌ VIDEO LOAD FAIL: ${mediaItem.id} failed to load. Error:`, error);
        return null;
      }
    } else if (mediaItem.type === "image") {
      const existingImage = imageElementsRef.current.get(mediaItem.id);
      if (existingImage) {
        console.log(`✅ Image element already exists for ${mediaItem.id}`);
        return existingImage;
      }
    
      console.log(`🖼️ Starting to load image ${mediaItem.id}...`);
      
      try {
        const img = new Image();
        
        let imageSrc: string = "";
        
        // Priority order for image sources:
        // 1. thumbnailUrl (backend-served or data/blob URLs - highest priority)
        // 2. previewUrl (backend-served or data/blob URLs)
        // 3. filePath (filesystem path - for legacy items)
        // 4. Fallback to any available source
        
        if (mediaItem.thumbnailUrl && (
          mediaItem.thumbnailUrl.startsWith('data:') || 
          mediaItem.thumbnailUrl.startsWith('blob:') ||
          mediaItem.thumbnailUrl.includes('localhost:5555/api/media/openai-image')
        )) {
          // Use thumbnailUrl if it's a valid data URL, blob URL, or backend-served URL
          imageSrc = mediaItem.thumbnailUrl;
          console.log(`🖼️ Loading image ${mediaItem.id} from thumbnailUrl: ${imageSrc.substring(0, 50)}...`);
        } else if (mediaItem.thumbnailUrl && mediaItem.thumbnailUrl.startsWith('http')) {
          // Convert external URL to base64 to avoid CORS issues
          try {
            imageSrc = await convertUrlToBase64(mediaItem.thumbnailUrl);
            console.log(`🖼️ Loaded image ${mediaItem.id} from thumbnailUrl (converted to base64): ${imageSrc.substring(0, 50)}...`);
          } catch (error) {
            console.warn(`❌ Failed to convert thumbnailUrl to base64 for ${mediaItem.id}:`, error);
            // Fall back to direct URL (may cause CORS issues)
            imageSrc = mediaItem.thumbnailUrl;
          }
        } else if (mediaItem.previewUrl && (
          mediaItem.previewUrl.startsWith('data:') || 
          mediaItem.previewUrl.startsWith('blob:') ||
          mediaItem.previewUrl.includes('localhost:5555/api/media/openai-image')
        )) {
          // Use previewUrl if it's a valid data URL, blob URL, or backend-served URL
          imageSrc = mediaItem.previewUrl;
          console.log(`🖼️ Loading image ${mediaItem.id} from previewUrl: ${imageSrc.substring(0, 50)}...`);
        } else if (mediaItem.previewUrl && mediaItem.previewUrl.startsWith('http')) {
          // Convert external URL to base64 to avoid CORS issues
          try {
            imageSrc = await convertUrlToBase64(mediaItem.previewUrl);
            console.log(`🖼️ Loaded image ${mediaItem.id} from previewUrl (converted to base64): ${imageSrc.substring(0, 50)}...`);
          } catch (error) {
            console.warn(`❌ Failed to convert previewUrl to base64 for ${mediaItem.id}:`, error);
            // Fall back to direct URL (may cause CORS issues)
            imageSrc = mediaItem.previewUrl;
          }
        } else if (mediaItem.filePath && !mediaItem.filePath.startsWith('http')) {
          // Load from filesystem path (for legacy items)
          console.log(`🖼️ Loading image ${mediaItem.id} from filesystem: ${mediaItem.filePath}...`);
          
          try {
            imageSrc = await mediaStorageService.loadImageAsBase64(mediaItem.filePath);
            
            // Check if we got a file:// URL (large file) or data: URL (small file)
            if (imageSrc.startsWith('file://')) {
              console.log(`✅ Loaded large image ${mediaItem.id} as file path: ${imageSrc}`);
            } else {
              console.log(`✅ Loaded small image ${mediaItem.id} as base64: ${imageSrc.substring(0, 50)}...`);
            }
          } catch (loadError) {
            console.warn(`❌ Failed to load image as base64 from filesystem ${mediaItem.id}:`, loadError);
            
            // Try alternative loading methods
            try {
              // Try loading as regular media file (might return blob URL)
              imageSrc = await mediaStorageService.loadMediaFile(mediaItem.filePath);
              console.log(`✅ Loaded image ${mediaItem.id} as media file: ${imageSrc.substring(0, 50)}...`);
            } catch (altError) {
              console.error(`❌ All filesystem loading methods failed for image ${mediaItem.id}:`, altError);
              // Continue to next priority source
            }
          }
        } else if (mediaItem.filePath && mediaItem.filePath.startsWith('http')) {
          // Check if it's a backend-served image (no CORS issues)
          if (mediaItem.filePath.includes('localhost:5555/api/media/openai-image')) {
            imageSrc = mediaItem.filePath;
            console.log(`🖼️ Loading image ${mediaItem.id} from backend-served path: ${imageSrc}`);
          } else {
            // Convert external URL to base64 to avoid CORS issues
            try {
              imageSrc = await convertUrlToBase64(mediaItem.filePath);
              console.log(`🖼️ Loaded image ${mediaItem.id} from filePath (converted to base64): ${imageSrc.substring(0, 50)}...`);
            } catch (error) {
              console.warn(`❌ Failed to convert filePath to base64 for ${mediaItem.id}:`, error);
              // Continue to next priority source
            }
          }

        } else {
          // Last resort - try any available source
          const availableSources = [
            mediaItem.thumbnailUrl,
            mediaItem.previewUrl,
            mediaItem.filePath
          ].filter((source): source is string => Boolean(source));
          
          if (availableSources.length > 0) {
            const source = availableSources[0];
            if (source.startsWith('http')) {
              // Check if it's a backend-served image (no CORS issues)
              if (source.includes('localhost:5555/api/media/openai-image')) {
                imageSrc = source;
                console.log(`🖼️ Using fallback backend-served source for image ${mediaItem.id}: ${imageSrc}`);
              } else {
                // Convert external URL to base64
                try {
                  imageSrc = await convertUrlToBase64(source);
                  console.log(`🖼️ Using fallback source for image ${mediaItem.id} (converted to base64): ${imageSrc.substring(0, 50)}...`);
                } catch (error) {
                  console.warn(`❌ Failed to convert fallback source to base64 for ${mediaItem.id}:`, error);
                  imageSrc = source;
                }
              }
            } else {
              imageSrc = source;
              console.log(`🖼️ Using fallback source for image ${mediaItem.id}: ${imageSrc.substring(0, 50)}...`);
            }
          } else {
            throw new Error(`No valid source for image ${mediaItem.id}`);
          }
        }
        
        // Log the image source type for debugging
        if (imageSrc.startsWith('file://')) {
          console.log(`🖼️ Setting image src for ${mediaItem.id} to file path: ${imageSrc}`);
        } else if (imageSrc.startsWith('data:')) {
          console.log(`🖼️ Setting image src for ${mediaItem.id} to base64 data: ${imageSrc.substring(0, 100)}...`);
        } else {
          console.log(`🖼️ Setting image src for ${mediaItem.id} to: ${imageSrc.substring(0, 100)}...`);
        }
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            console.log(`✅ Image onload fired for ${mediaItem.id} - loaded successfully`);
            console.log(`📊 Image dimensions: ${img.width}x${img.height}`);
            resolve();
          };
          img.onerror = (error) => {
            console.error(`❌ Image onerror fired for ${mediaItem.id}:`, error);
            console.error(`❌ Failed image src: ${imageSrc}`);
            reject(new Error(`Failed to load image: ${error}`));
          };
          img.src = imageSrc;
        });
    
        console.log(`🖼️ Adding image to refs for ${mediaItem.id}...`);
        imageElementsRef.current.set(mediaItem.id, img);
        console.log(`✅ Image element loaded and set for ${mediaItem.id}`);
        console.log(`🖼️ Current image refs:`, Array.from(imageElementsRef.current.keys()));
        
        setTimeout(() => {
          if (canvasInitializedRef.current) {
            renderPreviewFrame(currentTime, 0);
          }
        }, 50);
        
        return img;
      } catch (error) {
        console.error(`❌ IMAGE LOAD FAIL: ${mediaItem.id} failed to load. Error:`, error);
        console.error(`🖼️ Current image refs after failure:`, Array.from(imageElementsRef.current.keys()));
        return null;
      }
    }
    return null;
  };

  // Add canvas health check function
  const checkCanvasHealth = (): boolean => {
    const canvas = previewCanvasRef.current;
    const ctx = previewContextRef.current;
    
    if (!canvas || !ctx) {
      console.warn("⚠️ Canvas health check failed: Canvas or context is null");
      return false;
    }
    
    // Check if canvas dimensions are valid
    if (canvas.width <= 0 || canvas.height <= 0) {
      console.warn("⚠️ Canvas health check failed: Invalid canvas dimensions", { width: canvas.width, height: canvas.height });
      return false;
    }
    
    // Try to get image data to verify context is working
    try {
      const testImageData = ctx.getImageData(0, 0, 1, 1);
      if (!testImageData || !testImageData.data) {
        console.warn("⚠️ Canvas health check failed: Cannot get image data");
        return false;
      }
    } catch (error) {
      // Check if this is a CORS error
      if (error instanceof Error && (error.message.includes('tainted') || error.message.includes('cross-origin'))) {
        console.warn("⚠️ Canvas health check failed: Canvas tainted by cross-origin data. This is expected for external images.");
        // Don't treat CORS errors as fatal - the canvas can still work for non-external images
        return true;
      } else {
        console.warn("⚠️ Canvas health check failed: Context error", error);
        return false;
      }
    }
    
    return true;
  };

  // Add function to render preview frame with geometric transformations
  const renderPreviewFrame = (time: number = currentTime, retryCount: number = 0) => {
    console.log(`🎬 renderPreviewFrame called at time ${time} (retry: ${retryCount})`);
    
    // Check canvas health first
    if (!checkCanvasHealth()) {
      console.warn("🔄 Canvas health check failed, attempting recovery...");
      canvasInitializedRef.current = false;
      
      // Try to re-initialize canvas
      setTimeout(() => {
        initializePreview();
        if (retryCount < 3) {
          renderPreviewFrame(time, retryCount + 1);
        }
      }, 100);
      return;
    }
    
    if (!canvasInitializedRef.current) {
      console.warn(`❌ RENDER FAIL: Canvas not initialized yet (canvasInitializedRef.current: ${canvasInitializedRef.current}, previewCanvasRef: ${!!previewCanvasRef.current}, previewContextRef: ${!!previewContextRef.current})`);
      
      // Add retry logic - try again after canvas initialization
      if (retryCount < 5) { // Max 5 retries
        const delay = Math.min(100 * Math.pow(2, retryCount), 2000); // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
        console.log(`🔄 RETRY: Will retry rendering in ${delay}ms (attempt ${retryCount + 1}/5)`);
        
        // Clear any existing retry timer
        if (retryRenderRef.current) {
          clearTimeout(retryRenderRef.current);
        }
        
        // Try to initialize canvas if it's available but not initialized
        if (previewCanvasRef.current && !canvasInitializedRef.current) {
          console.log("🔄 RETRY: Attempting early canvas initialization...");
          try {
            initializePreview();
          } catch (error) {
            console.warn("⚠️ RETRY: Early initialization failed:", error);
          }
        }
        
        retryRenderRef.current = setTimeout(() => {
          renderPreviewFrame(time, retryCount + 1);
        }, delay);
      } else {
        console.error("🚨 RENDER FAIL: Canvas failed to initialize after 5 retries. Trying to force initialization...");
        console.log(`📊 FORCE INIT: Canvas state - canvasRef: ${!!previewCanvasRef.current}, contextRef: ${!!previewContextRef.current}, initialized: ${canvasInitializedRef.current}`);
        
        // Force canvas initialization as last resort
        try {
          if (previewCanvasRef.current) {
            console.log("🔧 FORCE INIT: Attempting to reinitialize canvas...");
            initializePreview();
            
            // Give it extra time after forced initialization
            setTimeout(() => {
              console.log(`✅ FORCE INIT: Retry after forced initialization. Canvas initialized: ${canvasInitializedRef.current}`);
              renderPreviewFrame(time, 0); // Reset retry count after forced init
            }, 300);
          } else {
            console.error("💥 CRITICAL: Canvas element is null, cannot force initialization");
          }
        } catch (error) {
          console.error("💥 CRITICAL: Cannot initialize canvas:", error);
        }
      }
      return; // Canvas not ready yet, skip rendering
    }

    if (!previewContextRef.current || !previewCanvasRef.current) {
      console.warn("❌ RENDER FAIL: Canvas context or canvas ref not available");
      
      // Try to retry with same logic as canvas initialization
      if (retryCount < 3) {
        const delay = 200 + (retryCount * 100); // 200ms, 300ms, 400ms
        console.log(`🔄 RETRY: Canvas context missing, retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
        
        if (retryRenderRef.current) {
          clearTimeout(retryRenderRef.current);
        }
        
        retryRenderRef.current = setTimeout(() => {
          renderPreviewFrame(time, retryCount + 1);
        }, delay);
      } else {
        console.error("🚨 RENDER FAIL: Canvas context unavailable after retries");
      }
      return;
    }

    // Clear any pending retry timer since we're successfully rendering now
    if (retryRenderRef.current) {
      clearTimeout(retryRenderRef.current);
      retryRenderRef.current = null;
    }
    
    // Log success if this was a retry
    if (retryCount > 0) {
      console.log(`✅ RENDER SUCCESS: Canvas ready after ${retryCount} retries!`);
    }

    const ctx = previewContextRef.current;
    const canvas = previewCanvasRef.current;
    
    console.log(`🎨 Canvas size: ${canvas.width}x${canvas.height}`);
    console.log(`📚 Layers count: ${layers.length}`);
    console.log(`🎬 Media items count: ${mediaItems.length}`);

    // Clear canvas with black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let renderedItemsCount = 0;
    let skippedItemsCount = 0;

    // Render layers from bottom to top (reverse order)
    [...layers].reverse().forEach((layer, layerIndex) => {
      console.log(`🔍 Processing layer ${layerIndex}: ${layer.name} (${layer.items.length} items, visible: ${layer.visible})`);
      
      if (!layer.visible) {
        console.warn(`⚠️ SKIP: Layer "${layer.name}" is not visible`);
        return;
      }
      
      console.log(`🔍 Layer ${layer.name} timeline items:`, layer.items.map(item => ({
        id: item.id,
        mediaId: item.mediaId,
        startTime: item.startTime,
        endTime: item.startTime + item.duration,
        inTimeRange: time >= item.startTime && time < item.startTime + item.duration
      })));

      layer.items.forEach((item, itemIndex) => {
        console.log(`🔍 Processing item ${itemIndex}: ${item.id} (${item.startTime}-${item.startTime + item.duration}) mediaId: ${item.mediaId}`);
        
        if (time >= item.startTime && time < item.startTime + item.duration) {
          console.log(`✅ Item ${item.id} is in time range`);
          
          const mediaItem = mediaItems.find((m) => m.id === item.mediaId);
          if (!mediaItem) {
            console.warn(`❌ RENDER FAIL: MediaItem not found for item.mediaId: ${item.mediaId}`);
            console.warn(`Available mediaItems:`, mediaItems.map(m => ({id: m.id, name: m.name, type: m.type})));
            skippedItemsCount++;
            return;
          }
          
          console.log(`✅ Found mediaItem: ${mediaItem.name} (${mediaItem.type})`);

          // Get geometry or use defaults
          const geometry = item.geometry || {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            rotation: 0,
          };

          // Calculate actual pixel coordinates
          const x = geometry.x * canvas.width;
          const y = geometry.y * canvas.height;
          const width = geometry.width * canvas.width;
          const height = geometry.height * canvas.height;
          const rotation = geometry.rotation || 0;
          
          console.log(`📐 Geometry: x=${x.toFixed(1)}, y=${y.toFixed(1)}, w=${width.toFixed(1)}, h=${height.toFixed(1)}`);

          ctx.save();

          // Apply transformations
          if (rotation !== 0) {
            ctx.translate(x + width / 2, y + height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-(width / 2), -(height / 2));
          } else {
            ctx.translate(x, y);
          }

          // Render the media
          if (mediaItem.type === "video") {
            const video = videoElementsRef.current.get(mediaItem.id);

            if (!video) {
              console.warn(`❌ RENDER FAIL: Video element not found in ref for ${mediaItem.id}`);
              console.warn(`Available video refs:`, Array.from(videoElementsRef.current.keys()));
              skippedItemsCount++;
            } else {
              console.log(`🎬 Video element found: readyState=${video.readyState}, width=${video.videoWidth}, height=${video.videoHeight}, src=${video.src.substring(0, 50)}...`);

            // More lenient rendering condition - render if video exists and has basic metadata
            if (
              video &&
              (video.readyState >= 1 ||
                (video.videoWidth > 0 && video.videoHeight > 0))
            ) {
              try {
                // Draw video if it has loaded enough data or has valid dimensions
                // This ensures videos remain clickable during timeline scrubbing
                ctx.drawImage(video, 0, 0, width, height);
                  console.log(`✅ Successfully rendered video ${mediaItem.id}`);
                  renderedItemsCount++;
                } catch (error) {
                  console.warn(`❌ RENDER FAIL: Error drawing video ${mediaItem.id}:`, error);
                  skippedItemsCount++;
                }
              } else {
                console.warn(`❌ RENDER FAIL: Video ${mediaItem.id} not ready - readyState: ${video.readyState}, dimensions: ${video.videoWidth}x${video.videoHeight}`);
                skippedItemsCount++;
              }
            }
          } else if (mediaItem.type === "image") {
            const img = imageElementsRef.current.get(mediaItem.id);
            
            if (!img) {
              console.warn(`❌ RENDER FAIL: Image element not found in ref for ${mediaItem.id}`);
              console.warn(`Available image refs:`, Array.from(imageElementsRef.current.keys()));
              skippedItemsCount++;
            } else {
              console.log(`🖼️ Image element found: complete=${img.complete}, naturalWidth=${img.naturalWidth}, src=${img.src.substring(0, 50)}...`);
              
              if (img.complete && img.naturalWidth > 0) {
                try {
                  ctx.drawImage(img, 0, 0, width, height);
                  console.log(`✅ Successfully rendered image ${mediaItem.id}`);
                  renderedItemsCount++;
                } catch (error) {
                  // Check if this is a CORS error
                  if (error instanceof Error && (error.message.includes('tainted') || error.message.includes('cross-origin'))) {
                    console.warn(`⚠️ CORS ERROR: Cannot draw image ${item.mediaId} due to cross-origin restrictions. Attempting to convert to base64...`);
                    
                    // Try to convert the image to base64 and reload it
                    const currentMediaItem = mediaItems.find(m => m.id === item.mediaId);
                    if (currentMediaItem && (currentMediaItem.filePath?.startsWith('http') || currentMediaItem.previewUrl?.startsWith('http') || currentMediaItem.thumbnailUrl?.startsWith('http'))) {
                      // Schedule a reload with base64 conversion
                      setTimeout(() => {
                        loadMediaElement(currentMediaItem).then(() => {
                          if (canvasInitializedRef.current) {
                            renderPreviewFrame(currentTime, 0);
                          }
                        }).catch(reloadError => {
                          console.error(`❌ Failed to reload image ${currentMediaItem.id} with base64:`, reloadError);
                        });
                      }, 100);
                    }
                  } else {
                    console.warn(`❌ RENDER FAIL: Error drawing image ${item.mediaId}:`, error);
                  }
                  skippedItemsCount++;
                }
              } else {
                console.warn(`❌ RENDER FAIL: Image ${mediaItem.id} not loaded - complete: ${img.complete}, naturalWidth: ${img.naturalWidth}`);
                skippedItemsCount++;
              }
            }
          } else if (mediaItem.type === "text") {
            console.log(`📝 RENDERING TEXT: Rendering text item ${mediaItem.id}: "${mediaItem.text?.substring(0, 50)}..."`);
            // Render text with enhanced subtitle styling
            if (mediaItem.text) {
              // Apply enhanced font properties
              const fontFamily = mediaItem.fontFamily || "Arial";
              const fontSize = mediaItem.fontSize || Math.min(width, height) * 0.1;
              const fontWeight = mediaItem.fontBold ? "bold" : "normal";
              const fontStyle = mediaItem.fontItalic ? "italic" : "normal";

              // Build font string (underline and strikethrough handled separately)
              let fontString = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
              ctx.font = fontString;
              
              // Apply text alignment
              ctx.textAlign = mediaItem.textAlignment || "center";
              ctx.textBaseline = "middle";

              // Apply text opacity
              const textOpacity = (mediaItem.textOpacity || 100) / 100;
              const textColor = mediaItem.fontColor || "#ffffff";
              let textColorWithOpacity = textColor;
              
              if (textOpacity < 1 && textColor.startsWith('#')) {
                const r = parseInt(textColor.slice(1, 3), 16);
                const g = parseInt(textColor.slice(3, 5), 16);
                const b = parseInt(textColor.slice(5, 7), 16);
                textColorWithOpacity = `rgba(${r}, ${g}, ${b}, ${textOpacity})`;
              }
              
              ctx.fillStyle = textColorWithOpacity;

              // Apply text border if specified
              if (mediaItem.textBorderThickness && mediaItem.textBorderThickness > 0 && mediaItem.textBorderColor) {
                ctx.strokeStyle = mediaItem.textBorderColor;
                ctx.lineWidth = mediaItem.textBorderThickness;
              } else {
                // Default black outline for readability
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 2;
              }

              // Text shadow for better readability
              ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
              ctx.shadowBlur = 4;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;

              // Draw background if specified and not transparent
              if (
                !mediaItem.backgroundTransparent &&
                mediaItem.backgroundColor &&
                mediaItem.backgroundColor !== "#000000"
              ) {
                ctx.save();
                const bgColor = mediaItem.backgroundColor;
                const bgOpacity = (mediaItem.backgroundOpacity || 100) / 100;
                let bgColorWithOpacity = bgColor;
                
                if (bgOpacity < 1 && bgColor.startsWith('#')) {
                  const r = parseInt(bgColor.slice(1, 3), 16);
                  const g = parseInt(bgColor.slice(3, 5), 16);
                  const b = parseInt(bgColor.slice(5, 7), 16);
                  bgColorWithOpacity = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
                }
                
                ctx.fillStyle = bgColorWithOpacity;
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
                // Restore text fill style after background
                ctx.fillStyle = textColorWithOpacity;
              }

              // Apply text capitalization
              let displayText = mediaItem.text;
              switch (mediaItem.textCapitalization) {
                case "AA":
                  displayText = mediaItem.text.toUpperCase();
                  break;
                case "aa":
                  displayText = mediaItem.text.toLowerCase();
                  break;
                case "Aa":
                  displayText = mediaItem.text.charAt(0).toUpperCase() + mediaItem.text.slice(1).toLowerCase();
                  break;
                case "--":
                default:
                  displayText = mediaItem.text; // Keep original
                  break;
              }

              // Calculate text position based on alignment
              let textX: number;
              switch (mediaItem.textAlignment) {
                case "left":
                  textX = width * 0.05; // 5% from left edge
                  break;
                case "right":
                  textX = width * 0.95; // 5% from right edge
                  break;
                case "center":
                default:
                  textX = width / 2; // Center
                  break;
              }

              // Process text with proper line breaks and word wrapping
              const maxWidth = width * 0.9; // Use 90% to prevent edge overflow
              const lines: string[] = [];
              
              // First, split by actual newlines to respect line breaks
              const paragraphs = displayText.split('\n');
              
              paragraphs.forEach(paragraph => {
                if (paragraph.trim() === '') {
                  // Empty paragraph - add a blank line
                  lines.push('');
                  return;
                }
                
                // Word wrap each paragraph
                const words = paragraph.split(" ");
                let currentLine = words[0] || "";

                for (let i = 1; i < words.length; i++) {
                  const word = words[i];
                  const testLine = currentLine + " " + word;
                  const metrics = ctx.measureText(testLine);

                  if (metrics.width > maxWidth && currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = word;
                  } else {
                    currentLine = testLine;
                  }
                }
                if (currentLine.length > 0) {
                  lines.push(currentLine);
                }
              });
              
              // Debug: Log the processed lines
              console.log(`[PREVIEW TEXT] ${mediaItem.id}: Original text: "${displayText}"`);
              console.log(`[PREVIEW TEXT] ${mediaItem.id}: Processed into ${lines.length} lines:`, lines);

              // Position text to fill the entire area
              let actualLineHeight;
              let startY;

              // Filter out empty lines for height calculation but keep them for spacing
              const nonEmptyLines = lines.filter(line => line.trim() !== '');
              
              if (lines.length === 1) {
                actualLineHeight = height;
                startY = height / 2;
              } else {
                const totalAvailableHeight = height;
                actualLineHeight = totalAvailableHeight / lines.length;
                const topMargin = actualLineHeight / 2;
                startY = topMargin;
              }
              
              console.log(`[PREVIEW TEXT] ${mediaItem.id}: Line positioning - total lines: ${lines.length}, non-empty: ${nonEmptyLines.length}, line height: ${actualLineHeight}px, start Y: ${startY}px`);

              lines.forEach((line, index) => {
                const lineY = startY + index * actualLineHeight;

                // Skip rendering empty lines but still maintain spacing
                if (line.trim() === '') {
                  console.log(`[PREVIEW TEXT] ${mediaItem.id}: Skipping empty line at index ${index}`);
                  return;
                }

                // Calculate optimal font size to fit within bounds
                let optimalFontSize = fontSize;

                if (lines.length === 1) {
                  const lineMetrics = ctx.measureText(line);
                  const maxWidthFontSize = width * 0.9 * (fontSize / lineMetrics.width);
                  const maxHeightFontSize = height * 0.8;
                  optimalFontSize = Math.min(maxWidthFontSize, maxHeightFontSize, fontSize * 2);
                } else {
                  const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
                  const maxWidthFontSize = width * 0.9 * (fontSize / maxLineWidth);
                  const maxHeightFontSize = actualLineHeight * 0.7;
                  optimalFontSize = Math.min(maxWidthFontSize, maxHeightFontSize, fontSize * 1.5);
                }

                // Apply the calculated font size if different from original
                if (Math.abs(optimalFontSize - fontSize) > 1) {
                  let newFontString = `${fontStyle} ${fontWeight} ${optimalFontSize}px ${fontFamily}`;
                  ctx.font = newFontString;
                }

                console.log(`[PREVIEW TEXT] ${mediaItem.id}: Rendering line ${index}: "${line}" at Y=${lineY}px with font size=${optimalFontSize}px`);

                // Draw text with border and fill
                if (mediaItem.textBorderThickness && mediaItem.textBorderThickness > 0) {
                  ctx.strokeText(line, textX, lineY);
                }
                ctx.fillText(line, textX, lineY);

                // Draw underline if enabled
                if (mediaItem.fontUnderline) {
                  const lineMetrics = ctx.measureText(line);
                  const underlineY = lineY + (optimalFontSize || fontSize) * 0.1;
                  const underlineThickness = Math.max(1, (optimalFontSize || fontSize) * 0.05);
                  
                  ctx.save();
                  ctx.strokeStyle = ctx.fillStyle; // Use same color as text
                  ctx.lineWidth = underlineThickness;
                  ctx.beginPath();
                  
                  let underlineStartX = textX;
                  let underlineWidth = lineMetrics.width;
                  
                  // Adjust start position based on text alignment
                  switch (mediaItem.textAlignment) {
                    case "left":
                      underlineStartX = textX;
                      break;
                    case "center":
                      underlineStartX = textX - lineMetrics.width / 2;
                      break;
                    case "right":
                      underlineStartX = textX - lineMetrics.width;
                      break;
                  }
                  
                  ctx.moveTo(underlineStartX, underlineY);
                  ctx.lineTo(underlineStartX + underlineWidth, underlineY);
                  ctx.stroke();
                  ctx.restore();
                }

                // Draw strikethrough if enabled
                if (mediaItem.fontStrikethrough) {
                  const lineMetrics = ctx.measureText(line);
                  const strikethroughY = lineY - (optimalFontSize || fontSize) * 0.2;
                  const strikethroughThickness = Math.max(1, (optimalFontSize || fontSize) * 0.05);
                  
                  ctx.save();
                  ctx.strokeStyle = ctx.fillStyle; // Use same color as text
                  ctx.lineWidth = strikethroughThickness;
                  ctx.beginPath();
                  
                  let strikethroughStartX = textX;
                  let strikethroughWidth = lineMetrics.width;
                  
                  // Adjust start position based on text alignment
                  switch (mediaItem.textAlignment) {
                    case "left":
                      strikethroughStartX = textX;
                      break;
                    case "center":
                      strikethroughStartX = textX - lineMetrics.width / 2;
                      break;
                    case "right":
                      strikethroughStartX = textX - lineMetrics.width;
                      break;
                  }
                  
                  ctx.moveTo(strikethroughStartX, strikethroughY);
                  ctx.lineTo(strikethroughStartX + strikethroughWidth, strikethroughY);
                  ctx.stroke();
                  ctx.restore();
                }

                // Restore original font
                ctx.font = fontString;
              });

              // Reset shadow
              ctx.shadowColor = "transparent";
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
              
              console.log(`✅ Successfully rendered text ${mediaItem.id}`);
              renderedItemsCount++;
            }
          }

          ctx.restore();

          // Draw selection indicators if this item is selected and it's a visual media item
          if (
            selectedTimelineItem &&
            selectedTimelineItem.id === item.id &&
            (mediaItem.type === "image" ||
              mediaItem.type === "video" ||
              mediaItem.type === "text")
          ) {
            drawSelectionIndicators(ctx, x, y, width, height);

            // Debug: Show tight text boundaries for text items
            if (mediaItem.type === "text") {
              ctx.save();
              ctx.strokeStyle = "#00ff00"; // Green color for text bounds
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 2]); // Dashed line
              ctx.strokeRect(x, y, width, height);
              ctx.restore();
            }
          }
          
          ctx.restore();
        } else {
          console.log(`⚠️ SKIP: Item ${item.id} not in time range (current: ${time})`);
        }
      });
    });
    
    // Summary logging
    console.log(`📊 RENDER SUMMARY: ${renderedItemsCount} items rendered, ${skippedItemsCount} items skipped`);
    
    if (skippedItemsCount > 0 && renderedItemsCount === 0) {
      console.warn(`🚨 NO ITEMS RENDERED! All ${skippedItemsCount} items were skipped. Check the warnings above.`);
    } else if (renderedItemsCount > 0) {
      console.log(`✅ RENDER SUCCESS: ${renderedItemsCount} items displayed on canvas`);
    }
  };

  // Helper function to draw selection indicators and resize handles
  const drawSelectionIndicators = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    // Selection border
    ctx.strokeStyle = "#00aaff";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);

    // Resize handles
    const handleSize = 8;
    const handles = [
      { name: "tl", x: x - handleSize / 2, y: y - handleSize / 2 },
      { name: "tr", x: x + width - handleSize / 2, y: y - handleSize / 2 },
      { name: "bl", x: x - handleSize / 2, y: y + height - handleSize / 2 },
      {
        name: "br",
        x: x + width - handleSize / 2,
        y: y + height - handleSize / 2,
      },
      { name: "t", x: x + width / 2 - handleSize / 2, y: y - handleSize / 2 },
      {
        name: "b",
        x: x + width / 2 - handleSize / 2,
        y: y + height - handleSize / 2,
      },
      { name: "l", x: x - handleSize / 2, y: y + height / 2 - handleSize / 2 },
      {
        name: "r",
        x: x + width - handleSize / 2,
        y: y + height / 2 - handleSize / 2,
      },
    ];

    // Draw handles
    ctx.fillStyle = "#00aaff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;

    handles.forEach((handle) => {
      ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
      ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
    });
  };
  // Keep ref in sync with state to avoid stale closures
  useEffect(() => {
    currentlyPlayingAudiosRef.current = currentlyPlayingAudios;
  }, [currentlyPlayingAudios]);

  useEffect(() => {
    currentlyPlayingVideosRef.current = currentlyPlayingVideos;
  }, [currentlyPlayingVideos]);

  // Preload audio chunks when layers change for better performance
  useEffect(() => {
    if (layers.length > 0 && mediaItems.length > 0) {
      // Preload audio chunks in the background
      preloadAudioChunks().catch(error => {
        console.warn("⚠️ Failed to preload audio chunks:", error);
      });
    }
  }, [layers, mediaItems]);





  // Update seekToTime to handle media seeking
  // Temporarily commented out - not currently in use
  /* const seekToTime = async (newTime: number) => {
    const wasPlaying = isPlaying;
    
    if (isPlaying) {
      pauseTimeline();
    }

    if (timeRulerRef.current) {
      const rulerWidth = timeRulerRef.current.clientWidth;
      const newPosition = (newTime / totalDuration) * rulerWidth;
      setIndicatorPosition(newPosition);
    }

    // Simple audio cleanup and restart
    if (wasPlaying) {
      // Stop all current audio
      currentlyPlayingAudios.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      setCurrentlyPlayingAudios([]);
      
      // Audio will be restarted by manageContinuousAudio in the next update
    } else {
      // Clean up audio elements when not playing
      currentlyPlayingAudios.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      setCurrentlyPlayingAudios([]);
    }

    currentlyPlayingVideosRef.current.forEach((video) => {
      video.pause();
    });
    setCurrentlyPlayingVideos([]);

    // Create an array of promises for all media seeking operations
    const seekPromises: Promise<void>[] = [];

    // Handle video and audio seeking
    for (const layer of layers) {
      if (!layer.visible) continue;

      for (const item of layer.items) {
        if (
          newTime >= item.startTime &&
          newTime < item.startTime + item.duration
        ) {
          const mediaItem = mediaItems.find((m) => m.id === item.mediaId);
          if (!mediaItem) continue;

          if (mediaItem.type === "video") {
            const seekPromise = new Promise<void>(async (resolve) => {
              const video = (await loadMediaElement(
                mediaItem
              )) as HTMLVideoElement;
              if (video) {
                const targetTime = Math.max(0, newTime - item.startTime);
                video.currentTime = targetTime;

                // Wait for video to be seeked
                const handleSeeked = () => {
                  video.removeEventListener("seeked", handleSeeked);
                  resolve();
                };
                video.addEventListener("seeked", handleSeeked);

                // Timeout in case seeking takes too long
                setTimeout(() => {
                  video.removeEventListener("seeked", handleSeeked);
                  resolve();
                }, 500);
              } else {
                resolve();
              }
            });
            seekPromises.push(seekPromise);
          }
        }
      }
    }

    // Handle audio elements - check all layers, not just track 1
    const allTimelineItems = layers.flatMap((layer) =>
      layer.visible ? layer.items : []
    );
    const relevantItems = allTimelineItems.filter(
      (item) =>
        newTime >= item.startTime && newTime < item.startTime + item.duration
    );

    for (const item of relevantItems) {
      const audioPromise = new Promise<void>(async (resolve) => {
        try {
          const mediaItem = mediaItems.find((m) => m.id === item.mediaId);

          if (
            mediaItem &&
            (mediaItem.type === "voiceover" || mediaItem.type === "audio")
          ) {
            const audio = await loadAudioForPlayback(item.mediaId);
            if (audio) {
              const offsetTime = newTime - item.startTime;
              audio.currentTime = offsetTime;

              if (wasPlaying) {
                await audio.play();
                setCurrentlyPlayingAudios((prev) => [...prev, audio]);
              }
            } else {
            }
          }
        } catch (error) {
          setError(`Failed to seek audio ${item.mediaId}: ${error}`);
        }
        resolve();
      });
      seekPromises.push(audioPromise);
    }

    // Wait for all seek operations to complete
    await Promise.all(seekPromises);
    setCurrentTime(newTime);

    renderPreviewFrame(newTime);

    if (wasPlaying) {
      playTimeline();
    }
  }; */




  // Update updateTimeDisplay to include frame rendering and audio management
  const updateTimeDisplay = async (isPlaying: boolean) => {
    if (!isPlaying || totalDuration === 0) return;

    const now = performance.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    const newTime = pausedTimeRef.current + elapsed;
    
    // If we've reached the end of the timeline, stop (do not loop)
    if (newTime >= totalDuration) {
      pauseTimeline();
      setCurrentTime(totalDuration);
      pausedTimeRef.current = totalDuration;
      if (timeRulerRef.current && totalDuration > 0) {
        const rulerWidth = timeRulerRef.current.clientWidth;
        const newPosition = (totalDuration / totalDuration) * rulerWidth;
        setIndicatorPosition(newPosition);
      }
      return;
    }

    const clampedTime = Math.min(newTime, totalDuration);
    setCurrentTime(clampedTime);
    renderPreviewFrame(clampedTime);



    // Auto-scroll timeline to keep time indicator visible
    autoScrollTimeline();

    if (isPlaying && newTime < totalDuration) {
      timeUpdateLoopRef.current = requestAnimationFrame(() =>
        updateTimeDisplay(isPlaying)
      );
    }
  };

  // Find the next audio item after the current one
  const findNextAudioItem = (timelineItem: TimelineItem): TimelineItem | null => {
    const allTimelineItems = layers.flatMap((layer) =>
      layer.visible ? layer.items : []
    );
    
    // Sort by start time to find the next one
    const sortedItems = allTimelineItems.sort((a, b) => a.startTime - b.startTime);
    
    // Find the next audio item after the current one
    return sortedItems.find(
      (item) => {
        const mediaItem = mediaItems.find((m) => m.id === item.mediaId);
        return mediaItem && 
               (mediaItem.type === "voiceover" || mediaItem.type === "audio") &&
               item.startTime > timelineItem.startTime;
      }
    ) || null;
  };

  // Start the next audio item
  const startNextAudioItem = async (timelineItem: TimelineItem) => {
    const mediaItem = mediaItems.find((m) => m.id === timelineItem.mediaId);
    if (!mediaItem || (mediaItem.type !== "voiceover" && mediaItem.type !== "audio")) {
      return;
    }

    try {
      const audio = await loadAudioForPlayback(timelineItem.mediaId);
      if (audio && !audio.ended && audio.paused) {
        // Start from the beginning
        audio.currentTime = 0;
        
        // Apply volume settings
        const individualVolume = mediaItem.volume || 100;
        let globalVolume = 100;
        if (mediaItem.type === "voiceover") {
          globalVolume = voiceoverVolume;
        } else if (mediaItem.type === "audio") {
          globalVolume = soundtrackVolume;
        }
        audio.volume = mediaItem.muted
          ? 0
          : (individualVolume * globalVolume) / 10000;

        // Start playing
        await audio.play();
        console.log(`🎵 Started next audio chunk: ${mediaItem.name}`);
        
        // Add to currently playing audios
        setCurrentlyPlayingAudios((prev) => {
          if (!prev.includes(audio)) {
            return [...prev, audio];
          }
          return prev;
        });

        // Set up advancement for this chunk too
        audio.onended = () => {
          console.log(`🎵 Audio chunk ended: ${mediaItem.name}`);
          const nextItem = findNextAudioItem(timelineItem);
          if (nextItem) {
            startNextAudioItem(nextItem);
          }
        };
      }
    } catch (error) {
      console.error(`❌ Failed to start next audio chunk ${mediaItem.name}:`, error);
    }
  };



  // Preload audio chunks for better performance
  const preloadAudioChunks = async () => {
    const allTimelineItems = layers.flatMap((layer) =>
      layer.visible ? layer.items : []
    );
    
    const audioItems = allTimelineItems.filter((item) => {
      const mediaItem = mediaItems.find((m) => m.id === item.mediaId);
      return mediaItem && (mediaItem.type === "voiceover" || mediaItem.type === "audio");
    });

    // Preload audio chunks in parallel (limit to 5 at a time to avoid overwhelming the system)
    const batchSize = 5;
    for (let i = 0; i < audioItems.length; i += batchSize) {
      const batch = audioItems.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (item) => {
          try {
            await loadAudioForPlayback(item.mediaId);
          } catch (error) {
            console.warn(`⚠️ Failed to preload audio chunk: ${error}`);
          }
        })
      );
    }
  };

  // Clean up audio elements and ensure smooth transitions
  // Temporarily commented out - not currently in use
  /* const cleanupAudioElements = () => {
    // Stop all currently playing audio elements
    currentlyPlayingAudios.forEach((audio) => {
      if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
    
    // Clear the currently playing audios array
    setCurrentlyPlayingAudios([]);
    
    // Reset all audio elements to beginning
    audioElementsRef.current.forEach((audio) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }; */



  // Canvas interaction handlers
  const getCanvasCoordinates = (
    event: React.MouseEvent<HTMLCanvasElement> | MouseEvent
  ): { x: number; y: number } => {
    if (!previewCanvasRef.current) return { x: 0, y: 0 };

    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  // Get selectable item at position (any visible item, regardless of time)
  const getSelectableItemAtPosition = (
    x: number,
    y: number
  ): TimelineItem | null => {
    if (!previewCanvasRef.current) return null;

    const canvas = previewCanvasRef.current;

    // Check items from top to bottom (layers in normal order)
    for (const layer of layers) {
      if (!layer.visible) {
        continue;
      }

      for (const item of layer.items) {
        const mediaItem = mediaItems.find((m) => m.id === item.mediaId);
        if (
          !mediaItem ||
          (mediaItem.type !== "image" &&
            mediaItem.type !== "video" &&
            mediaItem.type !== "text")
        ) {
          continue;
        }

        // **CRITICAL**: Only consider items that are currently visible at the current time
        const isCurrentlyVisible =
          currentTime >= item.startTime &&
          currentTime < item.startTime + item.duration;
        if (!isCurrentlyVisible) {
          continue;
        }

        const geometry = item.geometry || { x: 0, y: 0, width: 1, height: 1 };
        const itemX = geometry.x * canvas.width;
        const itemY = geometry.y * canvas.height;
        const itemWidth = geometry.width * canvas.width;
        const itemHeight = geometry.height * canvas.height;

        if (
          x >= itemX &&
          x <= itemX + itemWidth &&
          y >= itemY &&
          y <= itemY + itemHeight
        ) {
          return item;
        }
      }
    }

    return null;
  };

  const getResizeHandle = (
    x: number,
    y: number,
    item: TimelineItem
  ): string | null => {
    if (!previewCanvasRef.current) return null;

    const canvas = previewCanvasRef.current;
    const geometry = item.geometry || { x: 0, y: 0, width: 1, height: 1 };

    const itemX = geometry.x * canvas.width;
    const itemY = geometry.y * canvas.height;
    const itemWidth = geometry.width * canvas.width;
    const itemHeight = geometry.height * canvas.height;

    const tolerance = 15; // Increased tolerance for easier grabbing

    const handles = [
      { name: "tl", x: itemX, y: itemY },
      { name: "tr", x: itemX + itemWidth, y: itemY },
      { name: "bl", x: itemX, y: itemY + itemHeight },
      { name: "br", x: itemX + itemWidth, y: itemY + itemHeight },
      { name: "t", x: itemX + itemWidth / 2, y: itemY },
      { name: "b", x: itemX + itemWidth / 2, y: itemY + itemHeight },
      { name: "l", x: itemX, y: itemY + itemHeight / 2 },
      { name: "r", x: itemX + itemWidth, y: itemY + itemHeight / 2 },
    ];

    for (const handle of handles) {
      if (
        Math.abs(x - handle.x) <= tolerance &&
        Math.abs(y - handle.y) <= tolerance
      ) {
        return handle.name;
      }
    }

    return null;
  };

  // Get the appropriate cursor style based on what's under the mouse
  const getCursorForPosition = (x: number, y: number): string => {
    // During interaction, keep current cursor
    if (canvasInteractionMode === "move") return "move";
    if (canvasInteractionMode === "resize") {
      // Return directional cursor based on resize handle
      switch (resizeHandle) {
        case "tl":
        case "br":
          return "nw-resize";
        case "tr":
        case "bl":
          return "ne-resize";
        case "t":
        case "b":
          return "n-resize";
        case "l":
        case "r":
          return "e-resize";
        default:
          return "nwse-resize";
      }
    }

    // Use selectable item position (ignore time constraint for selection)
    const clickedItem = getSelectableItemAtPosition(x, y);

    if (clickedItem) {
      // Check if hovering over a resize handle (only for selected item)
      if (selectedTimelineItem && clickedItem.id === selectedTimelineItem.id) {
        const handle = getResizeHandle(x, y, clickedItem);
        if (handle) {
          // Return directional cursor for resize handle
          switch (handle) {
            case "tl":
            case "br":
              return "nw-resize";
            case "tr":
            case "bl":
              return "ne-resize";
            case "t":
            case "b":
              return "n-resize";
            case "l":
            case "r":
              return "e-resize";
            default:
              return "nwse-resize";
          }
        }
      }

      // Only show move cursor if this item is currently selected
      if (selectedTimelineItem && clickedItem.id === selectedTimelineItem.id) {
        const mediaItem = mediaItems.find((m) => m.id === clickedItem.mediaId);
        if (
          mediaItem &&
          (mediaItem.type === "image" || mediaItem.type === "video")
        ) {
          return "move";
        }
      } else {
        // For unselected items, show pointer to indicate they're clickable
        const mediaItem = mediaItems.find((m) => m.id === clickedItem.mediaId);
        if (
          mediaItem &&
          (mediaItem.type === "image" || mediaItem.type === "video")
        ) {
          return "pointer";
        }
      }
    }

    return "default";
  };

  const handleCanvasMouseDown = (
    event: React.MouseEvent<HTMLCanvasElement>
  ) => {
    const coords = getCanvasCoordinates(event);
    // Use selectable item position (allow selecting any item regardless of time)
    const clickedItem = getSelectableItemAtPosition(coords.x, coords.y);

    if (clickedItem) {
      // Select the item (works regardless of time position)
      

      setSelectedTimelineItem(clickedItem);

      // Check if clicking on a resize handle
      const handle = getResizeHandle(coords.x, coords.y, clickedItem);

      if (handle) {
        // Start resizing
        setCanvasInteractionMode("resize");
        setResizeHandle(handle as any);
        setOriginalGeometry(
          clickedItem.geometry || { x: 0, y: 0, width: 1, height: 1 }
        );
      } else {
        // Start moving
        setCanvasInteractionMode("move");
        setOriginalGeometry(
          clickedItem.geometry || { x: 0, y: 0, width: 1, height: 1 }
        );
      }

      setCanvasDragStart(coords);
    } else {
      // Clicked on empty area, deselect
      setSelectedTimelineItem(null);
      setCanvasInteractionMode("none");
    }
  };
  const handleCanvasMouseMove = (
    event: React.MouseEvent<HTMLCanvasElement>,
    canvasInteractionMode: string
  ) => {
    
    const coords = getCanvasCoordinates(event);

    // Update cursor based on what's under the mouse (even when not dragging)
    const newCursor = getCursorForPosition(coords.x, coords.y);
    if (newCursor !== canvasCursor) {
      setCanvasCursor(newCursor);
    }

    // Handle dragging operations
    if (
      !selectedTimelineItem ||
      !canvasDragStart ||
      !originalGeometry ||
      !previewCanvasRef.current
    ) {
      return;
    }

    const canvas = previewCanvasRef.current;

    const deltaX = (coords.x - canvasDragStart.x) / canvas.width;
    const deltaY = (coords.y - canvasDragStart.y) / canvas.height;

    let newGeometry = { ...originalGeometry };

    if (canvasInteractionMode === "move") {
      // Move the item
      newGeometry.x = Math.max(
        0,
        Math.min(1 - newGeometry.width, originalGeometry.x + deltaX)
      );
      newGeometry.y = Math.max(
        0,
        Math.min(1 - newGeometry.height, originalGeometry.y + deltaY)
      );
    } else if (canvasInteractionMode === "resize" && resizeHandle) {
      // Resize the item
      const minSize = 0.05; // Minimum 5% of canvas size

      switch (resizeHandle) {
        case "tl":
          newGeometry.width = Math.max(
            minSize,
            originalGeometry.width - deltaX
          );
          newGeometry.height = Math.max(
            minSize,
            originalGeometry.height - deltaY
          );
          newGeometry.x =
            originalGeometry.x + originalGeometry.width - newGeometry.width;
          newGeometry.y =
            originalGeometry.y + originalGeometry.height - newGeometry.height;
          break;
        case "tr":
          newGeometry.width = Math.max(
            minSize,
            originalGeometry.width + deltaX
          );
          newGeometry.height = Math.max(
            minSize,
            originalGeometry.height - deltaY
          );
          newGeometry.y =
            originalGeometry.y + originalGeometry.height - newGeometry.height;
          break;
        case "bl":
          newGeometry.width = Math.max(
            minSize,
            originalGeometry.width - deltaX
          );
          newGeometry.height = Math.max(
            minSize,
            originalGeometry.height + deltaY
          );
          newGeometry.x =
            originalGeometry.x + originalGeometry.width - newGeometry.width;
          break;
        case "br":
          newGeometry.width = Math.max(
            minSize,
            originalGeometry.width + deltaX
          );
          newGeometry.height = Math.max(
            minSize,
            originalGeometry.height + deltaY
          );
          break;
        case "t":
          newGeometry.height = Math.max(
            minSize,
            originalGeometry.height - deltaY
          );
          newGeometry.y =
            originalGeometry.y + originalGeometry.height - newGeometry.height;
          break;
        case "b":
          newGeometry.height = Math.max(
            minSize,
            originalGeometry.height + deltaY
          );
          break;
        case "l":
          newGeometry.width = Math.max(
            minSize,
            originalGeometry.width - deltaX
          );
          newGeometry.x =
            originalGeometry.x + originalGeometry.width - newGeometry.width;
          break;
        case "r":
          newGeometry.width = Math.max(
            minSize,
            originalGeometry.width + deltaX
          );
          break;
      }

      // Ensure the item stays within bounds
      newGeometry.x = Math.max(
        0,
        Math.min(1 - newGeometry.width, newGeometry.x)
      );
      newGeometry.y = Math.max(
        0,
        Math.min(1 - newGeometry.height, newGeometry.y)
      );
      newGeometry.width = Math.min(1 - newGeometry.x, newGeometry.width);
      newGeometry.height = Math.min(1 - newGeometry.y, newGeometry.height);
    }

    // Update the geometry in real-time
    updateTimelineItemGeometry(selectedTimelineItem.id, newGeometry);
  };

  const handleCanvasMouseUp = () => {
    // Ensure properties panel is synced when canvas interaction ends
    if (selectedTimelineItem) {
      syncMediaItemFromGeometry(selectedTimelineItem.id);
    }

    setCanvasInteractionMode("none");
    setResizeHandle(null);
    setCanvasDragStart(null);
    setOriginalGeometry(null);
  };

  const handleCanvasMouseLeave = () => {
    // Reset cursor when mouse leaves canvas
    setCanvasCursor("default");
    // Also handle mouse up in case user drags outside
    handleCanvasMouseUp();
  };

  const updateTimelineItemGeometry = (
    itemId: string,
    geometry: GeometricInfo
  ) => {
    // Find the timeline item to get the media ID for syncing
    const timelineItem = timelineItems.find((item) => item.id === itemId);
    if (timelineItem) {
      // Check if this is a text item that needs bounds adjustment
      const mediaItem = mediaItems.find(
        (item) => item.id === timelineItem.mediaId
      );
      if (mediaItem && mediaItem.type === "text") {
        // Ensure text fits within the new geometry bounds
        ensureTextFitsInArea(itemId, geometry);
      }

      // Sync geometry changes back to media item properties for properties panel
      setMediaItems((prevItems) =>
        prevItems.map((item) =>
          item.id === timelineItem.mediaId
            ? {
                ...item,
                x: geometry.x,
                y: geometry.y,
                width: geometry.width,
                height: geometry.height,
              }
            : item
        )
      );
    }

    setLayers((prevLayers) =>
      prevLayers.map((layer) => ({
        ...layer,
        items: layer.items.map((item) =>
          item.id === itemId ? { ...item, geometry } : item
        ),
      }))
    );

    // Update the selected item reference
    setSelectedTimelineItem((prev) =>
      prev && prev.id === itemId ? { ...prev, geometry } : prev
    );

    // Re-render the preview
    if (canvasInitializedRef.current) {
      renderPreviewFrame(currentTime);
    }
    
    // Save video assets to ensure geometry changes are persisted
    saveVideoAssets();
  };

  // Initialize preview on mount and load system fonts
  useEffect(() => {
    // Load available system fonts
    detectSystemFonts()
      .then((fonts) => {
        setSystemFonts(fonts);
      })

    // Delay initialization slightly to ensure DOM is ready
    setTimeout(() => {
      initializePreview();
      window.addEventListener("resize", updateCanvasSize);
    }, 100);

    // Load any unloaded media items with priority on videos - OPTIMIZED: removed renderPreviewFrame call
    mediaItems.forEach((item) => {
      if (
        !videoElementsRef.current.has(item.id) &&
        !imageElementsRef.current.has(item.id)
      ) {
        loadMediaElement(item)
          .then(() => {
            // Media loaded successfully - no need to trigger re-render here
            // The existing useEffect hooks will handle re-rendering when needed
          })
          .catch((error) => {
            console.error(`❌ Failed to load media element ${item.id}:`, error);
          });
      }
    });

    return () => {
      window.removeEventListener("resize", updateCanvasSize);

      // Cleanup media elements
      videoElementsRef.current.forEach((video) => {
        video.pause();
        video.src = "";
        video.load();
      });
      videoElementsRef.current.clear();
      imageElementsRef.current.clear();
      // Don't immediately set canvas as uninitialized - let the re-initialization handle it
      // canvasInitializedRef.current = false; // REMOVED: Too aggressive cleanup
    };
  }, []);

  // Re-render canvas immediately when font properties change - OPTIMIZED: simplified dependencies
  useEffect(() => {
    if (selectedTimelineItem) {
      const mediaItem = mediaItems.find(
        (item) =>
          item.id === selectedTimelineItem.mediaId && item.type === "text"
      );

      if (mediaItem) {
        // Small delay to ensure state updates are processed
        setTimeout(() => {
          if (canvasInitializedRef.current) {
            renderPreviewFrame(currentTime);
          }
        }, 50);
      }
    }
  }, [
    // Simplified: only watch selectedTimelineItem and currentTime
    selectedTimelineItem?.id,
    currentTime,
  ]);

  // Re-render canvas when any text media item properties change
  useEffect(() => {
    const textItems = mediaItems.filter((item) => item.type === "text");
    if (textItems.length > 0 && canvasInitializedRef.current) {
      renderPreviewFrame(currentTime);
    }
  }, [
    // Watch for changes in any text media items
    JSON.stringify(
      mediaItems
        .filter((item) => item.type === "text")
        .map((item) => ({
          id: item.id,
          fontFamily: item.fontFamily,
          fontSize: item.fontSize,
          fontColor: item.fontColor,
          backgroundColor: item.backgroundColor,
          backgroundTransparent: item.backgroundTransparent,
          fontBold: item.fontBold,
          fontItalic: item.fontItalic,
          fontUnderline: item.fontUnderline,
          fontStrikethrough: item.fontStrikethrough,
          textOpacity: item.textOpacity,
          backgroundOpacity: item.backgroundOpacity,
          textBorderColor: item.textBorderColor,
          textBorderThickness: item.textBorderThickness,
          textAlignment: item.textAlignment,
          textCapitalization: item.textCapitalization,
          text: item.text,
        }))
    ),
  ]);

  // Handle video style changes
  useEffect(() => {
    updateCanvasSize();
    if (canvasInitializedRef.current) {
      renderPreviewFrame(0);
    }
  }, [videoStyle]);

  // Handle media items changes
  useEffect(() => {
    // Check for split audio items that need audio elements
    const splitAudioItems = mediaItems.filter(
      (item) =>
        (item.type === "voiceover" || item.type === "audio") &&
        item.name.includes("(Part") &&
        !audioElementsRef.current.has(item.id)
    );

    if (splitAudioItems.length > 0) {
      preloadSplitAudioElements(splitAudioItems).catch((error) => {
        console.error("Failed to preload split audio elements:", error);
      });
    }

    // Load thumbnails for images that don't have them yet
    const imagesWithoutThumbnails = mediaItems.filter(
      (item) =>
        item.type === "image" && !item.thumbnailUrl && item.filePath
    );

    if (imagesWithoutThumbnails.length > 0) {
      console.log(`🖼️ Loading thumbnails for ${imagesWithoutThumbnails.length} images...`);
      imagesWithoutThumbnails.forEach(item => {
        loadImageAsBase64(item.filePath).then(base64Url => {
          setMediaItems(prev => prev.map(mediaItem => 
            mediaItem.id === item.id 
              ? { ...mediaItem, thumbnailUrl: base64Url }
              : mediaItem
          ));
        }).catch(error => {
          console.error(`❌ Failed to load thumbnail for ${item.name}:`, error);
        });
      });
    }

    console.log(`🔍 MEDIA LOADING: Processing ${mediaItems.length} media items for element loading`);
    
    // Load all media elements in parallel for better performance
    const loadPromises = mediaItems.map(async (item, index) => {
      const hasVideoRef = videoElementsRef.current.has(item.id);
      const hasImageRef = imageElementsRef.current.has(item.id);
      
      console.log(`📋 Item ${index}: ${item.id} (${item.type}) - videoRef: ${hasVideoRef}, imageRef: ${hasImageRef}`);
      
      if (!hasVideoRef && !hasImageRef) {
        console.log(`⚡ Loading element for ${item.id}...`);
        try {
          await loadMediaElement(item);
          console.log(`✅ Successfully loaded element for ${item.id}`);
        } catch (error) {
          console.error(`❌ Failed to load element for ${item.id}:`, error);
        }
      } else {
        console.log(`✅ Element already loaded for ${item.id}`);
      }
    });
    
    // Wait for all media elements to load
    Promise.all(loadPromises).then(() => {
      console.log(`📊 REFS STATUS: ${videoElementsRef.current.size} video refs, ${imageElementsRef.current.size} image refs`);
      
      // Trigger a re-render after all media is loaded
      if (canvasInitializedRef.current) {
        renderPreviewFrame(currentTime, 0);
      }
    });
  }, [mediaItems]);


  
  // Cleanup orphaned timeline items that reference non-existent media items
  useEffect(() => {
    if (mediaItems.length > 0 && timelineItems.length > 0) {
      const mediaItemIds = new Set(mediaItems.map(item => item.id));
      const orphanedTimelineItems = timelineItems.filter(item => !mediaItemIds.has(item.mediaId));
      
      if (orphanedTimelineItems.length > 0) {
        console.warn(`🧹 Found ${orphanedTimelineItems.length} orphaned timeline items, cleaning up...`);
        orphanedTimelineItems.forEach(item => {
          console.warn(`🗑️ Removing orphaned timeline item: ${item.id} (references non-existent media: ${item.mediaId})`);
        });
        
        // Remove orphaned timeline items
        setTimelineItems(prev => prev.filter(item => mediaItemIds.has(item.mediaId)));
        
        // Also clean up layers
        setLayers(prev => prev.map(layer => ({
          ...layer,
          items: layer.items.filter(item => mediaItemIds.has(item.mediaId))
        })));
      }
    }
  }, [mediaItems, timelineItems]);

  // Cleanup retry timer and loading attempts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (retryRenderRef.current) {
        clearTimeout(retryRenderRef.current);
        retryRenderRef.current = null;
      }

    };
  }, []);

  const pauseTimeline = () => {
    if (timeRulerRef.current) {
      const rulerWidth = timeRulerRef.current.clientWidth;
      const exactTime = (indicatorPosition / rulerWidth) * totalDuration;
      setCurrentTime(exactTime);
      pausedTimeRef.current = exactTime;
    }

    setIsPlaying(false);

    // Pause all media
    currentlyPlayingAudiosRef.current.forEach((audio) => audio.pause());
    currentlyPlayingVideosRef.current.forEach((video) => video.pause());

    if (timeUpdateLoopRef.current) {
      cancelAnimationFrame(timeUpdateLoopRef.current);
      timeUpdateLoopRef.current = null;
    }

    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
  };

  const handleAddMediaClick = () => fileInputRef.current?.click();

  const [showTranscriptSelector, setShowTranscriptSelector] = useState(false);

  const [showStockMediaConfirmation, setShowStockMediaConfirmation] = useState(false);
  const [pendingStockMediaRequest, setPendingStockMediaRequest] = useState<Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    paragraphNumber?: number;
    isStoryBased?: boolean;
    totalImages?: number;
    videoDuration?: number;
  }> | null>(null);

  const handleAddTranscriptClick = () => setShowTranscriptSelector(true);

  // Function to sync media item properties from timeline item geometry (for canvas interactions)
  const syncMediaItemFromGeometry = (timelineItemId: string) => {
    const timelineItem = timelineItems.find(
      (item) => item.id === timelineItemId
    );
    if (timelineItem && timelineItem.geometry) {
      const geometry = timelineItem.geometry;
      setMediaItems((prev) =>
        prev.map((item) =>
          item.id === timelineItem.mediaId
            ? {
                ...item,
                x: geometry.x,
                y: geometry.y,
                width: geometry.width,
                height: geometry.height,
              }
            : item
        )
      );
    }
  };

  // Function to restore text properties to default values
  const restoreTextDefaults = (mediaId: string) => {
    const defaultTextProperties = {
      fontFamily: "Arial",
      fontSize: 24,
      fontBold: false,
      fontItalic: false,
      fontUnderline: false,
      fontStrikethrough: false,
      fontColor: "#ffffff",
      backgroundColor: "#000000",
      backgroundTransparent: false,
      textOpacity: 100,
      backgroundOpacity: 70,
      textBorderColor: "#000000",
      textBorderThickness: 2,
      textAlignment: "center" as const,
      textCapitalization: "--" as const,
    };

    updateMediaItemProperties(mediaId, defaultTextProperties);
  };

  // Function to update media item properties
  const updateMediaItemProperties = (
    mediaId: string,
    updates: Partial<MediaItem>
  ) => {
    // Log background transparency changes

    setMediaItems((prev) =>
      prev.map((item) => (item.id === mediaId ? { ...item, ...updates } : item))
    );

    // Also update geometry in timeline items if position/size changed
    if (
      updates.x !== undefined ||
      updates.y !== undefined ||
      updates.width !== undefined ||
      updates.height !== undefined
    ) {
      setTimelineItems((prev) =>
        prev.map((item) => {
          if (item.mediaId === mediaId) {
            return {
              ...item,
              geometry: {
                ...item.geometry,
                x: updates.x ?? item.geometry?.x ?? 0,
                y: updates.y ?? item.geometry?.y ?? 0,
                width: updates.width ?? item.geometry?.width ?? 1,
                height: updates.height ?? item.geometry?.height ?? 1,
                rotation: item.geometry?.rotation ?? 0,
              },
            };
          }
          return item;
        })
      );

      // Update layers as well
      setLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          items: layer.items.map((item) => {
            if (item.mediaId === mediaId) {
              return {
                ...item,
                geometry: {
                  ...item.geometry,
                  x: updates.x ?? item.geometry?.x ?? 0,
                  y: updates.y ?? item.geometry?.y ?? 0,
                  width: updates.width ?? item.geometry?.width ?? 1,
                  height: updates.height ?? item.geometry?.height ?? 1,
                  rotation: item.geometry?.rotation ?? 0,
                },
              };
            }
            return item;
          }),
        }))
      );
    }

    // Re-render canvas to show changes
    if (canvasInitializedRef.current) {
      renderPreviewFrame(currentTime);
    }
    
    // Save video assets to ensure property changes are persisted
    // But don't trigger transcript generation for text property updates
    saveVideoAssets();
  };

  // Sync properties panel when selected item changes
  useEffect(() => {
    if (selectedTimelineItem) {
      syncMediaItemFromGeometry(selectedTimelineItem.id);
    }
  }, [selectedTimelineItem?.id, selectedTimelineItem?.geometry]);

  // Function to calculate optimal text geometry based on actual text dimensions
  const calculateOptimalTextGeometry = (
    text: string,
    canvasWidth: number = 1920,
    canvasHeight: number = 1080,
    options: {
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string;
      fontStyle?: string;
      maxWidthRatio?: number;
      position?: "top" | "center" | "bottom";
      padding?: number;
      forceFullWidth?: boolean;
      minHeight?: number;
    } = {}
  ): GeometricInfo => {
    // Create temporary canvas for text measurement
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) {
      // Fallback to default geometry if canvas not available
      return { x: 0.1, y: 0.8, width: 0.8, height: 0.15 };
    }

    // Set default options
    const {
      fontFamily = "Arial",
      fontSize = Math.min(canvasWidth, canvasHeight) * 0.04, // 4% of canvas size
      fontWeight = "normal",
      fontStyle = "normal",
      maxWidthRatio = 0.8, // 80% of canvas width
      position = "bottom",
      forceFullWidth = false, // For transcript text, use full width
      minHeight = 0.12, // Minimum height ratio
    } = options;

    // Set font for measurement
    tempCtx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    // Calculate word wrapping based on width settings
    const effectiveWidthRatio = forceFullWidth ? 0.95 : maxWidthRatio; // Use 95% of full width for transcript
    const words = text.split(" ");
    const maxWidth = canvasWidth * effectiveWidthRatio;
    const lines: string[] = [];
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      const metrics = tempCtx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    // Calculate text dimensions with pixel-perfect precision
    let maxLineWidth = 0;
    let maxAscent = 0;
    let maxDescent = 0;

    // Measure each line individually for exact dimensions
    lines.forEach((line) => {
      const metrics = tempCtx.measureText(line);

      // Get the most precise width measurement
      let lineWidth = 0;
      if (
        metrics.actualBoundingBoxLeft !== undefined &&
        metrics.actualBoundingBoxRight !== undefined
      ) {
        // Use actual bounding box for pixel-perfect width
        lineWidth =
          metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
      } else {
        // Fallback to standard width
        lineWidth = metrics.width;
      }

      if (lineWidth > maxLineWidth) {
        maxLineWidth = lineWidth;
      }

      // Get precise height measurements
      if (
        metrics.actualBoundingBoxAscent !== undefined &&
        metrics.actualBoundingBoxDescent !== undefined
      ) {
        // Track maximum ascent and descent across all lines
        if (metrics.actualBoundingBoxAscent > maxAscent) {
          maxAscent = metrics.actualBoundingBoxAscent;
        }
        if (metrics.actualBoundingBoxDescent > maxDescent) {
          maxDescent = metrics.actualBoundingBoxDescent;
        }
      }
    });

    // Calculate dimensions based on settings
    let textWidth = maxLineWidth;
    let textHeight;

    if (lines.length === 1) {
      // Single line - use exact character bounds
      textHeight = maxAscent + maxDescent || fontSize * 0.8; // Fallback to 80% of fontSize
    } else {
      // Multiple lines - use minimal line spacing
      const singleLineHeight = maxAscent + maxDescent || fontSize * 0.8;
      const lineGap = fontSize * 0.1; // Minimal 10% gap between lines
      textHeight =
        singleLineHeight + (lines.length - 1) * (singleLineHeight + lineGap);
    }

    // Apply width and height overrides for transcript text
    if (forceFullWidth) {
      textWidth = canvasWidth * effectiveWidthRatio; // Use full width
    }

    // Ensure minimum dimensions to prevent invisible text
    textWidth = Math.max(textWidth, fontSize * 0.5);
    textHeight = Math.max(textHeight, fontSize * 0.5);

    // Apply minimum height for better readability
    const minPixelHeight = canvasHeight * minHeight;
    textHeight = Math.max(textHeight, minPixelHeight);

    // Convert to relative coordinates (0-1)
    const relativeWidth = Math.min(
      textWidth / canvasWidth,
      effectiveWidthRatio
    );
    const relativeHeight = Math.min(textHeight / canvasHeight, 0.4); // Max 40% of canvas height for larger areas

    // Calculate position based on preference with minimal margins
    let relativeX = (1 - relativeWidth) / 2; // Center horizontally
    let relativeY: number;
    const minMargin = 0.005; // Tiny margin (0.5%) to prevent edge clipping

    switch (position) {
      case "top":
        relativeY = minMargin;
        break;
      case "center":
        relativeY = (1 - relativeHeight) / 2;
        break;
      case "bottom":
      default:
        relativeY = Math.max(1 - relativeHeight - minMargin, 0);
        break;
    }

    return {
      x: relativeX,
      y: relativeY,
      width: relativeWidth,
      height: relativeHeight,
      rotation: 0,
    };
  };

  // Function to ensure text fits within area bounds when resized
  const ensureTextFitsInArea = (
    timelineItemId: string,
    newGeometry: GeometricInfo
  ) => {
    const timelineItem = timelineItems.find(
      (item) => item.id === timelineItemId
    );
    if (!timelineItem) return;

    const mediaItem = mediaItems.find(
      (item) => item.id === timelineItem.mediaId
    );
    if (!mediaItem || mediaItem.type !== "text" || !mediaItem.text) return;

    const canvas = previewCanvasRef.current;
    const canvasWidth = canvas?.width || 1920;
    const canvasHeight = canvas?.height || 1080;

    // Calculate the actual pixel dimensions of the new area
    const actualWidth = newGeometry.width * canvasWidth;
    const actualHeight = newGeometry.height * canvasHeight;

    // Create temporary canvas to measure text with current font
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // Set current font properties
    const currentFontSize =
      mediaItem.fontSize || Math.min(canvasWidth, canvasHeight) * 0.04;
    tempCtx.font = `${mediaItem.fontItalic ? "italic" : "normal"} ${
      mediaItem.fontBold ? "bold" : "normal"
    } ${currentFontSize}px ${mediaItem.fontFamily || "Arial"}`;

    // Calculate if text would overflow the new area
    const words = mediaItem.text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      const metrics = tempCtx.measureText(testLine);

      if (metrics.width > actualWidth * 0.9 && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    // Calculate required adjustments
    const maxLineWidth = Math.max(
      ...lines.map((line) => tempCtx.measureText(line).width)
    );
    const textHeight = lines.length * currentFontSize * 1.1;

    // Check if adjustments are needed
    const widthOverflow = maxLineWidth > actualWidth * 0.9;
    const heightOverflow = textHeight > actualHeight * 0.8;

    if (widthOverflow || heightOverflow) {
      // Calculate optimal font size for the new area
      const widthScale = (actualWidth * 0.9) / maxLineWidth;
      const heightScale = (actualHeight * 0.8) / textHeight;
      const optimalScale = Math.min(widthScale, heightScale);

      const newFontSize = Math.max(currentFontSize * optimalScale, 8); // Minimum 8px font

      // Update the media item with new font size
      setMediaItems((prev) =>
        prev.map((item) =>
          item.id === mediaItem.id ? { ...item, fontSize: newFontSize } : item
        )
      );
    }
  };

  // Function to create text layer from transcript segments
  const createTextLayerFromTranscript = (transcript: {
    text: string;
    segments: Array<{
      id: number;
      start: number;
      end: number;
      text: string;
    }>;
  }, audioStartTime: number = 0, voiceoverItemId?: string) => {
    // Get current canvas dimensions for optimal text sizing
    const canvas = previewCanvasRef.current;
    const canvasWidth = canvas?.width || 1920;
    const canvasHeight = canvas?.height || 1080;

    // Find the audio timeline item to get its actual duration
    const audioTimelineItem = timelineItems.find(item => 
      item.startTime === audioStartTime && 
      (mediaItems.find(m => m.id === item.mediaId)?.type === "voiceover" || 
       mediaItems.find(m => m.id === item.mediaId)?.type === "audio")
    );
    
    const audioDuration = audioTimelineItem?.duration || 0;
    console.log(`🎙️ AUDIO DURATION: Audio timeline item duration: ${audioDuration}s, Audio start time: ${audioStartTime}s`);

    // Create MediaItems for each text segment with optimized styling
    const textMediaItems: MediaItem[] = transcript.segments.map((segment) => {
      // Calculate proportional duration based on audio chunk's actual duration
      const segmentRatio = (segment.end - segment.start) / Math.max(...transcript.segments.map(s => s.end));
      const proportionalDuration = audioDuration * segmentRatio;
      
      console.log(`📝 SEGMENT DURATION: "${segment.text.substring(0, 30)}..." - Original: ${segment.end - segment.start}s, Proportional: ${proportionalDuration.toFixed(2)}s`);
      
      return {
        id: `text_segment_${voiceoverItemId || 'unknown'}_${segment.id}`,
        name: `Text: ${segment.text.substring(0, 30)}${
          segment.text.length > 30 ? "..." : ""
        }`,
        type: "text",
        duration: proportionalDuration,
        filePath: "", // Text doesn't need a file path
        text: segment.text,
        // Set optimal styling for transcript text
        fontFamily: "Arial",
        fontSize: Math.min(canvasWidth, canvasHeight) * 0.04, // 4% of canvas size
        fontBold: false,
        fontItalic: false,
        fontUnderline: false,
        fontStrikethrough: false,
        fontColor: "#ffffff",
        backgroundColor: "rgba(0, 0, 0, 0.7)", // Semi-transparent background for readability
        backgroundTransparent: false, // Default to opaque background
        // Enhanced subtitle styling defaults
        textOpacity: 100,
        backgroundOpacity: 70,
        textBorderColor: "#000000",
        textBorderThickness: 2,
        textAlignment: "center",
        textCapitalization: "--",
      };
    });

    // 📝 PREVENT DUPLICATES: Check for existing text items by content and segment ID
    setMediaItems((prev) => {
      // Add all text items - let the system handle duplicates naturally
      console.log(`📝 CREATE TRANSCRIPT: Adding ${textMediaItems.length} new text media items from transcript`);
      return [...prev, ...textMediaItems];
    });

    // Create TimelineItems for each text segment with optimized geometry
    const textTimelineItems: TimelineItem[] = textMediaItems.map(
      (mediaItem, index) => {
        const segment = transcript.segments[index];

        // Calculate optimal geometry for this specific text with full width
        const geometry = calculateOptimalTextGeometry(
          segment.text,
          canvasWidth,
          canvasHeight,
          {
            fontFamily: mediaItem.fontFamily,
            fontSize: mediaItem.fontSize,
            fontWeight: mediaItem.fontBold ? "bold" : "normal",
            fontStyle: mediaItem.fontItalic ? "italic" : "normal",
            position: "bottom", // Position transcript text at bottom like subtitles
            padding: 0, // No padding - exact character bounds
            forceFullWidth: true, // Force full video width for transcript text
            minHeight: 0.2, // Minimum 20% of video height for excellent readability
          }
        );

        // Calculate proportional start time based on audio chunk's actual duration
        // segment.start and segment.end are relative to the audio file duration
        const segmentStartRatio = segment.start / Math.max(...transcript.segments.map(s => s.end));
        const segmentEndRatio = segment.end / Math.max(...transcript.segments.map(s => s.end));
        const proportionalStartTime = audioStartTime + (audioDuration * segmentStartRatio);
        const proportionalEndTime = audioStartTime + (audioDuration * segmentEndRatio);
        const proportionalDuration = proportionalEndTime - proportionalStartTime;

        console.log(`📝 TRANSCRIPT SEGMENT: "${segment.text.substring(0, 30)}..." - Original: ${segment.start}s-${segment.end}s, Timeline: ${proportionalStartTime.toFixed(2)}s-${proportionalEndTime.toFixed(2)}s, Duration: ${mediaItem.duration.toFixed(2)}s`);

        return {
          id: `timeline_${mediaItem.id}`,
          mediaId: mediaItem.id,
          startTime: proportionalStartTime, // Offset by audio file's start time
          duration: proportionalDuration, // Use the calculated proportional duration
          track: 0, // Will be updated when layer is created
          geometry: geometry, // Apply optimized geometry
        };
      }
    );

    // Add timeline items to the Text layer
    setLayers((prevLayers) => {
      const existingTextLayerIndex = prevLayers.findIndex(
        (layer) => layer.type === "text"
      );

      if (existingTextLayerIndex !== -1) {
        // Add to existing text layer
        const updatedLayers = [...prevLayers];
        console.log(`📝 CREATE TRANSCRIPT: Adding ${textTimelineItems.length} new timeline items to existing text layer`);
        updatedLayers[existingTextLayerIndex] = {
          ...updatedLayers[existingTextLayerIndex],
          items: [
            ...updatedLayers[existingTextLayerIndex].items,
            ...textTimelineItems,
          ],
        };
        return updatedLayers;
      } else {
        // Create new text layer
        const newTextLayer: Layer = {
          id: `text_layer_${Date.now()}`,
          name: "Text",
          type: "text",
          visible: true,
          locked: false,
          items: textTimelineItems,
        };
        console.log(`📝 CREATE TRANSCRIPT: Creating new text layer with ${textTimelineItems.length} timeline items`);
        return [...prevLayers, newTextLayer];
      }
    });

    // 📝 PREVENT DUPLICATES: Set timeline items for global access (check for existing items)
    setTimelineItems((prev) => {
      const existingItemIds = prev.map(item => item.id);
      const newTimelineItems = textTimelineItems.filter(item => 
        !existingItemIds.includes(item.id)
      );
      if (newTimelineItems.length > 0) {
        console.log(`📝 CREATE TRANSCRIPT: Adding ${newTimelineItems.length} new timeline items to global timeline`);
        return [...prev, ...newTimelineItems];
      } else {
        console.log(`📝 CREATE TRANSCRIPT: All timeline items already exist globally, skipping duplicates`);
        return prev;
      }
    });

    // Update total duration if needed
    const maxEndTime = Math.max(...transcript.segments.map((s) => s.end));
    if (maxEndTime > totalDuration) {
      setTotalDuration(maxEndTime);
    }

    // **NEW: Save sentence-level transcript data to the database**
    const sentenceTranscriptData = {
      sentences: transcript.segments.map((segment, index) => {
        const mediaItem = textMediaItems[index];
        // Use the same timing calculation as the timeline items
        const segmentStartRatio = segment.start / Math.max(...transcript.segments.map(s => s.end));
        const segmentEndRatio = segment.end / Math.max(...transcript.segments.map(s => s.end));
        const proportionalStartTime = audioStartTime + (audioDuration * segmentStartRatio);
        const proportionalEndTime = audioStartTime + (audioDuration * segmentEndRatio);
        const proportionalDuration = proportionalEndTime - proportionalStartTime;
        
        return {
          id: mediaItem.id, // Use the same ID as the timeline item
          text: segment.text,
          startTime: proportionalStartTime, // Use proportional start time
          duration: proportionalDuration, // Use calculated proportional duration
          endTime: proportionalEndTime, // Use calculated proportional end time
          audioChunkId: undefined, // Could be linked to specific audio chunks if needed
          chapterNumber: undefined, // Could be linked to chapters if needed
        };
      }),
      totalDuration: audioStartTime + audioDuration, // Use audio chunk's actual duration
      language: "en", // Default to English, could be made configurable
      savedAt: new Date().toISOString(),
    };

    // Save transcript data using the onSentenceTranscriptsUpdate callback
    if (onSentenceTranscriptsUpdate) {
      onSentenceTranscriptsUpdate(sentenceTranscriptData);
    }

    // Update transcriptInfo state for saving to database
    const newTranscriptInfo = {
      storyContent: storyContent || "",
      audioChunks: audioChunks || [],
      totalAudioDuration: audioChunks?.reduce((total, chunk) => total + (chunk.duration || 0), 0) || 0,
      voiceoverSettings: {
        selectedVoiceId: selectedVoiceId || "",
        volume: voiceoverVolume,
      },
      savedAt: new Date().toISOString(),
    };
    setTranscriptInfo(newTranscriptInfo);

    // Note: Auto-save is handled elsewhere in the component
  };



  // Function to import OpenAI-generated images from local filesystem
  const importOpenAIGeneratedImages = async (
    stockMediaItems: Array<{
      id: string;
      type: "image";
      name: string;
      description: string;
      url: string;
      imageBuffer: string; // Base64 encoded image data
      fileName: string;
      contentType: string;
      size: number;
      duration: number;
      width: number;
      height: number;
      segmentId?: number;
      startTime: number;
      endTime: number;
      searchQuery?: string;
      prompt: string;
      source: string;
      allocation: 'sequential' | 'strategic' | 'fallback' | 'story-based';
      priority?: string;
      strategicIndex?: number;
      paragraphNumber?: number; // Which paragraph this image represents
    }>
  ): Promise<MediaItem[]> => {
    if (!storyId) {
      console.error("Story ID is required to import OpenAI-generated images");
      return [];
    }

    const importedMediaItems: MediaItem[] = [];

    for (const stockItem of stockMediaItems) {
      try {
        console.log(`🔄 Importing OpenAI image: ${stockItem.name}`);
        console.log(`🔍 DEBUG: stockItem object:`, {
          id: stockItem.id,
          name: stockItem.name,
          url: stockItem.url,
          imageBuffer: stockItem.imageBuffer ? `${stockItem.imageBuffer.substring(0, 50)}...` : 'none',
          fileName: stockItem.fileName,
          contentType: stockItem.contentType,
          size: stockItem.size,
          source: stockItem.source,
          type: stockItem.type,
          hasUrl: !!stockItem.url,
          hasImageBuffer: !!stockItem.imageBuffer,
          hasFileName: !!stockItem.fileName,
          urlLength: stockItem.url?.length || 0,
          bufferSize: stockItem.imageBuffer?.length || 0
        });

        // Generate unique media ID for imported item
        const mediaId = `openai-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Check if we have image buffer data
        if (stockItem.imageBuffer) {
          console.log(`✅ USING IMAGE BUFFER: Image ${stockItem.id} has base64 data`);
          console.log(`📄 File name: ${stockItem.fileName}`);
          console.log(`🆔 Story ID: ${storyId}`);
          
          // Convert base64 to blob
          const base64Data = stockItem.imageBuffer;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: stockItem.contentType });
          
          // Use the same approach as the + button - save to Electron AppData
          const savedFile = await mediaStorageService.saveMediaFile(
            storyId,
            mediaId,
            blob,
            "image",
            stockItem.url, // originalUrl
            "openai", // pexelsId
            "OpenAI" // photographer
          );
          
          // Create a MediaItem that uses the Electron AppData path (same as + button)
          const importedMedia: MediaItem = {
            id: mediaId,
            name: stockItem.name,
            type: "image",
            duration: stockItem.duration,
            filePath: savedFile.relativePath, // Use Electron AppData path
            fileName: savedFile.fileName, // Add the fileName property
            url: stockItem.url, // Keep original URL for reference
            description: stockItem.description,
            source: stockItem.source,
            paragraphNumber: stockItem.paragraphNumber,
            x: 0,
            y: 0,
            width: stockItem.width,
            height: stockItem.height,
            // Generate thumbnail immediately from the base64 data
            thumbnailUrl: `data:${stockItem.contentType};base64,${stockItem.imageBuffer}`,
          };

          // Add OpenAI-specific properties
          (importedMedia as any).openaiPrompt = stockItem.prompt;
          (importedMedia as any).allocation = stockItem.allocation;
          (importedMedia as any).priority = stockItem.priority;
          (importedMedia as any).strategicIndex = stockItem.strategicIndex;
          (importedMedia as any).originalOpenAIUrl = stockItem.url;
          (importedMedia as any).segmentId = stockItem.segmentId;

          console.log(`✅ OpenAI image saved to Electron AppData: ${importedMedia.filePath}`);
          console.log(`📁 Electron path: ${importedMedia.filePath}`);
          console.log(`🔗 Original URL: ${stockItem.url}`);
          console.log(`📄 File name: ${importedMedia.fileName}`);

          importedMediaItems.push(importedMedia);
          console.log(`✅ Successfully imported OpenAI image: ${stockItem.name}`, {
            id: importedMedia.id,
            source: importedMedia.source,
            filePath: importedMedia.filePath,
            fileName: importedMedia.fileName,
            type: importedMedia.type
          });
        } else {
          console.warn(`⚠️ WARNING: No image buffer data for image ${stockItem.id}, skipping...`);
          continue; // Skip images without buffer data
        }

      } catch (error) {
        console.error(`❌ Failed to import OpenAI image ${stockItem.id}:`, error);
      }
    }

    return importedMediaItems;
  };

  // Function to create stocks layer from Pexels media
  // Reusable function to import a single file (extracted from handleFileSelect)
  const importSingleFile = async (
    file: Blob,
    fileName: string,
    fileType: string,
    mediaId: string
  ): Promise<MediaItem | null> => {
    const type = fileType.startsWith("video/")
      ? "video"
      : fileType.startsWith("image/")
      ? "image"
      : fileType.startsWith("audio/")
      ? "audio"
      : null;

    if (!type) {
      return null;
    }

    try {
      let duration = 0;
      let thumbnailUrl = "";

      // Create temporary blob URL for processing
      const tempBlobUrl = URL.createObjectURL(file);

      // Get metadata (same as handleFileSelect)
      if (type === "video") {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = tempBlobUrl;

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = async () => {
            duration = video.duration;
            video.currentTime = 1;
            await new Promise<void>((seekResolve) => {
              video.onseeked = () => {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
                thumbnailUrl = canvas.toDataURL("image/jpeg");
                seekResolve();
              };
            });
            resolve();
          };
          video.onerror = () => resolve();
        });
      } else if (type === "audio") {
        const audio = new Audio(tempBlobUrl);

        await new Promise<void>((resolve) => {
          let resolved = false;

          const resolveOnce = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };

          audio.onloadedmetadata = () => {
            duration = audio.duration;
            resolveOnce();
          };

          audio.onloadeddata = () => {
            if (duration === 0 && audio.duration > 0) {
              duration = audio.duration;
            }
          };

          audio.oncanplaythrough = () => {
            if (duration === 0 && audio.duration > 0) {
              duration = audio.duration;
            }
          };

          audio.onerror = () => {
            resolveOnce();
          };

          // Start loading
          audio.load();

          setTimeout(() => {
            if (!resolved) {
              resolveOnce();
            }
          }, 3000);
        });
      }

      // Save file to filesystem using media storage service (same as handleFileSelect)
      let filePath = tempBlobUrl; // Fallback to blob URL
      let previewUrl = tempBlobUrl; // Always keep blob URL for preview
      let thumbnailForDisplay = tempBlobUrl; // Keep blob URL for thumbnail display

      if (storyId) {
        try {
          // Determine if this is an OpenAI image based on the mediaId prefix
          const isOpenAIImage = mediaId.startsWith('openai-');
          const pexelsId = isOpenAIImage ? "openai" : "local";
          const photographer = isOpenAIImage ? "OpenAI" : "User";
          
          console.log(`💾 SAVING: Saving ${type} file to filesystem...`, {
            storyId,
            mediaId,
            fileName,
            fileType,
            isOpenAIImage,
            pexelsId,
            photographer,
            fileSize: file.size
          });
          
          const savedFile = await mediaStorageService.saveMediaFile(
            storyId,
            mediaId,
            file,
            type === "video" ? "video" : "image",
            tempBlobUrl, // originalUrl
            pexelsId, // Use "openai" for OpenAI images, "local" for manual uploads
            photographer // Use "OpenAI" for OpenAI images, "User" for manual uploads
          );
          
          console.log(`✅ SAVED: File saved to filesystem successfully:`, {
            relativePath: savedFile.relativePath,
            filePath: savedFile.filePath,
            fileName: savedFile.fileName
          });
          
          filePath = savedFile.relativePath;

          // Always keep the blob URL for preview regardless of type
          previewUrl = tempBlobUrl;

          // For images, use base64 data URL for thumbnail display (production compatible)
          // For videos, we already have the generated canvas thumbnail
          if (type === "image") {
            try {
              console.log(`🔄 LOADING: Loading saved image as base64 for thumbnail: ${filePath}`);
              thumbnailForDisplay = await mediaStorageService.loadImageAsBase64(filePath); // Use base64 for production compatibility
              console.log(`✅ LOADED: Image loaded as base64 successfully, length: ${thumbnailForDisplay.length}`);
            } catch (base64Error) {
              console.warn(`⚠️ Failed to load image as base64 for thumbnail, using blob URL:`, base64Error);
              thumbnailForDisplay = tempBlobUrl; // Fallback to blob URL
            }
          } else {
            // For videos, the canvas thumbnail is sufficient for thumbnails
            // but we still keep the blob URL for preview
            thumbnailForDisplay = thumbnailUrl; // Use the generated canvas thumbnail
          }
        } catch (saveError) {
          console.error(`❌ SAVE FAILED: Failed to save media file to filesystem:`, saveError);
          console.error(`❌ SAVE ERROR DETAILS:`, {
            storyId,
            mediaId,
            fileName,
            fileType,
            fileSize: file.size,
            error: saveError instanceof Error ? saveError.message : 'Unknown error',
            stack: saveError instanceof Error ? saveError.stack : undefined
          });
          // Continue with blob URL as fallback
          previewUrl = tempBlobUrl;
          thumbnailForDisplay = tempBlobUrl;
        }
      }

      const newMedia: MediaItem = {
        id: mediaId,
        name: fileName.split(".")[0],
        type: type,
        duration: duration,
        filePath: filePath,
        previewUrl: previewUrl,
        thumbnailUrl:
          thumbnailUrl || (type === "image" ? thumbnailForDisplay : ""),
        text: "",
      };

      return newMedia;
    } catch (error) {
          console.error(
        `Failed to process file ${fileName}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    }
  };

  // Import saved stock media files using the same flow as handleFileSelect
  // This function is no longer needed - replaced by importOpenAIGeneratedImages
  // Temporarily commented out - deprecated function
  /* const importSavedStockMedia = async (
    stockMediaItems: Array<any>
  ): Promise<MediaItem[]> => {
    console.log("⚠️ importSavedStockMedia is deprecated - use importOpenAIGeneratedImages instead");
    return [];
  }; */

  // Add imported stock media to timeline
  const addStockMediaToTimeline = async (
    importedMediaItems: MediaItem[],
    originalStockItems: Array<{
      id: string;
      type: "image"; // OpenAI only generates images
      width: number;
      height: number;
      segmentId?: number; // Optional for strategic allocation
      startTime: number;
      endTime: number;
      duration: number;
      paragraphNumber?: number; // Which paragraph this image represents
      allocation?: 'sequential' | 'strategic' | 'fallback' | 'story-based';
    }>
  ) => {
    // Get current canvas dimensions for optimal sizing
    const canvas = previewCanvasRef.current;
    const canvasWidth = canvas?.width || 1920;
    const canvasHeight = canvas?.height || 1080;

    console.log(`🔗 STOCK MAPPING: Mapping ${importedMediaItems.length} imported media items to ${originalStockItems.length} original stock items`);
    
    // Create TimelineItems for imported media
    const stockTimelineItems: TimelineItem[] = importedMediaItems
      .map((importedMedia, index) => {
        console.log(`🔍 Creating timeline item for media ${importedMedia.id} at index ${index}`);
        // Find the original stock item by paragraph number or fall back to array index
        let originalStockItem = originalStockItems.find(
          item => item.paragraphNumber === index + 1
        );
        
        // Fallback: if no paragraph number, use array index
        if (!originalStockItem) {
          originalStockItem = originalStockItems[index];
        }

        if (!originalStockItem) {
          console.warn(
            `❌ No original stock data found for imported media ${importedMedia.id} at index ${index}`
          );
          return null;
        }

        console.log(`✅ STOCK MAPPING: Successfully mapped imported media ${importedMedia.id} to paragraph ${originalStockItem.paragraphNumber || index + 1}`);

        // Calculate geometry to fit the video dimensions
        const aspectRatio = originalStockItem.width / originalStockItem.height;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        let width, height, x, y;

        if (aspectRatio > canvasAspectRatio) {
          // Media is wider than canvas - fit by height
          width = canvasHeight * aspectRatio;
          height = canvasHeight;
          x = (canvasWidth - width) / 2;
          y = 0;
        } else {
          // Media is taller than canvas - fit by width
          width = canvasWidth;
          height = canvasWidth / aspectRatio;
          x = 0;
          y = (canvasHeight - height) / 2;
        }

        // Calculate timing based on story-based segments or paragraph position
        let startTime, duration;
        
        if (originalStockItem.allocation === 'story-based' && originalStockItem.startTime !== undefined && originalStockItem.endTime !== undefined) {
          // Use story-based timing for complete video coverage
          startTime = originalStockItem.startTime;
          duration = originalStockItem.endTime - originalStockItem.startTime;
          console.log(`⏰ STORY-BASED TIMING: Image ${originalStockItem.paragraphNumber} covers ${startTime.toFixed(1)}s to ${originalStockItem.endTime.toFixed(1)}s (duration: ${duration.toFixed(1)}s)`);
        } else {
          // Fallback to paragraph-based timing
          const paragraphIndex = originalStockItem.paragraphNumber || index + 1;
          const paragraphDuration = 5; // Each paragraph gets 5 seconds
          startTime = (paragraphIndex - 1) * paragraphDuration;
          duration = paragraphDuration;
          console.log(`⏰ PARAGRAPH TIMING: Image ${paragraphIndex} at ${startTime}s for ${duration}s`);
        }

        const timelineItem = {
          id: `timeline_openai_${importedMedia.id}`,
          mediaId: importedMedia.id, // Use the new imported media ID
          startTime: startTime,
          duration: duration,
          track: 0, // Will be updated when layer is created
          geometry: {
            x: x / canvasWidth, // Convert to relative coordinates (0-1)
            y: y / canvasHeight, // Convert to relative coordinates (0-1)
            width: width / canvasWidth, // Convert to relative coordinates (0-1)
            height: height / canvasHeight, // Convert to relative coordinates (0-1)
            rotation: 0,
          },
        };

        console.log(`📅 Created timeline item: ${timelineItem.id} at ${startTime}s for ${duration}s`);
        return timelineItem;
      })
      .filter(Boolean) as TimelineItem[]; // Remove any null items

    console.log(`📋 FINAL TIMELINE ITEMS: Created ${stockTimelineItems.length} timeline items:`, 
      stockTimelineItems.map(item => ({
        id: item.id,
        mediaId: item.mediaId,
        startTime: item.startTime,
        duration: item.duration
      }))
    );

    // Verify complete video coverage for story-based generation
    if (originalStockItems.length > 0 && originalStockItems[0].allocation === 'story-based') {
      const sortedItems = stockTimelineItems.sort((a, b) => a.startTime - b.startTime);
      const firstItem = sortedItems[0];
      const lastItem = sortedItems[sortedItems.length - 1];
      const totalCoverage = lastItem ? (lastItem.startTime + lastItem.duration) - firstItem.startTime : 0;
      
      console.log(`🔍 COVERAGE VERIFICATION:`, {
        totalItems: stockTimelineItems.length,
        firstImageStart: firstItem?.startTime.toFixed(1) + 's',
        lastImageEnd: lastItem ? (lastItem.startTime + lastItem.duration).toFixed(1) + 's' : 'N/A',
        totalCoverage: totalCoverage.toFixed(1) + 's',
        videoDuration: totalDuration.toFixed(1) + 's',
        coveragePercentage: totalDuration > 0 ? ((totalCoverage / totalDuration) * 100).toFixed(1) + '%' : 'N/A'
      });
      
      if (totalCoverage < totalDuration * 0.95) {
        console.warn(`⚠️ COVERAGE WARNING: Images only cover ${(totalCoverage / totalDuration * 100).toFixed(1)}% of video duration. There may be gaps.`);
      } else {
        console.log(`✅ COVERAGE SUCCESS: Images cover ${(totalCoverage / totalDuration * 100).toFixed(1)}% of video duration. Complete coverage achieved!`);
      }
    }
    
    // Verify timeline items are valid
    if (stockTimelineItems.length === 0) {
      console.error(`❌ CRITICAL ERROR: No timeline items created for stock media!`);
      return;
    }
    
    console.log(`✅ TIMELINE VERIFICATION: ${stockTimelineItems.length} timeline items ready for layer creation`);

    // Follow the exact same flow as manual drag and drop (handleTimelineDrop function)
    const stocksLayerId = "stocks-layer";
    const existingStocksLayerIndex = layers.findIndex(
      (layer) => layer.id === stocksLayerId
    );

    let updatedLayers: Layer[];

    if (existingStocksLayerIndex >= 0) {
      // 🔒 PREVENT DUPLICATES: Update existing stocks layer without duplicating timeline items
      updatedLayers = layers.map((layer) => {
        if (layer.id === stocksLayerId) {
          const existingItemIds = layer.items.map(item => item.id);
          const newStockItems = stockTimelineItems.filter(item => 
            !existingItemIds.includes(item.id)
          );
          
          if (newStockItems.length > 0) {
            console.log(`📋 ADD STOCK: Adding ${newStockItems.length} new stock timeline items to existing layer (${stockTimelineItems.length - newStockItems.length} duplicates skipped)`);
            return {
              ...layer,
              items: [...layer.items, ...newStockItems],
            };
          } else {
            console.log(`📋 ADD STOCK: All ${stockTimelineItems.length} stock timeline items already exist in layer, skipping duplicates`);
            return layer;
          }
        }
        return layer;
      });
    } else {
      // Create new stocks layer (like manual drag and drop)
      const newStocksLayer: Layer = {
        id: stocksLayerId,
        name: "Stock Media",
        visible: true,
        locked: false,
        items: stockTimelineItems,
        type: "footage",
        duration: Math.max(...stockTimelineItems.map((item) => item.startTime + item.duration)),
      };

      // Find the last text layer to insert stock media layer right below it
      let textLayerIndex = -1;
      for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].type === "text") {
          textLayerIndex = i;
          break;
        }
      }
      
      if (textLayerIndex >= 0) {
        // Insert stock media layer right after the last text layer
        updatedLayers = [
          ...layers.slice(0, textLayerIndex + 1),
          newStocksLayer,
          ...layers.slice(textLayerIndex + 1)
        ];
        console.log(`📋 ADD STOCK: Inserted stock media layer after text layer at index ${textLayerIndex}`);
      } else {
        // No text layers found, add at the top like before
        updatedLayers = [newStocksLayer, ...layers];
        console.log(`📋 ADD STOCK: No text layers found, added stock media layer at top`);
      }
    }

    // 🔥 FOLLOW EXACT SAME FLOW AS WORKING RESTORATION (lines 5440-5449)
    // The system has useEffect hooks that will automatically:
    // 1. Sync timelineItems from layers (lines 5719-5731)
    // 2. Re-render canvas when layers change (lines 5733-5737)
    
    console.log(`🎯 RESTORATION FLOW: Setting ${updatedLayers.length} layers with stock media`);
    
    // Step 1: Set layers first (this will trigger automatic sync and rendering)
    console.log(`🎯 LAYERS: Setting ${updatedLayers.length} layers:`, updatedLayers.map(layer => ({
      id: layer.id,
      name: layer.name,
      type: layer.type,
      itemCount: layer.items?.length || 0,
      items: layer.items?.map(item => ({ id: item.id, mediaId: item.mediaId, startTime: item.startTime }))
    })));
    
    setLayers(updatedLayers);
    
    // Step 1.5: MANUALLY SYNC timelineItems from layers to ensure they appear immediately
    console.log(`🔄 MANUAL SYNC: Syncing timeline items from layers...`);
    syncTimelineItemsFromLayers(updatedLayers);

    // Extend timeline duration if needed
    const maxEndTime = Math.max(...stockTimelineItems.map((item) => item.startTime + item.duration));
    if (maxEndTime > totalDuration) {
      setTotalDuration(maxEndTime);
    }

    // Load media elements in parallel (like manual import does)
    const loadPromises = importedMediaItems.map(async (mediaItem) => {
      try {
        await loadMediaElement(mediaItem);
        console.log(`✅ Stock media element loaded: ${mediaItem.id}`);
        return true;
      } catch (error) {
        console.error(`❌ Failed to load stock media element ${mediaItem.id}:`, error);
        return false;
      }
    });

    // Wait for all media elements to load and let useEffect hooks handle the rest
    const results = await Promise.all(loadPromises);
    const loadedCount = results.filter(Boolean).length;
    
    console.log(`🎬 STOCK MEDIA LOADED: ${loadedCount}/${importedMediaItems.length} items ready for rendering`);
    console.log(`🔄 Auto-render will be triggered by useEffect hooks when layers change`);
  };

  // New streamlined createStockMediaLayer function
  const createStockMediaLayer = async (
    stockMediaItems: Array<{
      id: string;
      type: "image"; // OpenAI only generates images
      name: string;
      description: string;
      url: string;
      imageBuffer: string; // Base64 encoded image data
      fileName: string;
      contentType: string;
      size: number;
      duration: number;
      width: number;
      height: number;
      segmentId?: number; // Optional for strategic allocation
      startTime: number;
      endTime: number;
      searchQuery?: string; // Optional for strategic allocation
      prompt: string; // OpenAI prompt used to generate the image
      source: string; // 'openai-dalle'
      allocation: 'sequential' | 'strategic' | 'fallback' | 'story-based';
      priority?: string; // For strategic allocation
      strategicIndex?: number; // For strategic allocation
      paragraphNumber?: number; // Which paragraph this image represents
    }>
  ) => {

    try {
      const importedMediaItems = await importOpenAIGeneratedImages(stockMediaItems);

      if (importedMediaItems.length === 0) {
        return;
      }

      setMediaItems(prev => {
        const existingIds = prev.map(item => item.id);
        const newItems = importedMediaItems.filter(item => !existingIds.includes(item.id));
        
        if (newItems.length > 0) {
          return [...prev, ...newItems];
        } else {
          return prev;
        }
      });

      // Step 2: Add imported media to timeline with paragraph information
      await addStockMediaToTimeline(importedMediaItems, stockMediaItems);
      
      // Step 2.5: Update stockMediaInfo state for saving to database
      const stockMediaItemsForInfo = mediaItems.filter(
        (item) =>
          (item.source === "pexels" || item.source === "openai-dalle") &&
          (item.type === "video" || item.type === "image")
      );
      const stockTimelineItemsForInfo = timelineItems.filter((item) =>
        stockMediaItemsForInfo.some((media) => media.id === item.mediaId)
      );

      const newStockMediaInfo = {
        items: stockMediaItemsForInfo.map((mediaItem) => {
          const timelineItem = stockTimelineItemsForInfo.find(
            (t) => t.mediaId === mediaItem.id
          );
          
          // Handle both legacy Pexels and new OpenAI items
          if (mediaItem.source === "openai-dalle") {
            return {
              id: mediaItem.id,
              name: mediaItem.name,
              type: "image" as const,
              description: (mediaItem as any).description || mediaItem.name,
              url: (mediaItem as any).originalOpenAIUrl || mediaItem.url || "", // Store original OpenAI URL
              fileName: (mediaItem as any).fileName || `${mediaItem.id}.jpg`,
              duration: mediaItem.duration || 0,
              width: mediaItem.width || 0,
              height: mediaItem.height || 0,
              segmentId: (mediaItem as any).segmentId,
              startTime: timelineItem?.startTime || 0,
              endTime:
                (timelineItem?.startTime || 0) +
                (timelineItem?.duration || mediaItem.duration || 0),
              searchQuery: mediaItem.searchQuery,
              prompt: (mediaItem as any).openaiPrompt || "",
              source: "openai-dalle",
              allocation: (mediaItem as any).allocation || "sequential",
              priority: (mediaItem as any).priority || "medium",
              strategicIndex: (mediaItem as any).strategicIndex,
              localFilePath: mediaItem.filePath, // Store the filesystem path
              downloadedAt: new Date().toISOString(),
            };
          } else {
            // Legacy Pexels items - convert to new format
            return {
              id: mediaItem.id,
              name: mediaItem.name,
              type: "image" as const,
              description: mediaItem.name,
              url: mediaItem.url || "",
              fileName: `${mediaItem.id}.jpg`,
              duration: mediaItem.duration || 0,
              width: mediaItem.width || 0,
              height: mediaItem.height || 0,
              segmentId: undefined,
              startTime: timelineItem?.startTime || 0,
              endTime:
                (timelineItem?.startTime || 0) +
                (timelineItem?.duration || mediaItem.duration || 0),
              searchQuery: mediaItem.searchQuery,
              prompt: `Stock media: ${mediaItem.name}`,
              source: "pexels-legacy",
              allocation: "sequential",
              priority: "medium",
              strategicIndex: undefined,
              localFilePath: mediaItem.filePath, // Store the filesystem path
              downloadedAt: new Date().toISOString(),
            };
          }
        }),
        savedAt: new Date().toISOString(),
      };
      
      setStockMediaInfo(newStockMediaInfo);
      


    } catch (error) {
      throw error;
    }
  };

  // Function to handle stock media fetching from transcript




  // NEW: Function to handle story-based stock media generation
  const handleStoryBasedStockMediaGeneration = useCallback(async (autoExecute: boolean = false) => {
    if (!storyId) {
      setError("Story ID is required for stock media fetching");
      return;
    }

    // Try to get video duration from multiple sources
    let videoDuration = totalDuration;
    
    if (!videoDuration || videoDuration === 0) {
      if (savedVideoAssets?.timeline?.totalDuration) {
        videoDuration = savedVideoAssets.timeline.totalDuration;
      }
      else if (audioChunks && audioChunks.length > 0) {
        const audioDuration = audioChunks.reduce((sum, chunk) => sum + chunk.duration, 0);
        if (audioDuration > 0) {
          videoDuration = audioDuration;
        }
      }
      else if (initialStory?.totalAudioDuration) {
        videoDuration = initialStory.totalAudioDuration;
      }
      else if (initialStory?.transcriptInfo?.totalAudioDuration) {
        videoDuration = initialStory.transcriptInfo.totalAudioDuration;
      }
      else if (timelineItems && timelineItems.length > 0) {
        const timelineDuration = timelineItems.reduce((sum, item) => Math.max(sum, item.startTime + item.duration), 0);
        if (timelineDuration > 0) {
          videoDuration = timelineDuration;
        }
      }
    }

    if (!videoDuration || videoDuration === 0) {
      setError('Video duration not available. Please ensure audio has been generated or video has been loaded.');
      return;
    }

    const videoDurationMinutes = videoDuration / 60;
    const imagesPerMinute = 5;
    const totalImagesNeeded = Math.ceil(videoDurationMinutes * imagesPerMinute);

    // Store generation parameters
    const generationRequest = [{
      id: 1,
      start: 0,
      end: videoDuration,
      text: `Story-based generation for ${totalImagesNeeded} images`,
      paragraphNumber: 1,
      isStoryBased: true,
      totalImages: totalImagesNeeded,
      videoDuration: videoDuration
    }];

    if (autoExecute) {
      // Automatically execute without showing confirmation dialog
      setPendingStockMediaRequest(generationRequest);
      await executeStoryBasedStockMediaGeneration();
    } else {
      // Show confirmation dialog for manual calls
      setShowStockMediaConfirmation(true);
      setPendingStockMediaRequest(generationRequest);
    }
  }, [storyId, totalDuration, savedVideoAssets, audioChunks, initialStory, timelineItems]);

  // Function to execute story-based stock media generation
  const executeStoryBasedStockMediaGeneration = useCallback(async () => {
    if (!pendingStockMediaRequest || !storyId) return;

    // Set auto-generating state
    setIsAutoGeneratingStockMedia(true);
    setAutoStockMediaProgress("Starting automatic image generation...");

    try {
      const generationParams = pendingStockMediaRequest[0];
    const totalImages = generationParams.totalImages;
    const videoDuration = generationParams.videoDuration;

    if (!totalImages || !videoDuration) {
      setError('Missing required parameters for story-based generation');
      return;
    }

    setTranscriptProgress(
      `Generating ${totalImages} images based on story content (5 per minute)...`
    );

    const imageDuration = videoDuration / totalImages;
    const overlapTime = 0.5;

    // Create story-based segments for image generation with complete image plan
    const storyBasedSegments = [];
    for (let i = 0; i < totalImages; i++) {
      const startTime = i * imageDuration;
      const endTime = Math.min(startTime + imageDuration + overlapTime, videoDuration); // Ensure last image extends to video end
      const imageNumber = i + 1;
      
      // Create a comprehensive image plan that the backend will use directly
      storyBasedSegments.push({
        id: imageNumber,
        start: startTime,
        end: endTime,
        text: `Story-based image ${imageNumber} for video segment ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`,
        paragraphNumber: imageNumber,
        isStoryBased: true,
        imageNumber: imageNumber,
        startTime: startTime,
        endTime: endTime,
        // Add the complete image plan so backend just downloads images
        prompt: `Create a beautiful, cinematic image representing a compelling story moment. Scene ${imageNumber} of ${totalImages}. This image will appear at ${startTime.toFixed(1)}s and cover until ${endTime.toFixed(1)}s in a ${(videoDuration/60).toFixed(2)} minute video. Style: High quality, professional, cinematic, suitable for storytelling. Focus on visual storytelling and scene transitions. Ensure this image can sustain viewer interest for ${(endTime - startTime).toFixed(1)} seconds.`,
        description: `Story moment ${imageNumber} - ${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s (covers ${(endTime - startTime).toFixed(1)}s)`,
        priority: 'high',
        allocation: 'story-based'
      });
    }


    
    const stockMediaData = await apiService.fetchStockMedia(
      storyBasedSegments,
      storyId,
      totalImages
    );



    setTranscriptProgress("Creating story-based stock media layer...");

    // Create stocks layer from fetched media
    if (stockMediaData.stockMedia && stockMediaData.stockMedia.length > 0) {
      const missingImageNumbers = stockMediaData.stockMedia.filter(item => !item.paragraphNumber);
      if (missingImageNumbers.length > 0) {
        stockMediaData.stockMedia.forEach((item, index) => {
          if (!item.paragraphNumber) {
            item.paragraphNumber = index + 1;
          }
        });
      }
      
      await createStockMediaLayer(stockMediaData.stockMedia);
    } else {
      throw new Error("No stock media received from backend");
    }

    setTranscriptProgress(
      `✅ Story-based stock media completed! ${stockMediaData.totalItems} images added to media library and timeline.`
    );
    
    // Clear auto-generating state
    setIsAutoGeneratingStockMedia(false);
    setAutoStockMediaGenerated(true);
    setAutoStockMediaProgress("Automatic image generation completed!");
    
    setTimeout(() => {
      setIsTranscriptModalOpen(false);
    }, 1000);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to generate stock media");
    
    setIsAutoGeneratingStockMedia(false);
    setAutoStockMediaProgress("Image generation failed - you can try manually.");
  }
  }, [pendingStockMediaRequest, storyId, apiService]);



  // Function to confirm and execute stock media generation
  const confirmStockMediaGeneration = async () => {
    if (!pendingStockMediaRequest) return;
    if (!storyId) {
      setError("Story ID is required for stock media generation");
      setShowStockMediaConfirmation(false);
      return;
    }

    try {
      setTranscriptProgress("Fetching related stock media...");
      setIsTranscriptModalOpen(true);
      setShowStockMediaConfirmation(false);

      if (pendingStockMediaRequest.length === 0) {
        setError("No story data available for stock media generation.");
        setIsTranscriptModalOpen(false);
        return;
      }

      // Only story-based generation is supported now
      await executeStoryBasedStockMediaGeneration();

    } catch (error) {
      console.error("❌ Failed to fetch stock media:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch stock media"
      );
      setIsTranscriptModalOpen(false);
    }
  };

  const handleTranscriptVoiceoverSelect = async (mediaItem: MediaItem) => {
    if (!storyId) {
      setError("Story ID is required for transcript processing");
      return;
    }

    try {
      setIsTranscriptModalOpen(true);
      setTranscriptProgress("Loading audio file...");
      setShowTranscriptSelector(false);

      // Load the audio file from storage first
      let audioData: ArrayBuffer;

      if (mediaItem.filePath.startsWith("blob:")) {
        // Handle blob URLs
        const response = await fetch(mediaItem.filePath);
        audioData = await response.arrayBuffer();
      } else {
        // Load from electron storage
        try {
          audioData = await window.electronAPI.audio.loadAudioFile(
            mediaItem.filePath
          );
        } catch (electronError) {
          throw new Error(`Failed to load audio file: ${electronError}`);
        }
      }

      // Detect MIME type based on file extension or default to mp3
      const getAudioMimeType = (fileName: string): string => {
        const extension = fileName.split(".").pop()?.toLowerCase();
        const mimeTypes: { [key: string]: string } = {
          mp3: "audio/mpeg",
          wav: "audio/wav",
          flac: "audio/flac",
          m4a: "audio/mp4",
          ogg: "audio/ogg",
          webm: "audio/webm",
        };
        return mimeTypes[extension || ""] || "audio/mpeg";
      };

      // Create File object for API service with proper MIME type
      const mimeType = getAudioMimeType(mediaItem.name);
      const audioBlob = new Blob([audioData], { type: mimeType });
      const audioFile = new File([audioBlob], mediaItem.name, {
        type: mimeType,
      });

      setTranscriptProgress("Generating transcript with AI...");

      // Call backend API for transcript generation using apiService
      const transcript = await apiService.generateTranscript(
        audioFile,
        storyId,
        mediaItem.id
      );

      setTranscriptProgress("Creating text layers...");

      // Find the timeline item for this audio file to get its start time
      const audioTimelineItem = timelineItems.find(item => item.mediaId === mediaItem.id);
      const audioStartTime = audioTimelineItem?.startTime || 0;

      console.log(`🎙️ TRANSCRIPT: Audio file "${mediaItem.name}" starts at ${audioStartTime}s in timeline`);

              // Create text layer from transcript segments with proper time offset
        createTextLayerFromTranscript(transcript, audioStartTime, mediaItem.id);

      // Do not auto-generate stock media here; keep flows decoupled
      // Users can manually invoke stock generation from the Stock Media panel
    } catch (error) {
      console.error("❌ Failed to generate transcript:", error);
      setError(
        error instanceof Error ? error.message : "Failed to generate transcript"
      );
    } finally {
      setIsTranscriptModalOpen(false);
    }
  };

  // Function to automatically generate transcripts for all voiceover items
  const autoGenerateTranscripts = useCallback(async () => {
    if (!storyId) {
      console.log("⚠️ No story ID available for automatic transcript generation");
      return;
    }

    // Only prevent duplicate automatic transcript generation if we're currently generating
    if (isAutoGeneratingTranscripts) {
      console.log("⚠️ Automatic transcript generation already in progress");
      return;
    }

    // Check if transcripts already exist - if so, skip automatic generation
    const existingTextLayers = layers.filter(layer => layer.type === "text");
    const hasExistingTranscripts = existingTextLayers.some(layer => layer.items.length > 0);
    
    if (hasExistingTranscripts) {
      console.log("🎙️ AUTO-TRANSCRIPT: Skipping - transcripts already exist");
      setAutoTranscriptGenerated(true); // Mark as completed since transcripts exist
      return;
    }

    // Get all voiceover items
    const voiceoverItems = mediaItems.filter(item => item.type === "voiceover");
    
    if (voiceoverItems.length === 0) {
      console.log("⚠️ No voiceover items found for transcript generation");
      return;
    }

    console.log(`🎙️ AUTO-TRANSCRIPT: Found ${voiceoverItems.length} voiceover items for transcript generation`);

    // Set progress state
    setIsAutoGeneratingTranscripts(true);
    setAutoTranscriptProgress(`Starting transcript generation for ${voiceoverItems.length} voiceover items...`);

    // Generate transcripts for each voiceover item sequentially
    for (const mediaItem of voiceoverItems) {
      try {
        console.log(`🎙️ AUTO-TRANSCRIPT: Generating transcript for "${mediaItem.name}"`);
        setAutoTranscriptProgress(`Generating transcript for "${mediaItem.name}"...`);
        
        // Load the audio file from storage
        let audioData: ArrayBuffer;

        if (mediaItem.filePath.startsWith("blob:")) {
          // Handle blob URLs
          const response = await fetch(mediaItem.filePath);
          audioData = await response.arrayBuffer();
        } else {
          // Load from electron storage
          try {
            audioData = await window.electronAPI.audio.loadAudioFile(
              mediaItem.filePath
            );
          } catch (electronError) {
            console.warn(`⚠️ Failed to load audio file for auto-transcript: ${electronError}`);
            continue; // Skip this item and continue with the next one
          }
        }

        // Detect MIME type based on file extension or default to mp3
        const getAudioMimeType = (fileName: string): string => {
          const extension = fileName.split(".").pop()?.toLowerCase();
          const mimeTypes: { [key: string]: string } = {
            mp3: "audio/mpeg",
            wav: "audio/wav",
            flac: "audio/flac",
            m4a: "audio/mp4",
            ogg: "audio/ogg",
            webm: "audio/webm",
          };
          return mimeTypes[extension || ""] || "audio/mpeg";
        };

        // Create File object for API service with proper MIME type
        const mimeType = getAudioMimeType(mediaItem.name);
        const audioBlob = new Blob([audioData], { type: mimeType });
        const audioFile = new File([audioBlob], mediaItem.name, {
          type: mimeType,
        });

        console.log(`🎙️ AUTO-TRANSCRIPT: Calling API for "${mediaItem.name}"`);

        // Call backend API for transcript generation
        const transcript = await apiService.generateTranscript(
          audioFile,
          storyId,
          mediaItem.id
        );

        console.log(`🎙️ AUTO-TRANSCRIPT: Received transcript for "${mediaItem.name}" with ${transcript.segments.length} segments`);

        // Find the timeline item for this audio file to get its start time
        const audioTimelineItem = timelineItems.find(item => item.mediaId === mediaItem.id);
        const audioStartTime = audioTimelineItem?.startTime || 0;

        console.log(`🎙️ AUTO-TRANSCRIPT: Creating text layers for "${mediaItem.name}" starting at ${audioStartTime}s`);

        // Create text layer from transcript segments with proper time offset
        createTextLayerFromTranscript(transcript, audioStartTime, mediaItem.id);

        // Add a small delay between transcript generations to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ AUTO-TRANSCRIPT: Failed to generate transcript for "${mediaItem.name}":`, error);
        setAutoTranscriptProgress(`Failed to generate transcript for "${mediaItem.name}" - continuing with next item...`);
        // Continue with the next item instead of stopping the entire process
        continue;
      }
    }

    setAutoTranscriptGenerated(true);
    setIsAutoGeneratingTranscripts(false);
    setAutoTranscriptProgress("Automatic transcript generation completed!");

    setAutoTranscriptProgress("Transcripts completed! Automatic image generation will start if needed.");

    // Show completion message briefly
    setShowCompletionMessage(true);
    setTimeout(() => {
      setShowCompletionMessage(false);
    }, 5000); // Hide after 5 seconds
  }, [storyId, layers, mediaItems, timelineItems, apiService]);

  const renderTranscriptSelector = () => {
    const voiceoverItems = mediaItems.filter(
      (item) => item.type === "voiceover"
    );

    if (voiceoverItems.length === 0) {
      return (
        <div className="absolute top-full left-0 mt-1 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-64">
          <p className="text-sm text-gray-500 mb-2">No voiceover items found</p>
          <p className="text-xs text-gray-400">
            Generate some voiceover audio first to create transcripts.
          </p>
          <Button
            size="sm"
            onClick={() => setShowTranscriptSelector(false)}
            className="mt-2 text-xs"
          >
            Close
          </Button>
        </div>
      );
    }

    return (
      <div className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-80  overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">
            Select Voiceover for Transcript
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowTranscriptSelector(false)}
            className="text-xs h-6 w-6 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>

        <div className="space-y-2">
          {voiceoverItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleTranscriptVoiceoverSelect(item)}
              className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer border border-gray-100 hover:border-gray-200"
            >
              <div className="flex items-center space-x-2">
                <Music className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium truncate max-w-48">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.duration?.toFixed(1)}s
                  </p>
                </div>
              </div>
              <Button size="sm" className="text-xs h-7">
                Generate
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };



  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!storyId) {
      setError("Story ID is required to save media files");
      return;
    }


    for (const file of Array.from(files)) {
      try {
        // Generate unique media ID for each file
        const mediaId = `custom-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Use the reusable importSingleFile function
        const importedMedia = await importSingleFile(
            file,
          file.name,
          file.type,
          mediaId
        );

        if (importedMedia) {
          setMediaItems((prev) => {
            const existingIds = prev.map(item => item.id);
            if (!existingIds.includes(importedMedia.id)) {
              return [...prev, importedMedia];
          } else {
              return prev;
            }
          });
        }
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to process file"
        );
      }
    }

    // Clear the file input
    event.target.value = "";
  };

  // Layer management functions

  const addLayer = () => {
    if (layers.length >= MAX_LAYERS) return;

    const newLayer: Layer = {
      id: `layer-${layers.length + 1}`,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      items: [],
      type: "main",
    };

    setLayers((prev) => [newLayer, ...prev]);
    setSelectedLayerId(newLayer.id);
  };
  // Audio splitting function using Web Audio API
  const splitAudioFile = async (
    originalMediaItem: MediaItem,
    splitPointInSeconds: number,
    firstPartDuration: number,
    secondPartDuration: number
  ): Promise<{
    firstPartMediaItem: MediaItem;
    secondPartMediaItem: MediaItem;
  }> => {
    // Load original audio file
    const audioBuffer = await loadAudioBuffer(originalMediaItem.filePath);
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;

    // Calculate sample positions
    const splitSample = Math.floor(splitPointInSeconds * sampleRate);
    const firstPartSamples = splitSample;
    const secondPartSamples = audioBuffer.length - splitSample;

    // Create AudioContext for processing
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    // Create first part buffer
    const firstPartBuffer = audioContext.createBuffer(
      channels,
      firstPartSamples,
      sampleRate
    );
    for (let channel = 0; channel < channels; channel++) {
      const originalData = audioBuffer.getChannelData(channel);
      const firstPartData = firstPartBuffer.getChannelData(channel);
      for (let i = 0; i < firstPartSamples; i++) {
        firstPartData[i] = originalData[i];
      }
    }

    // Create second part buffer
    const secondPartBuffer = audioContext.createBuffer(
      channels,
      secondPartSamples,
      sampleRate
    );
    for (let channel = 0; channel < channels; channel++) {
      const originalData = audioBuffer.getChannelData(channel);
      const secondPartData = secondPartBuffer.getChannelData(channel);
      for (let i = 0; i < secondPartSamples; i++) {
        secondPartData[i] = originalData[splitSample + i];
      }
    }

    // Convert AudioBuffers to audio blobs
    const firstPartBlob = await audioBufferToBlob(firstPartBuffer);
    const secondPartBlob = await audioBufferToBlob(secondPartBuffer);

    // Generate IDs for split parts
    const timestamp = Date.now();
    const firstPartId = `${originalMediaItem.id}_split1_${timestamp}`;
    const secondPartId = `${originalMediaItem.id}_split2_${timestamp}`;

    // Create blob URLs for immediate playback
    const firstPartBlobUrl = URL.createObjectURL(firstPartBlob);
    const secondPartBlobUrl = URL.createObjectURL(secondPartBlob);

    // Save audio files to storage if storyId is available
    let firstPartFilePath = firstPartBlobUrl;
    let secondPartFilePath = secondPartBlobUrl;

    if (storyId) {
      try {
        // Save first part
        const firstPartInfo = await audioStorageService.saveAudioFile(
          storyId,
          firstPartId,
          firstPartBlob
        );
        firstPartFilePath = firstPartInfo.relativePath;

        // Save second part
        const secondPartInfo = await audioStorageService.saveAudioFile(
          storyId,
          secondPartId,
          secondPartBlob
        );
        secondPartFilePath = secondPartInfo.relativePath;
      } catch (error) {
        console.warn(
          "Failed to save split audio to storage, using blob URLs:",
          error
        );
      }
    }

    // Create new MediaItem objects for split parts
    const firstPartMediaItem: MediaItem = {
      id: firstPartId,
      name: `${originalMediaItem.name} (Part 1)`,
      type: originalMediaItem.type,
      duration: firstPartDuration,
      filePath: firstPartFilePath,
      text: originalMediaItem.text || "",
      previewUrl: firstPartBlobUrl,
    };

    const secondPartMediaItem: MediaItem = {
      id: secondPartId,
      name: `${originalMediaItem.name} (Part 2)`,
      type: originalMediaItem.type,
      duration: secondPartDuration,
      filePath: secondPartFilePath,
      text: originalMediaItem.text || "",
      previewUrl: secondPartBlobUrl,
    };

    // Clean up audio context
    audioContext.close();

    return { firstPartMediaItem, secondPartMediaItem };
  };

  // Helper function to load audio file as AudioBuffer
  const loadAudioBuffer = async (filePath: string): Promise<AudioBuffer> => {
    let audioData: ArrayBuffer;

    try {
      if (filePath.startsWith("blob:")) {
        // Load from blob URL
        const response = await fetch(filePath);
        audioData = await response.arrayBuffer();
      } else {
        // Always use blob URL method for reliability - load through storage service
        const blobUrl = await audioStorageService.loadAudioFile(filePath);
        const response = await fetch(blobUrl);
        audioData = await response.arrayBuffer();
      }

      // Validate that we have a proper ArrayBuffer
      if (!(audioData instanceof ArrayBuffer)) {
        throw new Error(
          `Invalid audio data type: ${typeof audioData}, expected ArrayBuffer`
        );
      }

      if (audioData.byteLength === 0) {
        throw new Error("Audio data is empty");
      }

      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      try {
        const audioBuffer = await audioContext.decodeAudioData(
          audioData.slice()
        );
        audioContext.close();

        return audioBuffer;
      } catch (decodeError) {
        audioContext.close();
        console.error("Failed to decode audio data:", decodeError);
        throw new Error(`Failed to decode audio: ${decodeError}`);
      }
    } catch (loadError) {
      console.error("Failed to load audio buffer:", loadError);
      throw new Error(`Failed to load audio buffer: ${loadError}`);
    }
  };

  // Helper function to convert AudioBuffer to Blob
  const audioBufferToBlob = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;

    // Create WAV file manually (simplified implementation)
    const buffer = new ArrayBuffer(44 + length * channels * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * channels * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * channels * 2, true);

    // Convert float32 samples to int16
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        const int16Sample = Math.max(-1, Math.min(1, sample)) * 0x7fff;
        view.setInt16(offset, int16Sample, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: "audio/wav" });
  };

  // Helper function to preload audio elements for split files
  const preloadSplitAudioElements = async (splitMediaItems: MediaItem[]) => {
    for (const mediaItem of splitMediaItems) {
      if (mediaItem.type === "voiceover" || mediaItem.type === "audio") {
        try {
          // Use previewUrl (blob URL) for immediate playback
          const audioUrl = mediaItem.previewUrl || mediaItem.filePath;
          if (!audioUrl) {
            console.warn(`❌ No audio URL for split file: ${mediaItem.id}`);
            continue;
          }

          const audio = new Audio(audioUrl);

          // Wait for audio to be loaded
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              console.error(
                `⏰ Audio load timeout for split file: ${mediaItem.id}`
              );
              reject(new Error("Audio load timeout"));
            }, 10000); // Increased timeout to 10 seconds

            audio.onloadeddata = () => {
              clearTimeout(timeout);

              resolve();
            };

            audio.onerror = (e) => {
              clearTimeout(timeout);
              console.error(
                `❌ Failed to load split audio: ${mediaItem.id} (${mediaItem.name})`,
                {
                  error: e,
                  audioUrl: audioUrl.substring(0, 100),
                  readyState: audio.readyState,
                  networkState: audio.networkState,
                }
              );
              reject(e);
            };

            audio.load();
          });

          // Store in audio elements map for playback
          audioElementsRef.current.set(mediaItem.id, audio);

        } catch (error) {
          console.error(
            `❌ Failed to preload audio for ${mediaItem.id} (${mediaItem.name}):`,
            error
          );
        }
      }
    }
  };

  const splitSelectedItem = async () => {
    if (!selectedTimelineItem) {
      console.warn("✂️ Split failed: No timeline item selected for splitting");
      return;
    }

    // Check if current time is within the selected item's duration
    const itemStartTime = selectedTimelineItem.startTime;
    const itemEndTime =
      selectedTimelineItem.startTime + selectedTimelineItem.duration;

    if (currentTime <= itemStartTime || currentTime >= itemEndTime) {
      console.warn(
        `✂️ Split failed: Current time (${currentTime.toFixed(
          2
        )}s) is not within the selected item's duration (${itemStartTime.toFixed(
          2
        )}s - ${itemEndTime.toFixed(2)}s)`
      );
      return;
    }

    const originalMediaItem = mediaItems.find(
      (m) => m.id === selectedTimelineItem.mediaId
    );
    if (!originalMediaItem) {
      console.error("✂️ Split failed: Original media item not found");
      return;
    }

    // Calculate split point relative to the original audio (not timeline)
    const splitPointInAudio = currentTime - itemStartTime;
    const firstPartDuration = splitPointInAudio;
    const secondPartDuration = itemEndTime - currentTime;

    try {
      // For audio files, split the actual audio
      if (
        originalMediaItem.type === "voiceover" ||
        originalMediaItem.type === "audio"
      ) {
        const { firstPartMediaItem, secondPartMediaItem } =
          await splitAudioFile(
            originalMediaItem,
            splitPointInAudio,
            firstPartDuration,
            secondPartDuration
          );

        // Create new timeline items referencing the split audio files
        const firstPart: TimelineItem = {
          ...selectedTimelineItem,
          id: `${selectedTimelineItem.id}_part1_${Date.now()}`,
          mediaId: firstPartMediaItem.id, // Reference new split audio
          duration: firstPartDuration,
          geometry: selectedTimelineItem.geometry
            ? { ...selectedTimelineItem.geometry }
            : undefined,
        };

        const secondPart: TimelineItem = {
          ...selectedTimelineItem,
          id: `${selectedTimelineItem.id}_part2_${Date.now()}`,
          mediaId: secondPartMediaItem.id, // Reference new split audio
          startTime: currentTime,
          duration: secondPartDuration,
          geometry: selectedTimelineItem.geometry
            ? { ...selectedTimelineItem.geometry }
            : undefined,
        };

        // Add new media items and remove the original
        setMediaItems((prev) => {
          // Remove original media item and add split parts
          const filteredItems = prev.filter(
            (item) => item.id !== originalMediaItem.id
          );
          const updatedItems = [
            ...filteredItems,
            firstPartMediaItem,
            secondPartMediaItem,
          ];

          return updatedItems;
        });

        // Clean up original audio element to prevent conflicts
        const originalAudio = audioElementsRef.current.get(
          originalMediaItem.id
        );
        if (originalAudio) {
          originalAudio.pause();
          originalAudio.src = "";
          audioElementsRef.current.delete(originalMediaItem.id);
        }

        // Clean up original blob URLs to prevent memory leaks
        if (
          originalMediaItem.previewUrl &&
          originalMediaItem.previewUrl.startsWith("blob:")
        ) {
          URL.revokeObjectURL(originalMediaItem.previewUrl);
        }
        if (
          originalMediaItem.filePath &&
          originalMediaItem.filePath.startsWith("blob:")
        ) {
          URL.revokeObjectURL(originalMediaItem.filePath);
        }

        // Update layers by replacing the original item with the split parts
        const updatedLayers = layers.map((layer) => ({
          ...layer,
          items: layer.items
            .map((item) => {
              if (item.id === selectedTimelineItem.id) {
                return [firstPart, secondPart];
              }
              return item;
            })
            .flat(),
        }));

        setLayers(updatedLayers);
        syncTimelineItemsFromLayers(updatedLayers);
        setSelectedTimelineItem(firstPart);

        // Pre-load audio elements for immediate playback
        await preloadSplitAudioElements([
          firstPartMediaItem,
          secondPartMediaItem,
        ]);

        // Verify that audio elements are properly cached
      } else {
        // For non-audio items (images/videos), use original visual-only split
        const firstPart: TimelineItem = {
          ...selectedTimelineItem,
          id: `${selectedTimelineItem.id}_part1_${Date.now()}`,
          duration: firstPartDuration,
          geometry: selectedTimelineItem.geometry
            ? { ...selectedTimelineItem.geometry }
            : undefined,
        };

        const secondPart: TimelineItem = {
          ...selectedTimelineItem,
          id: `${selectedTimelineItem.id}_part2_${Date.now()}`,
          startTime: currentTime,
          duration: secondPartDuration,
          geometry: selectedTimelineItem.geometry
            ? { ...selectedTimelineItem.geometry }
            : undefined,
        };

        const updatedLayers = layers.map((layer) => ({
          ...layer,
          items: layer.items
            .map((item) => {
              if (item.id === selectedTimelineItem.id) {
                return [firstPart, secondPart];
              }
              return item;
            })
            .flat(),
        }));

        setLayers(updatedLayers);
        syncTimelineItemsFromLayers(updatedLayers);
        setSelectedTimelineItem(firstPart);
      }
    } catch (error) {
      console.error("✂️ Split failed:", error);
      setError(
        `Failed to split item: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Timeline direct drop functions
  const getTimeFromTimelinePosition = (
    event: React.DragEvent,
    layerElement: HTMLElement
  ): number => {
    const rect = layerElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const timelineWidth = rect.width;
    return (x / timelineWidth) * totalDuration;
  };

  // Check if dropping a new item would create a collision
  const checkDropCollision = (
    layerId: string,
    startTime: number,
    duration: number
  ): boolean => {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return false;

    const endTime = startTime + duration;

    // Check if the new item would overlap with any existing item
    return layer.items.some((existingItem) => {
      const existingEnd = existingItem.startTime + existingItem.duration;

      // Check for overlap (not just touching at edges)
      return startTime < existingEnd && endTime > existingItem.startTime;
    });
  };

  const handleTimelineDragOver = (event: React.DragEvent, layerId: string) => {
    if (!draggedMediaItem) return;

    event.preventDefault();

    const layerElement = event.currentTarget as HTMLElement;
    const dropTime = getTimeFromTimelinePosition(event, layerElement);

    // Calculate item duration for collision check
    let itemDuration: number;
    if (draggedMediaItem.type === "image") {
      itemDuration = IMAGE_DURATION;
    } else if (
      draggedMediaItem.type === "audio" ||
      draggedMediaItem.type === "voiceover"
    ) {
      itemDuration =
        draggedMediaItem.duration && draggedMediaItem.duration > 0
          ? draggedMediaItem.duration
          : 5;
    } else if (draggedMediaItem.type === "video") {
      itemDuration = draggedMediaItem.duration || 5;
    } else {
      itemDuration = 5;
    }

    // Check for collision and set appropriate drop effect
    const hasCollision = checkDropCollision(layerId, dropTime, itemDuration);

    if (hasCollision) {
      event.dataTransfer.dropEffect = "none";
      setTimelineDropTarget(null); // Don't show drop target if collision
    } else {
      event.dataTransfer.dropEffect = "copy";
      setTimelineDropTarget({
        layerId,
        time: dropTime,
      });
    }
  };

  const handleTimelineDragLeave = (event: React.DragEvent) => {
    // Only clear if we're actually leaving the timeline area
    const relatedTarget = event.relatedTarget as Element;
    if (!relatedTarget || !event.currentTarget.contains(relatedTarget)) {
      setTimelineDropTarget(null);
    }
  };
  const handleTimelineDrop = (event: React.DragEvent, layerId: string) => {
    event.preventDefault();

    if (!draggedMediaItem) return;

    const dropTime = getTimeFromTimelinePosition(
      event,
      event.currentTarget as HTMLElement
    );

    // Calculate proper duration based on media type using actual media length
    let itemDuration: number;
    if (draggedMediaItem.type === "image") {
      itemDuration = IMAGE_DURATION; // 5 seconds for images
    } else if (
      draggedMediaItem.type === "audio" ||
      draggedMediaItem.type === "voiceover"
    ) {
      // Use actual audio duration, but ensure it's valid
      itemDuration =
        draggedMediaItem.duration && draggedMediaItem.duration > 0
          ? draggedMediaItem.duration
          : 5; // Fallback to 5s only if duration is invalid
    } else if (draggedMediaItem.type === "video") {
      // Use actual video duration to preserve full media length
      itemDuration = draggedMediaItem.duration || 5;
    } else {
      itemDuration = 5; // Default fallback
    }

    // Check for collision with existing items - prevent drop if collision detected
    if (checkDropCollision(layerId, dropTime, itemDuration)) {
      // Clear drag state and exit without creating item
      setDraggedMediaItem(null);
      setTimelineDropTarget(null);
      return;
    }

    const finalDuration = itemDuration;

    // Don't expand timeline for manual video/image drops (keep original duration for repositioning)
    const newEndTime = dropTime + finalDuration;
    if (newEndTime > totalDuration && totalDuration > 0) {
    }

    // Create new timeline item with calculated position and duration
    const newTimelineItem: TimelineItem = {
      id: `timeline_${draggedMediaItem.id}_${Date.now()}`,
      mediaId: draggedMediaItem.id,
      startTime: dropTime,
      duration: finalDuration,
      track: layers.findIndex((l) => l.id === layerId) + 1,
      // Add default geometry for visual media
      geometry:
        draggedMediaItem.type === "image" || draggedMediaItem.type === "video"
          ? {
              x: 0,
              y: 0,
              width: 1,
              height: 1,
              rotation: 0,
            }
          : undefined,
    };

    // Add to the target layer
    const updatedLayers = layers.map((layer) => {
      if (layer.id === layerId) {
        return {
          ...layer,
          items: [...layer.items, newTimelineItem],
        };
      }
      return layer;
    });

    setLayers(updatedLayers);
    syncTimelineItemsFromLayers(updatedLayers);

    // Auto-select the newly created item if it's visual media
    if (
      draggedMediaItem.type === "image" ||
      draggedMediaItem.type === "video"
    ) {
      setSelectedTimelineItem(newTimelineItem);
    }

    // Clear drag state
    setDraggedMediaItem(null);
    setTimelineDropTarget(null);
  };
  const removeLayer = (layerId: string) => {
    // Find the layer to check if it's protected
    const layerToRemove = layers.find((layer) => layer.id === layerId);

    // Only prevent removal of the main voiceover layer (not text layers)
    if (layerToRemove && layerToRemove.type === "voiceover") {
      return;
    }

    // Allow removal of text layers (including transcript layers)
    if (layerToRemove && layerToRemove.type === "text") {
      // Also remove the associated media items for text layers
      const textItemIds = layerToRemove.items.map((item) => item.mediaId);
      setMediaItems((prev) =>
        prev.filter((item) => !textItemIds.includes(item.id))
      );
      setTimelineItems((prev) =>
        prev.filter((item) => !textItemIds.includes(item.mediaId))
      );
    }

    setLayers((prev) => prev.filter((layer) => layer.id !== layerId));
    if (selectedLayerId === layerId) {
      const remainingLayers = layers.filter((layer) => layer.id !== layerId);
      setSelectedLayerId(
        remainingLayers.length > 0 ? remainingLayers[0].id : ""
      );
    }
  };

  const toggleLayerVisibility = (layerId: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  const toggleLayerLock = (layerId: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, locked: !layer.locked } : layer
      )
    );
  };

  // Debug function to log timeline item selection issues

  const renameLayer = (layerId: string, newName: string) => {
    // Find the layer to check if it's protected
    const layerToRename = layers.find((layer) => layer.id === layerId);

    // Only prevent renaming of voiceover layer (allow text layer renaming)
    if (layerToRename && layerToRename.type === "voiceover") {
      const cleanName = newName.replace(/^🔒\s*/, ""); // Remove lock emoji if user somehow included it

      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === layerId ? { ...layer, name: cleanName } : layer
        )
      );
      return;
    }

    // Allow normal renaming for non-protected layers
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, name: newName } : layer
      )
    );
  };

  // Initialize state from props - OPTIMIZED: removed currentTime and totalDuration dependencies
  useEffect(() => {
    const initializeEditor = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!audioChunks?.length) {
          setIsLoading(false);
          return;
        }

        if (initialLoadComplete) {
          // Even if already initialized, sync the indicator position
          if (timeRulerRef.current) {
            const rulerWidth = timeRulerRef.current.clientWidth;
            const newPosition = (currentTime / totalDuration) * rulerWidth;
            setIndicatorPosition(newPosition);
          }
          setIsLoading(false);
          return;
        }

        // If we have savedVideoAssets and are restoring, skip audio initialization
        if (savedVideoAssets && !audioRestored) {
          setIsLoading(false);
          return;
        }

        // Validate audio chunks
        const validChunks = audioChunks.filter((chunk): chunk is AudioChunk => {
          if (!chunk || typeof chunk !== "object") return false;
          if (!chunk.id || !chunk.filePath) return false;
          return true;
        });

        if (validChunks.length === 0) {
          throw new Error("No valid audio chunks found");
        }

        // Create media items
        const newMediaItems = validChunks.map(
          (chunk): MediaItem => ({
            id: chunk.id,
            name: chunk.name || chunk.id,
            type: "voiceover",
            duration: chunk.duration,
            filePath: normalizePath(chunk.filePath),
            text: chunk.text,
          })
        );

        // Create timeline items
        let currentStartTime = 0;
        const newTimelineItems = newMediaItems.map((chunk): TimelineItem => {
          const timelineItem = {
            id: `timeline_${chunk.id}`,
            mediaId: chunk.id,
            startTime: currentStartTime,
            duration: chunk.duration,
            track: 1,
          };
          currentStartTime += chunk.duration;
          return timelineItem;
        });

        // Register audio files
        for (const chunk of newMediaItems) {
          if (chunk.filePath) {
            const normalizedPath = normalizePath(chunk.filePath);
            const exists = await audioStorageService.fileExists(normalizedPath);
            if (!exists) {
              throw new Error(`Audio file not found: ${normalizedPath}`);
            }
          }
        }

        // Update state - BUT PRESERVE EXISTING LIFTED STATE

        // Only initialize if we don't already have media items (preserve lifted state)
        if (mediaItems.length === 0) {
        setMediaItems(newMediaItems);
        setTimelineItems(newTimelineItems);
        } else {
          // Just add the voice layer items to existing timeline items if they don't exist
          const existingVoiceItems = timelineItems.filter(item => 
            newTimelineItems.some(newItem => newItem.id === item.id)
          );
          if (existingVoiceItems.length === 0) {
            setTimelineItems(prev => [...newTimelineItems, ...prev]);
          }
        }
        
        const totalDur = newMediaItems.reduce(
          (sum, chunk) => sum + chunk.duration,
          0
        );
        setTotalDuration(totalDur);

        // Update voice layer with timeline items - but preserve other layers
        setLayers((prevLayers) => {
          const existingVoiceLayer = prevLayers.find(layer => layer.id === "voice-layer");
          
          // If voice layer already has the items, don't overwrite
          if (existingVoiceLayer && existingVoiceLayer.items.length > 0) {
            return prevLayers;
          }
          
          return prevLayers.map((layer) => {
            if (layer.id === "voice-layer") {
              return {
                ...layer,
                items: newTimelineItems,
                duration: totalDur,
              };
            }
            return layer;
          });
        });

        setInitialLoadComplete(true);
        setPreGeneratedProcessed(true);
        setIsLoading(false);
        
        // 3 seconds after all loading processes finished, initiate the canvas and render initial screen again
        // with retry logic to ensure wonderful initialization
        setTimeout(() => {
          console.warn("🔄 Starting delayed canvas re-initialization with retry logic...");
          
          const reinitializeCanvasWithRetry = (attemptCount = 0) => {
            const maxRetries = 5;
            const retryDelay = 500; // 500ms between retries
            
            console.warn(`🔄 Canvas re-initialization attempt ${attemptCount + 1}/${maxRetries}...`);
            
            try {
              // Re-initialize canvas
              initializePreview();
              
              // Render initial frame
              renderPreviewFrame(currentTime);
              
              // Verify canvas is working properly
              const canvas = previewCanvasRef.current;
              if (canvas && canvas.width > 0 && canvas.height > 0) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  // Try to get image data to verify canvas is working
                  const imageData = ctx.getImageData(0, 0, 1, 1);
                  if (imageData && imageData.data) {
                    console.log("✅ Canvas re-initialization successful on attempt", attemptCount + 1);
                    
                    // Start automatic transcript generation after successful canvas initialization
                    // Only if transcripts don't already exist
                    setTimeout(() => {
                      const existingTextLayers = layers.filter(layer => layer.type === "text");
                      const hasExistingTranscripts = existingTextLayers.some(layer => layer.items.length > 0);
                      
                      if (!hasExistingTranscripts && !autoTranscriptGenerated) {
                      console.log("🎙️ AUTO-TRANSCRIPT: Starting automatic transcript generation...");
                      autoGenerateTranscripts();
                      } else {
                        console.log("🎙️ AUTO-TRANSCRIPT: Skipping - transcripts already exist or generation completed");
                      }
                    }, 2000); // 2 second delay after canvas is ready
                    
                    return; // Success, exit the retry loop
                  }
                }
              }
              
              // If we reach here, canvas initialization failed
              if (attemptCount < maxRetries - 1) {
                console.log(`⚠️ Canvas initialization attempt ${attemptCount + 1} failed, retrying in ${retryDelay}ms...`);
                setTimeout(() => {
                  reinitializeCanvasWithRetry(attemptCount + 1);
                }, retryDelay);
              } else {
                console.error("❌ Failed to initialize canvas after maximum retries (5 attempts)");
              }
            } catch (error) {
              console.error(`❌ Canvas initialization attempt ${attemptCount + 1} failed:`, error);
              if (attemptCount < maxRetries - 1) {
                setTimeout(() => {
                  reinitializeCanvasWithRetry(attemptCount + 1);
                }, retryDelay);
              } else {
                console.error("❌ Failed to initialize canvas after maximum retries due to errors");
              }
            }
          };
          
          // Start the retry process
          reinitializeCanvasWithRetry();
        }, 3000); // 3 second delay
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to initialize editor"
        );
        setIsLoading(false);
      }
    };

    initializeEditor();
  }, [audioChunks, initialLoadComplete]); // REMOVED: currentTime, totalDuration dependencies

  // Add a separate effect to handle indicator position after resize or screen return
  useEffect(() => {
    const updateIndicatorPosition = () => {
      if (timeRulerRef.current && !isPlaying) {
        const rulerWidth = timeRulerRef.current.clientWidth;
        const newPosition = (currentTime / totalDuration) * rulerWidth;
        setIndicatorPosition(newPosition);
      }
    };

    // Update position initially
    updateIndicatorPosition();

    // Update position when window is resized
    window.addEventListener("resize", updateIndicatorPosition);

    // Update position when visibility changes
    document.addEventListener("visibilitychange", updateIndicatorPosition);

    return () => {
      window.removeEventListener("resize", updateIndicatorPosition);
      document.removeEventListener("visibilitychange", updateIndicatorPosition);
    };
  }, [currentTime, totalDuration, isPlaying]);

  // Remove the old audio chunks processing code
  useEffect(() => {
    const currentAudioChunksLength = audioChunks.length;
    if (currentAudioChunksLength !== lastProcessedAudioChunksLength) {
      if (!initialLoadComplete) {
        setPreGeneratedProcessed(false);
        setLastProcessedAudioChunksLength(currentAudioChunksLength);
      }
    }
  }, [audioChunks, lastProcessedAudioChunksLength, initialLoadComplete]);

  // Restore saved video assets on mount
  useEffect(() => {
    if (savedVideoAssets && !audioRestored && !isRestoringAudio) {
      setIsRestoringAudio(true);

      // Restore layers if they exist - BUT PRESERVE EXISTING LIFTED STATE
      if (savedVideoAssets.layers && savedVideoAssets.layers.length > 0) {
        // Only restore layers if we don't have any user-added layers (preserve lifted state)
        const hasUserLayers = layers.some(layer => 
          layer.id !== "voice-layer" && layer.items.length > 0
        );
        
        if (!hasUserLayers) {
        setLayers(savedVideoAssets.layers);
        } else {
          // Preserve existing user layers but ensure voice and text layers from saved assets are present
          setLayers(prev => {
            const updatedLayers = [...prev];
            
            // Ensure voice layer is present
            const hasVoiceLayer = updatedLayers.some(layer => layer.id === "voice-layer");
            if (!hasVoiceLayer && savedVideoAssets.layers) {
              const voiceLayer = savedVideoAssets.layers.find(layer => layer.id === "voice-layer");
              if (voiceLayer) {
                updatedLayers.push(voiceLayer);
              }
            }
            
            // 📝 PRESERVE TEXT LAYERS: Ensure text layers from saved assets are present
            const savedTextLayers = savedVideoAssets.layers?.filter(layer => layer.type === "text") || [];
            savedTextLayers.forEach(savedTextLayer => {
              const existingTextLayer = updatedLayers.find(layer => 
                layer.type === "text" && layer.id === savedTextLayer.id
              );
              if (!existingTextLayer) {
                console.log(`📝 PRESERVING TEXT LAYER: Adding saved text layer "${savedTextLayer.name}" with ${savedTextLayer.items?.length || 0} items`);
                updatedLayers.push(savedTextLayer);
              }
            });
            
            return updatedLayers;
          });
        }
        
        if (savedVideoAssets.editorSettings?.selectedLayerId) {
          setSelectedLayerId(savedVideoAssets.editorSettings.selectedLayerId);
        }
      }

      // Restore audio chunks if they exist
      if (
        savedVideoAssets.audioChunks &&
        savedVideoAssets.audioChunks.length > 0
      ) {
        const restoredMediaItems = savedVideoAssets.audioChunks.map(
          (chunk: any) => ({
            id: chunk.id,
            name: chunk.name,
            type: "voiceover" as const,
            duration: chunk.duration,
            filePath: chunk.blobUrl,
            text: chunk.text,
          })
        );

        // Create continuous timeline starting from 0 for restored assets
        let currentStartTime = 0;
        const restoredTimelineItems = savedVideoAssets.audioChunks.map(
          (chunk: any) => {
            const timelineItem = {
              id: `timeline_${chunk.id}`,
              mediaId: chunk.id,
              startTime: currentStartTime,
              duration: chunk.duration,
              track: 1,
            };
            currentStartTime += chunk.duration;
            return timelineItem;
          }
        );

        const loadAudioChunks = async () => {
          const chunks = savedVideoAssets.audioChunks;
          if (!Array.isArray(chunks) || chunks.length === 0) return;

          for (const chunk of chunks) {
            try {
              let audioUrl = null;

              // Check if we have a valid file path for audio storage
              if (chunk.filePath && !chunk.filePath.startsWith("blob:")) {
                // Load from audio storage using relative path
                try {
                  audioUrl = await audioStorageService.loadAudioFile(
                    chunk.filePath
                  );
                } catch (storageError) {
                  audioUrl = null;
                }
              } else if (chunk.blobUrl && chunk.blobUrl.startsWith("blob:")) {
                // Try to use existing blob URL
                audioUrl = chunk.blobUrl;
              }

              if (audioUrl) {
                const audio = new Audio(audioUrl);

                // Test if audio loads successfully
                try {
                  await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                      reject(new Error("Audio load timeout"));
                    }, 5000);

                    audio.onloadeddata = () => {
                      clearTimeout(timeout);
                      resolve(true);
                    };

                    audio.onerror = (e) => {
                      clearTimeout(timeout);
                      reject(e);
                    };

                    audio.load();
                  });

                  audioElementsRef.current.set(chunk.id, audio);
                } catch (audioError) {
                  console.warn(
                    `Failed to load audio element for chunk ${chunk.id}:`,
                    audioError
                  );
                }
              }
            } catch (error) {
              console.warn(
                `Failed to restore audio for chunk ${chunk.id}:`,
                error
              );
            }
          }
        };

        // Load audio chunks asynchronously to prevent blocking
        loadAudioChunks()
          .then(() => {
            setAudioRestored(true);
            
            // Start automatic transcript generation after restoration is complete
            setTimeout(() => {
              // Check if transcripts already exist before proceeding
              const existingTextLayers = layers.filter(layer => layer.type === "text");
              const hasExistingTranscripts = existingTextLayers.some(layer => layer.items.length > 0);
              
              if (hasExistingTranscripts) {
                console.log("🎙️ AUTO-TRANSCRIPT: Transcripts already exist after restoration, marking as completed");
                setAutoTranscriptGenerated(true);
                return;
              }
              
              console.log("🎙️ AUTO-TRANSCRIPT: Starting automatic transcript generation after restoration...");
              autoGenerateTranscripts();
            }, 3000); // 3 second delay after restoration
          })
          .catch(() => {
            // console.error("❌ Error loading audio chunks:", error);
            setAudioRestored(true); // Mark as complete even on error to prevent retry loop
            
            // Start automatic transcript generation even if restoration had errors
            setTimeout(() => {
              // Check if transcripts already exist before proceeding
              const existingTextLayers = layers.filter(layer => layer.type === "text");
              const hasExistingTranscripts = existingTextLayers.some(layer => layer.items.length > 0);
              
              if (hasExistingTranscripts) {
                console.log("🎙️ AUTO-TRANSCRIPT: Transcripts already exist after restoration (with errors), marking as completed");
                setAutoTranscriptGenerated(true);
                return;
              }
              
              console.log("🎙️ AUTO-TRANSCRIPT: Starting automatic transcript generation after restoration (with errors)...");
              autoGenerateTranscripts();
            }, 3000); // 3 second delay after restoration
          })
          .finally(() => {
            setIsRestoringAudio(false);
          });

        // PRESERVE EXISTING LIFTED STATE - only restore if empty
        if (mediaItems.length === 0) {
        setMediaItems(restoredMediaItems);
        setTimelineItems(restoredTimelineItems);
        } else {
          // Add missing voice items and text items from saved assets
          const existingVoiceItems = timelineItems.filter(item => 
            restoredTimelineItems.some(restoredItem => restoredItem.id === item.id)
          );
          if (existingVoiceItems.length === 0) {
            setTimelineItems(prev => [...restoredTimelineItems, ...prev]);
          }
          

        }
        setTotalDuration(savedVideoAssets.timeline?.totalDuration || 0);
        setCurrentTime(savedVideoAssets.timeline?.currentTime || 0);

        // Restore volume settings
        if (savedVideoAssets.editorSettings?.volumeSettings) {
          const {
            voiceover = 80,
            footage = 60,
            soundtrack = 40,
          } = savedVideoAssets.editorSettings.volumeSettings;
          setVoiceoverVolume(voiceover);
          setStockFootageVolume(footage);
          setSoundtrackVolume(soundtrack);
        }

        return; // Skip auto-generation if we have saved assets
      } else {
        // No audio chunks to restore, mark as complete
        setAudioRestored(true);
        setIsRestoringAudio(false);
      }
    } else if (!audioRestored) {
      // No saved assets, mark as complete to prevent infinite checks
      setAudioRestored(true);
      setIsRestoringAudio(false);
    }
  }, [
    storyContent,
    selectedVoiceId,
    savedVideoAssets,
    audioChunks,
    audioRestored,
    isRestoringAudio,
    preGeneratedProcessed,
    lastProcessedAudioChunksLength,
  ]);

  // Automatic transcript generation effect
  useEffect(() => {
    // Only trigger if we have audio chunks, story ID, and haven't already generated transcripts
    if (
      audioChunks?.length > 0 &&
      storyId &&
      !autoTranscriptGenerated &&
      initialLoadComplete &&
      !isLoading
    ) {
      // Check if transcripts already exist before setting the timer
      const existingTextLayers = layers.filter(layer => layer.type === "text");
      const hasExistingTranscripts = existingTextLayers.some(layer => layer.items.length > 0);
      
      if (hasExistingTranscripts) {
        console.log("🎙️ AUTO-TRANSCRIPT: Transcripts already exist, marking as completed");
        setAutoTranscriptGenerated(true);
        return;
      }
      
      // Add a delay to ensure everything is properly initialized
      const timer = setTimeout(() => {
        console.log("🎙️ AUTO-TRANSCRIPT: Triggering automatic transcript generation from useEffect...");
        autoGenerateTranscripts();
      }, 5000); // 5 second delay to ensure full initialization

      return () => clearTimeout(timer);
    }
  }, [
    audioChunks,
    storyId,
    autoTranscriptGenerated,
    initialLoadComplete,
    isLoading,
    autoGenerateTranscripts,
    layers
  ]);

  // Reset auto-transcript state when new audio chunks are added
  useEffect(() => {
    if (audioChunks?.length > 0) {
      // Reset completion message when new audio chunks are available
      setShowCompletionMessage(false);
      
      // Reset auto-transcript state when new audio chunks are added
      // This allows users to regenerate transcripts for new content
      if (audioChunks.length > lastProcessedAudioChunksLength) {
        setAutoTranscriptGenerated(false);
        setLastProcessedAudioChunksLength(audioChunks.length);
      }
    }
  }, [audioChunks, autoTranscriptGenerated, lastProcessedAudioChunksLength]);

  useEffect(() => {
    if (storyId && !isAutoGeneratingStockMedia && !autoStockMediaGenerated && showCompletionMessage) {
      const imageItems = mediaItems.filter(item => item.type === "image");
      
      if (imageItems.length === 0) {
        handleStoryBasedStockMediaGeneration(true);
      }
    }
  }, [storyId, mediaItems, isAutoGeneratingStockMedia, autoStockMediaGenerated, showCompletionMessage, handleStoryBasedStockMediaGeneration]);

  // Get video aspect ratio class based on video style
  const getVideoAspectRatio = () => {
    switch (videoStyle) {
      case "square":
        return "aspect-square";
      case "vertical":
        return "aspect-[9/16]";
      case "landscape":
      default:
        return "aspect-video";
    }
  };
  const saveVideoAssets = () => {
    if (!onVideoAssetsUpdate) return;

    // Collect transcript info for debugging
    const transcriptInfo = {
      storyContent,
      audioChunks,
      totalAudioDuration:
        audioChunks?.reduce(
          (total, chunk) => total + (chunk.duration || 0),
          0
        ) || 0,
      voiceoverSettings: {
        selectedVoiceId,
        volume: voiceoverVolume,
      },
      savedAt: new Date().toISOString(),
    };

    // Collect stock media info with local file paths and timestamps
    const stockMediaItems = mediaItems.filter(
      (item) =>
        (item.source === "pexels" || item.source === "openai-dalle") &&
        (item.type === "video" || item.type === "image")
    );
    const stockTimelineItems = timelineItems.filter((item) =>
      stockMediaItems.some((media) => media.id === item.mediaId)
    );

    const stockMediaInfo: NonNullable<SavedVideoAssets['stockMediaInfo']> = {
      items: stockMediaItems.map((mediaItem) => {
        const timelineItem = stockTimelineItems.find(
          (t) => t.mediaId === mediaItem.id
        );
        
        // Handle both legacy Pexels and new OpenAI items
        if (mediaItem.source === "openai-dalle") {
          return {
            id: mediaItem.id,
            name: mediaItem.name,
            type: "image" as const, // OpenAI only generates images
            description: (mediaItem as any).description || mediaItem.name,
            url: mediaItem.url || "",
            fileName: (mediaItem as any).fileName || `${mediaItem.id}.jpg`,
            duration: mediaItem.duration || 0,
            width: mediaItem.width || 0,
            height: mediaItem.height || 0,
            segmentId: (mediaItem as any).segmentId,
            startTime: timelineItem?.startTime || 0,
            endTime:
              (timelineItem?.startTime || 0) +
              (timelineItem?.duration || mediaItem.duration || 0),
            searchQuery: mediaItem.searchQuery,
            prompt: (mediaItem as any).openaiPrompt || "",
            source: "openai-dalle",
            allocation: (mediaItem as any).allocation || "sequential",
            priority: (mediaItem as any).priority || "medium",
            strategicIndex: (mediaItem as any).strategicIndex,
            localFilePath: mediaItem.filePath, // Save the Electron AppData file path
            downloadedAt: new Date().toISOString(),
          };
        } else {
          // Legacy Pexels items - convert to new format
          return {
            id: mediaItem.id,
            name: mediaItem.name,
            type: "image" as const, // Convert all to images for consistency
            description: mediaItem.name,
            url: mediaItem.url || "",
            fileName: `${mediaItem.id}.jpg`,
            duration: mediaItem.duration || 0,
            width: mediaItem.width || 0,
            height: mediaItem.height || 0,
            segmentId: undefined,
            startTime: timelineItem?.startTime || 0,
            endTime:
              (timelineItem?.startTime || 0) +
              (timelineItem?.duration || mediaItem.duration || 0),
            searchQuery: mediaItem.searchQuery,
            prompt: `Stock media: ${mediaItem.name}`,
            source: "pexels-legacy",
            allocation: "sequential",
            priority: "medium",
            strategicIndex: undefined,
            downloadedAt: new Date().toISOString(),
          };
        }
      }),
      savedAt: new Date().toISOString(),
    };

    const videoAssets: SavedVideoAssets = {
      transcriptInfo,
      stockMediaInfo,
      voice: selectedVoiceId
        ? {
            id: selectedVoiceId,
            name: "Selected Voice",
            isSelected: true,
          }
        : null,

      mediaLibrary: mediaItems
        .map((item) => {
          // Save all media items including text items with their properties
          const savedItem: any = {
            id: item.id,
            name: item.name,
            type: item.type,
            duration: item.duration,
            filePath: item.filePath, // Keep filesystem path
            text: item.text || "",
            // **PROPERLY SAVE THUMBNAILS** - Save data URLs, not blob URLs or file paths
            thumbnailUrl:
              item.thumbnailUrl && item.thumbnailUrl.startsWith("data:")
                ? item.thumbnailUrl // Save persistent data URL thumbnails
                : "", // Don't save blob URLs or file paths as thumbnails
            previewUrl: "", // Always reset preview URLs - they'll be regenerated on load
          };

          // 📝 SAVE TEXT-SPECIFIC PROPERTIES for text items
          if (item.type === "text") {
            savedItem.fontFamily = item.fontFamily || "Arial";
            savedItem.fontSize = item.fontSize || 48;
            savedItem.fontBold = item.fontBold || false;
            savedItem.fontItalic = item.fontItalic || false;
            savedItem.fontColor = item.fontColor || "#ffffff";
            savedItem.backgroundColor = item.backgroundColor || "rgba(0, 0, 0, 0.7)";
            savedItem.backgroundTransparent = item.backgroundTransparent ?? false;
            // Save geometry properties if they exist
            if (item.x !== undefined) savedItem.x = item.x;
            if (item.y !== undefined) savedItem.y = item.y;
            if (item.width !== undefined) savedItem.width = item.width;
            if (item.height !== undefined) savedItem.height = item.height;
            
            console.log(`💾 SAVE TEXT: Saving text item "${item.name}" with font ${item.fontFamily}, size ${item.fontSize}`);
          }

          return savedItem;
        }),

      audioChunks: mediaItems
        .filter(
          (item): item is MediaItem & { type: "voiceover" } =>
            item.type === "voiceover"
        )
        .map((item) => {
          const timelineItem = timelineItems.find((t) => t.mediaId === item.id);
          return {
            id: item.id,
            name: item.name,
            text: item.text || "",
            duration: item.duration || 0,
            startTime: timelineItem?.startTime || 0,
            blobUrl: item.filePath,
            isGenerated: true,
            filePath: item.filePath,
          };
        }),

      layers: layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        type: layer.type,
        items: layer.items,
        duration: layer.duration,
      })),

      timeline: {
        totalDuration,
        currentTime,
        tracks: layers.map((layer) => ({
          id: layer.id,
          name: layer.name,
          type: layer.type || "main",
          items: layer.items.map((item) => ({
            ...item,
            track: item.track,
          })),
        })),
      },

      editorSettings: {
        selectedLayerId,
        volumeSettings: {
          voiceover: voiceoverVolume,
          footage: stockFootageVolume,
          soundtrack: soundtrackVolume,
        },
        videoStyle,
      },
    };

    onVideoAssetsUpdate(videoAssets);

    // CRITICAL: Pass transcript and stock media info to parent for database storage
    if (onTranscriptInfoUpdate && transcriptInfo) {
      onTranscriptInfoUpdate(transcriptInfo);
    }

    if (onStockMediaInfoUpdate && stockMediaInfo) {
      onStockMediaInfoUpdate(stockMediaInfo);
    }
  };

  useEffect(() => {
    const hasTranscriptItems = mediaItems.some(item => item.type === "text" || item.source === "transcript");
    if (!hasTranscriptItems) {
      setTranscriptRestored(false);
    }
  }, [savedVideoAssets, mediaItems]);
  const restoreVideoAssets = async () => {
    if (!savedVideoAssets) {
      return;
    }

    const storedTranscriptInfo = savedVideoAssets.transcriptInfo;

    if (initialStory?.sentenceTranscripts?.sentences?.length > 0) {
      try {
        // Get current canvas dimensions for text sizing
        const canvas = previewCanvasRef.current;
        const canvasWidth = canvas?.width || 1920;
        const canvasHeight = canvas?.height || 1080;

        // Create MediaItems for each saved sentence
        const restoredTextMediaItems: MediaItem[] =
          initialStory.sentenceTranscripts.sentences.map((sentence: any) => ({
            id: sentence.id,
            name: `Text: ${sentence.text.substring(0, 30)}${
              sentence.text.length > 30 ? "..." : ""
            }`,
            type: "text",
            duration: sentence.duration,
            filePath: "",
            text: sentence.text,
            // Restore default text styling
            fontFamily: "Arial",
            fontSize: Math.min(canvasWidth, canvasHeight) * 0.04,
            fontBold: false,
            fontItalic: false,
            fontColor: "#ffffff",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backgroundTransparent: false,
          }));

        // Create TimelineItems for each sentence
        const restoredTextTimelineItems: TimelineItem[] =
          initialStory.sentenceTranscripts.sentences.map((sentence: any) => {
            // Use default geometry for restored text (user can adjust as needed)
            const defaultGeometry = {
              x: canvasWidth * 0.1, // 10% from left
              y: canvasHeight * 0.8, // 80% from top (bottom area)
              width: canvasWidth * 0.8, // 80% width
              height: canvasHeight * 0.1, // 10% height
            };

            return {
              id: `timeline_${sentence.id}`,
              mediaId: sentence.id,
              startTime: sentence.startTime,
              duration: sentence.duration,
              track: 1, // Default to track 1 for text
              geometry: defaultGeometry,
            };
          });

        setMediaItems((prev) => {
          const existingTextIds = prev.filter(item => item.type === "text").map(item => item.id);
          const newTextItems = restoredTextMediaItems.filter(textItem => 
            !existingTextIds.includes(textItem.id)
          );
          if (newTextItems.length > 0) {
            return [...prev, ...newTextItems];
          }
          return prev;
        });

        // 📝 PREVENT DUPLICATES: Create or update text layer with restored items (check for duplicates)
        setLayers((prevLayers) => {
          const existingTextLayerIndex = prevLayers.findIndex(
            (layer) => layer.type === "text"
          );

          if (existingTextLayerIndex !== -1) {
            // Add to existing text layer (check for duplicates)
            const updatedLayers = [...prevLayers];
            const existingTextItemIds = updatedLayers[existingTextLayerIndex].items.map(item => item.id);
            const newTextTimelineItems = restoredTextTimelineItems.filter(textItem => 
              !existingTextItemIds.includes(textItem.id)
            );
            
            if (newTextTimelineItems.length > 0) {
            updatedLayers[existingTextLayerIndex] = {
              ...updatedLayers[existingTextLayerIndex],
              items: [
                ...updatedLayers[existingTextLayerIndex].items,
                  ...newTextTimelineItems,
              ],
            };
            }
            return updatedLayers;
          } else {
            // Create new text layer
            const newTextLayer: Layer = {
              id: `restored_text_layer_${Date.now()}`,
              name: "Text",
              type: "text",
              visible: true,
              locked: false,
              items: restoredTextTimelineItems,
            };
            return [...prevLayers, newTextLayer];
          }
        });

        setTimelineItems((prev) => {
          const existingTimelineIds = prev.map(item => item.id);
          const newTimelineItems = restoredTextTimelineItems.filter(textItem => 
            !existingTimelineIds.includes(textItem.id)
          );
          if (newTimelineItems.length > 0) {
            return [...prev, ...newTimelineItems];
          }
          return prev;
        });

        // Update total duration if needed
        const maxEndTime = Math.max(
          ...initialStory.sentenceTranscripts.sentences.map(
            (s: any) => s.endTime
          )
        );
        if (maxEndTime > totalDuration) {
          setTotalDuration(maxEndTime);
        }
        

      } catch (error) {
        // Handle error silently
      }
    }

    if (savedVideoAssets.stockMediaInfo) {
      // CRITICAL: Restore stock media data to UI with proper layer structure
      const stockMediaInfo = savedVideoAssets.stockMediaInfo;

      if (stockMediaInfo.items && stockMediaInfo.items.length > 0) {
        // Load stock media files as blob URLs
        const restoredStockItems: MediaItem[] = [];
        const restoredStockTimelineItems: TimelineItem[] = [];

        for (const stockItem of stockMediaInfo.items) {
          try {
            console.log(`🔄 Restoring stock media item: ${stockItem.id} (${stockItem.source})`);
            
            let filePath: string = "";
            let previewUrl: string = "";
            let thumbnailUrl: string = "";
            
            if (stockItem.source === "openai-dalle") {
              // For OpenAI images, they are now saved to Electron AppData directory
              // Check if we have a filesystem path or need to use the URL
              const filesystemPath = (stockItem as any).localFilePath || (stockItem as any).filePath;
              
              if (filesystemPath && !filesystemPath.startsWith('http')) {
                // Use the saved filesystem path - load from Electron AppData
                filePath = filesystemPath;
                try {
                  // Load the image from Electron AppData using mediaStorageService
                  const base64Url = await mediaStorageService.loadImageAsBase64(filesystemPath);
                  previewUrl = base64Url;
                  thumbnailUrl = base64Url;
                  console.log(`🖼️ OpenAI image: Loaded from Electron AppData - ${filesystemPath}`);
                } catch (error) {
                  console.warn(`⚠️ Failed to load OpenAI image from Electron AppData ${stockItem.id}:`, error);
                  // Fall back to base64 conversion if available
                  if (stockItem.url) {
                    try {
                      const base64Url = await convertUrlToBase64(stockItem.url);
                      previewUrl = base64Url;
                      thumbnailUrl = base64Url;
                    } catch (fallbackError) {
                      console.warn(`⚠️ Failed to convert OpenAI image URL to base64 ${stockItem.id}:`, fallbackError);
                      filePath = stockItem.url;
                      previewUrl = stockItem.url;
                      thumbnailUrl = stockItem.url;
                    }
                  }
                }
              } else if (filesystemPath && filesystemPath.startsWith('http') && filesystemPath.includes('localhost:5555/api/media/openai-image')) {
                // Old backend URL - try to convert to base64
                try {
                  const base64Url = await convertUrlToBase64(filesystemPath);
                  filePath = filesystemPath; // Keep original URL for reference
                  previewUrl = base64Url;
                  thumbnailUrl = base64Url;
                  console.log(`🖼️ OpenAI image: Converted old backend URL to base64 - ${base64Url.substring(0, 50)}...`);
                } catch (error) {
                  console.warn(`⚠️ Failed to convert old backend URL to base64 ${stockItem.id}:`, error);
                  filePath = filesystemPath;
                  previewUrl = filesystemPath;
                  thumbnailUrl = filesystemPath;
                }
              } else {
                // No filesystem path, convert URL to base64
                try {
                  const base64Url = await convertUrlToBase64(stockItem.url);
                  filePath = stockItem.url; // Keep original URL for reference
                  previewUrl = base64Url;
                  thumbnailUrl = base64Url;
                  console.log(`🖼️ OpenAI image: Converted URL to base64 - ${base64Url.substring(0, 50)}...`);
                } catch (error) {
                  console.warn(`⚠️ Failed to convert OpenAI image to base64 ${stockItem.id}:`, error);
                  // Fall back to direct URL (may cause CORS issues)
                  filePath = stockItem.url;
                  previewUrl = stockItem.url;
                  thumbnailUrl = stockItem.url;
                }
              }
            } else {
              // For legacy items, try to load from file path
              try {
                const localFilePath = (stockItem as any).localFilePath || stockItem.url;
                if (localFilePath.startsWith('http')) {
                  // Network URL - convert to base64
                  try {
                    const base64Url = await convertUrlToBase64(localFilePath);
                    filePath = localFilePath; // Keep original URL for reference
                    previewUrl = base64Url;
                    thumbnailUrl = base64Url;
                  } catch (error) {
                    console.warn(`⚠️ Failed to convert legacy URL to base64 ${stockItem.id}:`, error);
                    filePath = localFilePath;
                    previewUrl = localFilePath;
                    thumbnailUrl = localFilePath;
                  }
                } else {
                  // Filesystem path - load as base64
                  const base64Url = await mediaStorageService.loadImageAsBase64(localFilePath);
                  filePath = localFilePath;
                  previewUrl = base64Url;
                  thumbnailUrl = base64Url;
                }
                console.log(`🖼️ Legacy image: Loaded from filesystem - ${localFilePath}`);
              } catch (error) {
                console.warn(`⚠️ Failed to load legacy image ${stockItem.id}:`, error);
                // Use URL as fallback
                filePath = stockItem.url;
                previewUrl = stockItem.url;
                thumbnailUrl = stockItem.url;
              }
            }

            // Create MediaItem with proper URLs
            const restoredMediaItem: MediaItem = {
              id: stockItem.id,
              name: stockItem.name,
              type: stockItem.type,
              source: stockItem.source || "unknown",
              filePath: filePath,
              previewUrl: previewUrl,
              thumbnailUrl: thumbnailUrl,
              duration: stockItem.duration || 0,
              width: stockItem.width || 0,
              height: stockItem.height || 0,
              volume: 60,
              // Handle legacy Pexels properties
              pexelsId: (stockItem as any).pexelsId ? Number((stockItem as any).pexelsId) : undefined,
              photographer: (stockItem as any).photographer,
              searchQuery: stockItem.searchQuery,
            };

            // Create TimelineItem
            const restoredTimelineItem: TimelineItem = {
              id: `timeline-stock-${stockItem.id}`,
              startTime: stockItem.startTime,
              duration: stockItem.duration || 0,
              mediaId: stockItem.id,
              track: 0, // Default track for restored items
            };

            restoredStockItems.push(restoredMediaItem);
            restoredStockTimelineItems.push(restoredTimelineItem);
          } catch {
            continue;
          }
        }

        if (restoredStockItems.length > 0) {
          // 🔒 PREVENT DUPLICATES: Add stock items to media library only if they don't already exist
          setMediaItems((prev) => {
            const existingIds = prev.map(item => item.id);
            const newStockItems = restoredStockItems.filter(item => 
              !existingIds.includes(item.id)
            );
            
            if (newStockItems.length > 0) {
              return [...prev, ...newStockItems];
            } else {
              return prev;
            }
          });

          // Create or update stock media layer
          const stocksLayerId = "stocks-layer";
          setLayers((prev) => {
            const updated = [...prev];
            const existingStocksLayerIndex = updated.findIndex(
              (layer) => layer.id === stocksLayerId
            );

            if (existingStocksLayerIndex >= 0) {
              // 🔒 PREVENT DUPLICATES: Update existing stocks layer without duplicating timeline items
              const existingItemIds = updated[existingStocksLayerIndex].items.map(item => item.id);
              const newTimelineItems = restoredStockTimelineItems.filter(item => 
                !existingItemIds.includes(item.id)
              );
              
              if (newTimelineItems.length > 0) {
              updated[existingStocksLayerIndex] = {
                ...updated[existingStocksLayerIndex],
                items: [
                  ...updated[existingStocksLayerIndex].items,
                    ...newTimelineItems,
                ],
                duration: Math.max(
                  updated[existingStocksLayerIndex].duration ?? 0,
                  Math.max(...stockMediaInfo.items.map((item) => item.endTime))
                ),
              };
              }
            } else {
              // Create new stocks layer
              const newStocksLayer: Layer = {
                id: stocksLayerId,
                name: "Stock Media",
                visible: true,
                locked: false,
                items: restoredStockTimelineItems,
                type: "footage",
                duration: Math.max(
                  ...stockMediaInfo.items.map((item) => item.endTime)
                ),
              };

              // Add the stocks layer at the top
              updated.unshift(newStocksLayer);
            }

            return updated;
          });

          setTimelineItems((prev) => {
            const existingIds = prev.map(item => item.id);
            const newTimelineItems = restoredStockTimelineItems.filter(item => 
              !existingIds.includes(item.id)
            );
            
            if (newTimelineItems.length > 0) {
              return [...prev, ...newTimelineItems];
            } else {
              return prev;
            }
          });

          // Load media elements for stock items

          for (const mediaItem of restoredStockItems) {
            try {
              await loadMediaElement(mediaItem);
            } catch (error) {
              // Handle error silently
            }
          }

          // Update total duration if stock media extends timeline
          const maxStockEndTime = Math.max(
            ...stockMediaInfo.items.map((item) => item.endTime)
          );
          if (maxStockEndTime > totalDuration) {
            setTotalDuration(maxStockEndTime);
          }

          // Force UI re-render after stock media restoration
          setTimeout(() => {
            renderPreviewFrame(currentTime);
            setCurrentTime(currentTime + 0.001);
            setTimeout(() => {
              setCurrentTime(currentTime);
            }, 100);
          }, 1000);
        } else {
        }
      } else {
      }
    }
    try {
      setIsLoading(true);

      if (savedVideoAssets.mediaLibrary?.length) {
        const restoredMedia = await Promise.all(
          savedVideoAssets.mediaLibrary.map(
            async (item: SavedMediaItem) => {
              let filePath = item.filePath;
              let thumbnailUrl = item.thumbnailUrl;
              let previewUrl = item.previewUrl;

              // If this is a filesystem path, convert it to blob URL for browser use
              if (
                !filePath.startsWith("blob:") &&
                (item.type === "image" || item.type === "video")
              ) {
                try {
                  const { mediaStorageService } = await import(
                    "../../lib/mediaStorage"
                  );

                  // Create blob URL from filesystem path for preview
                  const blobUrl = await mediaStorageService.loadMediaFile(
                    filePath
                  );

                  // Use blob URL for preview, but preserve existing thumbnails
                  previewUrl = blobUrl;

                  // **DON'T overwrite existing valid thumbnails with blob URLs**
                  // Only update thumbnail if it's invalid or doesn't exist
                  if (!thumbnailUrl || thumbnailUrl.startsWith("blob:")) {
                    if (item.type === "video") {
                      // Regenerate thumbnail from video file
                      try {
                        thumbnailUrl = await generateVideoThumbnail(blobUrl);
                      } catch (error) {
                        console.warn(`⚠️ Failed to generate video thumbnail for ${item.id}:`, error);
                        thumbnailUrl = ""; // Empty string will show default video icon
                      }
                    } else {
                      // For images, use base64 instead of local file URL
                      try {
                        thumbnailUrl = await loadImageAsBase64(filePath);
                      } catch (error) {
                        console.warn(`⚠️ Base64 failed for stock image ${item.id}, using blob URL:`, error);
                        thumbnailUrl = blobUrl; // Use blob URL as fallback instead of local file URL
                      }
                    }
                  }
                  // If thumbnailUrl is already a data URL, keep it!
                } catch (error) {
                  console.warn(
                    `Failed to create blob URL for media item ${item.id}:`,
                    error
                  );
                  // Keep original paths as fallback
                  previewUrl = filePath;
                  // Don't overwrite valid thumbnails on error
                  if (!thumbnailUrl || thumbnailUrl.startsWith("blob:")) {
                    thumbnailUrl = filePath;
                  }
                }
              } else if (filePath.startsWith("blob:")) {
                // This is an old saved blob URL - it won't work
                console.warn(
                  `Found old blob URL for ${item.id}, attempting to regenerate...`
                );

                // Try to regenerate from saved filesystem path if available
                if (item.filePath && !item.filePath.startsWith("blob:")) {
                  try {
                    const { mediaStorageService } = await import(
                      "../../lib/mediaStorage"
                    );
                    const newBlobUrl = await mediaStorageService.loadMediaFile(
                      item.filePath
                    );
                    previewUrl = newBlobUrl;

                    // Regenerate thumbnail if needed
                    if (!thumbnailUrl || thumbnailUrl.startsWith("blob:")) {
                      if (item.type === "video") {
                        try {
                          thumbnailUrl = await generateVideoThumbnail(newBlobUrl);
                        } catch (error) {
                          console.warn(`⚠️ Failed to regenerate video thumbnail for ${item.id}:`, error);
                          thumbnailUrl = ""; // Empty string will show default video icon
                        }
                      } else {
                        thumbnailUrl = newBlobUrl;
                      }
                    }
                  } catch (error) {
                    console.warn(
                      `Failed to regenerate blob URL for ${item.id}:`,
                      error
                    );
                    previewUrl = filePath;
                    thumbnailUrl = thumbnailUrl || filePath;
                  }
                } else {
                  previewUrl = filePath;
                  thumbnailUrl = thumbnailUrl || filePath;
                }
              }

              const restoredItem = {
                ...item,
                filePath, // Keep original filesystem path for rendering
                thumbnailUrl, // Blob URL for browser display
                previewUrl, // Blob URL for browser display
              } as MediaItem;

              // 📝 LOG TEXT RESTORATION for debugging
              if (item.type === "text") {
                console.log(`📖 RESTORE TEXT: Loading text item "${item.name}"`, {
                  text: item.text,
                  fontFamily: item.fontFamily,
                  fontSize: item.fontSize,
                  fontColor: item.fontColor,
                  backgroundColor: item.backgroundColor,
                  geometry: {
                    x: item.x,
                    y: item.y,
                    width: item.width,
                    height: item.height
                  }
                });
              }

              return restoredItem;
            }
          )
        );

        const validMediaItems = restoredMedia.filter(
          (item): item is MediaItem => item !== null
        );

        // 📝 LOG TEXT ITEMS BEING RESTORED FROM DATABASE
        const restoredTextItems = validMediaItems.filter(item => item.type === "text");
        if (restoredTextItems.length > 0) {
          console.log(`📖 RESTORE FROM DB: Loading ${restoredTextItems.length} text items from database:`, 
            restoredTextItems.map(item => ({
              id: item.id,
              name: item.name,
              text: item.text?.substring(0, 50) + (item.text && item.text.length > 50 ? "..." : ""),
              fontFamily: item.fontFamily,
              fontSize: item.fontSize
            }))
          );
        }

        // 📝 PRESERVE EXISTING LIFTED STATE: Add media items only if they don't already exist
        setMediaItems(prev => {
          if (prev.length === 0) {
            // No existing items, use all restored items
            console.log(`📁 RESTORE MEDIA: Setting ${validMediaItems.length} restored media items (fresh restore)`);
            return validMediaItems;
          } else {
            // Preserve existing items, only add missing ones
            const existingIds = prev.map(item => item.id);
            const newMediaItems = validMediaItems.filter(item => 
              !existingIds.includes(item.id)
            );
            if (newMediaItems.length > 0) {
              console.log(`📁 PRESERVE MEDIA: Adding ${newMediaItems.length} missing media items to existing ${prev.length} items`);
              return [...prev, ...newMediaItems];
            } else {
              console.log(`📁 PRESERVE MEDIA: All ${validMediaItems.length} media items already exist, preserving lifted state`);
              return prev;
            }
          }
        });
        
        // CRITICAL: Load media elements for restored media library items
        console.log("📁 LOADING: Loading media elements for restored media library items...");
        for (const mediaItem of validMediaItems) {
          // Skip text items as they don't need to be loaded into refs
          if (mediaItem.type === "text") {
            console.log(`📝 SKIP LOAD: Text item ${mediaItem.id} doesn't need loading (rendered directly)`);
            continue;
          }
          
          try {
            await loadMediaElement(mediaItem);
            console.log(`✅ LOADED: Successfully loaded media element for ${mediaItem.id} (${mediaItem.type})`);
          } catch (error) {
            console.error(`❌ LOAD FAIL: Failed to load media element for ${mediaItem.id}:`, error);
          }
        }
      }

      // 📝 PRESERVE EXISTING LIFTED STATE: Restore layers and timeline items
      if (savedVideoAssets.layers?.length) {
        console.log(`📚 RESTORE: Found ${savedVideoAssets.layers.length} layers to restore`);
        console.log("📚 RESTORE: Layers:", savedVideoAssets.layers.map(layer => ({
          id: layer.id,
          name: layer.name,
          type: layer.type,
          itemsCount: layer.items?.length || 0,
          items: layer.items?.map(item => ({
            id: item.id,
            mediaId: item.mediaId,
            startTime: item.startTime,
            duration: item.duration
          })) || []
        })));
        setLayers(prev => {
          if (prev.length <= 1) { // Only voice layer exists
            // No user layers, use restored layers
            console.log(`📚 RESTORE LAYERS: Setting ${savedVideoAssets.layers!.length} restored layers (fresh restore)`);
            return savedVideoAssets.layers!;
          } else {
            // Preserve existing user layers, merge with restored layers
            console.log(`📚 PRESERVE LAYERS: Merging ${savedVideoAssets.layers!.length} restored layers with ${prev.length} existing layers`);
            const merged = [...prev];
            
            savedVideoAssets.layers!.forEach(restoredLayer => {
              const existingIndex = merged.findIndex(layer => layer.id === restoredLayer.id);
              if (existingIndex >= 0) {
                // Update existing layer
                merged[existingIndex] = restoredLayer;
              } else {
                // Add new layer
                merged.push(restoredLayer);
              }
            });
            
            return merged;
          }
        });

        // Extract all timeline items from layers and set timelineItems state
        const allTimelineItems: TimelineItem[] = [];
        savedVideoAssets.layers.forEach((layer) => {
          if (layer.items) {
            allTimelineItems.push(...layer.items);
          }
        });
        
        setTimelineItems(prev => {
          if (prev.length === 0) {
            // No existing timeline items, use restored items
            console.log(`⏰ RESTORE TIMELINE: Setting ${allTimelineItems.length} restored timeline items (fresh restore)`);
            return allTimelineItems;
          } else {
            // Preserve existing items, merge with restored items
            const existingIds = prev.map(item => item.id);
            const newTimelineItems = allTimelineItems.filter(item => 
              !existingIds.includes(item.id)
            );
            if (newTimelineItems.length > 0) {
              console.log(`⏰ PRESERVE TIMELINE: Adding ${newTimelineItems.length} restored timeline items to existing ${prev.length} items`);
              return [...prev, ...newTimelineItems];
            } else {
              console.log(`⏰ PRESERVE TIMELINE: All ${allTimelineItems.length} timeline items already exist, preserving lifted state`);
              return prev;
            }
          }
        });

        // CRITICAL: Restore transcript data AFTER layer restoration to prevent override
        if (storedTranscriptInfo) {
          console.log("📝 RESTORE: Found stored transcript info, attempting restoration...");
          const transcriptInfo = storedTranscriptInfo;

          if (
            transcriptInfo.audioChunks &&
            transcriptInfo.audioChunks.length > 0
          ) {
            // Check if transcript items already exist to prevent duplicate restoration
            const transcriptChunkIds = transcriptInfo.audioChunks.map(
              (chunk) => chunk.id
            );
            const existingTranscriptItems = mediaItems.filter(
              (item) =>
                item.source === "transcript" &&
                transcriptChunkIds.includes(item.id)
            );

            // Only skip if we have ALL the transcript items AND transcriptRestored is true
            if (
              existingTranscriptItems.length === transcriptInfo.audioChunks.length &&
              transcriptRestored
            ) {
              console.log("📝 RESTORE: Transcript items already exist and transcriptRestored is true, skipping restoration");
              return;
            }

            // Create voice MediaItems from restored transcript audio chunks
            const restoredVoiceItems: MediaItem[] =
              transcriptInfo.audioChunks.map((chunk, index) => ({
                id: chunk.id,
                name: chunk.name || `Audio Part ${index + 1}`,
                type: "voiceover" as const,
                source: "transcript" as const,
                filePath: chunk.filePath,
                previewUrl: chunk.filePath,
                thumbnailUrl: "",
                duration: chunk.duration,
                width: 0,
                height: 0,
                volume: transcriptInfo.voiceoverSettings?.volume || 80,
                text: chunk.text,
                startTime: chunk.startTime,
              }));

            // Create voice TimelineItems for the voice layer
            const restoredVoiceTimelineItems: TimelineItem[] =
              transcriptInfo.audioChunks.map((chunk) => ({
                id: `timeline-voice-${chunk.id}`,
                startTime: chunk.startTime,
                duration: chunk.duration,
                mediaId: chunk.id,
                track: 0, // Voice track
              }));

            // Add voice items to media library (with deduplication)
            setMediaItems((prev) => {
              // Filter out items that already exist to prevent duplicates
              const existingIds = new Set(prev.map((item) => item.id));
              const newVoiceItems = restoredVoiceItems.filter(
                (item) => !existingIds.has(item.id)
              );

              if (newVoiceItems.length === 0) {
                return prev;
              }

              const newItems = [...prev, ...newVoiceItems];

              return newItems;
            });

            // Update the voice layer with restored timeline items (with deduplication)
            setLayers((prev) => {
              const updated = [...prev];
              const voiceLayerIndex = updated.findIndex(
                (layer) => layer.type === "voiceover"
              );

              if (voiceLayerIndex >= 0) {
                // Filter out timeline items that already exist in the voice layer
                const existingItemIds = new Set(
                  updated[voiceLayerIndex].items.map((item) => item.id)
                );
                const newTimelineItems = restoredVoiceTimelineItems.filter(
                  (item) => !existingItemIds.has(item.id)
                );

                if (newTimelineItems.length === 0) {
                  return updated;
                }

                updated[voiceLayerIndex] = {
                  ...updated[voiceLayerIndex],
                  items: [
                    ...updated[voiceLayerIndex].items,
                    ...newTimelineItems,
                  ],
                  duration: Math.max(
                    updated[voiceLayerIndex].duration ?? 0,
                    transcriptInfo.totalAudioDuration ?? 0
                  ),
                };
              } else {
                // Create voice layer if it doesn't exist
                const newVoiceLayer: Layer = {
                  id: "voice-layer",
                  name: "Voice Over",
                  visible: true,
                  locked: false,
                  items: restoredVoiceTimelineItems,
                  type: "voiceover",
                  duration: transcriptInfo.totalAudioDuration || 0,
                };
                updated.push(newVoiceLayer);
              }

              return updated;
            });

            // Update timeline items by reconstructing from layers (including our new voice layer)
            setLayers((currentLayers) => {
              const allTimelineItemsWithTranscripts = currentLayers.flatMap(
                (layer) =>
                  layer.items.map((item) => ({
                    ...item,
                    track: currentLayers.indexOf(layer),
                  }))
              );

              const voiceLayer = currentLayers.find(
                (l) => l.type === "voiceover"
              );
              if (voiceLayer) {
              } else {
              }

              setTimelineItems(allTimelineItemsWithTranscripts);

              return currentLayers; // Return unchanged layers
            });

            // Load audio elements for transcript chunks

            for (const mediaItem of restoredVoiceItems) {
              try {
                await loadMediaElement(mediaItem);
              } catch (error) {
                console.error(
                  "❌ Failed to load voice audio element",
                  mediaItem.id,
                  error
                );
              }
            }

            // Update total duration if transcript is longer
            if (
              transcriptInfo.totalAudioDuration &&
              transcriptInfo.totalAudioDuration > totalDuration
            ) {
              setTotalDuration(transcriptInfo.totalAudioDuration);
            }

            // Force UI re-render after transcript restoration
            setTimeout(() => {
              renderPreviewFrame(currentTime);
              setCurrentTime(currentTime + 0.001);
              setTimeout(() => {
                setCurrentTime(currentTime);
              }, 100);
            }, 500);

            // Mark transcript restoration as completed to prevent duplicates
            setTranscriptRestored(true);
          } else {
          }
        } else {
        }
      }

      // Restore editor settings with optional chaining
      const settings = savedVideoAssets.editorSettings;
      if (settings) {
        // Restore volume settings with defaults
        setVoiceoverVolume(settings.volumeSettings?.voiceover ?? 80);
        setStockFootageVolume(settings.volumeSettings?.footage ?? 60);
        setSoundtrackVolume(settings.volumeSettings?.soundtrack ?? 40);

        // Restore selected layer if valid
        if (settings.selectedLayerId) {
          setSelectedLayerId(settings.selectedLayerId);
        }
      }

      // Restore timeline state with defaults
      const timeline = savedVideoAssets.timeline;
      if (timeline) {
        setTotalDuration(timeline.totalDuration ?? 0);
        setCurrentTime(timeline.currentTime ?? 0);
      }

      // Restore audio chunks
      if (savedVideoAssets.audioChunks?.length) {
      }

      // CRITICAL: Force a final render after all restoration is complete
      console.log("🎨 FINAL RENDER: Triggering final render after restoration...");
      setTimeout(() => {
        if (canvasInitializedRef.current) {
          renderPreviewFrame(currentTime, 0);
          console.log("✅ FINAL RENDER: Final render completed");
        } else {
          console.warn("⚠️ FINAL RENDER: Canvas not initialized, skipping final render");
        }
      }, 500);

      console.log("✅ RESTORE: Video assets restoration completed successfully");
      setIsLoading(false);
      setIsRestoringVideoAssets(false);
    } catch (error) {
      console.error("❌ RESTORE: Error restoring video assets:", error);
      setError("Failed to restore video assets");
      setIsLoading(false);
      setIsRestoringVideoAssets(false);
    }
  };

  // Call restoreVideoAssets when component mounts and savedVideoAssets changes
  useEffect(() => {
    if (savedVideoAssets && !audioRestored && !isRestoringAudio && !isRestoringVideoAssets) {
      // Remove transcriptRestored condition to allow initial restoration
      console.log("🔄 RESTORE: Starting video assets restoration...");
      setIsRestoringVideoAssets(true);
      restoreVideoAssets();
    }
  }, [savedVideoAssets, audioRestored, isRestoringAudio, isRestoringVideoAssets]);

  // Auto-save video assets when relevant state changes
  useEffect(() => {
    if (
      mediaItems.length > 0 ||
      timelineItems.length > 0 ||
      layers.length > 0
    ) {
      saveVideoAssets();
    }
  }, [
    mediaItems,
    timelineItems,
    layers,
    selectedLayerId,
    voiceoverVolume,
    stockFootageVolume,
    soundtrackVolume,
    totalDuration,
    videoStyle, // Added videoStyle to ensure it's saved when changed
  ]);

  // Separate effect for timeline position (save less frequently to avoid performance issues)
  useEffect(() => {
    if (currentTime > 0 && !isPlaying) {
      // Only save timeline position when not playing and after a delay
      const timeoutId = setTimeout(() => {
        saveVideoAssets();
      }, 1000); // Debounce by 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [currentTime, isPlaying]);

  // Keep timelineItems in sync with layers as a safety measure - OPTIMIZED: prevent infinite loops
  useEffect(() => {
    const allTimelineItems: TimelineItem[] = [];
    layers.forEach((layer) => {
      if (layer.items) {
        allTimelineItems.push(...layer.items);
      }
    });

    // Only update if different to avoid infinite loops - use deep comparison
    const currentItemsString = JSON.stringify(timelineItems);
    const newItemsString = JSON.stringify(allTimelineItems);
    
    if (currentItemsString !== newItemsString) {
      setTimelineItems(allTimelineItems);
    }
  }, [layers]); // REMOVED: timelineItems dependency to prevent infinite loops

  // Re-render preview when selection changes or layers change - OPTIMIZED: removed currentTime dependency
  useEffect(() => {
    // Only render if canvas is initialized
    if (canvasInitializedRef.current) {
      renderPreviewFrame(currentTime);
      setCanvasCursor("default");
    }
  }, [selectedTimelineItem, layers]); // REMOVED: currentTime dependency to prevent frequent re-renders
  
  // Handle time changes with debouncing to prevent excessive re-renders
  useEffect(() => {
    // Only render if canvas is initialized
    if (canvasInitializedRef.current) {
      const timeoutId = setTimeout(() => {
        renderPreviewFrame(currentTime);
      }, 50); // Debounce time changes to prevent excessive re-renders
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentTime]);

  // Periodic canvas health check to detect and recover from canvas issues
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      if (canvasInitializedRef.current && !checkCanvasHealth()) {
        console.warn("🔄 Periodic health check: Canvas is unhealthy, attempting recovery...");
        canvasInitializedRef.current = false;
        
        // Re-initialize canvas
        setTimeout(() => {
          initializePreview();
          renderPreviewFrame(currentTime);
        }, 100);
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(healthCheckInterval);
  }, [currentTime]);

  // Ensure indicator position is properly calculated when time ruler or duration changes
  useEffect(() => {
    if (timeRulerRef.current && totalDuration > 0) {
      const rulerWidth = timeRulerRef.current.clientWidth;
      const newPosition = (currentTime / totalDuration) * rulerWidth;
      setIndicatorPosition(newPosition);
    }
  }, [currentTime, totalDuration]);

  // Auto-scroll timeline to keep time indicator visible during playback
  const autoScrollTimeline = () => {
    if (!timelineContainerRef.current || !timeRulerRef.current || !isPlaying) return;
    
    const container = timelineContainerRef.current;
    const ruler = timeRulerRef.current;
    const containerWidth = container.clientWidth;
    const rulerWidth = ruler.clientWidth;
    
    // Calculate the current position of the time indicator
    const indicatorPosition = (currentTime / totalDuration) * rulerWidth;
    
    // Calculate the scroll position to keep the indicator visible
    const scrollLeft = container.scrollLeft;
    const indicatorLeft = indicatorPosition;
    
    // Define the visible area (keep indicator in the middle 60% of the viewport)
    const visibleStart = scrollLeft + containerWidth * 0.2; // 20% from left
    const visibleEnd = scrollLeft + containerWidth * 0.8;   // 80% from left
    
    // Check if indicator is outside the visible area
    if (indicatorLeft < visibleStart || indicatorLeft > visibleEnd) {
      // Calculate new scroll position to center the indicator
      const newScrollLeft = indicatorLeft - containerWidth * 0.5;
      
      // Smooth scroll to the new position with a small delay to prevent excessive scrolling
      setTimeout(() => {
        container.scrollTo({
          left: Math.max(0, newScrollLeft),
          behavior: 'smooth'
        });
      }, 100); // Small delay to prevent rapid scrolling
    }
  };
  
  // Handle keyboard shortcuts for selection and manipulation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedTimelineItem) return;

      switch (event.key) {
        case "Delete":
        case "Backspace":
          event.preventDefault();
          handleRemoveTimelineItem(selectedTimelineItem.id);
          setSelectedTimelineItem(null);
          break;
        case "Escape":
          event.preventDefault();
          setSelectedTimelineItem(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTimelineItem]);

  const playTimeline = async () => {
    setIsPlaying(true);

    const activeAudios: HTMLAudioElement[] = [];
    const activeVideos: HTMLVideoElement[] = [];

    // Debug: Log current state

    // Find and start all active media for the current time
    for (const layer of layers) {
      if (!layer.visible) continue;

      for (const item of layer.items) {
        const isActive =
          currentTime >= item.startTime &&
          currentTime < item.startTime + item.duration;

        if (isActive) {
          const mediaItem = mediaItems.find((m) => m.id === item.mediaId);

          if (!mediaItem) {
            console.warn(
              `❌ Media item not found for mediaId: ${item.mediaId}`
            );

            continue;
          }

          if (mediaItem.type === "video") {
            const video = (await loadMediaElement(
              mediaItem
            )) as HTMLVideoElement;
            if (video) {
              // Apply volume before playing
              const individualVolume = mediaItem.volume || 100;
              const globalVolume = stockFootageVolume;
              video.volume = mediaItem.muted
                ? 0
                : (individualVolume * globalVolume) / 10000;

              const videoOffset = currentTime - item.startTime;
              video.currentTime = videoOffset;
              await video.play();
              activeVideos.push(video); // Track video for continuous management
            }
          } else if (
            mediaItem.type === "voiceover" ||
            mediaItem.type === "audio"
          ) {
            try {
              const audio = await loadAudioForPlayback(mediaItem.id);
              if (audio) {
                // Apply volume before playing
                const individualVolume = mediaItem.volume || 100;
                let globalVolume = 100;
                if (mediaItem.type === "voiceover") {
                  globalVolume = voiceoverVolume;
                } else if (mediaItem.type === "audio") {
                  globalVolume = soundtrackVolume;
                }
                audio.volume = mediaItem.muted
                  ? 0
                  : (individualVolume * globalVolume) / 10000;

                const audioOffset = currentTime - item.startTime;
                audio.currentTime = audioOffset;
                await audio.play();
                activeAudios.push(audio);

                // If this is a voiceover paragraph, pause at the end of the clip
                if (mediaItem.type === "voiceover") {
                  audio.onended = () => {
                    const endTime = item.startTime + item.duration;
                    // Determine if the next voiceover item is contiguous (same paragraph)
                    const nextItem = findNextAudioItem(item);
                    const gapThresholdSeconds = 0.2; // treat <=200ms gap as continuous
                    if (
                      nextItem &&
                      Math.abs(nextItem.startTime - endTime) <= gapThresholdSeconds
                    ) {
                      // Continue playing seamlessly into the next chunk
                      startNextAudioItem(nextItem);
                      return;
                    }

                    // Otherwise, stop at the end of the paragraph boundary
                    setCurrentTime(endTime);
                    pausedTimeRef.current = endTime;
                    if (timeRulerRef.current && totalDuration > 0) {
                      const rulerWidth = timeRulerRef.current.clientWidth;
                      const newPosition = (endTime / totalDuration) * rulerWidth;
                      setIndicatorPosition(newPosition);
                    }
                    pauseTimeline();
                  };
                }
              } else {
                console.warn(
                  `❌ Failed to load audio element for: ${mediaItem.id}`
                );
              }
            } catch (error) {
              console.error(
                `❌ Error loading audio for ${mediaItem.id}:`,
                error
              );
            }
          }
        }
      }
    }

    setCurrentlyPlayingAudios(activeAudios);
    setCurrentlyPlayingVideos(activeVideos);
    startTimeRef.current = performance.now();
    timeUpdateLoopRef.current = requestAnimationFrame(() =>
      updateTimeDisplay(isPlaying)
    );
  };

  // Update time from mouse position
  const updateTimeFromMousePosition = async (
    event: React.MouseEvent<HTMLDivElement> | MouseEvent
  ) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const labelWidth = 96;
    const timelineWidth = rect.width - labelWidth;

    const x = event.clientX - rect.left - labelWidth;
    if (x < 0) return;

    const percentage = Math.max(0, Math.min(x / timelineWidth, 1));
    const newTime = percentage * totalDuration;
    const clampedTime = Math.max(0, Math.min(newTime, totalDuration));

    // Update time
    setCurrentTime(clampedTime);
    return clampedTime;
  };

  // Remove old time update mechanisms that were causing sync issues
  useEffect(() => {
    return () => {
      currentlyPlayingAudios.forEach((audio) => {
        const clone = audio.cloneNode() as HTMLAudioElement;
        audio.parentNode?.replaceChild(clone, audio);
        clone.pause();
      });
    };
  }, []);

  
  // Global mouse events for dragging
  React.useEffect(() => {
    const handleMouseMove = async (event: MouseEvent) => {
      if (isDragging && timelineRef.current) {
        const wasPlaying = isPlaying;
        if (wasPlaying) {
          pauseTimeline();
        }

        await updateTimeFromMousePosition(event);

        if (wasPlaying) {
          await playTimeline();
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isPlaying]);
  // Cleanup time update mechanisms when component unmounts or playback stops
  useEffect(() => {
    if (!isPlaying) {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    }

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [isPlaying]);

  // Handle escape key to cancel dragging
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape" && draggedTimelineItem) {
        setPreviewDragPosition(null);
        setDraggedTimelineItem(null);
        if (dragUpdateThrottleRef.current) {
          cancelAnimationFrame(dragUpdateThrottleRef.current);
          dragUpdateThrottleRef.current = null;
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [draggedTimelineItem]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeUpdateLoopRef.current) {
        cancelAnimationFrame(timeUpdateLoopRef.current);
        timeUpdateLoopRef.current = null;
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      // Clean up drag preview
      if (dragUpdateThrottleRef.current) {
        cancelAnimationFrame(dragUpdateThrottleRef.current);
        dragUpdateThrottleRef.current = null;
      }
    };
  }, []);

  // Calculate pixels per second for smooth movement
  const getPixelsPerSecond = () => {
    if (!timeRulerRef.current) {
      // Fallback calculation when DOM element is not available
      // Use a reasonable default width (e.g., 800px) for initial calculation
      const defaultRulerWidth = 800;
      return (defaultRulerWidth / totalDuration) * timelineScale;
    }
    const rulerWidth = timeRulerRef.current.clientWidth;
    return (rulerWidth / totalDuration) * timelineScale;
  };

  // Cache for ruler spacing to prevent changes during interactions
  const rulerSpacingCache = useRef<number | null>(null);
  const lastTimelineScale = useRef<number>(timelineScale);
  const lastTotalDuration = useRef<number>(totalDuration);
  const lastRulerWidth = useRef<number>(0);

  // Force recalculation when ruler element becomes available
  useEffect(() => {
    if (timeRulerRef.current && timeRulerRef.current.clientWidth !== lastRulerWidth.current) {
      lastRulerWidth.current = timeRulerRef.current.clientWidth;
      // Clear cache to force recalculation with actual ruler width
      rulerSpacingCache.current = null;
    }
  }, [timeRulerRef.current?.clientWidth]);

  // Calculate dynamic ruler spacing based on zoom level (pixels per second)
  const getRulerSpacing = () => {
    // Check if we need to recalculate (timeline scale or duration changed)
    if (
      rulerSpacingCache.current === null ||
      lastTimelineScale.current !== timelineScale ||
      lastTotalDuration.current !== totalDuration
    ) {
      const pixelsPerSecond = getPixelsPerSecond();
      const minPixelSpacing = 50; // Minimum pixels between ruler marks
      const maxPixelSpacing = 100; // Maximum pixels between ruler marks
      
      // Calculate the maximum time interval that would fit within maxPixelSpacing
      const maxTimeInterval = maxPixelSpacing / pixelsPerSecond;
      
      // Define available intervals from finest to coarsest (in seconds)
      const intervals = [
        0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600
      ];
      
      // Find the finest interval that's <= maxTimeInterval and >= minTimeInterval
      const minTimeInterval = minPixelSpacing / pixelsPerSecond;
      
      for (const interval of intervals) {
        const actualPixelSpacing = interval * pixelsPerSecond;
        if (actualPixelSpacing >= minPixelSpacing && actualPixelSpacing <= maxPixelSpacing) {
          rulerSpacingCache.current = interval;
          lastTimelineScale.current = timelineScale;
          lastTotalDuration.current = totalDuration;
          return interval;
        }
      }
      
      // If no predefined interval fits, calculate a custom interval within bounds
      if (maxTimeInterval >= minTimeInterval) {
        // Use the maximum allowed interval that fits within pixel constraints
        const interval = Math.max(minTimeInterval, Math.min(maxTimeInterval, 1));
        rulerSpacingCache.current = interval;
        lastTimelineScale.current = timelineScale;
        lastTotalDuration.current = totalDuration;
        return interval;
      }
      
      // Fallback: use the finest interval available
      rulerSpacingCache.current = intervals[0];
      lastTimelineScale.current = timelineScale;
      lastTotalDuration.current = totalDuration;
      return intervals[0];
    }
    
    // Return cached value
    return rulerSpacingCache.current;
  };

  // Get scaled timeline width
  const getScaledTimelineWidth = () => {
    return totalDuration * timelineScale * 100; // 100px per second at scale 1
  };

  // Format time for ruler display with adaptive precision based on interval
  const formatRulerTime = (seconds: number) => {
    const spacing = getRulerSpacing();
    
    // For very fine intervals (< 1 second), show milliseconds
    if (spacing < 1) {
      if (spacing <= 0.01) {
        return `${seconds.toFixed(3)}s`; // 10ms intervals
      } else if (spacing <= 0.02) {
        return `${seconds.toFixed(2)}s`; // 20ms intervals
      } else if (spacing <= 0.05) {
        return `${seconds.toFixed(2)}s`; // 50ms intervals
      } else if (spacing <= 0.1) {
        return `${seconds.toFixed(1)}s`; // 100ms intervals
      } else if (spacing <= 0.2) {
        return `${seconds.toFixed(1)}s`; // 200ms intervals
      } else if (spacing <= 0.25) {
        return `${seconds.toFixed(1)}s`; // 250ms intervals
      } else {
        return `${seconds.toFixed(1)}s`; // 500ms intervals
      }
    }
    
    // For 1+ second intervals, show seconds or minutes
    if (seconds < 60) {
      return `${Math.floor(seconds)}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      if (remainingSeconds === 0) return `${minutes}m`;
      return `${minutes}m${remainingSeconds}s`;
    }
  };

  // Handle time ruler click
  const handleTimeRulerClick = async (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    console.log("🎬 Time ruler clicked!");
    console.log(`🎬 Current playback state: isPlaying=${isPlaying}`);
    if (!timeRulerRef.current) return;

    // Lock the ruler spacing cache during this interaction to prevent tick changes
    const originalCache = rulerSpacingCache.current;
    const originalTimelineScale = lastTimelineScale.current;
    const originalTotalDuration = lastTotalDuration.current;

    const rect = timeRulerRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left + timelineScrollLeft;
    const rulerWidth = timeRulerRef.current.clientWidth;

    const clickedTimePercent = clickX / rulerWidth;
    const newTime = totalDuration * clickedTimePercent;

    const indicatorPos = (newTime / totalDuration) * timeRulerRef.current.clientWidth - timelineScrollLeft;
    setIndicatorPosition(indicatorPos);
    startTimeRef.current = performance.now();
    pausedTimeRef.current = newTime;
    setCurrentTime(newTime);
    
    // Seek all media elements to the new time
    console.log(`🎬 Time ruler: About to call seekAllMediaToTime with time: ${newTime.toFixed(2)}s`);
    seekAllMediaToTime(newTime);
    console.log(`🎬 Time ruler: seekAllMediaToTime completed`);
    
    // await seekToTime(newTime);
    renderPreviewFrame(newTime);

    // Restore the original cache values to prevent any changes
    setTimeout(() => {
      rulerSpacingCache.current = originalCache;
      lastTimelineScale.current = originalTimelineScale;
      lastTotalDuration.current = originalTotalDuration;
    }, 0);
  };

  // Smooth time indicator animation
  const animateTimeIndicator = (timestamp: number) => {
    if (!timeRulerRef.current || !isPlaying) return;

    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp;
    }

    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    const pixelsPerSecond = getPixelsPerSecond();
    const pixelDelta = (pixelsPerSecond * deltaTime) / 1000;

    setIndicatorPosition((prev) => {
      const newPosition = prev + pixelDelta;
      return newPosition;
    });

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animateTimeIndicator);
    }
  };

  // Start animation when playing
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(animateTimeIndicator);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Add effect to sync indicator position with currentTime
  useEffect(() => {
    if (timeRulerRef.current && !isPlaying) {
      const rulerWidth = timeRulerRef.current.clientWidth;
      const newPosition = (currentTime / totalDuration) * rulerWidth - timelineScrollLeft;
      setIndicatorPosition(newPosition);
    }
  }, [currentTime, totalDuration, isPlaying, timelineScrollLeft]);

  // Update volume for currently playing videos when volume setting changes
  useEffect(() => {
    currentlyPlayingVideosRef.current.forEach((video) => {
      // Find the media ID for this video element to get its individual volume
      let mediaId = null;
      for (const [id, cachedVideo] of videoElementsRef.current.entries()) {
        if (cachedVideo === video) {
          mediaId = id;
          break;
        }
      }

      if (mediaId) {
        const mediaItem = mediaItems.find((m) => m.id === mediaId);
        if (mediaItem) {
          // Get individual volume or default to 100
          const individualVolume = mediaItem.volume || 100;
          // Get global volume (stockFootageVolume for videos)
          const globalVolume = stockFootageVolume;

          // Apply combined volume (individual * global / 100), but set to 0 if muted
          video.volume = mediaItem.muted
            ? 0
            : (individualVolume * globalVolume) / 10000;
        }
      }
    });
  }, [stockFootageVolume, currentlyPlayingVideos, mediaItems]);

  // Update volume for all cached video elements when volume setting changes
  useEffect(() => {
    videoElementsRef.current.forEach((video, mediaId) => {
      const mediaItem = mediaItems.find((m) => m.id === mediaId);
      if (mediaItem) {
        // Get individual volume or default to 100
        const individualVolume = mediaItem.volume || 100;
        // Get global volume (stockFootageVolume for videos)
        const globalVolume = stockFootageVolume;

        // Apply combined volume (individual * global / 100), but set to 0 if muted
        video.volume = mediaItem.muted
          ? 0
          : (individualVolume * globalVolume) / 10000;
      }
    });
  }, [stockFootageVolume, mediaItems]);

  // Update volume for currently playing audios when volume settings change
  useEffect(() => {
    currentlyPlayingAudiosRef.current.forEach((audio) => {
      // Find the media ID for this audio element to get its individual volume
      let mediaId = null;
      for (const [id, cachedAudio] of audioElementsRef.current.entries()) {
        if (cachedAudio === audio) {
          mediaId = id;
          break;
        }
      }

      if (mediaId) {
        const mediaItem = mediaItems.find((m) => m.id === mediaId);
        if (mediaItem) {
          // Get individual volume or default to 100
          const individualVolume = mediaItem.volume || 100;

          // Get global volume based on media type
          let globalVolume = 100;
          if (mediaItem.type === "voiceover") {
            globalVolume = voiceoverVolume;
          } else if (mediaItem.type === "audio") {
            globalVolume = soundtrackVolume;
          }

          // Apply combined volume (individual * global / 100), but set to 0 if muted
          audio.volume = mediaItem.muted
            ? 0
            : (individualVolume * globalVolume) / 10000;
        }
      }
    });
  }, [voiceoverVolume, soundtrackVolume, currentlyPlayingAudios, mediaItems]);

  // Update volume for all cached audio elements when volume settings change
  useEffect(() => {
    audioElementsRef.current.forEach((audio, mediaId) => {
      const mediaItem = mediaItems.find((m) => m.id === mediaId);
      if (mediaItem) {
        // Get individual volume or default to 100
        const individualVolume = mediaItem.volume || 100;

        // Get global volume based on media type
        let globalVolume = 100;
        if (mediaItem.type === "voiceover") {
          globalVolume = voiceoverVolume;
        } else if (mediaItem.type === "audio") {
          globalVolume = soundtrackVolume;
        }

        // Apply combined volume (individual * global / 100), but set to 0 if muted
        audio.volume = mediaItem.muted
          ? 0
          : (individualVolume * globalVolume) / 10000;
      }
    });
  }, [voiceoverVolume, soundtrackVolume, mediaItems]);

  // Show loading indicator while restoring audio
  if (isRestoringAudio) {
    return (
      <div
        className={`bg-gray-50 flex flex-col items-center justify-center ${className}`}
      >
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Loading Video Editor
          </h2>
          <p className="text-gray-600">Restoring audio assets...</p>
        </div>
      </div>
    );
  }

  const handlePlayPause = async () => {
    if (isPlaying) {
      pauseTimeline();
    } else {
      try {
        await playTimeline();
        updateTimeDisplay(true);
      } catch (error) {
        setError("Failed to start playback");
        setIsPlaying(false);
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Render transcript generation modal
  const renderTranscriptModal = () => {
    if (!isTranscriptModalOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900">
              Generating Transcript
            </h3>
          </div>

          <div className="text-center mb-4">
            <p className="text-gray-600 mb-2">
              AI is processing your audio file...
            </p>
            <p className="text-sm text-blue-600 font-medium">
              {transcriptProgress}
            </p>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full animate-pulse"
              style={{ width: "60%" }}
            ></div>
          </div>

          <p className="text-xs text-gray-500 text-center mt-3">
            This may take a few moments depending on audio length
          </p>
        </div>
      </div>
    );
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading video editor...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-4">❌</div>
          <p className="text-gray-900 font-medium mb-2">
            Failed to load video editor
          </p>
          <p className="text-gray-600">{error}</p>
          {onPrevious && (
            <button
              onClick={onPrevious}
              className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-900"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  };

  // Add thumbnail preview function
  const renderMediaThumbnail = (item: MediaItem) => {
    if (item.type === "image") {
      // Use existing thumbnailUrl if available, otherwise use filePath as fallback
      const thumbnailSrc = item.thumbnailUrl || item.filePath;

      return (
        <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg overflow-hidden">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.warn(`Failed to load thumbnail for ${item.name}:`, e);
                // If thumbnail fails, try to generate one from the file path
                if (item.filePath && !item.thumbnailUrl) {
                  // Load thumbnail asynchronously
                  loadImageAsBase64(item.filePath).then(base64Url => {
                    setMediaItems(prev => prev.map(mediaItem => 
                      mediaItem.id === item.id 
                        ? { ...mediaItem, thumbnailUrl: base64Url }
                        : mediaItem
                    ));
                  }).catch(error => {
                    console.error(`❌ Failed to load thumbnail for ${item.name}:`, error);
                  });
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      );
    } else if (item.type === "video" && item.thumbnailUrl) {
      const thumbnailSrc = item.thumbnailUrl;

      // Debug logging for Pexels thumbnails
      if (item.source === "pexels" && thumbnailSrc.startsWith("http")) {
        console.warn(
          `⚠️ THUMBNAIL NETWORK REQUEST: Pexels ${item.type} ${item.id} is using network URL for thumbnail!`,
          {
            thumbnailUrl: item.thumbnailUrl?.substring(0, 50),
            filePath: item.filePath?.substring(0, 50),
            actualSrc: thumbnailSrc.substring(0, 50),
          }
        );
      }

      return (
        <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={thumbnailSrc}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }

    // Default icons for other types
    return (
      <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
        {item.type === "voiceover" && <Volume2 className="w-4 h-4" />}
        {item.type === "video" && <VideoIcon className="w-4 h-4" />}
        {item.type === "audio" && <Music className="w-4 h-4" />}
        {item.type === "text" && (
          <div className="w-4 h-4 flex items-center justify-center text-xs font-bold text-gray-600">
            T
          </div>
        )}
      </div>
    );
  };

  // Handle drag start from media item
  const handleMediaDragStart = (mediaItem: MediaItem) => {
    setDraggedMediaItem(mediaItem);
  };

  // Handle drag over layer
  const handleLayerDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    layerId: string
  ) => {
    e.preventDefault();
    setDragOverLayerId(layerId);
  };

  // Handle drag leave layer
  const handleLayerDragLeave = () => {
    setDragOverLayerId(null);
  };

  // Layer reordering handlers
  const handleLayerReorderDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    layerId: string
  ) => {
    setDraggedLayerId(layerId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", layerId);
  };

  const handleLayerReorderDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    targetLayerId: string
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (draggedLayerId && draggedLayerId !== targetLayerId) {
      setLayerDragOverId(targetLayerId);
    }
  };

  const handleLayerReorderDragLeave = () => {
    setLayerDragOverId(null);
  };

  const handleLayerReorderDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetLayerId: string
  ) => {
    e.preventDefault();
    setLayerDragOverId(null);

    if (!draggedLayerId || draggedLayerId === targetLayerId) {
      setDraggedLayerId(null);
      return;
    }

    // Find the indices of the dragged and target layers
    const draggedIndex = layers.findIndex(
      (layer) => layer.id === draggedLayerId
    );
    const targetIndex = layers.findIndex((layer) => layer.id === targetLayerId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedLayerId(null);
      return;
    }

    // Reorder layers array
    const newLayers = [...layers];
    const draggedLayer = newLayers[draggedIndex];

    // Remove the dragged layer from its current position
    newLayers.splice(draggedIndex, 1);

    // Insert the dragged layer at the target position
    newLayers.splice(targetIndex, 0, draggedLayer);

    setLayers(newLayers);
    setDraggedLayerId(null);
  };

  const handleLayerReorderDragEnd = () => {
    setDraggedLayerId(null);
    setLayerDragOverId(null);
  };

  // Handle drop on layer
  const handleLayerDrop = (
    e: React.DragEvent<HTMLDivElement>,
    layerId: string
  ) => {
    e.preventDefault();
    setDragOverLayerId(null);

    if (!draggedMediaItem) return;

    // Calculate proper duration based on media type using actual media length

    let itemDuration: number;
    if (draggedMediaItem.type === "image") {
      itemDuration = IMAGE_DURATION; // 5 seconds for images
    } else if (
      draggedMediaItem.type === "audio" ||
      draggedMediaItem.type === "voiceover"
    ) {
      // Use actual audio duration, but ensure it's valid
      itemDuration =
        draggedMediaItem.duration && draggedMediaItem.duration > 0
          ? draggedMediaItem.duration
          : 5; // Fallback to 5s only if duration is invalid
    } else if (draggedMediaItem.type === "video") {
      // Use actual video duration to preserve full media length
      itemDuration = draggedMediaItem.duration || 5;
    } else {
      itemDuration = 5; // Default fallback
    }

    // Create new timeline item with default geometry for images/videos
    const newTimelineItem: TimelineItem = {
      id: `timeline_${draggedMediaItem.id}_${Date.now()}`,
      mediaId: draggedMediaItem.id,
      startTime: 0, // Will be adjusted based on layer's existing items
      duration: itemDuration,
      track: layers.findIndex((l) => l.id === layerId) + 1,
      // Add default geometry for visual media
      geometry:
        draggedMediaItem.type === "image" || draggedMediaItem.type === "video"
          ? {
              x: 0,
              y: 0,
              width: 1,
              height: 1,
              rotation: 0,
            }
          : undefined,
    };

    // Update layer with new item
    const updatedLayers = layers.map((layer) => {
      if (layer.id === layerId) {
        // Calculate start time to place item at the end of existing items
        const lastItem =
          layer.items.length > 0
            ? layer.items.reduce((latest, item) =>
                item.startTime + item.duration >
                latest.startTime + latest.duration
                  ? item
                  : latest
              )
            : null;

        newTimelineItem.startTime = lastItem
          ? lastItem.startTime + lastItem.duration
          : 0;

        // **Don't expand timeline for manual video/image drops (keep original duration for repositioning)**
        const itemEndTime =
          newTimelineItem.startTime + newTimelineItem.duration;
        if (itemEndTime > totalDuration && totalDuration > 0) {
        }

        return {
          ...layer,
          items: [...layer.items, newTimelineItem],
        };
      }
      return layer;
    });

    setLayers(updatedLayers);

    // Sync timelineItems from the updated layers
    syncTimelineItemsFromLayers(updatedLayers);

    // Auto-select the newly created item if it's visual media
    if (
      draggedMediaItem.type === "image" ||
      draggedMediaItem.type === "video"
    ) {
      setSelectedTimelineItem(newTimelineItem);
    }

    // Clear drag state
    setDraggedMediaItem(null);

    setDraggedMediaItem(null);
  };
  // Update media item rendering to be draggable
  const renderMediaItem = (item: MediaItem) => (
    <Card
      key={item.id}
      className="cursor-move hover:shadow-md transition-shadow border border-gray-200"
      draggable
      onDragStart={() => handleMediaDragStart(item)}
    >
      <CardContent className="p-3">
        <div className="flex items-center space-x-3">
          {renderMediaThumbnail(item)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {item.name}
            </p>
            <p className="text-xs text-gray-500">
              {item.type === "voiceover" &&
                `${Math.round(item.duration || 0)}s`}
              {item.type === "video" && `${item.duration}s video`}
              {item.type === "image" && "Image (5s)"}
              {item.type === "audio" && `${item.duration}s audio`}
            </p>
          </div>
          {item.type !== "voiceover" && (
            <button
              onClick={() => {
                // Clean up blob URLs to prevent memory leaks
                if (
                  item.thumbnailUrl &&
                  item.thumbnailUrl.startsWith("blob:")
                ) {
                  URL.revokeObjectURL(item.thumbnailUrl);
                }
                if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
                  URL.revokeObjectURL(item.previewUrl);
                }
                if (item.filePath && item.filePath.startsWith("blob:")) {
                  URL.revokeObjectURL(item.filePath);
                }

                // Remove from media items
                setMediaItems((prev) => prev.filter((m) => m.id !== item.id));

                // Also remove any timeline items that use this media
                setLayers((prevLayers) =>
                  prevLayers.map((layer) => ({
                    ...layer,
                    items: layer.items.filter(
                      (timelineItem) => timelineItem.mediaId !== item.id
                    ),
                  }))
                );
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Update layer rendering to handle drag and drop
  

  // Add new functions for timeline item drag and remove
  const handleTimelineItemMouseDown = (
    e: React.MouseEvent,
    item: TimelineItem
  ) => {
    e.stopPropagation();

    const layer = layers.find((l) => l.items.some((i) => i.id === item.id));
    if (layer?.locked) return;

    // Only start dragging if we're not clicking a resize handle
    const target = e.target as HTMLElement;
    if (!target.classList.contains("resize-handle")) {
      setDraggedTimelineItem(item);
      setDragStartX(e.clientX);
      setOriginalStartTime(item.startTime);
    }
  };

  // Add helper function to check for timeline item collisions
  const checkTimelineItemCollision = (
    item: TimelineItem,
    newStartTime: number,
    layerId: string
  ): boolean => {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return false;

    return layer.items.some((otherItem) => {
      if (otherItem.id === item.id) return false;

      const itemEnd = newStartTime + item.duration;
      const otherEnd = otherItem.startTime + otherItem.duration;

      // Check for actual overlap (not just touching)
      // Items can touch at edges but not overlap
      return newStartTime < otherEnd && itemEnd > otherItem.startTime;
    });
  };

  // Smooth timeline dragging with visual preview

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (!draggedTimelineItem || !timeRulerRef.current) return;

    const layer = layers.find((l) =>
      l.items.some((i) => i.id === draggedTimelineItem.id)
    );
    if (!layer || layer.locked) return;

    const rulerWidth = timeRulerRef.current.clientWidth;
    const deltaX = e.clientX - dragStartX;
    const deltaTime = (deltaX / rulerWidth) * totalDuration;

    const newStartTime = Math.max(0, originalStartTime + deltaTime);
    
    // Allow dragging beyond current video length - don't clamp to totalDuration
    // The video duration will be automatically extended if needed
    const clampedStartTime = newStartTime;

    // **IMMEDIATE VISUAL FEEDBACK** - Update preview position instantly
    setPreviewDragPosition(clampedStartTime);

    // **THROTTLED STATE UPDATE** - Only update actual state every 16ms (60fps)
    if (dragUpdateThrottleRef.current) {
      cancelAnimationFrame(dragUpdateThrottleRef.current);
    }

    dragUpdateThrottleRef.current = requestAnimationFrame(() => {
      // Check collision and update state in the next frame
      if (
        !checkTimelineItemCollision(
          draggedTimelineItem,
          clampedStartTime,
          layer.id
        )
      ) {
        // Update the timeline item position
        setLayers((prevLayers) =>
          prevLayers.map((l) => ({
            ...l,
            items: l.items.map((item) =>
              item.id === draggedTimelineItem.id
                ? { ...item, startTime: clampedStartTime }
                : item
            ),
          }))
        );

        // Allow dragging beyond video length without extending the video duration
        // Items can be positioned anywhere, but video length remains unchanged
      }
      dragUpdateThrottleRef.current = null;
    });
  };

  
  // Update handleTimelineMouseUp with smooth drag cleanup
  const handleTimelineMouseUp = () => {
    if (draggedTimelineItem) {
      // Clear preview position and finalize drag
      setPreviewDragPosition(null);

      // Cancel any pending throttled updates
      if (dragUpdateThrottleRef.current) {
        cancelAnimationFrame(dragUpdateThrottleRef.current);
        dragUpdateThrottleRef.current = null;
      }

      const layer = layers.find((l) =>
        l.items.some((i) => i.id === draggedTimelineItem.id)
      );
      if (layer) {
        const item = layer.items.find((i) => i.id === draggedTimelineItem.id);
        if (item) {
          // Final state update with exact dragged position (no snapping)
          // Allow dragging beyond video length without extending the video duration
          // Items can be positioned anywhere, but video length remains unchanged
        }
      }
    }

    setDraggedTimelineItem(null);
  };

  const handleRemoveTimelineItem = (itemId: string) => {
    // Update layers
    const updatedLayers = layers.map((layer) => ({
      ...layer,
      items: layer.items.filter((item) => item.id !== itemId),
    }));

    setLayers(updatedLayers);

    // Sync timelineItems from the updated layers
    syncTimelineItemsFromLayers(updatedLayers);
  };



  // Function to seek all media elements to a specific time
  const seekAllMediaToTime = (time: number) => {
    console.log(`🎬 seekAllMediaToTime called with time: ${time.toFixed(2)}s`);
    console.log(`🎬 Available video elements: ${videoElementsRef.current.size}`);
    console.log(`🎬 Available audio elements: ${audioElementsRef.current.size}`);
    console.log(`🎬 Current isPlaying state: ${isPlaying}`);

    // First, pause all currently playing media to prevent overlapping audio
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      console.log(`🎬 Pausing playback for seeking...`);
      
      // Use the existing pause system to properly stop all media
      pauseTimeline();
      
      // Clear the currently playing refs to ensure clean state
      currentlyPlayingAudiosRef.current.length = 0;
      currentlyPlayingVideosRef.current.length = 0;
    }

    // Force stop and reset ALL audio elements to prevent overlapping playback
    console.log(`🎬 Force stopping all audio elements...`);
    audioElementsRef.current.forEach((audio, mediaId) => {
      if (audio) {
        try {
          audio.pause();
          audio.currentTime = 0;
          audio.load(); // Force reload to reset audio state
          console.log(`🎬 Force reset audio element ${mediaId}`);
        } catch (error) {
          console.error(`❌ Error resetting audio ${mediaId}:`, error);
        }
      }
    });

    // Force stop and reset ALL video elements
    console.log(`🎬 Force stopping all video elements...`);
    videoElementsRef.current.forEach((video, mediaId) => {
      if (video) {
        try {
          video.pause();
          video.currentTime = 0;
          console.log(`🎬 Force reset video element ${mediaId}`);
        } catch (error) {
          console.error(`❌ Error resetting video ${mediaId}:`, error);
        }
      }
    });

    // Small delay to ensure all elements are fully stopped before seeking
    console.log(`🎬 Waiting for elements to fully stop...`);
    setTimeout(() => {
      console.log(`🎬 Elements stopped, now seeking...`);
      
      // Seek video elements
    try {
      videoElementsRef.current.forEach((video, mediaId) => {
        if (video && !isNaN(video.duration)) {
          // Find the timeline item for this video
          const timelineItem = timelineItems.find(item => item.mediaId === mediaId);
          
          if (timelineItem) {
            // Calculate the offset within the video's timeline
            const videoOffset = Math.max(0, time - timelineItem.startTime);
            if (videoOffset <= timelineItem.duration) {
              video.currentTime = videoOffset;
              console.log(`🎬 Video ${mediaId} seeked to ${videoOffset.toFixed(2)}s (timeline: ${time.toFixed(2)}s)`);
            }
          }
        }
      });
    } catch (error) {
      console.error(`❌ Error seeking video elements:`, error);
    }

    // Seek audio/voiceover elements
    try {
      audioElementsRef.current.forEach((audio, mediaId) => {
        if (audio && !isNaN(audio.duration)) {
          // Find the timeline item for this audio
          const timelineItem = timelineItems.find(item => item.mediaId === mediaId);
          
          if (timelineItem) {
            // Calculate the offset within the audio's timeline
            const audioOffset = Math.max(0, time - timelineItem.startTime);
            if (audioOffset <= timelineItem.duration) {
              audio.currentTime = audioOffset;
              console.log(`🎬 Audio ${mediaId} seeked to ${audioOffset.toFixed(2)}s (timeline: ${time.toFixed(2)}s)`);
            }
          }
        }
      });
    } catch (error) {
      console.error(`❌ Error seeking audio elements:`, error);
    }

    // Resume playback if it was playing before seeking
    if (wasPlaying) {
      console.log(`🎬 Resuming playback after seeking...`);
      // Use the existing play system to properly resume
      setTimeout(() => {
        playTimeline();
      }, 100); // Small delay to ensure seeking is complete
    }
    }, 200); // Wait 200ms for elements to fully stop
  };



  // Update renderTimelineItem to mark resize handles and selection
  const renderTimelineItem = (item: TimelineItem) => {
    const itemMedia = mediaItems.find((m) => m.id === item.mediaId);
    if (!itemMedia) {
      console.warn(`⚠️ TIMELINE RENDER: Media item not found for timeline item ${item.id} with mediaId ${item.mediaId}`);
      console.warn(`⚠️ TIMELINE RENDER: Available media items:`, mediaItems.map(m => ({ id: m.id, name: m.name, type: m.type })));
      return null;
    }

    const layer = layers.find((l) => l.items.some((i) => i.id === item.id));
    const isLocked = layer?.locked || false;
    const isDragging = draggedTimelineItem?.id === item.id;
    const isItemResizing = resizingItem?.id === item.id;
    const isSelected = selectedTimelineItem?.id === item.id;

    const isInTimeRange =
      currentTime >= item.startTime &&
      currentTime < item.startTime + item.duration;
    const isSelectedButOutOfRange = isSelected && !isInTimeRange;

    // Main click handler for timeline item selection
    const handleTimelineItemClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isLocked) {
        setSelectedTimelineItem(item);
        if (canvasInitializedRef.current) {
          renderPreviewFrame(currentTime); // Re-render to show selection
        }
      } else {
        console.warn("❌ Cannot select locked timeline item:", item.id);
      }
    };

    return (
      <div
        key={item.id}
        className={`absolute top-1 h-5 rounded-sm flex items-center px-2 select-none
          ${isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
          ${isDragging ? "shadow-lg z-30" : ""}
          ${isItemResizing ? "shadow-lg z-40" : ""}
          ${isSelected ? "z-20" : "z-10"}
          group
          ${
            itemMedia.type === "video"
              ? "bg-purple-100 border border-purple-500"
              : itemMedia.type === "image"
              ? "bg-green-100 border border-green-500"
              : itemMedia.type === "text"
              ? "bg-orange-100 border border-orange-500"
              : "bg-blue-100 border border-blue-500"
          }
          transition-all duration-150
          hover:shadow-md`}
        style={{
          // **SMOOTH DRAG PREVIEW** - Use preview position during drag for instant visual feedback
          left:
            isDragging && previewDragPosition !== null
              ? `${(previewDragPosition / totalDuration) * 100}%`
              : `${(item.startTime / totalDuration) * 100}%`,
          width: `${(item.duration / totalDuration) * 100}%`,
          minWidth: "8px",
          // Add slight opacity for selected items that are out of time range
          opacity: isSelectedButOutOfRange ? 0.7 : 1,
          // Enhanced visual feedback during drag
          transition: isDragging
            ? "transform 0.1s ease-out"
            : "transform 0.2s ease-out",
          // Add inset border for selection without expanding boundaries
          boxShadow: isSelected
            ? `inset 0 0 0 2px ${
                itemMedia.type === "video"
                  ? "#7c3aed"
                  : itemMedia.type === "image"
                  ? "#059669"
                  : itemMedia.type === "text"
                  ? "#ea580c"
                  : "#2563eb"
              }`
            : isDragging || isItemResizing
            ? "0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)"
            : undefined,
        }}
        onMouseDown={(e) => {
          // Only handle mouse down if not clicking on interactive elements
          const target = e.target as HTMLElement;
          if (
            !target.classList.contains("resize-handle") &&
            !target.closest(".resize-handle")
          ) {
            e.stopPropagation();
            if (!isLocked) {
              handleTimelineItemMouseDown(e, item);
            }
          }
        }}
        onClick={handleTimelineItemClick}
      >
        {!isLocked && (
          <>
            <div
              className="resize-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-blue-200 z-30"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, item, "left");
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Resize handle click - don't select item
              }}
            />
            <div
              className="resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-blue-200 z-30"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, item, "right");
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Resize handle click - don't select item
              }}
            />
          </>
        )}
        <div className="flex items-center justify-between w-full select-none">
          <span
            className="text-[11px] font-medium truncate px-1 select-none flex-1 cursor-pointer"
            onClick={handleTimelineItemClick}
            title={isSelected ? "Press Delete or Backspace to remove" : ""}
          >
            {itemMedia.name}
          </span>

        </div>
        {(isDragging || isItemResizing) && (
          <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500 bg-white px-1 rounded shadow select-none pointer-events-none">
            {formatTime(item.startTime)} -{" "}
            {formatTime(item.startTime + item.duration)}
          </div>
        )}
      </div>
    );
  };

  // Dynamic Properties Panel based on selected timeline item
  const renderPropertiesPanel = () => {
    const selectedMedia = selectedTimelineItem
      ? mediaItems.find((m) => m.id === selectedTimelineItem.mediaId)
      : null;

    if (!selectedMedia) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Select a timeline item to edit properties</p>
          </div>
        </div>
      );
    }



    const renderAudioControls = () => (
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 flex items-center">
          <Volume2 className="w-4 h-4 mr-2" />
          Audio Controls
        </h4>
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Volume
              </label>
              <span className="text-xs text-gray-500">
                {selectedMedia.volume || 100}%
              </span>
            </div>
            <Slider
              value={[selectedMedia.volume || 100]}
              onValueChange={([value]) =>
                updateMediaItemProperties(selectedMedia.id, { volume: value })
              }
              max={100}
              step={1}
              className="w-full"
              disabled={selectedMedia.muted}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`mute-${selectedMedia.id}`}
              checked={selectedMedia.muted || false}
              onChange={(e) =>
                updateMediaItemProperties(selectedMedia.id, {
                  muted: e.target.checked,
                })
              }
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label
              htmlFor={`mute-${selectedMedia.id}`}
              className="text-sm font-medium text-gray-700 cursor-pointer"
            >
              Mute {selectedMedia.type === "video" ? "video" : "audio"}
            </label>
          </div>
        </div>
      </div>
    );

    // Helper function to format numbers with 2 decimal places
    const formatNumber = (
      value: number | undefined,
      defaultValue: number = 0
    ): number => {
      return Math.round((value || defaultValue) * 100) / 100;
    };

    const renderPositionControls = () => (
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 flex items-center">
          <Move className="w-4 h-4 mr-2" />
          Position & Size
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              X Position
            </label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formatNumber(selectedMedia.x, 0)}
              onChange={(e) =>
                updateMediaItemProperties(selectedMedia.id, {
                  x: parseFloat(e.target.value),
                })
              }
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Y Position
            </label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formatNumber(selectedMedia.y, 0)}
              onChange={(e) =>
                updateMediaItemProperties(selectedMedia.id, {
                  y: parseFloat(e.target.value),
                })
              }
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Width
            </label>
            <Input
              type="number"
              min="0.1"
              max="1"
              step="0.01"
              value={formatNumber(selectedMedia.width, 1)}
              onChange={(e) =>
                updateMediaItemProperties(selectedMedia.id, {
                  width: parseFloat(e.target.value),
                })
              }
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Height
            </label>
            <Input
              type="number"
              min="0.1"
              max="1"
              step="0.01"
              value={formatNumber(selectedMedia.height, 1)}
              onChange={(e) =>
                updateMediaItemProperties(selectedMedia.id, {
                  height: parseFloat(e.target.value),
                })
              }
              className="text-xs"
            />
          </div>
        </div>
      </div>
    );

    const renderTextControls = () => (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900 flex items-center">
            <Type className="w-4 h-4 mr-2" />
            Subtitle Styling
          </h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => restoreTextDefaults(selectedMedia.id)}
            className="text-xs flex items-center gap-1 px-2 py-1 h-7"
            title="Restore default styling"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </Button>
        </div>

        {/* Font Family */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Font Family
          </label>
          <select
            value={selectedMedia.fontFamily || "Arial"}
            onChange={(e) =>
              updateMediaItemProperties(selectedMedia.id, {
                fontFamily: e.target.value,
              })
            }
            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
          >
            {systemFonts.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
        </div>

        {/* Font Size */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Font Size
          </label>
          <div className="flex items-center gap-2">
            <Slider
              value={[selectedMedia.fontSize || 24]}
              onValueChange={([value]) =>
                updateMediaItemProperties(selectedMedia.id, { fontSize: value })
              }
              min={8}
              max={72}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 min-w-[2rem] text-right">
              {selectedMedia.fontSize || 24}px
            </span>
          </div>
        </div>

        {/* Font Style Buttons */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-2">
            Font Style
          </label>
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant={selectedMedia.fontBold ? "default" : "outline"}
              size="sm"
              onClick={() =>
                updateMediaItemProperties(selectedMedia.id, {
                  fontBold: !selectedMedia.fontBold,
                })
              }
              className="text-xs"
            >
              <Bold className="w-3 h-3" />
            </Button>
            <Button
              variant={selectedMedia.fontItalic ? "default" : "outline"}
              size="sm"
              onClick={() =>
                updateMediaItemProperties(selectedMedia.id, {
                  fontItalic: !selectedMedia.fontItalic,
                })
              }
              className="text-xs"
            >
              <Italic className="w-3 h-3" />
            </Button>
            <Button
              variant={selectedMedia.fontUnderline ? "default" : "outline"}
              size="sm"
              onClick={() =>
                updateMediaItemProperties(selectedMedia.id, {
                  fontUnderline: !selectedMedia.fontUnderline,
                })
              }
              className="text-xs"
            >
              <span className="text-xs font-bold underline">U</span>
            </Button>
            <Button
              variant={selectedMedia.fontStrikethrough ? "default" : "outline"}
              size="sm"
              onClick={() =>
                updateMediaItemProperties(selectedMedia.id, {
                  fontStrikethrough: !selectedMedia.fontStrikethrough,
                })
              }
              className="text-xs"
            >
              <span className="text-xs font-bold line-through">S</span>
            </Button>
          </div>
        </div>

        {/* Text Alignment */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Text Alignment
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["left", "center", "right"] as const).map((align) => (
              <Button
                key={align}
                variant={selectedMedia.textAlignment === align ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  updateMediaItemProperties(selectedMedia.id, {
                    textAlignment: align,
                  })
                }
                className="text-xs capitalize"
              >
                {align}
              </Button>
            ))}
          </div>
        </div>

        {/* Text Capitalization */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Text Capitalization
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(["AA", "Aa", "aa", "--"] as const).map((cap) => (
              <Button
                key={cap}
                variant={selectedMedia.textCapitalization === cap ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  updateMediaItemProperties(selectedMedia.id, {
                    textCapitalization: cap,
                  })
                }
                className="text-xs"
              >
                {cap}
              </Button>
            ))}
          </div>
        </div>

        {/* Font Color */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Text Color
          </label>
          <Input
            type="color"
            value={selectedMedia.fontColor || "#ffffff"}
            onChange={(e) =>
              updateMediaItemProperties(selectedMedia.id, {
                fontColor: e.target.value,
              })
            }
            className="w-full h-8"
          />
        </div>

        {/* Text Opacity */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Text Opacity
          </label>
          <div className="flex items-center gap-2">
            <Slider
              value={[selectedMedia.textOpacity || 100]}
              onValueChange={([value]) =>
                updateMediaItemProperties(selectedMedia.id, { textOpacity: value })
              }
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 min-w-[3rem] text-right">
              {selectedMedia.textOpacity || 100}%
            </span>
          </div>
        </div>

        {/* Text Border */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Text Border
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={selectedMedia.textBorderColor || "#000000"}
                onChange={(e) =>
                  updateMediaItemProperties(selectedMedia.id, {
                    textBorderColor: e.target.value,
                  })
                }
                className="flex-1 h-8"
                placeholder="Border Color"
              />
              <div className="flex items-center gap-2">
                <Slider
                  value={[selectedMedia.textBorderThickness || 0]}
                  onValueChange={([value]) =>
                    updateMediaItemProperties(selectedMedia.id, { textBorderThickness: value })
                  }
                  min={0}
                  max={10}
                  step={1}
                  className="w-20"
                />
                <span className="text-xs text-gray-500 min-w-[2.5rem] text-right">
                  {selectedMedia.textBorderThickness || 0}px
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Background Color */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Background Color
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={selectedMedia.backgroundColor || "#000000"}
              onChange={(e) =>
                updateMediaItemProperties(selectedMedia.id, {
                  backgroundColor: e.target.value,
                })
              }
              className="flex-1 h-8"
              disabled={selectedMedia.backgroundTransparent}
            />
            <div className="flex items-center gap-1">
              <input
                type="checkbox"
                id="backgroundTransparent"
                checked={selectedMedia.backgroundTransparent || false}
                onChange={(e) =>
                  updateMediaItemProperties(selectedMedia.id, {
                    backgroundTransparent: e.target.checked,
                  })
                }
                className="w-4 h-4"
              />
              <label
                htmlFor="backgroundTransparent"
                className="text-xs text-gray-700 cursor-pointer"
              >
                Transparent
              </label>
            </div>
          </div>
        </div>

        {/* Background Opacity */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Background Opacity
          </label>
          <div className="flex items-center gap-2">
            <Slider
              value={[selectedMedia.backgroundOpacity || 100]}
              onValueChange={([value]) =>
                updateMediaItemProperties(selectedMedia.id, { backgroundOpacity: value })
              }
              min={0}
              max={100}
              step={1}
              className="flex-1"
              disabled={selectedMedia.backgroundTransparent}
            />
            <span className="text-xs text-gray-500 min-w-[3rem] text-right">
              {selectedMedia.backgroundOpacity || 100}%
            </span>
          </div>
        </div>
      </div>
    );

    return (
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900">Selected Item</h3>
          <p className="text-sm text-gray-600">{selectedMedia.name}</p>
          <p className="text-xs text-gray-500 capitalize">
            {selectedMedia.type} • {selectedMedia.duration.toFixed(1)}s
          </p>
        </div>

        {/* Audio controls for audio and video items */}
        {(selectedMedia.type === "audio" ||
          selectedMedia.type === "voiceover" ||
          selectedMedia.type === "video") &&
          renderAudioControls()}

        {/* Position controls for image, video, and text items */}
        {(selectedMedia.type === "image" ||
          selectedMedia.type === "video" ||
          selectedMedia.type === "text") &&
          renderPositionControls()}

        {/* Text controls for text items */}
        {selectedMedia.type === "text" && renderTextControls()}
      </div>
    );
  };
  // Update the media panel content to use the new renderMediaItem function
  const renderMediaPanel = () => (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      <CardHeader className="pb-3 h-[70px]">
        <div className="flex gap-2 items-center justify-center">
          <Button
            size="sm"
            onClick={handleAddMediaClick}
            className="text-xs flex items-center justify-center"
          >
            <Plus className="w-4 h-4 " />
          </Button>
          <div className="relative hidden">
            <Button
              size="sm"
              onClick={handleAddTranscriptClick}
              className="text-xs bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
            >
              <Type className="w-4 h-4 " />
            </Button>
            {showTranscriptSelector && renderTranscriptSelector()}

        
        {/* Stock Media Generation Confirmation Dialog */}
        {showStockMediaConfirmation && pendingStockMediaRequest && (
          <div className="absolute top-full left-0 mt-1 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-96">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-red-600">
                ⚠️ Confirm OpenAI API Call
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowStockMediaConfirmation(false)}
                className="text-xs h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">
                You are about to generate <strong>{pendingStockMediaRequest.length} AI images</strong> using OpenAI DALL-E.
              </p>
              <p className="text-xs text-gray-500 mb-3">
                This will cost money. Each image costs approximately $0.04 USD.
              </p>
              
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {pendingStockMediaRequest.map((segment, index) => (
                  <div key={segment.id} className="text-xs bg-gray-50 p-2 rounded">
                    <span className="font-medium">Paragraph {segment.paragraphNumber || index + 1}:</span>
                    <span className="text-gray-600 ml-2">
                      {segment.text.substring(0, 60)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={confirmStockMediaGeneration}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Generate {pendingStockMediaRequest.length} Images (${(pendingStockMediaRequest.length * 0.04).toFixed(2)})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowStockMediaConfirmation(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
          </div>
          
          {/* Manual Auto-Transcript Trigger Button */}
          <Button
            size="sm"
            onClick={() => {
              if (autoTranscriptGenerated) {
                // Reset state to allow regeneration
                setAutoTranscriptGenerated(false);
                setShowCompletionMessage(false);
              }
              
              // Check if transcripts already exist before proceeding
              const existingTextLayers = layers.filter(layer => layer.type === "text");
              const hasExistingTranscripts = existingTextLayers.some(layer => layer.items.length > 0);
              
              if (hasExistingTranscripts && !autoTranscriptGenerated) {
                console.log("🎙️ MANUAL-TRANSCRIPT: Transcripts already exist, marking as completed");
                setAutoTranscriptGenerated(true);
                return;
              }
              
              autoGenerateTranscripts();
            }}
            disabled={isAutoGeneratingTranscripts}
            className={`text-xs items-center hidden justify-center ${
              autoTranscriptGenerated 
                ? "bg-green-600 hover:bg-green-700" 
                : "bg-orange-600 hover:bg-orange-700"
            }`}
            title={autoTranscriptGenerated ? "Regenerate transcripts" : "Manually trigger transcript generation"}
          >
            {isAutoGeneratingTranscripts ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : autoTranscriptGenerated ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>

          {/* <Button
            size="sm"
            onClick={() => handleStoryBasedStockMediaGeneration()}
            className="text-xs bg-blue-600 hidden hover:bg-blue-700 flex items-center justify-center"
            title="Generate images based on story content and video duration"
          >
            Story
          </Button> */}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto min-h-[50vh]  h-[calc(100vh-70px-220px)]">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,video/*,audio/*"
          multiple
          onChange={handleFileSelect}
        />
        <div className="space-y-2 overflow-y-auto h-full">
          {(() => {
            const filteredItems = mediaItems.filter(
              (item) => item.type !== "text"
            );

            // Debug logging for OpenAI images
            const openaiImages = filteredItems.filter(item => item.source === 'openai-dalle');
            if (openaiImages.length > 0) {
              console.log(`🖼️ MEDIA PANEL: Found ${openaiImages.length} OpenAI images:`, 
                openaiImages.map(img => ({ id: img.id, name: img.name, type: img.type, source: img.source }))
              );
            }

            const videoItems = filteredItems.filter(
              (item) => item.type === "video"
            );
            
            const pexelsVideoItems = videoItems.filter(
              (item) => item.source === "pexels"
            );
            

            if (pexelsVideoItems.length === 0 && videoItems.length > 0) {
              console.warn(
                `⚠️ Found ${videoItems.length} videos but 0 Pexels videos in media panel`
              );
            }

            return filteredItems.map(renderMediaItem);
          })()}
        </div>
      </CardContent>
    </div>
  );

  // Add drag handle icon
  const DragHandle = () => (
    <div className="text-gray-400 cursor-move px-1">
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-current"></div>
          <div className="w-1 h-1 rounded-full bg-current"></div>
        </div>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-current"></div>
          <div className="w-1 h-1 rounded-full bg-current"></div>
        </div>
      </div>
    </div>
  );

  // Layer type icons
  const getLayerIcon = (type: string) => {
    switch (type) {
      case "voiceover":
        return <Volume2 className="w-4 h-4 text-blue-500" />;
      case "main":
        return <Layers className="w-4 h-4 text-purple-500" />;
      default:
        return <Square className="w-4 h-4 text-gray-500" />;
    }
  };

  // Add resize handlers
  const handleResizeStart = (
    e: React.MouseEvent,
    item: TimelineItem,
    direction: "left" | "right"
  ) => {
    e.stopPropagation();
    // Do not pause playback on resize start; allow live resize while playing

    const layer = layers.find((l) => l.items.some((i) => i.id === item.id));
    if (layer?.locked) return;

    setIsResizing(direction);
    setResizingItem(item);
    setResizeStartX(e.clientX);
    setOriginalDuration(item.duration);
    setOriginalStartTime(item.startTime);
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!resizingItem || !timeRulerRef.current || !isResizing) return;

    const layer = layers.find((l) =>
      l.items.some((i) => i.id === resizingItem.id)
    );
    if (!layer || layer.locked) return;

    const rulerWidth = timeRulerRef.current.clientWidth;
    const deltaX = e.clientX - resizeStartX;
    const deltaTime = (deltaX / rulerWidth) * totalDuration;

    let newStartTime = resizingItem.startTime;
    let newDuration = resizingItem.duration;

    if (isResizing === "left") {
      const maxStartTime = originalStartTime + originalDuration - 0.5; // Minimum duration 0.5s
      const newStart = Math.max(
        0,
        Math.min(maxStartTime, originalStartTime + deltaTime)
      );
      newStartTime = newStart;
      newDuration = originalDuration - (newStart - originalStartTime);
    } else {
      const minDuration = 0.5; // Minimum duration 0.5s
      // Allow extending beyond current video duration - don't clamp to totalDuration
              newDuration = Math.max(minDuration, originalDuration + deltaTime);
    }

    // Check for collisions
    const wouldCollide = layer.items.some((otherItem) => {
      if (otherItem.id === resizingItem.id) return false;

      const itemEnd = newStartTime + newDuration;
      const otherEnd = otherItem.startTime + otherItem.duration;

      return (
        (newStartTime >= otherItem.startTime && newStartTime < otherEnd) ||
        (itemEnd > otherItem.startTime && itemEnd <= otherEnd) ||
        (newStartTime <= otherItem.startTime && itemEnd >= otherEnd)
      );
    });

    if (!wouldCollide) {
      setLayers((prevLayers) =>
        prevLayers.map((l) => ({
          ...l,
          items: l.items.map((item) =>
            item.id === resizingItem.id
              ? { ...item, startTime: newStartTime, duration: newDuration }
              : item
          ),
        }))
      );

      // Allow resizing beyond video length without extending the video duration
      // Items can be resized to any duration, but video length remains unchanged
    }
  };

  const handleResizeEnd = () => {
    if (resizingItem) {
      const layer = layers.find((l) =>
        l.items.some((i) => i.id === resizingItem.id)
      );
      if (layer) {
        const item = layer.items.find((i) => i.id === resizingItem.id);
        if (item) {
          // No snapping - keep exact position and duration where user resized
          setLayers((prevLayers) =>
            prevLayers.map((l) => ({
              ...l,
              items: l.items.map((i) =>
                i.id === resizingItem.id
                  ? {
                      ...i,
                      startTime: item.startTime,
                      duration: item.duration,
                    }
                  : i
              ),
            }))
          );
        }
      }
    }

    setIsResizing(null);
          // Sync properties panel after resize
      if (resizingItem) {
        syncMediaItemFromGeometry(resizingItem.id);
           
        // Allow resizing beyond video length without extending the video duration
        // Items can be resized to any duration, but video length remains unchanged
      }

    setResizingItem(null);
  };
  // Render timeline section
  const renderTimelineSection = () => (
    <div className="h-[150px] mt-[67px] bg-white border-t border-gray-200 flex select-none">
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
      <div className="w-64 bg-gray-50 flex flex-col border-r border-gray-200 select-none">
        <div className="h-8 px-2 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <Button
              size="sm"
              onClick={splitSelectedItem}
              disabled={
                !selectedTimelineItem ||
                currentTime <= selectedTimelineItem?.startTime ||
                currentTime >=
                  selectedTimelineItem?.startTime + selectedTimelineItem?.duration
              }
              className="h-6 px-2 text-[11px] bg-orange-500 hover:bg-orange-600 text-white justify-center disabled:opacity-50"
              title={
                !selectedTimelineItem
                  ? "Select a timeline item to split"
                  : currentTime <= selectedTimelineItem?.startTime ||
                    currentTime >=
                      selectedTimelineItem?.startTime +
                        selectedTimelineItem?.duration
                  ? "Move time indicator within selected item range to split"
                  : "Split selected item at current time"
              }
            >
              <Scissors className="w-3 h-3 mr-1" />
              Split
            </Button>
            <Button
              size="sm"
              onClick={addLayer}
              disabled={layers.length >= MAX_LAYERS}
              className="h-6 px-2 text-[11px] bg-blue-500 hover:bg-blue-600 text-white justify-center"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Layer
            </Button>
            
            {/* Timeline Scale Slider */}
            <div className="flex items-center space-x-2 ml-4">
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={timelineScale}
                onChange={(e) => setTimelineScale(parseFloat(e.target.value))}
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                title={`Timeline Scale: ${timelineScale}x`}
              />
              <span className="text-xs text-gray-600 w-8">{timelineScale}x</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {layers.map((layer) => (
            <div
              key={layer.id}
              draggable={true}
              className={`h-8 min-h-[32px] border-b border-gray-200 flex items-center cursor-move
                ${
                  selectedLayerId === layer.id
                    ? "bg-blue-50"
                    : "hover:bg-gray-100"
                }
                ${dragOverLayerId === layer.id ? "bg-blue-100" : ""}
                ${
                  layerDragOverId === layer.id
                    ? "bg-green-100 border-green-300"
                    : ""
                }
                ${draggedLayerId === layer.id ? "opacity-30" : ""}
                ${!layer.visible && "opacity-50"}
                transition-all duration-200`}
              onClick={() => setSelectedLayerId(layer.id)}
              onDragStart={(e) => handleLayerReorderDragStart(e, layer.id)}
              onDragOver={(e) => {
                // Handle both media drop and layer reordering
                if (draggedLayerId) {
                  handleLayerReorderDragOver(e, layer.id);
                } else {
                  handleLayerDragOver(e, layer.id);
                }
              }}
              onDragLeave={() => {
                if (draggedLayerId) {
                  handleLayerReorderDragLeave();
                } else {
                  handleLayerDragLeave();
                }
              }}
              onDrop={(e) => {
                if (draggedLayerId) {
                  handleLayerReorderDrop(e, layer.id);
                } else {
                  handleLayerDrop(e, layer.id);
                }
              }}
              onDragEnd={handleLayerReorderDragEnd}
            >
              <div className="flex items-center space-x-2 text-gray-700 px-2 w-full h-full">
                <DragHandle />
                {getLayerIcon(layer.type || "main")}
                <div className="flex-1 flex items-center min-w-0">
                  <input
                    type="text"
                    value={
                      (layer.type === "voiceover" || layer.type === "text"
                        ? "🔒 "
                        : "") + layer.name
                    }
                    onChange={(e) => renameLayer(layer.id, e.target.value)}
                    className={`flex-1 text-xs bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-gray-700 ${
                      editingLayerId === layer.id
                        ? "select-text"
                        : "select-none"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => setEditingLayerId(layer.id)}
                    onBlur={() => setEditingLayerId(null)}
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerVisibility(layer.id);
                  }}
                  className={`p-1 rounded-sm hover:bg-gray-200 ${
                    layer.visible ? "text-gray-600" : "text-gray-400"
                  }`}
                  title={layer.visible ? "Hide layer" : "Show layer"}
                >
                  {layer.visible ? (
                    <Eye className="w-3 h-3" />
                  ) : (
                    <EyeOff className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerLock(layer.id);
                  }}
                  className={`p-1 rounded-sm hover:bg-gray-200 ${
                    layer.locked ? "text-red-500" : "text-gray-400"
                  }`}
                  title={layer.locked ? "Unlock layer" : "Lock layer"}
                >
                  {layer.locked ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <Unlock className="w-3 h-3" />
                  )}
                </button>
                {layers.length > 1 && layer.type !== "voiceover" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                    }}
                    className="p-1 rounded-sm hover:bg-gray-200 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Area with Horizontal Scroll */}
              <div ref={timelineContainerRef} className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex flex-col bg-white" style={{ width: `${getScaledTimelineWidth()}px` }}>
          {/* Timeline Ruler */}
          <div
            ref={timeRulerRef}
            onClick={handleTimeRulerClick}
            className="h-8 min-h-[32px] border-b border-gray-200 relative bg-gray-50 flex items-center cursor-pointer select-none"
          >
            {(() => {
              const spacing = getRulerSpacing();
              return Array.from(
                { length: Math.ceil(totalDuration / spacing) },
                (_, i) => {
                  const time = i * spacing;
                  if (time > totalDuration) return null;
                  
                  return (
                    <div
                      key={time}
                      className="absolute h-full flex flex-col items-center"
                      style={{
                        left: `${(time / totalDuration) * 100}%`,
                        transform: 'translateX(-50%)',
                      }}
                    >
                      <div className="w-px h-2 bg-gray-300" />
                      <span className="text-[10px] text-gray-600 select-none whitespace-nowrap">
                        {formatRulerTime(time)}
                      </span>
                    </div>
                  );
                }
              );
            })()}

            <div
              className="absolute top-0 bottom-0 z-50 pointer-events-none transition-transform duration-100 ease-linear"
              style={{
                transform: `translateX(${indicatorPosition}px)`,
                transition: isPlaying ? "none" : "transform 0.2s ease-out",
              }}
            >
              <div className="w-px h-full bg-red-500" />
              <div className="absolute -top-1 -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-red-500" />
            </div>
          </div>

          {/* Timeline Items */}
          <div
            className="flex-1 overflow-y-auto relative bg-gray-50 select-none"
            onMouseMove={(e) => {
              if (isResizing && resizingItem) {
                handleResizeMove(e);
              } else if (draggedTimelineItem) {
                handleTimelineMouseMove(e);
              }
            }}
            onMouseUp={() => {
              if (isResizing) {
                handleResizeEnd();
              } else if (draggedTimelineItem) {
                handleTimelineMouseUp();
              }
            }}
            onMouseLeave={() => {
              if (isResizing) {
                handleResizeEnd();
              } else if (draggedTimelineItem) {
                handleTimelineMouseUp();
              }
            }}
          >
            {layers.map((layer) => {
              // Debug logging for stock media layer
              if (layer.id === 'stocks-layer') {
                console.log(`🎬 TIMELINE RENDER: Rendering stocks layer with ${layer.items?.length || 0} items:`, 
                  layer.items?.map(item => ({ id: item.id, mediaId: item.mediaId, startTime: item.startTime }))
                );
              }
              
              return (
                <div
                  key={layer.id}
                  className={`h-8 min-h-[32px] border-b border-gray-200 relative bg-white group
                    ${!layer.visible && "opacity-50"} 
                    ${selectedLayerId === layer.id ? "bg-blue-50" : ""}
                    ${layer.locked ? "cursor-not-allowed" : ""}
                    ${
                      timelineDropTarget?.layerId === layer.id
                        ? "bg-green-100 ring-2 ring-green-300"
                        : ""
                    }
                    transition-all duration-150`}
                  onClick={() => setSelectedLayerId(layer.id)}
                  onDragOver={(e) => handleTimelineDragOver(e, layer.id)}
                  onDragLeave={handleTimelineDragLeave}
                  onDrop={(e) => handleTimelineDrop(e, layer.id)}
                >
                  {layer.items.map((item) => renderTimelineItem(item))}

                  {/* Drop indicator */}
                  {timelineDropTarget?.layerId === layer.id && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-green-500 z-20 pointer-events-none"
                      style={{
                        left: `${(timelineDropTarget.time / totalDuration) * 100}%`,
                      }}
                    >
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-b-3 border-transparent border-b-green-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );



  return (
    <div className={`h-screen bg-gray-50 flex flex-col ${className}`}>
      {/* Automatic Transcript Generation Progress Indicator */}
      {isAutoGeneratingTranscripts && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <div className="flex-1">
              <h4 className="font-medium text-sm">Auto-Generating Transcripts</h4>
              <p className="text-xs text-blue-100 mt-1">{autoTranscriptProgress}</p>
            </div>
          </div>
        </div>
      )}

      {/* Automatic Image Generation Progress Indicator */}
      {isAutoGeneratingStockMedia && (
        <div className="fixed top-16 right-4 z-50 bg-purple-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <div className="flex-1">
              <h4 className="font-medium text-sm">Auto-Generating Images</h4>
              <p className="text-xs text-purple-100 mt-1">{autoStockMediaProgress}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Automatic Generation Completion Message */}
      {showCompletionMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5" />
            <div className="flex-1">
              <h4 className="font-medium text-sm">Auto-Generation Complete!</h4>
              <p className="text-xs text-green-100 mt-1">
                {autoStockMediaGenerated 
                  ? "Transcripts and images have been automatically generated." 
                  : "All voiceover transcripts have been automatically generated."
                }
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between h-[70px]">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => {
              if (isPlaying) pauseTimeline();
              onPrevious?.();
            }}
            className="text-gray-600 border-gray-200 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <h1 className="text-xl font-semibold text-gray-900">Video Editor</h1>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            onClick={() => {
              saveVideoAssets();
              onSaveAndFinish?.();
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Save & Finish
          </Button>

          {hasRenderFailed ? (
            <Button
              onClick={() => {
                // Save the current video assets before retrying render
                saveVideoAssets();
                // Then call the retry render function
                onRetryRender?.();
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Render
            </Button>
          ) : (
            <Button
              onClick={() => {
                // Save the current video assets before rendering
                saveVideoAssets();
                // Then call the render function
                onRender?.();
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <VideoIcon className="w-4 h-4 mr-2" />
              Render
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex max-h-[calc(100vh-70px-220px)]">
        {renderMediaPanel()}

        <div className="flex-1 relative flex flex-col bg-gray-900 h-[480px]">
          <div className="flex-1 flex items-center justify-center p-4">
            <Card
              className={`w-full max-w-4xl ${getVideoAspectRatio()} bg-black border-gray-600 overflow-hidden max-h-[400px] rounded-none`}
            >
              <CardContent className="p-0 min-h-[330px] w-full flex items-center justify-center bg-black">
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full max-h-[370px] w-full object-contain"
                  style={{
                    backgroundColor: "black",
                    cursor: canvasCursor,
                  }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={(e) => {
                    handleCanvasMouseMove(e, canvasInteractionMode);
                  }}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseLeave}
                />
              </CardContent>
            </Card>
          </div>

          {/* Selection Info Panel */}

          <div className="absolute bottom-0 left-0 right-0 bg-gray-700 h-12 flex items-center justify-center px-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlayPause}
                disabled={totalDuration === 0}
                className="text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </Button>
              <div className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Properties Panel</CardTitle>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto">
            {renderPropertiesPanel()}

            {/* Transcript Generation Modal */}
            {renderTranscriptModal()}
          </CardContent>
        </div>
      </div>

      {renderTimelineSection()}
    </div>
  );
};

export default VideoEditor;

// Export types for use in other components
export type {
  SavedVideoAssets,
  MediaItem,
  TimelineItem,
  Layer,
  SavedAudioChunk,
  SavedMediaItem,
  GeometricInfo,
};