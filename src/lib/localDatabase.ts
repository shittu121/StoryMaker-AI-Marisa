import Datastore from "nedb";
import path from "path";
import fs from "fs";

// Simple function to generate unique IDs
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export interface LocalStory {
  _id?: string;
  title: string;
  content: string;
  summary?: string;
  genre?: string;
  duration?: number;
  status: "draft" | "generating" | "completed" | "failed";
  createdAt?: string;
  updatedAt?: string;
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
}

class LocalDatabase {
  private db: Datastore<LocalStory> | null = null;
  private dbPath: string = "";

  constructor() {
    // Get the user data directory for the app
    // const userDataPath = process.env.ELECTRON_USER_DATA_PATH || "./data";
    // this.dbPath = path.join(userDataPath, "stories.db");
    // console.log("Database path:", this.dbPath);
  }

  async initialize(userDataPath: string): Promise<void> {
    try {
      console.log("Initializing database...", userDataPath);
      // Create data directory if it doesn't exist
      this.dbPath = path.join(userDataPath, "stories.db");
      console.log("Database path:", this.dbPath);
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Initialize NeDB
      this.db = new Datastore({
        filename: this.dbPath,
        autoload: true,
        timestampData: true,
      });

      // Only index on createdAt and status
      this.db.ensureIndex({ fieldName: "createdAt" });
      this.db.ensureIndex({ fieldName: "status" });

      console.log("Database initialized successfully");
    } catch (err) {
      console.error("Error initializing database:", err);
      throw err;
    }
  }

  async createStory(
    story: Omit<LocalStory, "_id" | "createdAt" | "updatedAt"> & { summary?: string }
  ): Promise<LocalStory> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const newStory: LocalStory = {
        _id: generateId(), // Generate unique ID
        title: story.title,
        content: story.content,
        summary: story.summary || "",
        genre: story.genre || "fantasy",
        duration: story.duration || 180,
        status: story.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        videoStyle: story.videoStyle,
        language: story.language,
        additionalContext: Array.isArray(story.additionalContext) ? story.additionalContext : [],
        videoToneEmotions: Array.isArray(story.videoToneEmotions) ? story.videoToneEmotions : [],
        isDraft: story.isDraft ?? false,
        currentStep: typeof story.currentStep === "number" ? story.currentStep : 1,
        mainPrompt: story.mainPrompt,
        // New fields for two-stage generation
        storySummary: story.storySummary || "",
        chapterSummaries: Array.isArray(story.chapterSummaries) ? story.chapterSummaries : [],
        youtubeTitle: story.youtubeTitle || "",
        youtubeDescription: story.youtubeDescription || "",
        youtubeTags: story.youtubeTags || "",
        stockFootageTerms: story.stockFootageTerms || "",
        chapters: Array.isArray(story.chapters) ? story.chapters : [],
        currentChapter: typeof story.currentChapter === "number" ? story.currentChapter : 0,
        totalChapters: typeof story.totalChapters === "number" ? story.totalChapters : 0,
        // Voice and audio fields
        selectedVoiceId: story.selectedVoiceId || "",
        audioChunks: Array.isArray(story.audioChunks) ? story.audioChunks : [],
        totalAudioDuration: typeof story.totalAudioDuration === "number" ? story.totalAudioDuration : 0,
      };

      this.db!.insert(newStory, (err, insertedStory) => {
        if (err) {
          reject(err);
        } else {
          resolve(insertedStory);
        }
      });
    });
  }

  async getStories(): Promise<LocalStory[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      this.db!.find({})
        .sort({ createdAt: -1 })
        .exec((err, stories) => {
          if (err) {
            reject(err);
          } else {
            resolve(stories);
          }
        });
    });
  }

  async getStory(_id: string): Promise<LocalStory | null> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      this.db!.findOne({ _id }, (err, story) => {
        if (err) {
          reject(err);
        } else {
          resolve(story || null);
        }
      });
    });
  }

  async updateStory(
    _id: string,
    updates: Partial<LocalStory>
  ): Promise<LocalStory> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      this.db!.update({ _id }, { $set: updateData }, {}, (err, numAffected) => {
        if (err) {
          reject(err);
        } else if (numAffected === 0) {
          reject(new Error("Story not found"));
        } else {
          // Get the updated document
          this.db!.findOne({ _id }, (findErr, updatedStory) => {
            if (findErr) {
              reject(findErr);
            } else {
              resolve(updatedStory!);
            }
          });
        }
      });
    });
  }

  async deleteStory(_id: string): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      this.db!.remove({ _id }, {}, async (err, numRemoved) => {
        if (err) {
          reject(err);
        } else if (numRemoved === 0) {
          reject(new Error("Story not found"));
        } else {
          // Also delete associated audio files if running in Electron
          if (typeof window !== 'undefined' && 'electronAPI' in window) {
            try {
              const electronAPI = (window as any).electronAPI;
              await electronAPI.audio.deleteStoryAudio(_id);
              console.log("✅ Audio files deleted for story:", _id);
            } catch (audioError) {
              console.warn("⚠️ Failed to delete audio files:", audioError);
              // Don't fail the story deletion if audio cleanup fails
            }
          }
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      // NeDB automatically persists data, no explicit close needed
      this.db = null;
      console.log("Database connection closed");
    }
  }

  // Additional NeDB-specific methods for better functionality
  async getStoriesByStatus(
    status: LocalStory["status"]
  ): Promise<LocalStory[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      this.db!.find({ status })
        .sort({ createdAt: -1 })
        .exec((err, stories) => {
          if (err) {
            reject(err);
          } else {
            resolve(stories);
          }
        });
    });
  }

  async searchStories(query: string): Promise<LocalStory[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const regex = new RegExp(query, "i");
      this.db!.find({
        $or: [{ title: regex }, { content: regex }, { genre: regex }],
      })
        .sort({ createdAt: -1 })
        .exec((err, stories) => {
          if (err) {
            reject(err);
          } else {
            resolve(stories);
          }
        });
    });
  }

  async getStoryCount(): Promise<number> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      this.db!.count({}, (err, count) => {
        if (err) {
          reject(err);
        } else {
          resolve(count);
        }
      });
    });
  }
}

export default LocalDatabase;

// Create and export a singleton instance
export const localDatabase = new LocalDatabase();
