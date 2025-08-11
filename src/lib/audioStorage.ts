interface AudioFileInfo {
  id: string;
  fileName: string;
  relativePath: string;
  filePath: string;
}

interface AudioManifest {
  storyId: string;
  voiceId: string;
  generatedAt: string;
  chunks: Array<{
    id: string;
    fileName: string;
    relativePath: string;
    text: string;
    duration: number;
    startTime: number;
  }>;
}

class AudioStorageService {
  private isElectron(): boolean {
    return typeof window !== 'undefined' && 'electronAPI' in window;
  }

  private getElectronAPI() {
    if (!this.isElectron()) {
      throw new Error('Audio storage is only available in Electron environment');
    }
    return (window as any).electronAPI;
  }

  /**
   * Save an audio blob to the filesystem
   */
  async saveAudioFile(storyId: string, chunkId: string, audioBlob: Blob): Promise<AudioFileInfo> {
    if (!this.isElectron()) {
      throw new Error('Audio storage requires Electron environment');
    }

    try {
      // Convert blob to array buffer then to Uint8Array for IPC transfer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const result = await this.getElectronAPI().audio.saveAudioFile(
        storyId,
        chunkId,
        uint8Array
      );

      console.log(`✅ Audio file saved for story ${storyId}, chunk ${chunkId}:`, result.relativePath);
      
      return {
        id: chunkId,
        fileName: result.fileName,
        relativePath: result.relativePath,
        filePath: result.filePath,
      };
    } catch (error) {
      console.error('Failed to save audio file:', error);
      throw error;
    }
  }

  /**
   * Load an audio file from the filesystem and create a blob URL
   */
  async loadAudioFile(relativePath: string): Promise<string> {
    if (!this.isElectron()) {
      throw new Error('Audio loading requires Electron environment');
    }

    try {
      // Check if file exists first
      const exists = await this.getElectronAPI().audio.fileExists(relativePath);
      if (!exists) {
        throw new Error(`Audio file not found: ${relativePath}`);
      }

      // Load the file buffer
      const buffer = await this.getElectronAPI().audio.loadAudioFile(relativePath);
      
      // Convert buffer to blob
      const audioBlob = new Blob([buffer], { type: 'audio/mpeg' });
      
      // Create blob URL for playback
      const blobUrl = URL.createObjectURL(audioBlob);
      
      console.log(`✅ Audio file loaded: ${relativePath} -> ${blobUrl}`);
      
      return blobUrl;
    } catch (error) {
      console.error('Failed to load audio file:', error);
      throw error;
    }
  }

  /**
   * Save audio manifest with metadata
   */
  async saveAudioManifest(storyId: string, manifest: AudioManifest): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Audio manifest saving requires Electron environment');
    }

    try {
      await this.getElectronAPI().audio.saveManifest(storyId, manifest);
      console.log(`✅ Audio manifest saved for story ${storyId}`);
    } catch (error) {
      console.error('Failed to save audio manifest:', error);
      throw error;
    }
  }

  /**
   * Delete all audio files for a story
   */
  async deleteStoryAudio(storyId: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Audio deletion is only available in Electron environment');
      return;
    }

    try {
      await this.getElectronAPI().audio.deleteStoryAudio(storyId);
      console.log(`✅ Audio files deleted for story ${storyId}`);
    } catch (error) {
      console.error('Failed to delete story audio:', error);
      throw error;
    }
  }

  /**
   * Check if audio file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }

    try {
      return await this.getElectronAPI().audio.fileExists(relativePath);
    } catch (error) {
      console.error('Failed to check file existence:', error);
      return false;
    }
  }

  /**
   * Get the audio directory path
   */
  async getAudioDirectory(): Promise<string> {
    if (!this.isElectron()) {
      throw new Error('Audio directory access requires Electron environment');
    }

    try {
      return await this.getElectronAPI().audio.getAudioDirectory();
    } catch (error) {
      console.error('Failed to get audio directory:', error);
      throw error;
    }
  }

  /**
   * Generate a relative path for an audio chunk
   */
  getRelativePath(storyId: string, chunkId: string): string {
    return `audio/story-${storyId}/${chunkId}.mp3`;
  }

  /**
   * Create a complete audio manifest from audio chunks
   */
  createManifest(
    storyId: string, 
    voiceId: string, 
    audioChunks: Array<{
      id: string;
      text: string;
      duration: number;
      startTime: number;
      relativePath: string;
    }>
  ): AudioManifest {
    return {
      storyId,
      voiceId,
      generatedAt: new Date().toISOString(),
      chunks: audioChunks.map(chunk => ({
        id: chunk.id,
        fileName: `${chunk.id}.mp3`,
        relativePath: chunk.relativePath,
        text: chunk.text,
        duration: chunk.duration,
        startTime: chunk.startTime,
      })),
    };
  }
}

// Export singleton instance
export const audioStorageService = new AudioStorageService();
export type { AudioFileInfo, AudioManifest }; 