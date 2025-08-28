import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { useNavigate, useLocation } from "react-router-dom";
import { Slider } from "../ui/slider";
import { useToast } from "../ui/toast";
import FormInput from "../ui/form-input";
import VoiceSelector from "../ui/VoiceSelector";
import AudioPreview from "../ui/AudioPreview";
import VideoEditor from "../ui/VideoEditor";
import {
  Sparkles,
  BookOpen,
  Users,
  Palette,
  Target,
  FileText,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  RefreshCw,
  Plus,
  X,
  AlertTriangle,
  Volume2,
  Video,
  Save,
} from "lucide-react";
import { AudioChunk, IncomingAudioChunk } from "../../types/audio";
import { StoryData } from "../../types/story";
// Import the new RenderScreen component
import { RenderScreen } from "./RenderScreen";
import type {
  MediaItem,
  TimelineItem,
  Layer,
} from "../ui/VideoEditor"; // Import the types

const videoStyles = [
  { value: "landscape", label: "Landscape", description: "Wide format (16:9)" },
  { value: "square", label: "Square", description: "Square format (1:1)" },
  {
    value: "vertical",
    label: "Vertical",
    description: "Portrait format (9:16)",
  },
];



const genres = [
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Romance",
  "Adventure",
  "Horror",
  "Comedy",
  "Drama",
  "Thriller",
  "Historical Fiction",
  "Fable",
  "Nature Walks",
  "Seasons & Weathers",
  "Scientific Facts",
  "History",
  "Mindfulness & Meditations",
  "Motivations",
];

const languages = [
  "English",
  "Spanish",
  "Portuguese",
  "French",
  "German",
  "Italian",
  "Dutch",
  "Russian",
  "Chinese",
  "Ukrainian",
  "Romanian",
  "Turkish",
  "Hindi",
  "Arabic",
  "Japanese",
  "Korean",
  "Swedish",
  "Finnish",
  "Malay",
];

const emotions = [
  "awe",
  "wonder",
  "joy",
  "sadness",
  "grief",
  "love",
  "fear",
  "anxiety",
  "hope",
  "nostalgia",
  "betrayal",
  "anger",
  "revenge",
  "guilt",
  "shame",
  "relief",
  "pride",
  "humiliation",
  "admiration",
  "loneliness",
  "tension",
  "suspense",
  "serenity",
  "confusion",
  "anticipation",
  "shock",
  "heartbreak",
  "triumph",
  "empathy",
  "regret",
  "elation",
  "dread",
  "awkwardness",
  "frustration",
  "paranoia",
  "compassion",
  "determination",
  "envy",
  "jealousy",
  "desperation",
  "courage",
  "melancholy",
  "satisfaction",
  "curiosity",
  "vindication",
  "helplessness",
  "delight",
  "disgust",
  "peace",
  "resentment",
  "inspiration",
  "justice",
  "disbelief",
  "euphoria",
  "bittersweetness",
];

const CreateStoryScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [autoGenerateAudio, setAutoGenerateAudio] = useState(false);
  const [generatedAudioVoiceId, setGeneratedAudioVoiceId] = useState<
    string | undefined
  >(undefined);
  const [audioControlRef, setAudioControlRef] = useState<{
    handlePlayPause: () => void;
    isPlaying: () => boolean;
  } | null>(null);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [audioGenerated, setAudioGenerated] = useState(false);
  const [showAudioGeneration, setShowAudioGeneration] = useState(false);
  const [hasRenderFailed, setHasRenderFailed] = useState(false);

  // Simple audio state - only one audio at a time

  // **FIXED: Enhanced voice name helper with localStorage caching**
  const getVoiceName = (voiceId: string) => {
    if (!voiceId) return "";

    // First, try to get from localStorage cache
    try {
      const cachedVoices = localStorage.getItem('murfVoicesCache');
      if (cachedVoices) {
        const parsedVoices: Array<{ voice_id: string; name: string }> = JSON.parse(cachedVoices);
        const cachedMatch = parsedVoices.find((v) => v.voice_id === voiceId);
        if (cachedMatch?.name) {
          return cachedMatch.name;
        }
      }
    } catch (error) {
      console.warn('Failed to parse cached voices from localStorage:', error);
    }

    // Fallback to dynamic Murf voices from API
    const murfVoices: Array<{ voice_id: string; name: string }> =
      (window as any)?.murfVoices || [];
    
    const murfMatch = Array.isArray(murfVoices)
      ? murfVoices.find((v) => v.voice_id === voiceId)
      : undefined;
    
    if (murfMatch?.name) {
      // Cache this voice for future use
      cacheVoice(murfMatch);
      return murfMatch.name;
    }

    return "Unknown Voice";
  };

  // **NEW: Function to cache voice data in localStorage**
  const cacheVoice = (voice: { voice_id: string; name: string }) => {
    try {
      const existingCache = localStorage.getItem('murfVoicesCache');
      let cachedVoices: Array<{ voice_id: string; name: string }> = [];
      
      if (existingCache) {
        try {
          cachedVoices = JSON.parse(existingCache);
        } catch (error) {
          console.warn('Failed to parse existing voice cache, starting fresh');
          cachedVoices = [];
        }
      }

      // Check if voice already exists in cache
      const existingIndex = cachedVoices.findIndex(v => v.voice_id === voice.voice_id);
      if (existingIndex >= 0) {
        // Update existing entry
        cachedVoices[existingIndex] = voice;
      } else {
        // Add new voice to cache
        cachedVoices.push(voice);
      }

      // Limit cache size to prevent localStorage from getting too large (max 100 voices)
      if (cachedVoices.length > 100) {
        cachedVoices = cachedVoices.slice(-100);
      }

      localStorage.setItem('murfVoicesCache', JSON.stringify(cachedVoices));
      console.log(`🎵 Cached voice: ${voice.name} (${voice.voice_id})`);
    } catch (error) {
      console.warn('Failed to cache voice in localStorage:', error);
    }
  };

  // **NEW: Function to bulk cache voices from API response**
  const cacheVoicesFromAPI = (voices: Array<{ voice_id: string; name: string }>) => {
    if (!Array.isArray(voices) || voices.length === 0) return;
    
    try {
      const existingCache = localStorage.getItem('murfVoicesCache');
      let cachedVoices: Array<{ voice_id: string; name: string }> = [];
      
      if (existingCache) {
        try {
          cachedVoices = JSON.parse(existingCache);
        } catch (error) {
          console.warn('Failed to parse existing voice cache, starting fresh');
          cachedVoices = [];
        }
      }

      // Merge new voices with existing cache
      voices.forEach(voice => {
        const existingIndex = cachedVoices.findIndex(v => v.voice_id === voice.voice_id);
        if (existingIndex >= 0) {
          cachedVoices[existingIndex] = voice;
        } else {
          cachedVoices.push(voice);
        }
      });

      // Limit cache size
      if (cachedVoices.length > 100) {
        cachedVoices = cachedVoices.slice(-100);
      }

      localStorage.setItem('murfVoicesCache', JSON.stringify(cachedVoices));
      console.log(`🎵 Bulk cached ${voices.length} voices in localStorage`);
    } catch (error) {
      console.warn('Failed to bulk cache voices in localStorage:', error);
    }
  };

  // **NEW: Function to get all cached voices**
  const getCachedVoices = (): Array<{ voice_id: string; name: string }> => {
    try {
      const cachedVoices = localStorage.getItem('murfVoicesCache');
      if (cachedVoices) {
        return JSON.parse(cachedVoices);
      }
    } catch (error) {
      console.warn('Failed to get cached voices:', error);
    }
    return [];
  };

  // **NEW: Function to clear voice cache**
  const clearVoiceCache = () => {
    try {
      localStorage.removeItem('murfVoicesCache');
      console.log('🎵 Voice cache cleared from localStorage');
    } catch (error) {
      console.warn('Failed to clear voice cache:', error);
    }
  };



  // Update audio state when audio is generated (replaces any previous audio)
  const handleAudioGenerated = (audioChunks: any[], totalDuration: number) => {
    const formattedAudioChunks = audioChunks.map((chunk) => ({
      id: chunk.id,
      name: chunk.name,
      text: chunk.text,
      duration: chunk.duration,
      startTime: chunk.startTime,
      filePath: chunk.filePath || chunk.relativePath || chunk.blobUrl || "",
    }));

    updateStoryData({
      audioChunks: formattedAudioChunks,
      totalAudioDuration: totalDuration,
    });
    setAudioGenerated(true);
    // Store which voice was used for this generated audio
    setGeneratedAudioVoiceId(storyData.selectedVoiceId);
  };

  // Initial story state for comparison
  const initialStoryState: StoryData = {
    videoStyle: "landscape",
    storyName: "",
    duration: 180, // 3 minutes default
    genre: "",
    mainPrompt: "",
    language: "English",
    additionalContext: [],
    videoToneEmotions: [],
    selectedVoiceId: undefined,
  };

  const [storyData, setStoryData] = useState<StoryData>(initialStoryState);
  const [originalStoryData, setOriginalStoryData] = useState<StoryData | null>(
    null
  );

  // Video Editor State - Lifted to persist across navigation steps
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [layers, setLayers] = useState<Layer[]>([
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

  // **NEW: Initialize voice cache from localStorage and API on component mount**
  useEffect(() => {
    const initializeVoiceCache = async () => {
      try {
        // Check if we already have voices cached
        const existingCache = localStorage.getItem('murfVoicesCache');
        if (existingCache) {
          const cachedVoices = JSON.parse(existingCache);
          console.log(`🎵 Found existing voice cache in localStorage with ${cachedVoices.length} voices`);
          return;
        }

        // If no cache exists, try to get voices from API and cache them
        console.log('🎵 No voice cache found, attempting to fetch from API...');
        
        // Check if murfVoices are already available in window object
        const murfVoices: Array<{ voice_id: string; name: string }> = (window as any)?.murfVoices || [];
        if (murfVoices.length > 0) {
          console.log(`🎵 Found ${murfVoices.length} voices in window object, caching them...`);
          cacheVoicesFromAPI(murfVoices);
        } else {
          console.log('🎵 No voices found in window object, will cache when available');
        }
      } catch (error) {
        console.warn('Failed to initialize voice cache:', error);
      }
    };

    initializeVoiceCache();
  }, []);

  // **NEW: Monitor for voices becoming available and cache them automatically**
  useEffect(() => {
    const checkForVoices = () => {
      const murfVoices: Array<{ voice_id: string; name: string }> = (window as any)?.murfVoices || [];
      if (murfVoices.length > 0) {
        // Check if we need to cache these voices
        const existingCache = localStorage.getItem('murfVoicesCache');
        if (!existingCache) {
          console.log(`🎵 Voices became available, caching ${murfVoices.length} voices...`);
          cacheVoicesFromAPI(murfVoices);
        }
      }
    };

    // Check immediately
    checkForVoices();
    
    // Set up an interval to check for voices (they might load asynchronously)
    const interval = setInterval(checkForVoices, 2000); // Check every 2 seconds
    
    // Clean up interval
    return () => clearInterval(interval);
  }, []);

  // Generate a temporary story ID for new stories to enable audio file storage
  useEffect(() => {
    if (!storyData.storyId) {
      const tempId = `temp-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      updateStoryData({ storyId: tempId });
    }
  }, []);

  const totalSteps = 8;

  // Helper function to compare arrays
  const arraysEqual = (a: any[], b: any[]): boolean => {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  };

  // Load existing story data if storyId is provided
  useEffect(() => {
    const loadExistingStory = async () => {
      const storyId = location.state?.storyId;
      console.log("🔍 DEBUG: Story ID:", storyId);
      if (storyId === null || storyId === undefined) return;

      setIsLoadingStory(true);
      try {
        const { apiService } = await import("../../lib/api");
        const response = await apiService.getStory(storyId);
        console.log("🔍 DEBUG: API Response:", response);
        if (response.success) {
          const story = response.data.story;
          console.log("🔍 DEBUG: Loaded story data:", story);

          // Extract story content from full content (remove metadata)
          let storyContent = story.content || "";
          let storySummary = story.storySummary || "";

          // If the story has the old format with ***** markers, extract the story content
          if (story.content && story.content.includes("*****")) {
            const parts = story.content.split("*****");
            if (parts.length >= 3) {
              storyContent = parts[0].trim(); // Main story content
              storySummary = parts[2].trim(); // Summary between *****
            }
          }

          const newStoryData = {
            videoStyle: story.videoStyle || "landscape",
            storyName: story.title,
            duration: story.duration || 180,
            genre: story.genre || "Fable",
            mainPrompt: story.mainPrompt || "",
            language: story.language || "English",
            additionalContext: story.additionalContext || [],
            videoToneEmotions: story.videoToneEmotions || [],
            generatedContent: storyContent, // Only story content for display
            storyId: story.id,
            isDraft: story.isDraft,
            currentStep: story.currentStep || 1,
            maxStepReached: story.maxStepReached || story.currentStep || 1,
            // New fields for two-stage generation
            storySummary: story.storySummary || storySummary,
            chapterSummaries: story.chapterSummaries || [],
            youtubeTitle: story.youtubeTitle || "",
            youtubeDescription: story.youtubeDescription || "",
            youtubeTags: story.youtubeTags || "",
            stockFootageTerms: story.stockFootageTerms || "",
            chapters: story.chapters || [],
            currentChapter: story.currentChapter || 0,
            totalChapters: story.totalChapters || 0,
            // Voice and audio data
            selectedVoiceId: story.selectedVoiceId,
            audioChunks: story.audioChunks,
            totalAudioDuration: story.totalAudioDuration,
            videoAssets: story.videoAssets,
          };

          console.log("🔍 DEBUG: Setting story data:", newStoryData);
          console.log("📼 DEBUG: Loaded videoAssets from database:", {
            hasVideoAssets: !!newStoryData.videoAssets,
            videoAssetsKeys: newStoryData.videoAssets
              ? Object.keys(newStoryData.videoAssets)
              : [],
            mediaLibraryCount:
              (newStoryData.videoAssets as any)?.mediaLibrary?.length || 0,
            layersCount: (newStoryData.videoAssets as any)?.layers?.length || 0,
          });
          setStoryData(newStoryData);

          // If story has audio chunks and voice ID, set as generated audio voice
          if (
            newStoryData.audioChunks &&
            newStoryData.audioChunks.length > 0 &&
            newStoryData.selectedVoiceId
          ) {
            setGeneratedAudioVoiceId(newStoryData.selectedVoiceId);
            setAudioGenerated(true);
          }

          // Save the original loaded state for change detection
          setOriginalStoryData(newStoryData);

          // Determine the appropriate step to show based on user's progress
          let resumeStep = 1;
          const maxReached = story.maxStepReached || 1;

          if (
            story.videoAssets &&
            story.videoAssets.audioChunks &&
            story.videoAssets.audioChunks.length > 0
          ) {
            // User has generated audio, show video editor (step 7)
            resumeStep = 7;
            setGenerationComplete(true);
            setAudioGenerated(true);
          } else if (story.audioChunks && story.audioChunks.length > 0) {
            // User has generated audio chunks, show voice selection with audio preview (step 6)
            resumeStep = 6;
            setGenerationComplete(true);
            setAudioGenerated(true);
            setShowAudioGeneration(true);
          } else if (story.selectedVoiceId) {
            // User has selected voice, show voice selection (step 6) but don't auto-show audio generation
            resumeStep = 6;
            setGenerationComplete(true);
            // Don't set showAudioGeneration here - let user click "Generate Audio" button
          } else if (story.status === "completed" || story.content) {
            // For completed stories with content, go to step 5
            resumeStep = 5;
            setGenerationComplete(true);
          } else {
            // For drafts, go to the step they left off or max reached
            resumeStep = Math.max(story.currentStep || 1, maxReached);
          }

          setCurrentStep(resumeStep);

          // If the story has content, mark generation as complete
          if (story.content) {
            setGenerationComplete(true);
          }

          const stepMessage =
            story.status === "completed" || story.content
              ? "Story completed - you can review and edit the generated content"
              : `Continuing from step ${story.currentStep || 1}`;

          addToast({
            type: "info",
            title: "Story Loaded",
            message: stepMessage,
          });
        }
      } catch (error) {
        console.error("Error loading story:", error);
        addToast({
          type: "error",
          title: "Load Failed",
          message: "Failed to load story data",
        });
      } finally {
        setIsLoadingStory(false);
      }
    };

    loadExistingStory();
  }, [location.state?.storyId, addToast]);

  const updateStoryData = (updates: Partial<StoryData>) => {
    setStoryData((prev) => {
      const newData = { ...prev, ...updates };
      
      // If this is a new story and we haven't set original data yet, set it now
      if (!originalStoryData && !storyData.storyId) {
        setOriginalStoryData(initialStoryState);
      }

      return newData;
    });
  };

  // Helper function to validate if story ID is valid for saving
  const isValidStoryIdForSave = (storyId: string | undefined): boolean => {
    return !!(
      storyId && 
      storyId !== "" && 
      !storyId.startsWith("temp-")
    );
  };

  // Auto-save when voice is selected
  useEffect(() => {
    const autoSaveVoiceSelection = async () => {
      console.log("🎵 DEBUG: Voice selection auto-save check:", {
        selectedVoiceId: storyData.selectedVoiceId,
        storyId: storyData.storyId,
        isValidStoryId: isValidStoryIdForSave(storyData.storyId),
        hasGeneratedContent: !!storyData.generatedContent,
        willSave: !!(storyData.selectedVoiceId && 
                    isValidStoryIdForSave(storyData.storyId) && 
                    storyData.generatedContent)
      });

      if (
        storyData.selectedVoiceId &&
        isValidStoryIdForSave(storyData.storyId) &&
        storyData.generatedContent
      ) {
        try {
          const { apiService } = await import("../../lib/api");
          await apiService.updateStory(storyData.storyId!, {
            selectedVoiceId: storyData.selectedVoiceId,
          });
          console.log("Voice selection auto-saved");
        } catch (error) {
          console.error("Failed to auto-save voice selection:", error);
        }
      }
    };

    autoSaveVoiceSelection();
  }, [storyData.selectedVoiceId]);

  // Auto-save video assets when they change
  useEffect(() => {
    const autoSaveVideoAssets = async () => {
      console.log("📼 DEBUG: Video assets auto-save check:", {
        hasVideoAssets: !!storyData.videoAssets,
        storyId: storyData.storyId,
        isValidStoryId: isValidStoryIdForSave(storyData.storyId),
        isTemporaryStory: storyData.storyId?.startsWith("temp-"),
        videoAssetsKeys: storyData.videoAssets ? Object.keys(storyData.videoAssets) : [],
        mediaLibraryCount: (storyData.videoAssets as any)?.mediaLibrary?.length || 0,
        layersCount: (storyData.videoAssets as any)?.layers?.length || 0,
        willSave: !!(storyData.videoAssets && (isValidStoryIdForSave(storyData.storyId) || storyData.storyId?.startsWith("temp-")))
      });

      if (
        storyData.videoAssets &&
        (isValidStoryIdForSave(storyData.storyId) || (storyData.storyId && storyData.storyId.startsWith("temp-")))
      ) {
        try {
          const { apiService } = await import("../../lib/api");

          // If story is temporary, create it first
          if (storyData.storyId && storyData.storyId.startsWith("temp-")) {
            console.log("🔄 Auto-creating story from temporary ID for video assets...");
            
            const fullContentWithMetadata = `${storyData.generatedContent}\n\n*****\n${storyData.youtubeTitle}\n\n${storyData.youtubeDescription}\n\n${storyData.youtubeTags}\n\n${storyData.stockFootageTerms}\n*****\n${storyData.storySummary}\n*****`;

            const response = await apiService.createStory({
              title: storyData.storyName,
              content: fullContentWithMetadata,
              genre: storyData.genre,
              duration: storyData.duration,
              isDraft: true,
              currentStep: totalSteps,
              videoStyle: storyData.videoStyle,
              language: storyData.language,
              additionalContext: storyData.additionalContext,
              videoToneEmotions: storyData.videoToneEmotions,
              mainPrompt: storyData.mainPrompt,
              storySummary: storyData.storySummary,
              chapterSummaries: storyData.chapterSummaries,
              youtubeTitle: storyData.youtubeTitle,
              youtubeDescription: storyData.youtubeDescription,
              youtubeTags: storyData.youtubeTags,
              stockFootageTerms: storyData.stockFootageTerms,
              chapters: storyData.chapters,
              totalChapters: storyData.totalChapters,
              selectedVoiceId: storyData.selectedVoiceId,
              audioChunks: storyData.audioChunks,
              totalAudioDuration: storyData.totalAudioDuration,
              videoAssets: storyData.videoAssets,
              transcriptInfo: storyData.transcriptInfo,
              stockMediaInfo: storyData.stockMediaInfo,
            });

            if (response.success) {
              // Update story ID from temporary to real ID
              updateStoryData({ storyId: response.data.story.id });
              console.log("✅ Story auto-created successfully with ID:", response.data.story.id);
            } else {
              throw new Error("Failed to auto-create story");
            }
          } else {
            // Update existing story
            await apiService.updateStory(storyData.storyId!, {
              videoAssets: storyData.videoAssets,
              transcriptInfo: storyData.transcriptInfo,
              stockMediaInfo: storyData.stockMediaInfo,
            });
            console.log("✅ Video assets auto-saved successfully");
          }
        } catch (error) {
          console.error("❌ Failed to auto-save video assets:", error);
        }
      } else {
        console.log("⏸️ Video assets auto-save skipped - conditions not met");
      }
    };

    autoSaveVideoAssets();
  }, [storyData.videoAssets, storyData.transcriptInfo, storyData.stockMediaInfo]);

  // Auto-save audio chunks when they change
  useEffect(() => {
    const autoSaveAudioChunks = async () => {
      if (
        storyData.audioChunks &&
        storyData.audioChunks.length > 0 &&
        isValidStoryIdForSave(storyData.storyId)
      ) {
        try {
          const { apiService } = await import("../../lib/api");
          await apiService.updateStory(storyData.storyId!, {
            audioChunks: storyData.audioChunks,
            totalAudioDuration: storyData.totalAudioDuration,
          });
          console.log("Audio chunks auto-saved");
        } catch (error) {
          console.error("Failed to auto-save audio chunks:", error);
        }
      }
    };

    autoSaveAudioChunks();
  }, [storyData.audioChunks, storyData.totalAudioDuration]);

  // Debug: Monitor story ID changes
  useEffect(() => {
    console.log("🔍 DEBUG: Story ID changed:", {
      storyId: storyData.storyId,
      isValid: isValidStoryIdForSave(storyData.storyId),
      hasGeneratedContent: !!storyData.generatedContent,
      currentStep: currentStep
    });
  }, [storyData.storyId, storyData.generatedContent, currentStep]);

  // Force story creation when entering video editor step (step 7)
  useEffect(() => {
    const forceStoryCreation = async () => {
      if (currentStep === 7 && 
          storyData.storyId && 
          storyData.storyId.startsWith("temp-") && 
          storyData.generatedContent) {
        
        console.log("🚀 Force creating story before entering video editor...");
        
        try {
          const { apiService } = await import("../../lib/api");
          
          const fullContentWithMetadata = `${storyData.generatedContent}\n\n*****\n${storyData.youtubeTitle}\n\n${storyData.youtubeDescription}\n\n${storyData.youtubeTags}\n\n${storyData.stockFootageTerms}\n*****\n${storyData.storySummary}\n*****`;

          const response = await apiService.createStory({
            title: storyData.storyName,
            content: fullContentWithMetadata,
            genre: storyData.genre,
            duration: storyData.duration,
            isDraft: true,
            currentStep: totalSteps,
            videoStyle: storyData.videoStyle,
            language: storyData.language,
            additionalContext: storyData.additionalContext,
            videoToneEmotions: storyData.videoToneEmotions,
            mainPrompt: storyData.mainPrompt,
            storySummary: storyData.storySummary,
            chapterSummaries: storyData.chapterSummaries,
            youtubeTitle: storyData.youtubeTitle,
            youtubeDescription: storyData.youtubeDescription,
            youtubeTags: storyData.youtubeTags,
            stockFootageTerms: storyData.stockFootageTerms,
            chapters: storyData.chapters,
            totalChapters: storyData.totalChapters,
            selectedVoiceId: storyData.selectedVoiceId,
            audioChunks: storyData.audioChunks,
            totalAudioDuration: storyData.totalAudioDuration,
            videoAssets: storyData.videoAssets,
            transcriptInfo: storyData.transcriptInfo,
            stockMediaInfo: storyData.stockMediaInfo,
          });

          if (response.success) {
            // Update story ID from temporary to real ID
            updateStoryData({ storyId: response.data.story.id });
            console.log("✅ Story force-created successfully with ID:", response.data.story.id);
          } else {
            console.error("❌ Failed to force-create story");
          }
        } catch (error) {
          console.error("❌ Error force-creating story:", error);
        }
      }
    };

    forceStoryCreation();
  }, [currentStep, storyData.storyId, storyData.generatedContent]);

  // Periodic auto-save when in video editor step
  useEffect(() => {
    console.log("⏰ DEBUG: Periodic auto-save check:", {
      currentStep: currentStep,
      storyId: storyData.storyId,
      isValidStoryId: isValidStoryIdForSave(storyData.storyId),
      isTemporaryStory: storyData.storyId?.startsWith("temp-"),
      hasVideoAssets: !!storyData.videoAssets,
      willStartInterval: !!(currentStep === 7 && 
                           (isValidStoryIdForSave(storyData.storyId) || storyData.storyId?.startsWith("temp-")) && 
                           storyData.videoAssets)
    });

    if (currentStep === 7 && 
        (isValidStoryIdForSave(storyData.storyId) || (storyData.storyId && storyData.storyId.startsWith("temp-"))) && 
        storyData.videoAssets) {
      console.log("🔄 Starting periodic auto-save interval (every 10 seconds)");
      const interval = setInterval(async () => {
        try {
          const { apiService } = await import("../../lib/api");

          // If story is temporary, create it first
          if (storyData.storyId && storyData.storyId.startsWith("temp-")) {
            console.log("🔄 Periodic auto-save: Creating story from temporary ID...");
            
            const fullContentWithMetadata = `${storyData.generatedContent}\n\n*****\n${storyData.youtubeTitle}\n\n${storyData.youtubeDescription}\n\n${storyData.youtubeTags}\n\n${storyData.stockFootageTerms}\n*****\n${storyData.storySummary}\n*****`;

            const response = await apiService.createStory({
              title: storyData.storyName,
              content: fullContentWithMetadata,
              genre: storyData.genre,
              duration: storyData.duration,
              isDraft: true,
              currentStep: totalSteps,
              videoStyle: storyData.videoStyle,
              language: storyData.language,
              additionalContext: storyData.additionalContext,
              videoToneEmotions: storyData.videoToneEmotions,
              mainPrompt: storyData.mainPrompt,
              storySummary: storyData.storySummary,
              chapterSummaries: storyData.chapterSummaries,
              youtubeTitle: storyData.youtubeTitle,
              youtubeDescription: storyData.youtubeDescription,
              youtubeTags: storyData.youtubeTags,
              stockFootageTerms: storyData.stockFootageTerms,
              chapters: storyData.chapters,
              totalChapters: storyData.totalChapters,
              selectedVoiceId: storyData.selectedVoiceId,
              audioChunks: storyData.audioChunks,
              totalAudioDuration: storyData.totalAudioDuration,
              videoAssets: storyData.videoAssets,
              transcriptInfo: storyData.transcriptInfo,
              stockMediaInfo: storyData.stockMediaInfo,
            });

            if (response.success) {
              // Update story ID from temporary to real ID
              updateStoryData({ storyId: response.data.story.id });
              console.log("✅ Periodic auto-save: Story created successfully with ID:", response.data.story.id);
            } else {
              throw new Error("Failed to create story during periodic auto-save");
            }
          } else {
            // Update existing story
            await apiService.updateStory(storyData.storyId!, {
              videoAssets: storyData.videoAssets,
              transcriptInfo: storyData.transcriptInfo,
              stockMediaInfo: storyData.stockMediaInfo,
            });
            console.log("💾 Periodic auto-save of video assets completed");
          }
        } catch (error) {
          console.error("❌ Failed to periodic auto-save video assets:", error);
        }
      }, 10000); // Save every 10 seconds

      return () => {
        console.log("🛑 Stopping periodic auto-save interval");
        clearInterval(interval);
      };
    }
  }, [currentStep, storyData.storyId, storyData.videoAssets, storyData.transcriptInfo, storyData.stockMediaInfo]);

  // Save video assets when leaving video editor step
  useEffect(() => {
    return () => {
      // This cleanup function runs when the component unmounts or when dependencies change
      if (currentStep === 7 && 
          isValidStoryIdForSave(storyData.storyId) && 
          storyData.videoAssets) {
        const saveOnExit = async () => {
          try {
            const { apiService } = await import("../../lib/api");
            await apiService.updateStory(storyData.storyId!, {
              videoAssets: storyData.videoAssets,
              transcriptInfo: storyData.transcriptInfo,
              stockMediaInfo: storyData.stockMediaInfo,
            });
            console.log("💾 Save on exit from video editor");
          } catch (error) {
            console.error("Failed to save on exit from video editor:", error);
          }
        };
        saveOnExit();
      }
    };
  }, [currentStep, storyData.storyId, storyData.videoAssets, storyData.transcriptInfo, storyData.stockMediaInfo]);

  const handleNext = () => {
    // Stop any playing audio before navigation
    if (audioControlRef && audioControlRef.isPlaying()) {
      audioControlRef.handlePlayPause();
    }

    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;
      
      // Force story creation when entering video editor (step 7)
      if (currentStep === 6 && nextStep === 7 && 
          storyData.storyId && 
          storyData.storyId.startsWith("temp-") && 
          storyData.generatedContent) {
        
        console.log("🚀 Force creating story before entering video editor (handleNext)...");
        
        const forceStoryCreation = async () => {
          try {
            const { apiService } = await import("../../lib/api");
            
            const fullContentWithMetadata = `${storyData.generatedContent}\n\n*****\n${storyData.youtubeTitle}\n\n${storyData.youtubeDescription}\n\n${storyData.youtubeTags}\n\n${storyData.stockFootageTerms}\n*****\n${storyData.storySummary}\n*****`;

            const response = await apiService.createStory({
              title: storyData.storyName,
              content: fullContentWithMetadata,
              genre: storyData.genre,
              duration: storyData.duration,
              isDraft: true,
              currentStep: totalSteps,
              videoStyle: storyData.videoStyle,
              language: storyData.language,
              additionalContext: storyData.additionalContext,
              videoToneEmotions: storyData.videoToneEmotions,
              mainPrompt: storyData.mainPrompt,
              storySummary: storyData.storySummary,
              chapterSummaries: storyData.chapterSummaries,
              youtubeTitle: storyData.youtubeTitle,
              youtubeDescription: storyData.youtubeDescription,
              youtubeTags: storyData.youtubeTags,
              stockFootageTerms: storyData.stockFootageTerms,
              chapters: storyData.chapters,
              totalChapters: storyData.totalChapters,
              selectedVoiceId: storyData.selectedVoiceId,
              audioChunks: storyData.audioChunks,
              totalAudioDuration: storyData.totalAudioDuration,
              videoAssets: storyData.videoAssets,
              transcriptInfo: storyData.transcriptInfo,
              stockMediaInfo: storyData.stockMediaInfo,
            });

            if (response.success) {
              // Update story ID from temporary to real ID
              updateStoryData({ storyId: response.data.story.id });
              console.log("✅ Story force-created successfully with ID:", response.data.story.id);
              
              // Now proceed to next step with real story ID
              setCurrentStep(nextStep);
              updateStoryData({
                maxStepReached: Math.max(storyData.maxStepReached || 1, nextStep),
              });
            } else {
              console.error("❌ Failed to force-create story");
              // Still proceed to next step even if creation fails
              setCurrentStep(nextStep);
              updateStoryData({
                maxStepReached: Math.max(storyData.maxStepReached || 1, nextStep),
              });
            }
          } catch (error) {
            console.error("❌ Error force-creating story:", error);
            // Still proceed to next step even if creation fails
            setCurrentStep(nextStep);
            updateStoryData({
              maxStepReached: Math.max(storyData.maxStepReached || 1, nextStep),
            });
          }
        };
        
        forceStoryCreation();
        return; // Exit early, step change will happen in the async function
      }
      
      // Normal navigation for other steps
      setCurrentStep(nextStep);

      // Update maxStepReached if we're going to a new step
      updateStoryData({
        maxStepReached: Math.max(storyData.maxStepReached || 1, nextStep),
      });

      // Force save current state when navigating
      if (isValidStoryIdForSave(storyData.storyId)) {
        const forceSaveCurrentState = async () => {
          try {
            const { apiService } = await import("../../lib/api");
            await apiService.updateStory(storyData.storyId!, {
              maxStepReached: Math.max(storyData.maxStepReached || 1, nextStep),
              videoAssets: storyData.videoAssets,
              transcriptInfo: storyData.transcriptInfo,
              stockMediaInfo: storyData.stockMediaInfo,
              audioChunks: storyData.audioChunks,
              totalAudioDuration: storyData.totalAudioDuration,
            });
            console.log("💾 Forced save during step navigation");
          } catch (error) {
            console.error("Failed to force save during navigation:", error);
          }
        };
        forceSaveCurrentState();
      }
    }
  };

  const handlePrevious = () => {
    // Stop any playing audio before navigation
    if (audioControlRef && audioControlRef.isPlaying()) {
      audioControlRef.handlePlayPause();
    }

    if (currentStep > 1) {
      const previousStep = currentStep - 1;
      setCurrentStep(previousStep);

      // Force save current state when navigating back
      if (isValidStoryIdForSave(storyData.storyId)) {
        const forceSaveCurrentState = async () => {
          try {
            const { apiService } = await import("../../lib/api");
            await apiService.updateStory(storyData.storyId!, {
              videoAssets: storyData.videoAssets,
              transcriptInfo: storyData.transcriptInfo,
              stockMediaInfo: storyData.stockMediaInfo,
              audioChunks: storyData.audioChunks,
              totalAudioDuration: storyData.totalAudioDuration,
            });
            console.log("💾 Forced save during backward navigation");
          } catch (error) {
            console.error("Failed to force save during backward navigation:", error);
          }
        };
        forceSaveCurrentState();
      }
    }
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return storyData.storyName.trim().length > 0;
      case 2:
        return storyData.duration >= 30 && storyData.genre !== "";
      case 3:
        return storyData.mainPrompt.trim().length > 0;
      case 4:
        return true; // All fields are optional
      case 5:
        return !!(
          storyData.generatedContent && storyData.generatedContent.length > 0
        );
      case 6:
        return !!storyData.selectedVoiceId;
      case 7:
        return true; // Video editing step - always accessible once audio is generated
      default:
        return false;
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationComplete(false);
    updateStoryData({
      generatedContent: "",
      storySummary: "",
      chapterSummaries: [],
      youtubeTitle: "",
      youtubeDescription: "",
      youtubeTags: "",
      stockFootageTerms: "",
      chapters: [],
      currentChapter: 0,
      totalChapters: 0,
    });
    setCurrentStep(5);

    try {
      const { apiService } = await import("../../lib/api");

      // Stage 1: Generate story structure and metadata
      addToast({
        type: "info",
        title: "Generating Story Structure",
        message: "Creating story outline and metadata...",
      });

      await apiService.generateStoryStructure(
        {
          title: storyData.storyName,
          genre: storyData.genre,
          duration: storyData.duration,
          mainPrompt: storyData.mainPrompt,
          language: storyData.language,
          additionalContext: storyData.additionalContext,
          videoToneEmotions: storyData.videoToneEmotions,
        },
        (chunk: any) => {
          if (chunk.type === "start") {
            addToast({
              type: "info",
              title: "Generating Structure",
              message: chunk.message,
            });
          } else if (chunk.type === "chunk") {
            // Don't display structure generation content in the story text
            // This is just metadata generation
          }
        },
        (data?: {
          storySummary: string;
          chapterSummaries: Array<{ number: number; summary: string }>;
          youtubeTitle: string;
          youtubeDescription: string;
          youtubeTags: string;
          stockFootageTerms: string;
        }) => {
          if (data) {
            // Store the metadata
            setStoryData((prev: StoryData) => ({
              ...prev,
              storySummary: data.storySummary,
              chapterSummaries: data.chapterSummaries,
              youtubeTitle: data.youtubeTitle,
              youtubeDescription: data.youtubeDescription,
              youtubeTags: data.youtubeTags,
              stockFootageTerms: data.stockFootageTerms,
              totalChapters: data.chapterSummaries.length,
              currentChapter: 0,
            }));

            // Stage 2: Generate each chapter's content
            generateChapters(data.chapterSummaries, data.storySummary);
          }
        },
        (error: any) => {
          setIsGenerating(false);
          setGenerationComplete(false);
          addToast({
            type: "error",
            title: "Structure Generation Failed",
            message: error.message || "Failed to generate story structure",
          });
        }
      );
    } catch (error) {
      setIsGenerating(false);
      setGenerationComplete(false);
      addToast({
        type: "error",
        title: "Generation Failed",
        message:
          error instanceof Error ? error.message : "Failed to generate story",
      });
    }
  };

  const generateChapters = async (
    chapterSummaries: Array<{ number: number; summary: string }>,
    storySummary: string
  ) => {
    const { apiService } = await import("../../lib/api");
    const chapters: Array<{ number: number; content: string }> = [];
    let currentChapterIndex = 0;

    const generateNextChapter = async () => {
      if (currentChapterIndex >= chapterSummaries.length) {
        // All chapters generated, combine them for story content only
        const fullStoryContent = chapters
          .sort((a, b) => a.number - b.number)
          .map((chapter) => chapter.content)
          .join("\n\n");

        // Store the full content with metadata separately (for saving to database)

        setStoryData((prev: StoryData) => ({
          ...prev,
          generatedContent: fullStoryContent, // Only story content for display
          chapters: chapters,
        }));

        setIsGenerating(false);
        setGenerationComplete(true);

        const finalWordCount = fullStoryContent.split(/\s+/).length;
        addToast({
          type: "success",
          title: "Story Generated!",
          message: `Your amazing story has been created successfully! (${finalWordCount} words)`,
        });
        return;
      }

      const chapter = chapterSummaries[currentChapterIndex];

      setStoryData((prev: StoryData) => ({
        ...prev,
        currentChapter: chapter.number,
      }));

      await apiService.generateChapterContent(
        {
          chapterSummary: chapter.summary,
          chapterNumber: chapter.number,
          storySummary: storySummary,
          topic: storyData.mainPrompt,
          genre: storyData.genre,
          language: storyData.language,
          duration: storyData.duration,
          videoToneEmotions: storyData.videoToneEmotions,
        },
        (chunk: any) => {
          if (chunk.type === "start") {
          } else if (chunk.type === "chunk") {
            // Update the current chapter content in real-time
            setStoryData((prev: StoryData) => {
              const updatedChapters = [...(prev.chapters || [])];
              const existingChapterIndex = updatedChapters.findIndex(
                (c) => c.number === chapter.number
              );

              if (existingChapterIndex >= 0) {
                updatedChapters[existingChapterIndex] = {
                  ...updatedChapters[existingChapterIndex],
                  content:
                    (updatedChapters[existingChapterIndex].content || "") +
                    chunk.content,
                };
              } else {
                updatedChapters.push({
                  number: chapter.number,
                  content: chunk.content,
                });
              }

              // Combine all chapters for display (story content only)
              const combinedContent = updatedChapters
                .sort((a, b) => a.number - b.number)
                .map((c) => c.content)
                .join("\n\n");

              return {
                ...prev,
                chapters: updatedChapters,
                generatedContent: combinedContent, // Only story content
              };
            });
          }
        },
        (data?: { chapterContent: string; chapterNumber: number }) => {
          if (data) {
            chapters.push({
              number: data.chapterNumber,
              content: data.chapterContent,
            });

            addToast({
              type: "success",
              title: `Chapter ${data.chapterNumber} Complete`,
              message: `Chapter ${data.chapterNumber} has been generated successfully!`,
            });
          }

          currentChapterIndex++;
          generateNextChapter();
        },
        (error: any) => {
          setIsGenerating(false);
          setGenerationComplete(false);
          addToast({
            type: "error",
            title: `Chapter ${chapter.number} Generation Failed`,
            message:
              error.message || `Failed to generate chapter ${chapter.number}`,
          });
        }
      );
    };

    // Start generating chapters
    await generateNextChapter();
  };

  const handleCancel = () => {
    // Stop any playing audio before checking for changes/navigation
    if (audioControlRef && audioControlRef.isPlaying()) {
      audioControlRef.handlePlayPause();
    }

    // If no original data exists (new story), compare with initial state
    const comparisonData = originalStoryData || initialStoryState;

    // Compare current story state with original/initial state
    const hasChanges =
      storyData.storyName !== comparisonData.storyName ||
      storyData.videoStyle !== comparisonData.videoStyle ||
      storyData.duration !== comparisonData.duration ||
      storyData.genre !== comparisonData.genre ||
      storyData.mainPrompt !== comparisonData.mainPrompt ||
      storyData.language !== comparisonData.language ||
      !arraysEqual(
        storyData.additionalContext,
        comparisonData.additionalContext
      ) ||
      !arraysEqual(
        storyData.videoToneEmotions,
        comparisonData.videoToneEmotions
      ) ||
      storyData.generatedContent !== comparisonData.generatedContent ||
      (originalStoryData
        ? currentStep !== originalStoryData.currentStep
        : currentStep !== 1) ||
      isGenerating ||
      generationComplete;

    console.log("🔍 DEBUG: Change detection:", {
      hasChanges,
      currentStory: storyData,
      originalStory: comparisonData,
      currentStep,
      originalStep: originalStoryData?.currentStep,
    });

    if (!hasChanges) {
      // No changes detected, go directly to dashboard
      console.log("🔍 DEBUG: No changes detected, navigating directly");
      // Stop any playing audio before navigation
      if (audioControlRef) {
        audioControlRef.handlePlayPause();
      }
      navigate("/dashboard");
    } else {
      // Changes detected, show confirmation dialog
      console.log("🔍 DEBUG: Changes detected, showing confirmation dialog");
      setShowCancelDialog(true);
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelDialog(false);
    // Stop any playing audio before navigation
    if (audioControlRef) {
      audioControlRef.handlePlayPause();
    }
    navigate("/dashboard");
  };

  const handleSaveAsDraft = async () => {
    // Stop any playing audio before saving and navigation
    if (audioControlRef && audioControlRef.isPlaying()) {
      audioControlRef.handlePlayPause();
    }

    setIsSaving(true);
    try {
      const { apiService } = await import("../../lib/api");

      // Create the full content with metadata for saving to database
      const fullContentWithMetadata = storyData.generatedContent
        ? `${storyData.generatedContent}\n\n*****\n${storyData.youtubeTitle}\n\n${storyData.youtubeDescription}\n\n${storyData.youtubeTags}\n\n${storyData.stockFootageTerms}\n*****\n${storyData.storySummary}\n*****`
        : "";

      // Check if this is a real story ID or a temporary one
      const isRealStory =
        storyData.storyId && !storyData.storyId.startsWith("temp-");

      if (isRealStory) {
        // Update existing story as draft
        console.log("📝 Attempting to update existing story:", {
          storyId: storyData.storyId,
          storyName: storyData.storyName,
          storyIdType: typeof storyData.storyId,
          storyIdLength: storyData.storyId?.length,
          isTemp: storyData.storyId?.startsWith("temp-"),
        });

        const response = await apiService.updateStory(storyData.storyId!, {
          title: storyData.storyName,
          content: fullContentWithMetadata,
          genre: storyData.genre,
          duration: storyData.duration,
          isDraft: true,
          currentStep: currentStep,
          maxStepReached: storyData.maxStepReached,
          videoStyle: storyData.videoStyle,
          language: storyData.language,
          additionalContext: storyData.additionalContext,
          videoToneEmotions: storyData.videoToneEmotions,
          mainPrompt: storyData.mainPrompt,
          // New fields for two-stage generation
          storySummary: storyData.storySummary,
          chapterSummaries: storyData.chapterSummaries,
          youtubeTitle: storyData.youtubeTitle,
          youtubeDescription: storyData.youtubeDescription,
          youtubeTags: storyData.youtubeTags,
          stockFootageTerms: storyData.stockFootageTerms,
          chapters: storyData.chapters,
          totalChapters: storyData.totalChapters,
          // Voice and audio data
          selectedVoiceId: storyData.selectedVoiceId,
          audioChunks: storyData.audioChunks,
          totalAudioDuration: storyData.totalAudioDuration,
          videoAssets: storyData.videoAssets,
          transcriptInfo: storyData.transcriptInfo,
          stockMediaInfo: storyData.stockMediaInfo,
        });

        if (response.success) {
          addToast({
            type: "success",
            title: "Draft Updated!",
            message: "Your story has been saved as a draft",
          });
          navigate("/dashboard", { state: { refresh: true } });
        }
      } else {
        // Create new story as draft (or convert temporary story)
        console.log("📝 Creating new story as draft:", {
          storyName: storyData.storyName,
          hasStoryId: !!storyData.storyId,
          storyId: storyData.storyId,
          isTemp: storyData.storyId?.startsWith("temp-"),
          reason: !storyData.storyId ? "No story ID" : "Temporary story ID",
        });

        const response = await apiService.createStory({
          title: storyData.storyName,
          content: fullContentWithMetadata,
          genre: storyData.genre,
          duration: storyData.duration,
          isDraft: true,
          currentStep: currentStep,
          maxStepReached: storyData.maxStepReached,
          videoStyle: storyData.videoStyle,
          language: storyData.language,
          additionalContext: storyData.additionalContext,
          videoToneEmotions: storyData.videoToneEmotions,
          mainPrompt: storyData.mainPrompt,
          // New fields for two-stage generation
          storySummary: storyData.storySummary,
          chapterSummaries: storyData.chapterSummaries,
          youtubeTitle: storyData.youtubeTitle,
          youtubeDescription: storyData.youtubeDescription,
          youtubeTags: storyData.youtubeTags,
          stockFootageTerms: storyData.stockFootageTerms,
          chapters: storyData.chapters,
          totalChapters: storyData.totalChapters,
          // Voice and audio data
          selectedVoiceId: storyData.selectedVoiceId,
          audioChunks: storyData.audioChunks,
          totalAudioDuration: storyData.totalAudioDuration,
          videoAssets: storyData.videoAssets,
          transcriptInfo: storyData.transcriptInfo,
          stockMediaInfo: storyData.stockMediaInfo,
        });

        if (response.success) {
          // Update story ID from temporary to real ID
          if (
            storyData.storyId?.startsWith("temp-") &&
            response.data?.story?.id
          ) {
            console.log("🔄 Converting temporary story ID to real ID:", {
              oldId: storyData.storyId,
              newId: response.data.story.id,
            });
            updateStoryData({ storyId: response.data.story.id });
          }

          addToast({
            type: "success",
            title: "Draft Saved!",
            message: "Your story has been saved as a draft",
          });
          navigate("/dashboard", { state: { refresh: true } });
        }
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      addToast({
        type: "error",
        title: "Save Failed",
        message: "Failed to save draft",
      });
    } finally {
      setIsSaving(false);
      setShowCancelDialog(false);
    }
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    setGenerationComplete(false);
    updateStoryData({
      generatedContent: "",
      storySummary: "",
      chapterSummaries: [],
      youtubeTitle: "",
      youtubeDescription: "",
      youtubeTags: "",
      stockFootageTerms: "",
      chapters: [],
      currentChapter: 0,
      totalChapters: 0,
    });

    try {
      const { apiService } = await import("../../lib/api");

      // Stage 1: Generate story structure and metadata
      addToast({
        type: "info",
        title: "Regenerating Story Structure",
        message: "Creating new story outline and metadata...",
      });

      await apiService.generateStoryStructure(
        {
          title: storyData.storyName,
          genre: storyData.genre,
          duration: storyData.duration,
          mainPrompt: storyData.mainPrompt,
          language: storyData.language,
          additionalContext: storyData.additionalContext,
          videoToneEmotions: storyData.videoToneEmotions,
        },
        (chunk: any) => {
          if (chunk.type === "start") {
            addToast({
              type: "info",
              title: "Regenerating Structure",
              message: chunk.message,
            });
          } else if (chunk.type === "chunk") {
            // Don't display structure generation content in the story text
            // This is just metadata generation
          }
        },
        (data?: {
          storySummary: string;
          chapterSummaries: Array<{ number: number; summary: string }>;
          youtubeTitle: string;
          youtubeDescription: string;
          youtubeTags: string;
          stockFootageTerms: string;
        }) => {
          if (data) {
            // Store the metadata
            setStoryData((prev: StoryData) => ({
              ...prev,
              storySummary: data.storySummary,
              chapterSummaries: data.chapterSummaries,
              youtubeTitle: data.youtubeTitle,
              youtubeDescription: data.youtubeDescription,
              youtubeTags: data.youtubeTags,
              stockFootageTerms: data.stockFootageTerms,
              totalChapters: data.chapterSummaries.length,
              currentChapter: 0,
            }));

            // Stage 2: Generate each chapter's content
            generateChapters(data.chapterSummaries, data.storySummary);
          }
        },
        (error: any) => {
          setIsGenerating(false);
          setGenerationComplete(false);
          addToast({
            type: "error",
            title: "Regeneration Failed",
            message: error.message || "Failed to regenerate story structure",
          });
        }
      );
    } catch (error) {
      setIsGenerating(false);
      setGenerationComplete(false);
      addToast({
        type: "error",
        title: "Regeneration Failed",
        message:
          error instanceof Error ? error.message : "Failed to regenerate story",
      });
    }
  };

  const handleSaveAndGoToDashboard = async () => {
    // Stop any playing audio before saving and navigation
    if (audioControlRef) {
      audioControlRef.handlePlayPause();
    }
    if (!storyData.generatedContent) {
      addToast({
        type: "error",
        title: "No Content to Save",
        message: "Please generate a story first",
      });
      return;
    }

    setIsSaving(true);

    try {
      const { apiService } = await import("../../lib/api");

      // Create the full content with metadata for saving to database
      const fullContentWithMetadata = `${storyData.generatedContent}\n\n*****\n${storyData.youtubeTitle}\n\n${storyData.youtubeDescription}\n\n${storyData.youtubeTags}\n\n${storyData.stockFootageTerms}\n*****\n${storyData.storySummary}\n*****`;

      // Check if this is a real story ID or a temporary one
      const isRealStory =
        storyData.storyId && !storyData.storyId.startsWith("temp-");

      if (isRealStory) {
        // Update existing story
        console.log("💾 Attempting to update existing story (Save & Finish):", {
          storyId: storyData.storyId,
          storyName: storyData.storyName,
          storyIdType: typeof storyData.storyId,
          storyIdLength: storyData.storyId?.length,
          isTemp: storyData.storyId?.startsWith("temp-"),
        });

        const response = await apiService.updateStory(storyData.storyId!, {
          title: storyData.storyName,
          content: fullContentWithMetadata, // Save full content with metadata
          genre: storyData.genre,
          duration: storyData.duration,
          videoStyle: storyData.videoStyle,
          language: storyData.language,
          additionalContext: storyData.additionalContext,
          videoToneEmotions: storyData.videoToneEmotions,
          mainPrompt: storyData.mainPrompt,
          // New fields for two-stage generation
          storySummary: storyData.storySummary,
          chapterSummaries: storyData.chapterSummaries,
          youtubeTitle: storyData.youtubeTitle,
          youtubeDescription: storyData.youtubeDescription,
          youtubeTags: storyData.youtubeTags,
          stockFootageTerms: storyData.stockFootageTerms,
          chapters: storyData.chapters,
          totalChapters: storyData.totalChapters,
          // Voice and audio data
          selectedVoiceId: storyData.selectedVoiceId,
          audioChunks: storyData.audioChunks,
          totalAudioDuration: storyData.totalAudioDuration,
          videoAssets: storyData.videoAssets,
          transcriptInfo: storyData.transcriptInfo,
          stockMediaInfo: storyData.stockMediaInfo,
        });

        console.log(
          "💾 CreateStoryScreen: Saving story with videoAssets (update):",
          {
            hasVideoAssets: !!storyData.videoAssets,
            storyId: storyData.storyId,
            mediaLibraryCount:
              (storyData.videoAssets as any)?.mediaLibrary?.length || 0,
            layersCount: (storyData.videoAssets as any)?.layers?.length || 0,
          }
        );

        if (response.success) {
          addToast({
            type: "success",
            title: "Story Updated!",
            message: "Your story has been updated",
          });
          navigate("/dashboard", { state: { refresh: true } });
        } else {
          throw new Error("Failed to update story");
        }
      } else {
        // Create new story (or convert temporary story)
        console.log("💾 Creating new story (Save & Finish):", {
          storyName: storyData.storyName,
          hasStoryId: !!storyData.storyId,
          storyId: storyData.storyId,
          isTemp: storyData.storyId?.startsWith("temp-"),
          reason: !storyData.storyId ? "No story ID" : "Temporary story ID",
        });

        const response = await apiService.createStory({
          title: storyData.storyName,
          content: fullContentWithMetadata, // Save full content with metadata
          genre: storyData.genre,
          duration: storyData.duration,
          isDraft: true,
          currentStep: totalSteps,
          videoStyle: storyData.videoStyle,
          language: storyData.language,
          additionalContext: storyData.additionalContext,
          videoToneEmotions: storyData.videoToneEmotions,
          mainPrompt: storyData.mainPrompt,
          // New fields for two-stage generation
          storySummary: storyData.storySummary,
          chapterSummaries: storyData.chapterSummaries,
          youtubeTitle: storyData.youtubeTitle,
          youtubeDescription: storyData.youtubeDescription,
          youtubeTags: storyData.youtubeTags,
          stockFootageTerms: storyData.stockFootageTerms,
          chapters: storyData.chapters,
          totalChapters: storyData.totalChapters,
          // Voice and audio data
          selectedVoiceId: storyData.selectedVoiceId,
          audioChunks: storyData.audioChunks,
          totalAudioDuration: storyData.totalAudioDuration,
          videoAssets: storyData.videoAssets,
          transcriptInfo: storyData.transcriptInfo,
          stockMediaInfo: storyData.stockMediaInfo,
        });

        console.log(
          "💾 CreateStoryScreen: Saving story with videoAssets (create):",
          {
            hasVideoAssets: !!storyData.videoAssets,
            storyId: storyData.storyId,
            mediaLibraryCount:
              (storyData.videoAssets as any)?.mediaLibrary?.length || 0,
            layersCount: (storyData.videoAssets as any)?.layers?.length || 0,
          }
        );

        if (response.success) {
          // Update story ID from temporary to real ID
          if (storyData.storyId?.startsWith("temp-")) {
            console.log(
              "🔄 Converting temporary story ID to real ID (Save & Finish):",
              {
                oldId: storyData.storyId,
                newId: response.data.story.id,
              }
            );
          }

          updateStoryData({ storyId: response.data.story.id });
          addToast({
            type: "success",
            title: "Story Saved!",
            message: "Your story has been saved",
          });
          navigate("/dashboard", { state: { refresh: true } });
        } else {
          throw new Error("Failed to save story");
        }
      }
    } catch (error) {
      console.error("Error saving story:", error);
      addToast({
        type: "error",
        title: "Save Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save story to local database",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addAdditionalContext = () => {
    if (storyData.additionalContext.length < 5) {
      updateStoryData({
        additionalContext: [...storyData.additionalContext, ""],
      });
    }
  };

  const removeAdditionalContext = (index: number) => {
    updateStoryData({
      additionalContext: storyData.additionalContext.filter(
        (_, i) => i !== index
      ),
    });
  };

  const updateAdditionalContext = (index: number, value: string) => {
    const newContext = [...storyData.additionalContext];
    newContext[index] = value;
    updateStoryData({ additionalContext: newContext });
  };

  const toggleEmotion = (emotion: string) => {
    const currentEmotions = storyData.videoToneEmotions;
    if (currentEmotions.includes(emotion)) {
      updateStoryData({
        videoToneEmotions: currentEmotions.filter((e) => e !== emotion),
      });
    } else if (currentEmotions.length < 4) {
      updateStoryData({
        videoToneEmotions: [...currentEmotions, emotion],
      });
    }
  };

  const formatLength = (minutes: number) => {
    if (minutes < 1) return "Less than 1 minute";
    if (minutes === 1) return "1 minute";
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    return `${hours} hour${hours > 1 ? "s" : ""} ${remainingMinutes} minute${
      remainingMinutes > 1 ? "s" : ""
    }`;
  };

  const getLengthCategory = (minutes: number) => {
    if (minutes <= 5) return "Short Story";
    if (minutes <= 15) return "Medium Story";
    if (minutes <= 30) return "Long Story";
    return "Epic Story";
  };

  const getStepIcon = (step: number) => {
    switch (step) {
      case 1:
        return <BookOpen className="w-5 h-5" />;
      case 2:
        return <Target className="w-5 h-5" />;
      case 3:
        return <Palette className="w-5 h-5" />;
      case 4:
        return <Users className="w-5 h-5" />;
      case 5:
        return isGenerating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5" />
        );
      case 6:
        return <Volume2 className="w-5 h-5" />;
      case 7:
        return <Video className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1:
        return "Story Title & Video Style";
      case 2:
        return "Story Length & Genre";
      case 3:
        return "Story Description";
      case 4:
        return "Language & Context";
      case 5:
        return isGenerating
          ? "Generating Story..."
          : "Story Generation & Review";
      case 6:
        return "Voice Selection";
      case 7:
        return "Video Creation";
      default:
        return "";
    }
  };

  const handleAudioDataUpdate = (audioData: any) => {
    updateStoryData({
      audioChunks: audioData.audioChunks,
      totalAudioDuration: audioData.totalAudioDuration,
    });
  };

  const handleVideoAssetsUpdate = (videoAssets: any) => {
    console.log("📼 CreateStoryScreen: Updating video assets:", {
      hasVideoAssets: !!videoAssets,
      hasMediaLibrary: !!videoAssets?.mediaLibrary,
      mediaLibraryCount: videoAssets?.mediaLibrary?.length || 0,
      hasLayers: !!videoAssets?.layers,
      layersCount: videoAssets?.layers?.length || 0,
      storyId: storyData.storyId,
    });
    updateStoryData({ videoAssets });
  };

  const handleTranscriptInfoUpdate = (transcriptInfo: any) => {
    console.log("📝 Updating transcript info:", transcriptInfo);
    setStoryData((prev) => ({
      ...prev,
      transcriptInfo,
    }));
  };

  const handleStockMediaInfoUpdate = (stockMediaInfo: any) => {
    console.log("🎬 Updating stock media info:", stockMediaInfo);
    setStoryData((prev) => ({
      ...prev,
      stockMediaInfo,
    }));
  };

  const handleSentenceTranscriptsUpdate = (sentenceTranscripts: any) => {
    console.log("📝 Updating sentence transcripts:", sentenceTranscripts);
    setStoryData((prev) => ({
      ...prev,
      sentenceTranscripts,
    }));
  };

  const handleRender = () => {
    // Save the latest video assets before rendering
    if (storyData.videoAssets) {
      console.log(
        "Starting render process from frontend...",
        storyData.videoAssets
      );
      
      // Ensure we have the latest video assets from the VideoEditor
      const latestVideoAssets = {
        ...storyData.videoAssets,
        // Include the current state from VideoEditor if available
        mediaItems: mediaItems || (storyData.videoAssets as any).mediaLibrary || [],
        timelineItems: timelineItems || [],
        layers: layers || (storyData.videoAssets as any).layers || [],
        timeline: {
          totalDuration: storyData.videoAssets.timeline?.totalDuration || 30,
          currentTime: 0,
          tracks: layers?.map((layer: any) => ({
            id: layer.id,
            name: layer.name,
            type: layer.type || "footage" as const,
            blocks: layer.items?.map((item: any) => ({
              id: item.id,
              startTime: item.startTime,
              duration: item.duration,
              mediaId: item.mediaId,
              volume: 100
            })) || []
          })) || []
        },
        editorSettings: {
          selectedLayerId: "",
          volumeSettings: {
            voiceover: 100,
            footage: 100,
            soundtrack: 100,
          },
          videoStyle: storyData.videoStyle || "landscape",
        }
      };
      
      console.log("Latest video assets for rendering:", latestVideoAssets);
      
      // Cast to the specific type to satisfy the compiler
      (window as any).electron.startRender(latestVideoAssets as any);
      setHasRenderFailed(false); // Reset render failure state
      setCurrentStep(8);
    } else {
      console.error("Render clicked but no videoAssets found in storyData.");
    }
  };

  const handleBackToEditor = () => {
    setHasRenderFailed(true); // Mark that render has failed
    setCurrentStep(7); // Go back to the video editor
  };

  const handleSaveComplete = () => {
    // Navigate to dashboard or show success message
    handleSaveAndGoToDashboard();
  };

  const handleRetryRender = () => {
    setHasRenderFailed(false); // Reset the failure state
    handleRender(); // Start the render process again
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <FormInput
                type="text"
                label="Story Title"
                placeholder="Enter your story title"
                value={storyData.storyName}
                onChange={(value) => updateStoryData({ storyName: value })}
                icon="user"
                required
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Video Style <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {videoStyles.map((style) => (
                    <motion.button
                      key={style.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        updateStoryData({ videoStyle: style.value as any })
                      }
                      className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                        storyData.videoStyle === style.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      <div className="font-medium">{style.label}</div>
                      <div className="text-sm opacity-75">
                        {style.description}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700">
                    Story Length <span className="text-red-500">*</span>
                  </label>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-blue-600">
                      {formatLength(storyData.duration / 60)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getLengthCategory(storyData.duration / 60)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Slider
                    value={[storyData.duration]}
                    onValueChange={([value]) =>
                      updateStoryData({ duration: value })
                    }
                    max={7200} // 2 hours max
                    min={60} // 1 minute min
                    step={60}
                    className="w-full"
                  />

                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1 min</span>
                    <span>30 min</span>
                    <span>60 min</span>
                    <span>120 min</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[300, 900, 1800, 3600].map((preset) => (
                    <motion.button
                      key={preset}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => updateStoryData({ duration: preset })}
                      className={`p-2 rounded-lg border-2 transition-all duration-200 text-xs ${
                        storyData.duration === preset
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      {preset / 60}m
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Genre <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {genres.map((genre: string) => (
                    <motion.button
                      key={genre}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateStoryData({ genre })}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                        storyData.genre === genre
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      {genre}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Story Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={storyData.mainPrompt}
                  onChange={(e) =>
                    updateStoryData({ mainPrompt: e.target.value })
                  }
                  placeholder="Describe your story idea, plot, or any specific elements you'd like to include..."
                  className="min-w-[500px] p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={6}
                />
              </div>
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="step4"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Language
                </label>
                <select
                  value={storyData.language}
                  onChange={(e) =>
                    updateStoryData({ language: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {languages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Additional Context (Optional)
                </label>
                <div className="space-y-2">
                  {storyData.additionalContext.map((context, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={context}
                        onChange={(e) =>
                          updateAdditionalContext(index, e.target.value)
                        }
                        placeholder="Enter additional context..."
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeAdditionalContext(index)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {storyData.additionalContext.length < 5 && (
                    <Button
                      variant="outline"
                      onClick={addAdditionalContext}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Context
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Video Tone & Emotions (Optional - Max 4)
                </label>
                <div className="text-xs text-gray-500 mb-2">
                  Selected: {storyData.videoToneEmotions.length}/4
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                  {emotions.map((emotion) => (
                    <motion.button
                      key={emotion}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleEmotion(emotion)}
                      disabled={
                        !storyData.videoToneEmotions.includes(emotion) &&
                        storyData.videoToneEmotions.length >= 4
                      }
                      className={`p-2 rounded-lg border-2 transition-all duration-200 text-xs ${
                        storyData.videoToneEmotions.includes(emotion)
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      }`}
                    >
                      {emotion}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 5:
        return (
          <motion.div
            key="step5"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              {isGenerating ? (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    <h3 className="text-lg font-semibold text-blue-800">
                      {storyData.currentChapter && storyData.totalChapters
                        ? `Generating Chapter ${storyData.currentChapter} of ${storyData.totalChapters}...`
                        : "Generating Story Structure..."}
                    </h3>
                  </div>
                  <p className="text-blue-700 text-sm">
                    {storyData.currentChapter && storyData.totalChapters
                      ? `AI is creating Chapter ${storyData.currentChapter} content. Please wait while the story unfolds!`
                      : "AI is creating your story outline and metadata. This will be followed by chapter generation."}
                  </p>
                  {/* {storyData.currentChapter &&
                    storyData.totalChapters &&
                    storyData.currentChapter > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm text-blue-600 mb-1">
                          <span>Progress</span>
                          <span>
                            {storyData.currentChapter - 1} /{" "}
                            {storyData.totalChapters} chapters completed
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                ((storyData.currentChapter - 1) /
                                  storyData.totalChapters) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )} */}
                </div>
              ) : generationComplete && storyData.generatedContent ? (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-green-800">
                      Story Generated Successfully!
                    </h3>
                  </div>
                  <p className="text-green-700 text-sm">
                    Your story has been created with{" "}
                    {storyData.totalChapters || 0} chapters. You can now review
                    and edit it below.
                  </p>
                  {storyData.youtubeTitle && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
                      <h4 className="font-medium text-green-800 mb-1">
                        YouTube Metadata Generated:
                      </h4>
                      <p className="text-sm text-green-700">
                        <strong>Title:</strong> {storyData.youtubeTitle}
                      </p>
                      <p className="text-sm text-green-700">
                        <strong>Description:</strong>{" "}
                        {storyData.youtubeDescription}
                      </p>
                      <p className="text-sm text-green-700">
                        <strong>Tags:</strong> {storyData.youtubeTags}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Sparkles className="w-5 h-5 text-yellow-600" />
                    <h3 className="text-lg font-semibold text-yellow-800">
                      Ready to Generate
                    </h3>
                  </div>
                  <p className="text-yellow-700 text-sm">
                    Click the generate button to start creating your story. This
                    will first generate the story structure and metadata, then
                    create each chapter's content.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {isGenerating
                    ? "Generating Story Content..."
                    : "Generated Story Content"}
                </label>
                <textarea
                  value={storyData.generatedContent || ""}
                  onChange={(e) =>
                    updateStoryData({ generatedContent: e.target.value })
                  }
                  placeholder={
                    isGenerating
                      ? "Generating..."
                      : "No content generated yet..."
                  }
                  disabled={isGenerating}
                  className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-64"
                  rows={12}
                />
              </div>

              {/* Story Summary Section */}
              {generationComplete && storyData.storySummary && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Story Summary
                  </label>
                  <div className="w-full p-4 border border-gray-300 rounded-lg bg-gray-50 min-h-32">
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {storyData.storySummary}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  className="flex-1 text-gray-600 border-gray-200 hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                {generationComplete && storyData.generatedContent && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (storyData.generatedContent) {
                        navigator.clipboard.writeText(
                          storyData.generatedContent
                        );
                        addToast({
                          type: "success",
                          title: "Copied!",
                          message: "Story content copied to clipboard",
                        });
                      }
                    }}
                    className="flex-1"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Copy to Clipboard
                  </Button>
                )}

                {generationComplete && storyData.generatedContent && (
                  <Button
                    onClick={handleRegenerate}
                    className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                )}

                {generationComplete && storyData.generatedContent && (
                  <Button
                    onClick={handleNext}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Next: Choose Voice
                  </Button>
                )}

                {!isGenerating && !storyData.generatedContent && (
                  <Button
                    onClick={handleGenerate}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Story
                  </Button>
                )}

                {/* Previous Button for Step 5 */}
              </div>
            </div>
          </motion.div>
        );

      case 6:
        return (
          <motion.div
            key="step6"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Voice Selection Phase */}
            {!showAudioGeneration && (
              <>
                <VoiceSelector
                  selectedVoice={storyData.selectedVoiceId}
                  onVoiceSelect={(voiceId) => {
                    updateStoryData({ selectedVoiceId: voiceId });
                    
                    // **NEW: Automatically cache the selected voice if we have its info**
                    if (voiceId) {
                      const murfVoices: Array<{ voice_id: string; name: string }> = (window as any)?.murfVoices || [];
                      const selectedVoice = murfVoices.find(v => v.voice_id === voiceId);
                      if (selectedVoice) {
                        cacheVoice(selectedVoice);
                        console.log(`🎵 Auto-cached selected voice: ${selectedVoice.name}`);
                      }
                    }
                  }}
                  className="max-w-4xl mx-auto"
                />

                {/* Navigation buttons */}
                <div className="flex space-x-3 max-w-4xl mx-auto">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    className="flex-1 text-gray-600 border-gray-200 hover:bg-gray-50"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>

                  {/* Only show Generate Audio button when voice is selected */}
                  {storyData.selectedVoiceId && (
                    <Button
                      onClick={() => {
                        console.log("Proceeding to audio generation");
                        setShowAudioGeneration(true);

                        // If audio exists, go straight to generated state
                        if (
                          storyData.audioChunks &&
                          storyData.audioChunks.length > 0
                        ) {
                          setAudioGenerated(true);
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Generate Audio
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* Audio Generation Phase - ONLY when showAudioGeneration is true */}
            {showAudioGeneration &&
              storyData.selectedVoiceId &&
              !audioGenerated && (
                <>
                  {/* Show replacement warning if audio exists */}
                  {storyData.audioChunks &&
                    storyData.audioChunks.length > 0 && (
                      <div className="max-w-4xl mx-auto mb-4">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                            <div>
                              <h4 className="text-sm font-medium text-orange-800">
                                Replace Existing Audio
                              </h4>
                              <p className="text-sm text-orange-600">
                                Generating new audio with{" "}
                                <strong>
                                  {getVoiceName(
                                    storyData.selectedVoiceId || ""
                                  )}
                                </strong>{" "}
                                will completely replace your current audio.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  <AudioPreview
                    storyContent={storyData.generatedContent || ""}
                    selectedVoiceId={storyData.selectedVoiceId}
                    generatedAudioVoiceId={generatedAudioVoiceId}
                    existingAudioChunks={storyData.audioChunks?.map(
                      (chunk: IncomingAudioChunk): AudioChunk => ({
                        id: chunk.id,
                        name: chunk.name || `Audio Part ${chunk.id}`,
                        text: chunk.text || "",
                        duration: chunk.duration,
                        startTime: chunk.startTime || 0,
                        filePath:
                          chunk.filePath ||
                          chunk.relativePath ||
                          chunk.blobUrl ||
                          "",
                        relativePath: chunk.relativePath,
                        blobUrl: chunk.blobUrl,
                      })
                    )}
                    autoStart={autoGenerateAudio}
                    storyId={storyData.storyId}
                    onAudioControlRef={setAudioControlRef}
                    onAudioGenerated={(audioChunks, totalDuration) => {
                      const formattedAudioChunks = audioChunks.map((chunk) => ({
                        id: chunk.id,
                        name: chunk.name || `Audio Part ${chunk.id}`,
                        text: chunk.text || "",
                        duration: chunk.duration,
                        startTime: chunk.startTime || 0,
                        filePath:
                          chunk.filePath ||
                          chunk.relativePath ||
                          chunk.blobUrl ||
                          "",
                      }));

                      // Update audio data (replaces any previous audio)
                      handleAudioGenerated(formattedAudioChunks, totalDuration);
                      setAutoGenerateAudio(false); // Reset auto-generate flag after generation
                    }}
                    onNext={handleNext}
                    className="max-w-4xl mx-auto"
                  />

                  {/* Navigation for audio generation */}
                  <div className="flex justify-between max-w-4xl mx-auto">
                    <Button
                      variant="outline"
                      onClick={() => {
                        console.log(
                          "Going back to voice selection - preserving voice and audio data"
                        );
                        setShowAudioGeneration(false);
                        // Don't clear voice or audio data, just change UI state
                      }}
                      className="text-gray-600 border-gray-200 hover:bg-gray-50"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Voice Selection
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      className="text-gray-600 border-gray-200 hover:bg-gray-50"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous Step
                    </Button>
                  </div>
                </>
              )}

            {/* Audio Generated - Show Audio Preview */}
            {/* Audio Playback - ONLY when showAudioGeneration is true */}
            {showAudioGeneration &&
              storyData.selectedVoiceId &&
              audioGenerated && (
                <>
                  {/* Audio Controls */}
                  <Card className="max-w-4xl mx-auto mb-6">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Volume2 className="w-6 h-6 text-blue-600" />
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                Audio Options
                              </h3>
                              <p className="text-sm text-gray-600">
                                Selected voice for next generation:{" "}
                                <strong>
                                  {getVoiceName(
                                    storyData.selectedVoiceId || ""
                                  )}
                                </strong>

                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-3">
                          <Button
                            onClick={() => {
                              console.log("Going back to change voice");
                              // Stop any playing audio before navigation
                              if (
                                audioControlRef &&
                                audioControlRef.isPlaying()
                              ) {
                                audioControlRef.handlePlayPause();
                              }
                              setShowAudioGeneration(false);
                            }}
                            variant="outline"
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Change Voice
                          </Button>

                          <Button
                            onClick={() => {
                              console.log(
                                "Showing regenerate confirmation dialog"
                              );
                              setShowRegenerateDialog(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Regenerate Audio
                          </Button>
                        </div>


                      </div>
                    </CardContent>
                  </Card>

                  {/* Generated Audio Voice Info */}
                  {generatedAudioVoiceId && (
                    <Card className="max-w-4xl mx-auto mb-4 border-green-200 bg-green-50">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <Volume2 className="w-5 h-5 text-green-600" />
                          <div>
                            <h4 className="font-medium text-green-800">
                              Generated Audio
                            </h4>
                                                          <p className="text-sm text-green-700">
                                Voice used:{" "}
                                <strong>
                                  {getVoiceName(generatedAudioVoiceId)}
                                </strong>

                              </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <AudioPreview
                    storyContent={storyData.generatedContent || ""}
                    selectedVoiceId={storyData.selectedVoiceId}
                    generatedAudioVoiceId={generatedAudioVoiceId}
                    existingAudioChunks={storyData.audioChunks?.map(
                      (chunk: IncomingAudioChunk): AudioChunk => ({
                        id: chunk.id,
                        name: chunk.name || `Audio Part ${chunk.id}`,
                        text: chunk.text || "",
                        duration: chunk.duration,
                        startTime: chunk.startTime || 0,
                        filePath:
                          chunk.filePath ||
                          chunk.relativePath ||
                          chunk.blobUrl ||
                          "",
                        relativePath: chunk.relativePath,
                        blobUrl: chunk.blobUrl,
                      })
                    )}
                    storyId={storyData.storyId}
                    onAudioControlRef={setAudioControlRef}
                    onAudioGenerated={(audioChunks, totalDuration) => {
                      const formattedAudioChunks = audioChunks.map((chunk) => ({
                        id: chunk.id,
                        name: chunk.name || `Audio Part ${chunk.id}`,
                        text: chunk.text || "",
                        duration: chunk.duration,
                        startTime: chunk.startTime || 0,
                        filePath:
                          chunk.filePath ||
                          chunk.relativePath ||
                          chunk.blobUrl ||
                          "",
                      }));

                      // Update audio data (replaces any previous audio)
                      handleAudioGenerated(formattedAudioChunks, totalDuration);
                    }}
                    onNext={handleNext}
                    className="max-w-4xl mx-auto"
                  />

                  {/* Navigation for audio preview */}
                  <div className="flex justify-between max-w-4xl mx-auto">
                    <Button
                      variant="outline"
                      onClick={() => {
                        console.log(
                          "Change Voice clicked - preserving voice selection and saving current audio"
                        );

                        // Stop any playing audio before navigation
                        if (audioControlRef && audioControlRef.isPlaying()) {
                          audioControlRef.handlePlayPause();
                        }

                        // Simply go back to voice selection, keeping current audio visible
                        console.log(
                          "Change Voice clicked - keeping audio visible"
                        );
                        setShowAudioGeneration(false);
                      }}
                      className="text-gray-600 border-gray-200 hover:bg-gray-50"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Change Voice
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      className="text-gray-600 border-gray-200 hover:bg-gray-50"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous Step
                    </Button>
                  </div>
                </>
              )}
          </motion.div>
        );

      case 7:
        return (
          <motion.div
            key="step7"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {/* Manual Save Button for Video Editor */}
            <div className="absolute top-4 right-4 z-50">
              <Button
                onClick={handleManualSave}
                disabled={isSaving}
                className="bg-green-600 hidden hover:bg-green-700 text-white shadow-lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Progress
                  </>
                )}
              </Button>
            </div>
            <VideoEditor
              className="w-full h-full"
              storyContent={storyData.generatedContent || ""}
              selectedVoiceId={storyData.selectedVoiceId || ""}
              videoStyle={storyData.videoStyle || "landscape"}
              savedVideoAssets={storyData.videoAssets as any}
              audioChunks={storyData.audioChunks}
              storyId={storyData.storyId}
              initialStory={storyData} // Pass the full story data so VideoEditor can access sentenceTranscripts
              onPrevious={handleVideoEditorPrevious}
              onSaveAndFinish={handleVideoEditorComplete}
              onRender={handleVideoEditorRender}
              onVideoAssetsUpdate={handleVideoAssetsUpdate}
              onAudioDataUpdate={handleAudioDataUpdate}
              onTranscriptInfoUpdate={handleTranscriptInfoUpdate}
              onStockMediaInfoUpdate={handleStockMediaInfoUpdate}
              onSentenceTranscriptsUpdate={handleSentenceTranscriptsUpdate}
              // Render failure handling
              hasRenderFailed={hasRenderFailed}
              onRetryRender={handleRetryRender}
              // Lifted state props for persistence across navigation
              mediaItems={mediaItems}
              setMediaItems={setMediaItems}
              timelineItems={timelineItems}
              setTimelineItems={setTimelineItems}
              layers={layers}
              setLayers={setLayers}
            />
          </motion.div>
        );
      case 8: // New case for the render screen
        return (
          <RenderScreen
            onBackToEditor={handleBackToEditor}
            onSaveComplete={handleSaveComplete}
          />
        );
      default:
        // Fallback to the current step's render function
        return (
          <motion.div
            key={`step-${currentStep}`}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderCurrentStep()}
          </motion.div>
        );
    }
  };

  // Stubs for the missing render functions
  const renderStoryNameStep = () => <div>Story Name Step</div>;
  const renderDurationStep = () => <div>Duration Step</div>;
  const renderPromptStep = () => <div>Prompt Step</div>;
  const renderLanguageStep = () => <div>Language Step</div>;
  const renderGenerationStep = () => <div>Generation Step</div>;
  const renderVoiceSelectionStep = () => <div>Voice Selection Step</div>;

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStoryNameStep();
      case 2:
        return renderDurationStep();
      case 3:
        return renderPromptStep();
      case 4:
        return renderLanguageStep();
      case 5:
        return renderGenerationStep();
      case 6:
        return renderVoiceSelectionStep();
      default:
        return renderStoryNameStep(); // Default to first step
    }
  };

  // Video Editor handlers
  const handleVideoEditorPrevious = () => handlePrevious();
  const handleVideoEditorComplete = () => handleSaveAndGoToDashboard();
  const handleVideoEditorRender = () => {
    // First save the current video assets to ensure we have the latest state
    if (storyData.videoAssets) {
      // Update the video assets with the current state from VideoEditor
      const updatedVideoAssets = {
        ...storyData.videoAssets,
        mediaLibrary: mediaItems || (storyData.videoAssets as any).mediaLibrary || [],
        layers: layers || (storyData.videoAssets as any).layers || [],
        timeline: {
          ...storyData.videoAssets.timeline,
          tracks: layers?.map((layer: any) => ({
            id: layer.id,
            name: layer.name,
            type: layer.type || "footage" as const,
            blocks: layer.items?.map((item: any) => ({
              id: item.id,
              startTime: item.startTime,
              duration: item.duration,
              mediaId: item.mediaId,
              volume: 100
            })) || []
          })) || []
        }
      };
      
      // Update the story data with the latest video assets
      setStoryData(prev => ({
        ...prev,
        videoAssets: updatedVideoAssets
      }));
      
      console.log("Updated video assets before rendering:", updatedVideoAssets);
    }
    
    // Then start the render process
    handleRender();
  };

  // Manual save function for video editor
  const handleManualSave = async () => {
    console.log("💾 DEBUG: Manual save attempt:", {
      storyId: storyData.storyId,
      isValidStoryId: isValidStoryIdForSave(storyData.storyId),
      hasVideoAssets: !!storyData.videoAssets,
      hasGeneratedContent: !!storyData.generatedContent,
      currentStep: currentStep
    });

    try {
      setIsSaving(true);
      const { apiService } = await import("../../lib/api");

      // If story is temporary, create it first
      if (storyData.storyId && storyData.storyId.startsWith("temp-")) {
        console.log("🔄 Creating story from temporary ID...");
        
        const fullContentWithMetadata = `${storyData.generatedContent}\n\n*****\n${storyData.youtubeTitle}\n\n${storyData.youtubeDescription}\n\n${storyData.youtubeTags}\n\n${storyData.stockFootageTerms}\n*****\n${storyData.storySummary}\n*****`;

        const response = await apiService.createStory({
          title: storyData.storyName,
          content: fullContentWithMetadata,
          genre: storyData.genre,
          duration: storyData.duration,
          isDraft: true,
          currentStep: totalSteps,
          videoStyle: storyData.videoStyle,
          language: storyData.language,
          additionalContext: storyData.additionalContext,
          videoToneEmotions: storyData.videoToneEmotions,
          mainPrompt: storyData.mainPrompt,
          storySummary: storyData.storySummary,
          chapterSummaries: storyData.chapterSummaries,
          youtubeTitle: storyData.youtubeTitle,
          youtubeDescription: storyData.youtubeDescription,
          youtubeTags: storyData.youtubeTags,
          stockFootageTerms: storyData.stockFootageTerms,
          chapters: storyData.chapters,
          totalChapters: storyData.totalChapters,
          selectedVoiceId: storyData.selectedVoiceId,
          audioChunks: storyData.audioChunks,
          totalAudioDuration: storyData.totalAudioDuration,
          videoAssets: storyData.videoAssets,
          transcriptInfo: storyData.transcriptInfo,
          stockMediaInfo: storyData.stockMediaInfo,
        });

        if (response.success) {
          // Update story ID from temporary to real ID
          updateStoryData({ storyId: response.data.story.id });
          console.log("✅ Story created successfully with ID:", response.data.story.id);
          addToast({
            type: "success",
            title: "Story Created & Saved!",
            message: "Your story has been created and video progress saved",
          });
        } else {
          throw new Error("Failed to create story");
        }
      } else if (isValidStoryIdForSave(storyData.storyId) && storyData.videoAssets) {
        // Update existing story
        console.log("🔄 Updating existing story...");
        await apiService.updateStory(storyData.storyId!, {
          videoAssets: storyData.videoAssets,
          transcriptInfo: storyData.transcriptInfo,
          stockMediaInfo: storyData.stockMediaInfo,
          audioChunks: storyData.audioChunks,
          totalAudioDuration: storyData.totalAudioDuration,
        });
        console.log("✅ Manual save completed successfully");
        addToast({
          type: "success",
          title: "Progress Saved!",
          message: "Your video editor progress has been saved",
        });
      } else {
        throw new Error("Invalid story ID or missing video assets");
      }
    } catch (error) {
      console.error("❌ Failed to manual save:", error);
      addToast({
        type: "error",
        title: "Save Failed",
        message: error instanceof Error ? error.message : "Failed to save video editor progress",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.2,
                duration: 0.5,
                type: "spring",
                stiffness: 200,
              }}
              className="flex items-center space-x-3"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {location.state?.storyId ? "Edit Story" : "Create New Story"}
                </h1>
                <p className="text-xs text-gray-500">
                  Step {currentStep} of {totalSteps}
                </p>
              </div>
            </motion.div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="text-gray-600 border-gray-200 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Progress Bar - Hidden on video generation step */}
      {currentStep !== 7 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
        >
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center justify-center w-full max-w-2xl">
              {Array.from({ length: totalSteps }, (_, index) => (
                <motion.div
                  key={index + 1}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 0.4 + index * 0.1,
                    duration: 0.5,
                    type: "spring",
                    stiffness: 200,
                  }}
                  className="flex items-center justify-center"
                >
                  <div
                    className={`min-w-12 min-h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      index + 1 <= currentStep
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 border-transparent text-white"
                        : "bg-white border-gray-300 text-gray-400"
                    }`}
                  >
                    {getStepIcon(index + 1)}
                  </div>
                  {index < totalSteps - 1 && (
                    <div
                      className={`h-1 w-20 mx-0 transition-all duration-300 ${
                        index + 1 < currentStep
                          ? "bg-gradient-to-r from-blue-600 to-purple-600"
                          : "bg-gray-200"
                      }`}
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {currentStep !== 7 && (
            <div className="text-center mb-6">
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-2xl font-bold text-gray-900 mb-2"
              >
                {getStepTitle(currentStep)}
              </motion.h2>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="text-gray-600"
              >
                Let's create something amazing together
              </motion.p>
            </div>
          )}
        </motion.div>
      )}

      {/* Form Content */}
      {currentStep === 7 ? (
        // Full-screen layout for video editor
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex-1"
        >
          {isLoadingStory ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Loading Story...
                </h3>
                <p className="text-gray-600">
                  Please wait while we load your story data
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
          )}
        </motion.div>
      ) : (
        // Normal card layout for other steps
        <div className="min-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
              <CardContent className="p-8 max-w-4xl">
                {isLoadingStory ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Loading Story...
                      </h3>
                      <p className="text-gray-600">
                        Please wait while we load your story data
                      </p>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
                )}

                {/* Navigation Buttons */}
                {!isLoadingStory && currentStep < 5 && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                    className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200"
                  >
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentStep === 1}
                      className="text-gray-600 border-gray-200 hover:bg-gray-50"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>

                    <Button
                      onClick={handleNext}
                      disabled={!isStepValid(currentStep)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:scale-[0.98]"
                    >
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
          >
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Back to Dashboard
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              What would you like to do with your current progress?
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={handleSaveAsDraft}
                disabled={isSaving}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                Save & Exit
              </Button>
              <Button
                onClick={handleConfirmCancel}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Don't Save
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(false)}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 text-blue-600" />
              <span>Regenerate Audio</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to regenerate the audio? This will replace
              your current audio
              {generatedAudioVoiceId
                ? ` (voice: ${getVoiceName(generatedAudioVoiceId)})`
                : ""}{" "}
              with new audio using{" "}
              <strong>{getVoiceName(storyData.selectedVoiceId || "")}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                console.log(
                  "Confirmed regeneration with voice:",
                  getVoiceName(storyData.selectedVoiceId || "")
                );
                console.log("Starting immediate regeneration...");

                // Clear current audio and trigger automatic regeneration
                updateStoryData({
                  audioChunks: undefined,
                  totalAudioDuration: undefined,
                });

                // Stay in audio generation mode and trigger auto-generation
                setAudioGenerated(false);
                setGeneratedAudioVoiceId(undefined); // Clear previous voice info
                setAutoGenerateAudio(true); // This will trigger immediate generation

                setShowRegenerateDialog(false);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Yes, Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CreateStoryScreen;
