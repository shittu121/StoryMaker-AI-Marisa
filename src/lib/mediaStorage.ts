interface MediaFileInfo {
  id: string;
  fileName: string;
  relativePath: string;
  filePath: string;
  type: 'video' | 'image';
  originalUrl: string;
  pexelsId: string;
  photographer: string;
}

interface MediaManifest {
  storyId: string;
  downloadedAt: string;
  items: Array<{
    id: string;
    fileName: string;
    relativePath: string;
    type: 'video' | 'image';
    originalUrl: string;
    pexelsId: string;
    photographer: string;
    segmentId: string;
    startTime: number;
    endTime: number;
    searchQuery: string;
  }>;
}

class MediaStorageService {
  private isElectron(): boolean {
    return typeof window !== 'undefined' && 'electronAPI' in window;
  }

  private getElectronAPI() {
    if (!this.isElectron()) {
      throw new Error('Media storage is only available in Electron environment');
    }
    return (window as any).electronAPI;
  }

  /**
   * Get a local file URL for direct browser access
   */
  getLocalFileUrl(relativePath: string): string {
    if (!this.isElectron()) {
      throw new Error('Local file URLs require Electron environment');
    }
    return `local-file://${relativePath}`;
  }

  /**
   * Get thumbnail URL - use base64 for images, file path for videos
   */
  async getThumbnailUrl(relativePath: string, type: 'image' | 'video'): Promise<string> {
    if (type === 'image') {
      // For images, always use base64 data URL for production compatibility
      return this.loadImageAsBase64(relativePath);
    } else {
      // For videos, use base64 as well to avoid blob URLs
      return this.loadImageAsBase64(relativePath);
    }
  }

  /**
   * Save a media file to the filesystem
   */
  async saveMediaFile(storyId: string, mediaId: string, mediaBlob: Blob, type: 'video' | 'image', originalUrl: string, pexelsId: string, photographer: string): Promise<MediaFileInfo> {
    if (!this.isElectron()) {
      throw new Error('Media storage requires Electron environment');
    }

    try {
      // Convert blob to array buffer then to Uint8Array for IPC transfer
      const arrayBuffer = await mediaBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Generate proper filename based on type and pexelsId
      let fileName: string;
      let fileType: string;

      // Check if this is a thumbnail (mediaId ends with _thumb)
      const isThumb = mediaId.endsWith('_thumb');
      const baseMediaId = isThumb ? mediaId.replace('_thumb', '') : mediaId;

      if (isThumb) {
        // Thumbnails are always JPG images
        fileName = type === 'video' 
          ? `pexels_video_${pexelsId}_${baseMediaId}_thumb.jpg`
          : `pexels_photo_${pexelsId}_${baseMediaId}_thumb.jpg`;
        fileType = 'image/jpeg';
      } else if (type === 'video') {
        fileName = `pexels_video_${pexelsId}_${mediaId}.mp4`;
        fileType = 'video/mp4';
      } else {
        // For images, determine extension from originalUrl or default to .jpg
        const extension = originalUrl.includes('.png') ? '.png' : '.jpg';
        fileName = `pexels_photo_${pexelsId}_${mediaId}${extension}`;
        fileType = extension === '.png' ? 'image/png' : 'image/jpg';
      }

      console.log(`💾 Generated filename for ${type} ${mediaId}: ${fileName}`);

      // Call IPC with correct parameters (matching preload.ts signature)
      const result = await this.getElectronAPI().media.saveMediaFile(
        storyId,
        mediaId,
        uint8Array,
        fileName,
        fileType
      );

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to save media file');
      }

      // Return proper MediaFileInfo structure
      return {
        id: mediaId,
        fileName: fileName,
        relativePath: result.relativePath,
        filePath: result.filePath,
        type: type,
        originalUrl: originalUrl,
        pexelsId: pexelsId,
        photographer: photographer
      };
    } catch (error) {
      console.error('Error saving media file:', error);
      throw error;
    }
  }

  /**
   * Load a media file from the filesystem and return as base64 data URL
   * Falls back to file path for large files to prevent memory issues
   */
  async loadMediaFile(relativePath: string): Promise<string> {
    if (!this.isElectron()) {
      throw new Error('Media storage requires Electron environment');
    }

    try {
      const result = await this.getElectronAPI().media.loadMediaFile(relativePath);
      
      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to load media file');
      }

      // Check if the result is a file path (for large files) or buffer data
      if (result.isFilePath) {
        console.log(`📁 Large media file detected, using file path: ${result.filePath}`);
        return `file://${result.filePath}`;
      } else {
        console.log(`📄 Small media file, converting buffer to base64 (${result.size} bytes)`);
        // Convert buffer to base64
        const base64 = Buffer.from(result.data).toString('base64');
        return `data:application/octet-stream;base64,${base64}`;
      }
    } catch (error) {
      console.error('Error loading media file:', error);
      throw error;
    }
  }

  /**
   * Load an image as base64 data URL for production compatibility
   * Falls back to file path for large files to prevent memory issues
   */
  async loadImageAsBase64(relativePath: string): Promise<string> {
    if (!this.isElectron()) {
      throw new Error('Base64 image loading requires Electron environment');
    }

    try {
      const result = await this.getElectronAPI().media.loadImageAsBase64(relativePath);
      
      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to load image as base64');
      }

      // Check if the result is a file path (for large files) or base64 data
      if (result.isFilePath) {
        console.log(`📁 Large file detected, using file path: ${result.dataUrl}`);
        return result.dataUrl; // This will be a file:// URL
      } else {
        console.log(`📄 Small file, using base64 data (${result.size} bytes)`);
        return result.dataUrl; // This will be a data: URL
      }
    } catch (error) {
      console.error('Error loading image as base64:', error);
      throw error;
    }
  }

  /**
   * Check if a media file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }

    try {
      const result = await this.getElectronAPI().media.fileExists(relativePath);
      return result?.exists || false;
    } catch (error) {
      console.error('Error checking media file existence:', error);
      return false;
    }
  }

  /**
   * Get media manifest for a story
   */
  async getMediaManifest(storyId: string): Promise<MediaManifest | null> {
    if (!this.isElectron()) {
      return null;
    }

    try {
      const result = await this.getElectronAPI().media.getMediaManifest(storyId);
      return result?.manifest || null;
    } catch (error) {
      console.error('Error getting media manifest:', error);
      return null;
    }
  }

  /**
   * Delete all media files for a story
   */
  async deleteStoryMedia(storyId: string): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }

    try {
      const result = await this.getElectronAPI().media.deleteStoryMedia(storyId);
      return result?.success || false;
    } catch (error) {
      console.error('Error deleting story media:', error);
      return false;
    }
  }

  /**
   * Clean up old/unused media files
   */
  async cleanupMedia(): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }

    try {
      const result = await this.getElectronAPI().media.cleanupMedia();
      return result?.success || false;
    } catch (error) {
      console.error('Error cleaning up media:', error);
      return false;
    }
  }
}

export const mediaStorageService = new MediaStorageService(); 