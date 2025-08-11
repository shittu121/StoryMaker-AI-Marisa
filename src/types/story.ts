import { AudioChunk } from './audio';

export interface StoryData {
  // Screen 1
  videoStyle: "landscape" | "square" | "vertical";
  storyName: string;

  // Screen 2
  duration: number; // in seconds
  genre: string;

  // Screen 3
  mainPrompt: string;

  // Screen 4
  language: string;
  additionalContext: string[];
  videoToneEmotions: string[];

  // Screen 5
  generatedContent?: string;
  storyId?: string;
  isDraft?: boolean;
  currentStep?: number;

  // New fields for two-stage generation
  storySummary?: string;
  chapterSummaries?: Array<{ number: number; summary: string }>;
  youtubeTitle?: string;
  youtubeDescription?: string;
  youtubeTags?: string;
  stockFootageTerms?: string;
  chapters?: Array<{ number: number; content: string }>;
  currentChapter?: number;
  totalChapters?: number;

  // Voice selection
  selectedVoiceId?: string;

  // Audio data from video editor (current active audio)
  audioChunks?: AudioChunk[];
  totalAudioDuration?: number;

  // Audio generations per voice (preserves history)
  voiceAudioHistory?: Record<
    string,
    {
      voiceId: string;
      voiceName: string;
      generations: Array<{
        id: string;
        audioChunks: AudioChunk[];
        totalAudioDuration: number;
        generatedAt: string;
        isActive: boolean;
      }>;
    }
  >;

  // Video editor comprehensive state
  videoAssets?: {
    voice: {
      id: string;
      name: string;
      isSelected: boolean;
    } | null;
    audioChunks: Array<{
      id: string;
      name: string;
      text: string;
      duration: number;
      startTime: number;
      blobUrl?: string;
      isGenerated: boolean;
    }>;
    stockMedia: Array<{
      id: string;
      name: string;
      type: "video" | "image";
      url?: string;
      duration?: number;
    }>;
    timeline: {
      tracks: Array<{
        id: string;
        name: string;
        type: "voiceover" | "footage" | "soundtrack";
        blocks: Array<{
          id: string;
          startTime: number;
          duration: number;
          mediaId: string;
          volume?: number;
        }>;
      }>;
      totalDuration: number;
      currentTime: number;
    };
    subtitleSettings: {
      fontFamily: string;
      fontSize: number;
      fontColor: string;
      backgroundColor: string;
      position: "top" | "center" | "bottom";
    };
    volumeSettings: {
      voiceover: number;
      footage: number;
      soundtrack: number;
    };
  };

  // Resume state tracking
  maxStepReached?: number;

  // DEBUG: Transcript information with timestamps for debugging
  transcriptInfo?: {
    storyContent?: string;
    audioChunks?: Array<{
      id: string;
      name: string;
      text: string;
      duration: number;
      startTime: number;
      filePath: string;
    }>;
    totalAudioDuration?: number;
    voiceoverSettings?: {
      selectedVoiceId?: string;
      volume: number;
    };
    savedAt: string; // timestamp when saved
  };

  // Sentence-level transcript data for text timeline items
  sentenceTranscripts?: {
    sentences: Array<{
      id: string;
      text: string;
      startTime: number;
      duration: number;
      endTime: number;
      audioChunkId?: string; // Reference to the audio chunk this sentence belongs to
      chapterNumber?: number; // Which chapter/section this sentence is from
    }>;
    totalDuration?: number;
    language?: string;
    savedAt: string; // timestamp when saved
  };
  
  // DEBUG: Stock media information with local file paths and timestamps
  stockMediaInfo?: {
    items: Array<{
      id: string;
      name: string;
      type: 'video' | 'image';
      pexelsId?: string;
      photographer?: string;
      localFilePath: string; // local file path in temp folder
      thumbnailLocalPath?: string; // local thumbnail path
      originalUrl?: string; // original Pexels URL for reference
      width: number;
      height: number;
      duration?: number;
      startTime: number; // when it appears in timeline
      endTime: number;   // when it ends in timeline
      track: number;     // which timeline track
      searchQuery?: string;
      downloadedAt: string; // timestamp when downloaded
    }>;
    savedAt: string; // timestamp when saved
  };
} 