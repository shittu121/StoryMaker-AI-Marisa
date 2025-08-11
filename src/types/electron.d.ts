declare global {
  interface Window {
    electron: {
      startRender: (videoAssets: any) => void;
      onRenderProgress: (callback: (event: any, data: any) => void) => void;
      removeRenderProgressListener: (callback: (event: any, data: any) => void) => void;
      saveRenderedVideo: (filePath: string) => Promise<boolean>;
      loadRenderedVideo: (filePath: string) => Promise<any>;
    };
    electronAPI: {
      platform: string;
      versions: NodeJS.ProcessVersions;
      secureStorage: {
        encrypt: (text: string) => Promise<string>;
        decrypt: (encryptedText: string) => Promise<string>;
      };
      app: {
        quit: () => Promise<void>;
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
      };
      network: {
        isOnline: () => boolean;
        onOnline: (callback: () => void) => () => void;
        onOffline: (callback: () => void) => () => void;
      };
      audio: {
        getAudioDirectory: () => Promise<string>;
        saveAudioFile: (storyId: string, chunkId: string, audioBuffer: Uint8Array) => Promise<any>;
        loadAudioFile: (relativePath: string) => Promise<any>;
        deleteStoryAudio: (storyId: string) => Promise<any>;
        fileExists: (relativePath: string) => Promise<boolean>;
        saveManifest: (storyId: string, manifest: any) => Promise<any>;
      };
      media: {
        saveMediaFile: (storyId: string, mediaId: string, fileBuffer: Uint8Array, fileName: string, fileType: string) => Promise<any>;
        deleteStoryMedia: (storyId: string) => Promise<any>;
        loadMediaFile: (relativePath: string) => Promise<ArrayBuffer>;
        fileExists: (relativePath: string) => Promise<boolean>;
      };
      // Transcript generation moved to backend API server
    };
    storyDB: {
      createStory: (story: any) => Promise<any>;
      getStories: () => Promise<any>;
      getStory: (id: number) => Promise<any>;
      updateStory: (id: number, updates: any) => Promise<any>;
      deleteStory: (id: number) => Promise<any>;
    };
  }
}

export {};
