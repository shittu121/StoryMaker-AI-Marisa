import { contextBridge, ipcRenderer } from "electron";

// --------- Expose some API to the Renderer process ---------
const electronAPI = {
  // Platform info
  platform: process.platform,
  versions: process.versions,

  // Secure storage APIs
  secureStorage: {
    encrypt: async (text: string) => {
      try {
        return await ipcRenderer.invoke("secure-storage:encrypt", text);
      } catch (error) {
        console.error("Encryption failed:", error);
        throw error;
      }
    },
    decrypt: async (encryptedText: string) => {
      try {
        return await ipcRenderer.invoke(
          "secure-storage:decrypt",
          encryptedText
        );
      } catch (error) {
        console.error("Decryption failed:", error);
        throw error;
      }
    },
  },

  // App lifecycle
  app: {
    quit: () => ipcRenderer.invoke("app:quit"),
    minimize: () => ipcRenderer.invoke("app:minimize"),
    maximize: () => ipcRenderer.invoke("app:maximize"),
  },

  // Network status
  network: {
    isOnline: () => navigator.onLine,
    onOnline: (callback: () => void) => {
      window.addEventListener("online", callback);
      return () => window.removeEventListener("online", callback);
    },
    onOffline: (callback: () => void) => {
      window.addEventListener("offline", callback);
      return () => window.removeEventListener("offline", callback);
    },
  },

  // Audio file operations
  audio: {
    getAudioDirectory: () => ipcRenderer.invoke("audio:getAudioDirectory"),
    saveAudioFile: (storyId: string, chunkId: string, audioBuffer: Uint8Array) => 
      ipcRenderer.invoke("audio:saveAudioFile", { storyId, chunkId, audioBuffer }),
    loadAudioFile: (relativePath: string) => 
      ipcRenderer.invoke("audio:loadAudioFile", relativePath),
    deleteStoryAudio: (storyId: string) => 
      ipcRenderer.invoke("audio:deleteStoryAudio", storyId),
    fileExists: (relativePath: string) => 
      ipcRenderer.invoke("audio:fileExists", relativePath),
    saveManifest: (storyId: string, manifest: any) => 
      ipcRenderer.invoke("audio:saveManifest", storyId, manifest),
  },

  // Media file operations (images/videos)
  media: {
    saveMediaFile: (storyId: string, mediaId: string, fileBuffer: Uint8Array, fileName: string, fileType: string) => 
      ipcRenderer.invoke("media:saveMediaFile", { storyId, mediaId, fileBuffer, fileName, fileType }),
    deleteStoryMedia: (storyId: string) => 
      ipcRenderer.invoke("media:deleteStoryMedia", storyId),
    loadMediaFile: (relativePath: string) => 
      ipcRenderer.invoke("media:loadMediaFile", relativePath),
    fileExists: (relativePath: string) => 
      ipcRenderer.invoke("media:fileExists", relativePath),
    loadImageAsBase64: (relativePath: string) => 
      ipcRenderer.invoke("media:loadImageAsBase64", relativePath),
  },

  // Transcript generation moved to backend API server
};

// Expose the API with error handling
try {
  contextBridge.exposeInMainWorld("electronAPI", electronAPI);
  console.log("✅ Electron API exposed successfully");
} catch (error) {
  console.error("❌ Failed to expose Electron API:", error);
}

// Also expose a global variable as fallback
(globalThis as any).electronAPI = electronAPI;

contextBridge.exposeInMainWorld("storyDB", {
  createStory: (story: any) => ipcRenderer.invoke("storyDB:createStory", story),
  getStories: () => ipcRenderer.invoke("storyDB:getStories"),
  getStory: (id: string) => ipcRenderer.invoke("storyDB:getStory", id),
  updateStory: (id: string, updates: any) =>
    ipcRenderer.invoke("storyDB:updateStory", id, updates),
  deleteStory: (id: string) => ipcRenderer.invoke("storyDB:deleteStory", id),
  cleanupDuplicates: () => ipcRenderer.invoke("storyDB:cleanupDuplicates"),
  getDatabaseStats: () => ipcRenderer.invoke("storyDB:getDatabaseStats"),
});

contextBridge.exposeInMainWorld('electron', {
  // ... existing exposed functions
  startRender: (videoAssets: any) => {
    try {
      console.log('[PRELOAD] startRender called with videoAssets:', {
        hasVideoAssets: !!videoAssets,
        hasLayers: !!videoAssets?.layers,
        layersCount: videoAssets?.layers?.length || 0,
        hasMediaLibrary: !!videoAssets?.mediaLibrary,
        mediaLibraryCount: videoAssets?.mediaLibrary?.length || 0
      });
      ipcRenderer.send('start-render', videoAssets);
      console.log('[PRELOAD] start-render IPC message sent successfully');
    } catch (error) {
      console.error('[PRELOAD] Error sending start-render IPC message:', error);
      throw error;
    }
  },
  onRenderProgress: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('render-progress', callback);
  },
  removeRenderProgressListener: (callback: (event: any, data: any) => void) => {
    ipcRenderer.removeListener('render-progress', callback);
  },
  saveRenderedVideo: (filePath: string) => ipcRenderer.invoke('save-rendered-video', filePath),
  loadRenderedVideo: (filePath: string) => ipcRenderer.invoke('load-rendered-video', filePath),
});
