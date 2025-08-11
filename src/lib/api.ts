// Type declarations for window.storyDB
declare global {
  interface Window {
    storyDB: {
      createStory: (story: any) => Promise<any>;
      getStories: () => Promise<any[]>;
      getStory: (id: string) => Promise<any>;
      updateStory: (id: string, updates: any) => Promise<any>;
      deleteStory: (id: string) => Promise<void>;
    };
  }
}

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5555/api"
    : "https://storymaker.nocodelauncher.com/api";

export interface User {
  id: number;
  email: string;
  subscriptionStatus: "free" | "premium" | "pro";
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
}

export interface Story {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  genre?: string;
  duration?: number;
  status: "draft" | "generating" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  videoStyle?: "landscape" | "square" | "vertical";
  language?: string;
  additionalContext?: string[];
  videoToneEmotions?: string[];
  isDraft?: boolean;
  currentStep?: number;
  maxStepReached?: number; // Track the furthest step user has completed
  mainPrompt?: string;
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
  
  // Voice and audio fields
  selectedVoiceId?: string;
  audioChunks?: Array<{
    id: string;
    name: string;
    text: string;
    duration: number;
    startTime: number;
    filePath: string;
  }>;
  totalAudioDuration?: number;
  
  // Video editor assets stored as JSON
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
      type: 'video' | 'image';
      url?: string;
      duration?: number;
    }>;
    timeline: {
      tracks: Array<{
        id: string;
        name: string;
        type: 'voiceover' | 'footage' | 'soundtrack';
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
      position: 'top' | 'center' | 'bottom';
    };
    volumeSettings: {
      voiceover: number;
      footage: number;
      soundtrack: number;
    };
  };
  
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
      audioChunkId?: string;
      chapterNumber?: number;
    }>;
    totalDuration?: number;
    language?: string;
    savedAt: string;
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

export interface ApiError {
  success: false;
  error: string;
}

class ApiService {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Enhanced error handling with status codes
        const errorMessage = data.error || `HTTP ${response.status}`;
        const enhancedError = new Error(errorMessage);
        (enhancedError as any).status = response.status;
        (enhancedError as any).response = data;
        throw enhancedError;
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's a network error
        if (
          error.message.includes("fetch") ||
          error.message.includes("Failed to fetch")
        ) {
          throw new Error("Network error");
        }
        throw error;
      }
      throw new Error("Network error");
    }
  }

  // Authentication endpoints
  async register(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/auth/logout", {
      method: "POST",
    });
  }

  async getProfile(): Promise<{ success: boolean; data: { user: User } }> {
    return this.request<{ success: boolean; data: { user: User } }>(
      "/auth/profile"
    );
  }

  // Stories endpoints - using local SQLite storage via IPC
  async getStories(): Promise<{
    success: boolean;
    data: { stories: Story[] };
  }> {
    try {
      const stories = await window.storyDB.getStories();

      // Convert LocalStory to Story interface
      const storyArray: Story[] = stories.map((localStory: any) => ({
        id: localStory._id || "",
        title: localStory.title,
        content: localStory.content,
        summary: localStory.summary,
        genre: localStory.genre,
        duration: localStory.duration,
        status: localStory.status,
        createdAt: localStory.createdAt || new Date().toISOString(),
        updatedAt: localStory.updatedAt || new Date().toISOString(),
        videoStyle: localStory.videoStyle,
        language: localStory.language,
        additionalContext: localStory.additionalContext,
        videoToneEmotions: localStory.videoToneEmotions,
        isDraft: localStory.isDraft,
        currentStep: localStory.currentStep,
        maxStepReached: localStory.maxStepReached,
        mainPrompt: localStory.mainPrompt,
        // New fields for two-stage generation
        storySummary: localStory.storySummary,
        chapterSummaries: localStory.chapterSummaries,
        youtubeTitle: localStory.youtubeTitle,
        youtubeDescription: localStory.youtubeDescription,
        youtubeTags: localStory.youtubeTags,
        stockFootageTerms: localStory.stockFootageTerms,
        chapters: localStory.chapters,
        currentChapter: localStory.currentChapter,
        totalChapters: localStory.totalChapters,
        // Voice and audio fields
        selectedVoiceId: localStory.selectedVoiceId,
        audioChunks: localStory.audioChunks,
        totalAudioDuration: localStory.totalAudioDuration,
            transcriptInfo: localStory.transcriptInfo,
    sentenceTranscripts: localStory.sentenceTranscripts,
    stockMediaInfo: localStory.stockMediaInfo,
        videoAssets: localStory.videoAssets,
      }));

      return {
        success: true,
        data: { stories: storyArray },
      };
    } catch (error) {
      console.error("Error getting stories from local database:", error);
      return {
        success: false,
        data: { stories: [] },
      };
    }
  }

  async getStory(
    id: string
  ): Promise<{ success: boolean; data: { story: Story } }> {
    try {
      console.log("🔍 DEBUG: Attempting to get story with ID:", id);
      const localStory = await window.storyDB.getStory(id);
      console.log("🔍 DEBUG: Local story result:", localStory);

      if (localStory) {
        const story: Story = {
        id: localStory._id || "",
          title: localStory.title,
          content: localStory.content,
        summary: localStory.summary,
          genre: localStory.genre,
          duration: localStory.duration,
          status: localStory.status,
          createdAt: localStory.createdAt || new Date().toISOString(),
          updatedAt: localStory.updatedAt || new Date().toISOString(),
        videoStyle: localStory.videoStyle,
        language: localStory.language,
        additionalContext: localStory.additionalContext,
        videoToneEmotions: localStory.videoToneEmotions,
        isDraft: localStory.isDraft,
        currentStep: localStory.currentStep,
        maxStepReached: localStory.maxStepReached,
        mainPrompt: localStory.mainPrompt,
        // New fields for two-stage generation
        storySummary: localStory.storySummary,
        chapterSummaries: localStory.chapterSummaries,
        youtubeTitle: localStory.youtubeTitle,
        youtubeDescription: localStory.youtubeDescription,
        youtubeTags: localStory.youtubeTags,
        stockFootageTerms: localStory.stockFootageTerms,
        chapters: localStory.chapters,
        currentChapter: localStory.currentChapter,
        totalChapters: localStory.totalChapters,
        // Voice and audio fields
        selectedVoiceId: localStory.selectedVoiceId,
        audioChunks: localStory.audioChunks,
        totalAudioDuration: localStory.totalAudioDuration,
            transcriptInfo: localStory.transcriptInfo,
    sentenceTranscripts: localStory.sentenceTranscripts,
    stockMediaInfo: localStory.stockMediaInfo,
        videoAssets: localStory.videoAssets,
        };

        return {
          success: true,
          data: { story },
        };
      } else {
        throw new Error("Story not found");
      }
    } catch (error) {
      console.error("Error getting story from local database:", error);
      throw error;
    }
  }

  async createStory(storyData: {
    title: string;
    content: string;
    summary?: string;
    genre?: string;
    duration?: number;
    videoStyle?: "landscape" | "square" | "vertical";
    language?: string;
    additionalContext?: string[];
    videoToneEmotions?: string[];
    isDraft?: boolean;
    currentStep?: number;
    maxStepReached?: number;
    mainPrompt?: string;
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
    // Voice and audio fields
    selectedVoiceId?: string;
    audioChunks?: Array<{
      id: string;
      name: string;
      text: string;
      duration: number;
      startTime: number;
      filePath: string;
    }>;
    totalAudioDuration?: number;
      transcriptInfo?: any;
  sentenceTranscripts?: any;
  stockMediaInfo?: any;
    videoAssets?: any;
  }): Promise<{ success: boolean; data: { story: Story } }> {
    try {
      const localStory = await window.storyDB.createStory({
        title: storyData.title,
        content: storyData.content,
        summary: storyData.summary,
        genre: storyData.genre,
        duration: storyData.duration,
        status: storyData.isDraft ? "draft" : "completed",
        videoStyle: storyData.videoStyle,
        language: storyData.language,
        additionalContext: storyData.additionalContext,
        videoToneEmotions: storyData.videoToneEmotions,
        isDraft: storyData.isDraft,
        currentStep: storyData.currentStep,
        maxStepReached: storyData.maxStepReached,
        mainPrompt: storyData.mainPrompt,
        // New fields for two-stage generation
        storySummary: storyData.storySummary,
        chapterSummaries: storyData.chapterSummaries,
        youtubeTitle: storyData.youtubeTitle,
        youtubeDescription: storyData.youtubeDescription,
        youtubeTags: storyData.youtubeTags,
        stockFootageTerms: storyData.stockFootageTerms,
        chapters: storyData.chapters,
        currentChapter: storyData.currentChapter,
        totalChapters: storyData.totalChapters,
        // Voice and audio fields
        selectedVoiceId: storyData.selectedVoiceId,
        audioChunks: storyData.audioChunks,
        totalAudioDuration: storyData.totalAudioDuration,
            transcriptInfo: storyData.transcriptInfo,
    sentenceTranscripts: storyData.sentenceTranscripts,
    stockMediaInfo: storyData.stockMediaInfo,
        videoAssets: storyData.videoAssets,
      });

      const story: Story = {
        id: localStory._id || "",
        title: localStory.title,
        content: localStory.content,
        summary: localStory.summary,
        genre: localStory.genre,
        duration: localStory.duration,
        status: localStory.status,
        createdAt: localStory.createdAt || new Date().toISOString(),
        updatedAt: localStory.updatedAt || new Date().toISOString(),
        videoStyle: localStory.videoStyle,
        language: localStory.language,
        additionalContext: localStory.additionalContext,
        videoToneEmotions: localStory.videoToneEmotions,
        isDraft: localStory.isDraft,
        currentStep: localStory.currentStep,
        maxStepReached: localStory.maxStepReached,
        mainPrompt: localStory.mainPrompt,
        // New fields for two-stage generation
        storySummary: localStory.storySummary,
        chapterSummaries: localStory.chapterSummaries,
        youtubeTitle: localStory.youtubeTitle,
        youtubeDescription: localStory.youtubeDescription,
        youtubeTags: localStory.youtubeTags,
        stockFootageTerms: localStory.stockFootageTerms,
        chapters: localStory.chapters,
        currentChapter: localStory.currentChapter,
        totalChapters: localStory.totalChapters,
        // Voice and audio fields
        selectedVoiceId: localStory.selectedVoiceId,
        audioChunks: localStory.audioChunks,
        totalAudioDuration: localStory.totalAudioDuration,
            transcriptInfo: localStory.transcriptInfo,
    sentenceTranscripts: localStory.sentenceTranscripts,
    stockMediaInfo: localStory.stockMediaInfo,
        videoAssets: localStory.videoAssets,
      };

      return {
        success: true,
        data: { story },
      };
    } catch (error) {
      console.error("Error creating story in local database:", error);
      throw error;
    }
  }

  async updateStory(
    id: string,
    storyData: Partial<{
      title: string;
      content: string;
      summary?: string;
      genre: string;
      duration: number;
      status: "draft" | "generating" | "completed" | "failed";
      videoStyle?: "landscape" | "square" | "vertical";
      language?: string;
      additionalContext?: string[];
      videoToneEmotions?: string[];
      isDraft?: boolean;
      currentStep?: number;
      maxStepReached?: number;
      mainPrompt?: string;
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
      // Voice and audio fields
      selectedVoiceId?: string;
      audioChunks?: Array<{
        id: string;
        name: string;
        text: string;
        duration: number;
        startTime: number;
        filePath: string;
      }>;
      totalAudioDuration?: number;
        transcriptInfo?: any;
  sentenceTranscripts?: any;
  stockMediaInfo?: any;
      videoAssets?: any;
    }>
  ): Promise<{ success: boolean; data: { story: Story } }> {
    try {
      const localStory = await window.storyDB.updateStory(id, storyData);

      const story: Story = {
        id: localStory._id || "",
        title: localStory.title,
        content: localStory.content,
        summary: localStory.summary,
        genre: localStory.genre,
        duration: localStory.duration,
        status: localStory.status,
        createdAt: localStory.createdAt || new Date().toISOString(),
        updatedAt: localStory.updatedAt || new Date().toISOString(),
        videoStyle: localStory.videoStyle,
        language: localStory.language,
        additionalContext: localStory.additionalContext,
        videoToneEmotions: localStory.videoToneEmotions,
        isDraft: localStory.isDraft,
        currentStep: localStory.currentStep,
        maxStepReached: localStory.maxStepReached,
        mainPrompt: localStory.mainPrompt,
        // New fields for two-stage generation
        storySummary: localStory.storySummary,
        chapterSummaries: localStory.chapterSummaries,
        youtubeTitle: localStory.youtubeTitle,
        youtubeDescription: localStory.youtubeDescription,
        youtubeTags: localStory.youtubeTags,
        stockFootageTerms: localStory.stockFootageTerms,
        chapters: localStory.chapters,
        currentChapter: localStory.currentChapter,
        totalChapters: localStory.totalChapters,
        // Voice and audio fields
        selectedVoiceId: localStory.selectedVoiceId,
        audioChunks: localStory.audioChunks,
        totalAudioDuration: localStory.totalAudioDuration,
            transcriptInfo: localStory.transcriptInfo,
    sentenceTranscripts: localStory.sentenceTranscripts,
    stockMediaInfo: localStory.stockMediaInfo,
        videoAssets: localStory.videoAssets,
      };

      return {
        success: true,
        data: { story },
      };
    } catch (error) {
      console.error("Error updating story in local database:", error);
      throw error;
    }
  }

  async deleteStory(id: string): Promise<{ success: boolean }> {
    try {
      await window.storyDB.deleteStory(id);
      return { success: true };
    } catch (error) {
      console.error("Error deleting story from local database:", error);
      return { success: false };
    }
  }

  async generateStoryStructure(
    storyData: {
      title: string;
      genre?: string;
      duration?: number;
      mainPrompt: string;
      language?: string;
      additionalContext?: string[];
      videoToneEmotions?: string[];
    },
    onChunk: (chunk: any) => void,
    onComplete: (data?: {
      storySummary: string;
      chapterSummaries: Array<{ number: number; summary: string }>;
      youtubeTitle: string;
      youtubeDescription: string;
      youtubeTags: string;
      stockFootageTerms: string;
    }) => void,
    onError: (error: any) => void
  ): Promise<void> {
    try {
      const url = `${this.baseURL}/stories/generate-structure`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(storyData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
          try {
              const chunk = JSON.parse(line);
              onChunk(chunk);

              if (chunk.type === "complete") {
                onComplete({
                  storySummary: chunk.storySummary,
                  chapterSummaries: chunk.chapterSummaries,
                  youtubeTitle: chunk.youtubeTitle,
                  youtubeDescription: chunk.youtubeDescription,
                  youtubeTags: chunk.youtubeTags,
                  stockFootageTerms: chunk.stockFootageTerms,
                });
              } else if (chunk.type === "error") {
                onError(new Error(chunk.error));
            }
          } catch (parseError) {
            console.error("Error parsing chunk:", parseError);
          }
        }
      }
      }
    } catch (error) {
      console.error("Error in generateStoryStructure:", error);
      onError(error);
    }
  }

  async generateChapterContent(
    chapterData: {
      chapterSummary: string;
      chapterNumber: number;
      storySummary: string;
      topic: string;
      genre: string;
      language?: string;
      duration: number;
      videoToneEmotions?: string[];
    },
    onChunk: (chunk: any) => void,
    onComplete: (data?: { chapterContent: string; chapterNumber: number }) => void,
    onError: (error: any) => void
  ): Promise<void> {
    try {
      const url = `${this.baseURL}/stories/generate-chapter`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(chapterData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line);
              onChunk(chunk);

              if (chunk.type === "complete") {
                onComplete({
                  chapterContent: chunk.chapterContent,
                  chapterNumber: chunk.chapterNumber,
                });
              } else if (chunk.type === "error") {
                onError(new Error(chunk.error));
              }
            } catch (parseError) {
              console.error("Error parsing chunk:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in generateChapterContent:", error);
      onError(error);
    }
  }

  // Text-to-Speech Methods
  async generateTTS(voiceId: string, text: string): Promise<Blob> {
    try {
      const url = `${this.baseURL}/stories/tts`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          voice_id: voiceId,
          text: text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const audioBlob = await response.blob();
      return audioBlob;
    } catch (error) {
      console.error("Error in generateTTS:", error);
      throw error;
    }
  }

  async fetchMurfVoices(): Promise<{ success: boolean; data: { voices: Array<{ voice_id: string; name: string; description?: string }> } }> {
    try {
      const url = `${this.baseURL}/stories/voices`;
      const headers: Record<string, string> = {};
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching Murf voices:", error);
      throw error;
    }
  }

  // Transcript Generation Methods
  async generateTranscript(audioFile: File, storyId: string, mediaId: string): Promise<{
    text: string;
    segments: Array<{
      id: number;
      start: number;
      end: number;
      text: string;
    }>;
  }> {
    try {
      const url = `${this.baseURL}/transcript/generate`;
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('storyId', storyId);
      formData.append('mediaId', mediaId);

      const headers: Record<string, string> = {};
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate transcript');
      }

      return result.data;
    } catch (error) {
      console.error("Error in generateTranscript:", error);
      throw error;
    }
  }

  async checkTranscriptHealth(): Promise<{
    success: boolean;
    message: string;
    openaiConfigured: boolean;
  }> {
    try {
      const url = `${this.baseURL}/transcript/health`;
      const headers: Record<string, string> = {};
      
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error checking transcript health:", error);
      throw error;
    }
  }

  // Stock Media Methods
  async fetchStockMedia(segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>, storyId: string): Promise<{
    stockMedia: Array<{
      id: string;
      type: 'video' | 'image';
      name: string;
      description: string;
      url: string;
      thumbnailUrl: string;
      duration: number;
      width: number;
      height: number;
      segmentId: number;
      startTime: number;
      endTime: number;
      searchQuery: string;
      pexelsId: number;
      photographer: string;
      source: string;
    }>;
    totalItems: number;
    segments: number;
  }> {
    try {
      const url = `${this.baseURL}/media/fetch-stock-media`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          segments,
          storyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch stock media');
      }

      return result.data;
    } catch (error) {
      console.error("Error in fetchStockMedia:", error);
      throw error;
    }
  }

  async checkMediaHealth(): Promise<{
    success: boolean;
    message: string;
    pexelsConfigured: boolean;
  }> {
    try {
      const url = `${this.baseURL}/media/health`;
      const headers: Record<string, string> = {};
      
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error checking media health:", error);
      throw error;
    }
  }


}

export const apiService = new ApiService();
