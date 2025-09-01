import {
  app,
  BrowserWindow,
  Menu,
  shell,
  ipcMain,
  safeStorage,
  dialog,
  protocol,
} from "electron";
import { join } from "path";
import { localDatabase } from "../src/lib/localDatabase";
import * as fs from "fs/promises";
import { existsSync, mkdirSync, copyFileSync } from "fs"; // Import sync methods
import { spawn } from 'child_process';
import ffmpeg from 'ffmpeg-static';
import { platform, tmpdir } from 'os';

// Helper function to wrap text for FFmpeg drawtext filter
function wrapTextForFFmpeg(text: string, maxCharsPerLine: number): string {
  if (maxCharsPerLine <= 0) return text;
  
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is longer than maxCharsPerLine, split it
        lines.push(word.substring(0, maxCharsPerLine));
        currentLine = word.substring(maxCharsPerLine);
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  // Join lines with actual line breaks for FFmpeg
  return lines.join('\n');
}

// Function to get the correct FFmpeg path for production
function getFfmpegPath(): string {
  if (process.env.NODE_ENV === 'development') {
    // In development, use the path directly
    return ffmpeg || '';
  } else {
    // In production, FFmpeg needs to be extracted from the ASAR archive
    const ffmpegDir = join(app.getPath('userData'), 'ffmpeg');
    const ffmpegName = platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const ffmpegPath = join(ffmpegDir, ffmpegName);
    
    // Check if FFmpeg already exists in user data
    if (existsSync(ffmpegPath)) {
      console.log(`[FFMPEG] Using existing FFmpeg: ${ffmpegPath}`);
      return ffmpegPath;
    }
    
    // Extract FFmpeg from ASAR archive
    try {
      console.log(`[FFMPEG] Extracting FFmpeg to: ${ffmpegPath}`);
      
      // Create directory if it doesn't exist
      if (!existsSync(ffmpegDir)) {
        mkdirSync(ffmpegDir, { recursive: true });
      }
      
      // Try multiple possible locations for the bundled FFmpeg
      const possiblePaths = [
        ffmpeg, // Direct path from ffmpeg-static
        join(process.resourcesPath, 'ffmpeg.exe'), // Resources directory
        join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'), // Relative to dist-electron
        join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'), // Unpacked ASAR
      ];
      
      let bundledFfmpegPath = '';
      for (const path of possiblePaths) {
        if (path && existsSync(path)) {
          bundledFfmpegPath = path;
          console.log(`[FFMPEG] Found bundled FFmpeg at: ${path}`);
          break;
        }
      }
      
      if (bundledFfmpegPath) {
        copyFileSync(bundledFfmpegPath, ffmpegPath);
        
        // Make executable on Unix systems
        if (platform() !== 'win32') {
          const { chmod } = require('fs');
          chmod(ffmpegPath, 0o755);
        }
        
        console.log(`[FFMPEG] Successfully extracted FFmpeg to: ${ffmpegPath}`);
        return ffmpegPath;
      } else {
        console.error(`[FFMPEG] Bundled FFmpeg not found in any of the expected locations`);
        console.error(`[FFMPEG] Searched paths:`, possiblePaths);
        return '';
      }
    } catch (error) {
      console.error(`[FFMPEG] Failed to extract FFmpeg:`, error);
      return '';
    }
  }
}

const ffmpegPath = getFfmpegPath();

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Register custom protocol for local files
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const url = request.url.replace('local-file://', '');
    const filePath = join(app.getPath("userData"), url);
    console.log(`📁 Serving local file: ${url} -> ${filePath}`);
    callback({ path: filePath });
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
    
    // Open DevTools in development mode
    // if (process.env.NODE_ENV === "development") {
    //   mainWindow.webContents.openDevTools();
    // }
  });

  mainWindow.webContents.setWindowOpenHandler((details: { url: string }) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // Add keyboard shortcut for DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Load the remote URL for development or the local html file for production.
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadURL("https://storymaker.nocodelauncher.com/");
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // Remove menu bar
  Menu.setApplicationMenu(null);

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Initialize the database when the app is ready
  try {
    // Set the correct user data path for the database
    const userDataPath = app.getPath("userData");
    process.env.ELECTRON_USER_DATA_PATH = userDataPath;
    console.log("User data path:", userDataPath);
    await localDatabase.initialize(userDataPath);
    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// IPC Handlers for secure storage
ipcMain.handle("secure-storage:encrypt", async (_, text: string) => {
  try {
    const encrypted = safeStorage.encryptString(text);
    return encrypted.toString("base64");
  } catch (error) {
    console.error("Encryption failed:", error);
    throw error;
  }
});

ipcMain.handle("secure-storage:decrypt", async (_, encryptedText: string) => {
  try {
    const buffer = Buffer.from(encryptedText, "base64");
    return safeStorage.decryptString(buffer);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw error;
  }
});

// IPC Handlers for app lifecycle
ipcMain.handle("app:quit", () => {
  app.quit();
});

ipcMain.handle("app:minimize", () => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((window) => window.minimize());
});

ipcMain.handle("app:maximize", () => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((window) => {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });
});

// IPC handlers for CRUD
ipcMain.handle("storyDB:createStory", async (_event, story) => {
  return localDatabase.createStory(story);
});
ipcMain.handle("storyDB:getStories", async () => {
  return localDatabase.getStories();
});
ipcMain.handle("storyDB:getStory", async (_event, id) => {
  return localDatabase.getStory(id);
});
ipcMain.handle("storyDB:updateStory", async (_event, id, updates) => {
  return localDatabase.updateStory(id, updates);
});
ipcMain.handle("storyDB:deleteStory", async (_event, id) => {
  return localDatabase.deleteStory(id);
});

ipcMain.handle("storyDB:cleanupDuplicates", async () => {
  return localDatabase.cleanupDuplicates();
});

ipcMain.handle("storyDB:getDatabaseStats", async () => {
  return localDatabase.getDatabaseStats();
});

// IPC handlers for Audio File Operations
ipcMain.handle("audio:getAudioDirectory", async () => {
  const audioDir = join(app.getPath("userData"), "audio");
  try {
    await fs.mkdir(audioDir, { recursive: true });
    return audioDir;
  } catch (error) {
    console.error("Failed to create audio directory:", error);
    throw error;
  }
});

ipcMain.handle("audio:saveAudioFile", async (_event, { storyId, chunkId, audioBuffer }) => {
  try {
    const audioDir = join(app.getPath("userData"), "audio", `story-${storyId}`);
    await fs.mkdir(audioDir, { recursive: true });
    
    const fileName = `${chunkId}.mp3`;
    const filePath = join(audioDir, fileName);
    
    // Convert Uint8Array back to Buffer and save
    const buffer = Buffer.from(audioBuffer);
    await fs.writeFile(filePath, buffer);
    
    console.log(`✅ Audio saved: ${filePath}`);
    return {
      success: true,
      filePath,
      fileName,
      relativePath: join("audio", `story-${storyId}`, fileName)
    };
  } catch (error) {
    console.error("Failed to save audio file:", error);
    throw error;
  }
});

ipcMain.handle("audio:loadAudioFile", async (_event, relativePath) => {
  try {
    const fullPath = join(app.getPath("userData"), relativePath);
    const buffer = await fs.readFile(fullPath);
    return buffer;
  } catch (error) {
    console.error("Failed to load audio file:", error);
    throw error;
  }
});

ipcMain.handle("audio:deleteStoryAudio", async (_event, storyId) => {
  try {
    const storyAudioDir = join(app.getPath("userData"), "audio", `story-${storyId}`);
    await fs.rm(storyAudioDir, { recursive: true, force: true });
    console.log(`✅ Deleted audio for story: ${storyId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete story audio:", error);
    throw error;
  }
});

ipcMain.handle("audio:fileExists", async (_event, relativePath) => {
  try {
    const fullPath = join(app.getPath("userData"), relativePath);
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("audio:saveManifest", async (_event, storyId, manifest) => {
  try {
    const audioDir = join(app.getPath("userData"), "audio", `story-${storyId}`);
    await fs.mkdir(audioDir, { recursive: true });
    
    const manifestPath = join(audioDir, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    return { success: true, manifestPath };
  } catch (error) {
    console.error("Failed to save audio manifest:", error);
    throw error;
  }
});

// IPC handlers for Media File Operations (images/videos)
ipcMain.handle("media:saveMediaFile", async (_event, { storyId, mediaId, fileBuffer, fileName, fileType }) => {
  try {
    console.log(`📁 Saving media file:`, {
      storyId,
      mediaId,
      fileName,
      fileType,
      bufferSize: fileBuffer?.length || 0
    });

    const mediaDir = join(app.getPath("userData"), "media", `story-${storyId}`);
    await fs.mkdir(mediaDir, { recursive: true });
    
    const filePath = join(mediaDir, fileName);
    
    // Convert Uint8Array back to Buffer and save
    const buffer = Buffer.from(fileBuffer);
    await fs.writeFile(filePath, buffer);
    
    console.log(`✅ Media file saved successfully: ${filePath}`);
    return {
      success: true,
      filePath,
      fileName,
      relativePath: join("media", `story-${storyId}`, fileName)
    };
  } catch (error) {
    console.error("❌ Failed to save media file:", error);
    throw error;
  }
});

ipcMain.handle("media:deleteStoryMedia", async (_event, storyId) => {
  try {
    const storyMediaDir = join(app.getPath("userData"), "media", `story-${storyId}`);
    await fs.rm(storyMediaDir, { recursive: true, force: true });
    console.log(`✅ Deleted media for story: ${storyId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete story media:", error);
    throw error;
  }
});

ipcMain.handle("media:loadMediaFile", async (_event, relativePath) => {
  try {
    console.log(`📁 Loading media file: ${relativePath}`);
    const fullPath = join(app.getPath("userData"), relativePath);
    
    // Check if file exists first
    try {
      await fs.access(fullPath);
    } catch {
      console.error(`❌ File not found: ${fullPath}`);
      return {
        success: false,
        error: `File not found: ${relativePath}`
      };
    }
    
    // Get file stats to check size before loading
    const stats = await fs.stat(fullPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    console.log(`📊 Media file size: ${fileSizeInMB.toFixed(2)} MB`);
    
    // Memory protection: Don't load files larger than 100MB into memory
    const MAX_FILE_SIZE_MB = 100;
    if (fileSizeInMB > MAX_FILE_SIZE_MB) {
      console.warn(`⚠️ Media file too large (${fileSizeInMB.toFixed(2)} MB), returning file path instead of buffer`);
      return {
        success: true,
        data: null,
        filePath: fullPath,
        isFilePath: true,
        size: stats.size
      };
    }
    
    const buffer = await fs.readFile(fullPath);
    console.log(`✅ Loaded media file: ${relativePath} (${buffer.length} bytes)`);
    
    // Return the expected object structure with success flag and data
    return {
      success: true,
      data: buffer,
      isFilePath: false,
      size: buffer.length
    };
  } catch (error) {
    console.error(`❌ Failed to load media file ${relativePath}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle("media:fileExists", async (_event, relativePath) => {
  try {
    const fullPath = join(app.getPath("userData"), relativePath);
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
});

// New IPC handler for loading images as base64 with memory protection
ipcMain.handle("media:loadImageAsBase64", async (_event, relativePath) => {
  try {
    console.log(`📁 Loading image as base64: ${relativePath}`);
    const fullPath = join(app.getPath("userData"), relativePath);
    
    // Check if file exists first
    try {
      await fs.access(fullPath);
    } catch {
      console.error(`❌ Image file not found: ${fullPath}`);
      return {
        success: false,
        error: `File not found: ${relativePath}`
      };
    }
    
    // Get file stats to check size before loading
    const stats = await fs.stat(fullPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    console.log(`📊 File size: ${fileSizeInMB.toFixed(2)} MB`);
    
    // Memory protection: Don't load files larger than 50MB into memory
    const MAX_FILE_SIZE_MB = 50;
    if (fileSizeInMB > MAX_FILE_SIZE_MB) {
      console.warn(`⚠️ File too large (${fileSizeInMB.toFixed(2)} MB), returning file path instead of base64`);
      return {
        success: true,
        dataUrl: `file://${fullPath}`,
        mimeType: 'application/octet-stream',
        size: stats.size,
        isFilePath: true
      };
    }
    
    // For smaller files, load as base64
    const buffer = await fs.readFile(fullPath);
    
    // Additional safety check: Don't convert to string if buffer is too large
    if (buffer.length > 50 * 1024 * 1024) { // 50MB in bytes
      console.warn(`⚠️ Buffer too large (${buffer.length} bytes), returning file path instead of base64`);
      return {
        success: true,
        dataUrl: `file://${fullPath}`,
        mimeType: 'application/octet-stream',
        size: buffer.length,
        isFilePath: true
      };
    }
    
    const base64 = buffer.toString('base64');
    
    // Determine MIME type from file extension
    const extension = relativePath.split('.').pop()?.toLowerCase();
    let mimeType = 'image/jpeg'; // default
    if (extension === 'png') mimeType = 'image/png';
    else if (extension === 'gif') mimeType = 'image/gif';
    else if (extension === 'webp') mimeType = 'image/webp';
    else if (extension === 'bmp') mimeType = 'image/bmp';
    else if (extension === 'svg') mimeType = 'image/svg+xml';
    
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    console.log(`✅ Loaded image as base64: ${relativePath} (${buffer.length} bytes)`);
    
    return {
      success: true,
      dataUrl: dataUrl,
      mimeType: mimeType,
      size: buffer.length,
      isFilePath: false
    };
  } catch (error) {
    console.error(`❌ Failed to load image as base64 ${relativePath}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// Transcript generation is now handled by the backend API server

// Create a temporary directory for renders
const tempDir = join(app.getPath('userData'), 'renders');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir);
}

// Handle video rendering
ipcMain.on('start-render', async (event, videoAssets) => {
  try {
    console.log('[FFMPEG] Received start-render event.');
    console.log('[FFMPEG] Video assets received:', {
      hasVideoAssets: !!videoAssets,
      hasLayers: !!videoAssets?.layers,
      layersCount: videoAssets?.layers?.length || 0,
      hasMediaLibrary: !!videoAssets?.mediaLibrary,
      mediaLibraryCount: videoAssets?.mediaLibrary?.length || 0,
      hasTimeline: !!videoAssets?.timeline,
      totalDuration: videoAssets?.timeline?.totalDuration || 0
    });
    
        // Send initial progress to confirm we received the data
    console.log('[FFMPEG] Sending initial progress message...');
    event.sender.send('render-progress', { progress: 0, message: 'Starting render process...' });
    console.log('[FFMPEG] Initial progress message sent');
    
    const outputFileName = `render_${Date.now()}.mp4`;
  const outputPath = join(tempDir, outputFileName);

  // --- FFMPEG Command Generation with Timeline Support ---
  const inputs: string[] = [];
  const filterComplex: string[] = [];
  let filterScriptPath: string | undefined;
  
  // Cleanup function for filter script file
  const cleanupFilterScript = async () => {
    if (filterScriptPath) {
      try {
        await fs.unlink(filterScriptPath);
        console.log(`[FFMPEG] Cleaned up filter script file: ${filterScriptPath}`);
      } catch (cleanupError) {
        console.warn(`[FFMPEG] Failed to clean up filter script file: ${cleanupError}`);
      }
    }
  };

  // Enhanced types for timeline-based rendering - match video editor exactly
  interface MediaItem {
    id: string;
    type: 'video' | 'image' | 'audio' | 'voiceover' | 'text';
    filePath: string;
    duration?: number;
    // Audio/Video properties
    volume?: number; // 0-100
    muted?: boolean;
    // Visual properties (for images, videos, text)
    x?: number; // Position X (0-1)
    y?: number; // Position Y (0-1)
    width?: number; // Width (0-1)
    height?: number; // Height (0-1)
    // Text properties
    text?: string;
    fontFamily?: string;
    fontSize?: number;
    fontBold?: boolean;
    fontItalic?: boolean;
    fontUnderline?: boolean;
    fontStrikethrough?: boolean;
    fontColor?: string;
    backgroundColor?: string;
    backgroundTransparent?: boolean;
    textAlignment?: "left" | "center" | "right";
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
  }

  // Get timeline data
  const layers: Layer[] = videoAssets.layers || [];
  const mediaLibrary: MediaItem[] = videoAssets.mediaLibrary || [];
  const totalDuration = videoAssets.timeline?.totalDuration || 30; // Default 30s if not specified
  const videoStyle = videoAssets.editorSettings?.videoStyle || 'landscape';

  console.log(`[FFMPEG] Timeline: ${totalDuration}s, Layers: ${layers.length}, Media: ${mediaLibrary.length}`);
  console.log(`[FFMPEG] Layers details:`, layers.map(layer => ({
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    type: layer.type,
    itemsCount: layer.items?.length || 0,
    items: layer.items?.map(item => ({
      id: item.id,
      mediaId: item.mediaId,
      startTime: item.startTime,
      duration: item.duration,
      hasGeometry: !!item.geometry
    }))
  })));
  console.log(`[FFMPEG] Media library details:`, mediaLibrary.map(item => ({
    id: item.id,
    type: item.type,
    filePath: item.filePath?.substring(0, 50) + '...',
    text: item.text?.substring(0, 30) + '...',
    hasText: !!item.text
  })));
  
  

  // Collect all unique media items used in timeline and create input mapping
  const usedMediaItems: MediaItem[] = [];
  const mediaToInputIndex: Map<string, number> = new Map();

  layers.forEach((layer: Layer) => {
    console.log(`[FFMPEG] Processing layer: ${layer.name} (visible: ${layer.visible}, items: ${layer.items?.length || 0})`);
    if (!layer.visible) {
      console.log(`[FFMPEG] Skipping invisible layer: ${layer.name}`);
      return;
    }
    
    layer.items.forEach((item: TimelineItem) => {
      console.log(`[FFMPEG] Processing timeline item: ${item.id} (mediaId: ${item.mediaId})`);
      const mediaItem = mediaLibrary.find((m: MediaItem) => m.id === item.mediaId);
      if (mediaItem && !mediaToInputIndex.has(mediaItem.id)) {
        // Skip blob URLs
        if (mediaItem.filePath.startsWith('blob:')) {
          console.warn(`[FFMPEG] Skipping blob URL: ${mediaItem.id}`);
          return;
        }

        // Skip text items from file inputs - they'll be handled by drawtext filter
        if (mediaItem.type === 'text') {
          console.log(`[FFMPEG] Text item will be handled by drawtext filter: ${mediaItem.id}`);
          mediaToInputIndex.set(mediaItem.id, -1); // Mark as handled but not a file input
          usedMediaItems.push(mediaItem);
          return;
        }

        // Add to inputs
        let absolutePath: string;
        if (mediaItem.filePath.startsWith('/') || mediaItem.filePath.includes(':')) {
          absolutePath = mediaItem.filePath;
        } else {
          absolutePath = join(app.getPath('userData'), mediaItem.filePath);
        }

        const inputIndex = inputs.length / 2; // Each input adds 2 args: -i and path
        inputs.push('-i', absolutePath);
        mediaToInputIndex.set(mediaItem.id, inputIndex);
        usedMediaItems.push(mediaItem);
        
        console.log(`[FFMPEG] Input ${inputIndex}: ${mediaItem.type} - ${mediaItem.id}`);
      }
    });
  });
  
    console.log(`[FFMPEG] Media overlay processing complete.`);
  event.sender.send('render-progress', { progress: 30, message: `Media overlay processing complete.` });
  
  console.log(`[FFMPEG] Media processing complete. Used media items: ${usedMediaItems.length}`);
  event.sender.send('render-progress', { progress: 32, message: `Media processing complete. Used ${usedMediaItems.length} media items` });
  console.log(`[FFMPEG] Used media items breakdown:`, usedMediaItems.map(item => ({
    id: item.id,
    type: item.type,
    hasText: !!item.text,
    inputIndex: mediaToInputIndex.get(item.id),
    filePath: item.filePath?.substring(0, 50) + '...'
  })));
  
  // Debug: Check if we have any file inputs
  console.log(`[FFMPEG] File inputs count: ${inputs.length / 2}`);
  console.log(`[FFMPEG] File input paths:`, inputs.filter((_, index) => index % 2 === 1).map(path => path.substring(0, 50) + '...'));
  
  if (usedMediaItems.length === 0) {
    console.error('[FFMPEG] No valid media items found');
    console.error('[FFMPEG] Debug info:');
    console.error(`  - Total layers: ${layers.length}`);
    console.error(`  - Visible layers: ${layers.filter(l => l.visible).length}`);
    console.error(`  - Total media library items: ${mediaLibrary.length}`);
    console.error(`  - Text items: ${mediaLibrary.filter(m => m.type === 'text').length}`);
    console.error(`  - Image items: ${mediaLibrary.filter(m => m.type === 'image').length}`);
    console.error(`  - Video items: ${mediaLibrary.filter(m => m.type === 'video').length}`);
    event.sender.send('render-progress', { error: 'No valid media items found' });
    return;
  }

  // Determine video dimensions based on style
  let width: number, height: number;
  switch (videoStyle) {
    case 'square': width = 1080; height = 1080; break;
    case 'vertical': width = 1080; height = 1920; break;
    case 'landscape': 
    default: width = 1920; height = 1080; break;
  }

    // Process layers from bottom to top (reverse order for overlay) - respect individual item properties
  const audioSegments: string[] = [];
  
  // First, create a black background video for the full duration
  filterComplex.push(`color=black:size=${width}x${height}:duration=${totalDuration}:rate=30 [bg]`);
  let currentVideoStream = '[bg]';
  
  console.log(`[FFMPEG] Created background video filter: color=black:size=${width}x${height}:duration=${totalDuration}:rate=30 [bg]`);

  // Sort layers by index to maintain proper layering (bottom to top)
  const sortedLayers = [...layers].filter(layer => layer.visible);
  
  console.log(`[FFMPEG] Processing ${sortedLayers.length} visible layers for media overlay`);
  event.sender.send('render-progress', { progress: 5, message: `Processing ${sortedLayers.length} visible layers for media overlay` });
  
  let overlayCount = 0;
  
  sortedLayers.forEach((layer: Layer, layerIndex: number) => {
    console.log(`[FFMPEG] Processing layer ${layerIndex}: ${layer.name} with ${layer.items.length} items`);
    event.sender.send('render-progress', { progress: 10 + (layerIndex * 5), message: `Processing layer ${layerIndex}: ${layer.name} with ${layer.items.length} items` });
    
    layer.items.forEach((item: TimelineItem, itemIndex: number) => {
      const mediaItem = mediaLibrary.find((m: MediaItem) => m.id === item.mediaId);
      if (!mediaItem) {
        console.log(`[FFMPEG] No media item found for timeline item ${item.id} (mediaId: ${item.mediaId})`);
        event.sender.send('render-progress', { progress: 15, message: `ERROR: No media item found for timeline item ${item.id} (mediaId: ${item.mediaId})` });
        return;
      }
      
      console.log(`[FFMPEG] Found media item: ${mediaItem.id} (type: ${mediaItem.type})`);
      event.sender.send('render-progress', { progress: 20, message: `Found media item: ${mediaItem.id} (type: ${mediaItem.type})` });
      
      const inputIndex = mediaToInputIndex.get(mediaItem.id);
      if (inputIndex === undefined) {
        console.log(`[FFMPEG] No input index found for media item ${mediaItem.id}`);
        event.sender.send('render-progress', { progress: 25, message: `ERROR: No input index found for media item ${mediaItem.id}` });
        return;
      }
       
      // Skip processing for text items that don't have file inputs
      if (mediaItem.type === 'text' && inputIndex === -1) {
        // Text items are handled separately in the text processing section
        return;
      }

      const streamLabel = `item_${layerIndex}_${itemIndex}`;
      
             // Get geometry from timeline item or use media item properties as fallback
       const geometry = item.geometry || {
         x: mediaItem.x || 0,
         y: mediaItem.y || 0,
         width: mediaItem.width || 1,
         height: mediaItem.height || 1,
         rotation: 0
       };
      
      // Calculate actual pixel coordinates based on individual item geometry
      const itemX = Math.round(geometry.x * width);
      const itemY = Math.round(geometry.y * height);
      const itemWidth = Math.round(geometry.width * width);
      const itemHeight = Math.round(geometry.height * height);
      const rotation = geometry.rotation || 0;
      
                    if (mediaItem.type === 'image') {
          // For images: scale to individual item size and position
          // Use scale without pad to avoid dimension conflicts
           let scaleFilter = `[${inputIndex}:v] scale=${itemWidth}:${itemHeight}:force_original_aspect_ratio=decrease`;
          
          // Apply rotation if specified
          if (rotation !== 0) {
            scaleFilter += `,rotate=${rotation}*PI/180`;
          }
          
          filterComplex.push(`${scaleFilter} [${streamLabel}]`);
          
          // Overlay the image at the correct position and time
         const nextStreamLabel = `overlay_${overlayCount}`;
          const overlayFilter = `${currentVideoStream}[${streamLabel}] overlay=${itemX}:${itemY}:enable='between(t,${item.startTime},${item.startTime + item.duration})' [${nextStreamLabel}]`;
          filterComplex.push(overlayFilter);
         currentVideoStream = `[${nextStreamLabel}]`;
         overlayCount++;
         
       } else if (mediaItem.type === 'video') {
                 // For videos: trim to duration and scale to individual item size and position
         // Use scale without pad to avoid dimension conflicts
         let scaleFilter = `[${inputIndex}:v] trim=duration=${item.duration}, setpts=PTS-STARTPTS, scale=${itemWidth}:${itemHeight}:force_original_aspect_ratio=decrease`;
        
        // Apply rotation if specified
        if (rotation !== 0) {
          scaleFilter += `,rotate=${rotation}*PI/180`;
        }
        
        filterComplex.push(`${scaleFilter} [${streamLabel}]`);
        
        // Overlay the video at the correct position and time
        const nextStreamLabel = `overlay_${overlayCount}`;
        filterComplex.push(
          `${currentVideoStream}[${streamLabel}] overlay=${itemX}:${itemY}:enable='between(t,${item.startTime},${item.startTime + item.duration})' [${nextStreamLabel}]`
        );
        currentVideoStream = `[${nextStreamLabel}]`;
        overlayCount++;

        // **SKIP VIDEO AUDIO FOR NOW** - Simplified approach to avoid FFmpeg errors
        console.log(`[FFMPEG] Video audio extraction temporarily disabled for: ${mediaItem.id}`);
      }
      
     // Handle audio streams with volume control
      if (mediaItem.type === 'audio' || mediaItem.type === 'voiceover') {
        const audioStreamLabel = `audio_${layerIndex}_${itemIndex}`;
       
       // Get volume setting (0-100, default to 100 if not specified)
       const volume = mediaItem.volume !== undefined ? mediaItem.volume : 100;
       const volumeMultiplier = volume / 100; // Convert to 0-1 range
       
       // Skip muted audio
       if (mediaItem.muted || volume === 0) {
         console.log(`[FFMPEG] Skipping muted/zero volume audio: ${mediaItem.id}`);
         return;
       }
        
        // Trim audio to the item duration and add delay for start time
       let audioFilter = `[${inputIndex}:a] atrim=duration=${item.duration}, asetpts=PTS-STARTPTS`;
       
       // Apply volume adjustment if not 100%
       if (volumeMultiplier !== 1) {
         audioFilter += `,volume=${volumeMultiplier}`;
       }
       
       // Add delay if start time is not 0
        if (item.startTime > 0) {
         audioFilter += `,adelay=${item.startTime * 1000}|${item.startTime * 1000}`;
       }
       
       filterComplex.push(`${audioFilter} [${audioStreamLabel}]`);
       audioSegments.push(`[${audioStreamLabel}]`);
       console.log(`[FFMPEG] Added ${mediaItem.type} audio at ${item.startTime}s for ${item.duration}s with volume ${volume}%`);
     }
     
     
   });
 });

    // Process text items separately since they don't use file inputs - respect individual item properties
    console.log('[FFMPEG] Text rendering enabled');
    console.log(`[FFMPEG] Processing ${sortedLayers.length} layers for text items`);
    let textItemsFound = 0;
    sortedLayers.forEach((layer: Layer) => {
      if (!layer.visible) return;
      
      layer.items.forEach((item: TimelineItem) => {
        const mediaItem = mediaLibrary.find((m: MediaItem) => m.id === item.mediaId);
        if (!mediaItem || mediaItem.type !== 'text') return;
        
        const inputIndex = mediaToInputIndex.get(mediaItem.id);
        console.log(`[FFMPEG] Text item found: ${mediaItem.id}, inputIndex: ${inputIndex}`);
        if (inputIndex !== -1) return; // Skip if already processed
        
        textItemsFound++;
        
        // Get geometry from timeline item or use media item properties as fallback
        const geometry = item.geometry || {
          x: mediaItem.x || 0,
          y: mediaItem.y || 0,
          width: mediaItem.width || 1,
          height: mediaItem.height || 1,
          rotation: 0
        };
        
        // DETAILED GEOMETRY LOGGING
        console.log(`[TEXT GEOMETRY] ${mediaItem.id}: RELATIVE x=${geometry.x}, y=${geometry.y}, width=${geometry.width}, height=${geometry.height}, rotation=${geometry.rotation || 0}`);
        console.log(`[TEXT GEOMETRY] ${mediaItem.id}: VIDEO DIMENSIONS width=${width}px, height=${height}px`);
        
        // Calculate actual pixel coordinates based on individual item geometry
        const itemX = Math.round(geometry.x * width);
        const itemY = Math.round(geometry.y * height);
        const itemWidth = Math.round(geometry.width * width);
        const itemHeight = Math.round(geometry.height * height);
        
        // Calculate the text area that should be taken by the text
        // This ensures text fills the entire designated area properly (as shown in preview)
        const textAreaWidth = itemWidth;
        const textAreaHeight = itemHeight;
        
        // DETAILED PIXEL COORDINATE LOGGING
        console.log(`[TEXT PIXELS] ${mediaItem.id}: ABSOLUTE x=${itemX}px, y=${itemY}px, width=${itemWidth}px, height=${itemHeight}px`);
        console.log(`[TEXT AREA] ${mediaItem.id}: textAreaWidth=${textAreaWidth}px, textAreaHeight=${textAreaHeight}px`);
        console.log(`[TEXT AREA] ${mediaItem.id}: POSITION (${itemX}, ${itemY}) to (${itemX + itemWidth}, ${itemY + itemHeight})`);
       
        // For text: create text overlay using drawtext filter - match video editor exactly
        const textContent = mediaItem.text || '';
        
        // Log text content for debugging
        console.log(`[TEXT CONTENT] ${mediaItem.id}: "${textContent}"`);
        
        // Skip if text content is empty
        if (!textContent || textContent.trim() === '') {
          console.log(`[FFMPEG] Skipping empty text item: ${mediaItem.id}`);
          return;
        }
        
        // Use user's font size preference or calculate based on text area geometry
        let fontSize: number;
        let baseFontSize: number;
        
        // Use user's font size if available, otherwise calculate from area dimensions
        if (mediaItem.fontSize && mediaItem.fontSize > 0) {
          fontSize = mediaItem.fontSize;
          console.log(`[FONT SIZE] ${mediaItem.id}: USING USER PREFERENCE: fontSize=${fontSize}px`);
        } else {
          baseFontSize = Math.min(itemWidth, itemHeight) * 0.2; // 20% of smaller dimension for larger text
          fontSize = baseFontSize;
          console.log(`[FONT SIZE] ${mediaItem.id}: CALCULATED fontSize=${fontSize}px (20% of min(${itemWidth}, ${itemHeight}))`);
        }
        
        // First, escape the text for FFmpeg (preserve line breaks)
        console.log(`[TEXT ESCAPING] ${mediaItem.id}: BEFORE: "${textContent}"`);
        const escapedText = textContent
          .replace(/['",:;]/g, '')   // Remove quotes, apostrophes, commas, colons, semicolons
          .replace(/\r\n/g, '\n')    // Normalize line breaks to \n
          .replace(/\r/g, '\n')      // Convert remaining \r to \n
          .trim();                   // Trim whitespace
        console.log(`[TEXT ESCAPING] ${mediaItem.id}: AFTER: "${escapedText}"`);
        
        // Apply same optimal font size calculation as preview
        // This will simulate the canvas measureText and constraint calculations
        
        // First, do preliminary word wrapping to estimate line count
        const maxWidth = itemWidth * 0.99;
        console.log(`[WORD WRAP PRELIMINARY] ${mediaItem.id}: maxWidth=${maxWidth}px (99% of ${itemWidth}px)`);
        const preliminaryWrapped = wrapTextForFFmpeg(escapedText, Math.floor(maxWidth / (fontSize * 0.6)));
        const preliminaryLines = preliminaryWrapped.split('\n');
        console.log(`[WORD WRAP PRELIMINARY] ${mediaItem.id}: preliminaryLines=${preliminaryLines.length}`);
        
        // EXACT SAME optimal font size calculation as preview (lines 1368-1403)
        let optimalFontSize = fontSize;
        console.log(`[FONT OPTIMIZATION] ${mediaItem.id}: STARTING with fontSize=${fontSize}px`);
        
        if (preliminaryLines.length === 1) {
          // Single line - EXACTLY match preview algorithm (lines 1368-1384)
          // Text width estimation - use lower value to get larger calculated font sizes
          // The smaller the estimated width, the larger the calculated optimal font size
          // Preview's measureText is typically smaller than our estimation, so reduce factor
          const estimatedTextWidth = escapedText.length * fontSize * 0.25; // Much lower for larger fonts
          
          // EXACT SAME width constraint as preview: width * 0.9 * (fontSize / lineMetrics.width)
          const maxWidthFontSize = (itemWidth * 0.9) * (fontSize / estimatedTextWidth);
          
          // EXACT SAME height constraint as preview: height * 0.8
          const maxHeightFontSize = itemHeight * 0.8;
          
          console.log(`[FONT OPTIMIZATION] ${mediaItem.id}: SINGLE LINE - estimatedTextWidth=${estimatedTextWidth}px`);
          console.log(`[FONT OPTIMIZATION] ${mediaItem.id}: SINGLE LINE - maxWidthFontSize=${maxWidthFontSize}px (${itemWidth * 0.9}px * ${fontSize}px / ${estimatedTextWidth}px)`);
          console.log(`[FONT OPTIMIZATION] ${mediaItem.id}: SINGLE LINE - maxHeightFontSize=${maxHeightFontSize}px (80% of ${itemHeight}px)`);
          
          // EXACT SAME constraint logic as preview: Math.min with max 2x scaling
          optimalFontSize = Math.min(maxWidthFontSize, maxHeightFontSize, fontSize * 2);
          console.log(`[FONT OPTIMIZATION] ${mediaItem.id}: SINGLE LINE - optimalFontSize=${optimalFontSize}px (min of ${maxWidthFontSize}, ${maxHeightFontSize}, ${fontSize * 2})`);
        } else {
          // Multi-line - EXACTLY match preview algorithm (lines 1385-1403)
          // Text width estimation for multi-line - lower value for larger fonts
          const estimatedMaxLineWidth = Math.max(...preliminaryLines.map(line => line.length * fontSize * 0.25));
          
          // Use the SAME actualLineHeight calculation as positioning (preview consistency)
          const totalAvailableHeight = itemHeight;
          const actualLineHeight = totalAvailableHeight / preliminaryLines.length;
          
          // EXACT SAME width constraint as preview: width * 0.9 * (fontSize / maxLineWidth)
          const maxWidthFontSize = (itemWidth * 0.9) * (fontSize / estimatedMaxLineWidth);
          
          // EXACT SAME height constraint as preview: actualLineHeight * 0.7
          const maxHeightFontSize = actualLineHeight * 0.7;
          
          console.log(`[FONT OPTIMIZATION] ${mediaItem.id}: MULTI-LINE - estimatedMaxLineWidth=${estimatedMaxLineWidth}px`);
          console.log(`[FONT OPTIMIZATION] ${mediaItem.id}: MULTI-LINE - actualLineHeight=${actualLineHeight}px (${itemHeight}px / ${preliminaryLines.length} lines)`);
          console.log(`[FONT OPTIMIZATION] ${mediaItem.id}: MULTI-LINE - maxWidthFontSize=${maxWidthFontSize}px`);
          console.log(`[FONT OPTIMIZATION] ${mediaItem.id}: MULTI-LINE - maxHeightFontSize=${maxHeightFontSize}px (70% of ${actualLineHeight}px)`);
          
          // EXACT SAME constraint logic as preview: Math.min with max 1.5x scaling
          optimalFontSize = Math.min(maxWidthFontSize, maxHeightFontSize, fontSize * 1.5);
          console.log(`[FONT OPTIMIZATION] ${mediaItem.id}: MULTI-LINE - optimalFontSize=${optimalFontSize}px (min of ${maxWidthFontSize}, ${maxHeightFontSize}, ${fontSize * 1.5})`);
        }
        
        // Use the optimal font size calculated above - let preview algorithm control size naturally
        fontSize = optimalFontSize;
        console.log(`[FONT SIZE] ${mediaItem.id}: USING OPTIMAL SIZE: ${optimalFontSize}px (no artificial min/max constraints)`);
        
        // Log final font size calculation for debugging
        console.log(`[FONT SIZE] ${mediaItem.id}: FINAL fontSize=${fontSize}px (text length: ${textContent.length}, area: ${textAreaWidth}x${textAreaHeight})`);
        
        // NOW do final word wrapping with the optimized font size
        const finalMaxCharsPerLine = Math.floor(maxWidth / (fontSize * 0.6));
        const wrappedText = wrapTextForFFmpeg(escapedText, finalMaxCharsPerLine);
        
        // Ensure font size fits properly within the text area after wrapping
        const textLines = wrappedText.split('\n');
        const maxFontSizeForArea = Math.min(itemWidth / 10, itemHeight / (textLines.length || 1) * 0.8);
        if (fontSize > maxFontSizeForArea) {
          console.log(`[FONT SIZE] ${mediaItem.id}: Adjusting font size to fit area: ${fontSize}px -> ${maxFontSizeForArea}px`);
          fontSize = maxFontSizeForArea;
        }
        
        // Ensure reasonable bounds
        if (fontSize < 24) {
          console.log(`[FONT SIZE] ${mediaItem.id}: Minimum font size: 24px`);
          fontSize = 24;
        }
        if (fontSize > 150) {
          fontSize = 150;
          console.log(`[FONT SIZE] ${mediaItem.id}: Maximum font size: 150px`);
        }
        // Use the already calculated textLines
        console.log(`[WORD WRAP FINAL] ${mediaItem.id}: With optimized fontSize=${fontSize}px`);
        console.log(`[WORD WRAP FINAL] ${mediaItem.id}: finalMaxCharsPerLine=${finalMaxCharsPerLine}`);
        console.log(`[WORD WRAP FINAL] ${mediaItem.id}: wrappedText="${wrappedText}", lines=${textLines.length}`);
        
        const fontColor = mediaItem.fontColor || '#ffffff';
        
        // EXACT SAME text positioning as preview canvas
        // Preview uses center alignment horizontally and middle baseline vertically
        const centerX = itemX + (itemWidth / 2);  // Center horizontally (textAlign: center)
        console.log(`[TEXT POSITIONING] ${mediaItem.id}: HORIZONTAL CENTER calculation:`);
        console.log(`[TEXT POSITIONING] ${mediaItem.id}: - itemX=${itemX}px + (itemWidth=${itemWidth}px / 2) = centerX=${centerX}px`);
        
        // EXACT SAME positioning algorithm as preview (lines 1344-1363)
        // Preview uses textBaseline: "middle" and specific line height calculations
        
        let actualLineHeight;
        let startY;
        
        if (textLines.length === 1) {
          // Single line - EXACT SAME as preview (lines 1352-1353)
          actualLineHeight = itemHeight; // Full height for single line
          startY = itemY + (itemHeight / 2); // Perfect vertical center
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: SINGLE LINE (preview algorithm):`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - actualLineHeight=${actualLineHeight}px (full height)`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - startY=${startY}px (itemY + height/2 = ${itemY} + ${itemHeight/2})`);
        } else {
          // Multi-line - EXACT SAME as preview (lines 1356-1359)
          const totalAvailableHeight = itemHeight;
          actualLineHeight = totalAvailableHeight / textLines.length; // Equal distribution
          const topMargin = actualLineHeight / 2; // Equal margin from top
          startY = itemY + topMargin; // Start with equal top margin
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: MULTI-LINE (preview algorithm):`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - totalAvailableHeight=${totalAvailableHeight}px`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - actualLineHeight=${actualLineHeight}px (${totalAvailableHeight}px / ${textLines.length} lines)`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - topMargin=${topMargin}px (actualLineHeight / 2)`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - startY=${startY}px (itemY + topMargin = ${itemY} + ${topMargin})`);
        }
        
        // Use FFmpeg expressions for proper text centering
        // x=(w-text_w)/2 centers text horizontally, y=(h-text_h)/2 centers text vertically
        // For text area centering, we need to calculate relative to the text area bounds
        const textHeight = fontSize * textLines.length * 1.2; // Approximate text height with line spacing
        
        // Use FFmpeg expressions for automatic centering within the text area
        // These expressions will be evaluated by FFmpeg at render time
        const textX = `${itemX}+(${textAreaWidth}-text_w)/2`;
        const textY = `${itemY}+(${textAreaHeight}-text_h)/2`;
        
        console.log(`[TEXT CENTERING] ${mediaItem.id}: Using FFmpeg centering expressions`);
        console.log(`[TEXT CENTERING] ${mediaItem.id}: textX expression: ${textX}`);
        console.log(`[TEXT CENTERING] ${mediaItem.id}: textY expression: ${textY}`);
        console.log(`[TEXT CENTERING] ${mediaItem.id}: Text area: ${itemX},${itemY} to ${itemX + textAreaWidth},${itemY + textAreaHeight}`);
        console.log(`[TEXT CENTERING] ${mediaItem.id}: Estimated text dimensions: ${textHeight}px height`);
        
        // Final positioning summary
        console.log(`[TEXT POSITION] ${mediaItem.id}: FFmpeg centering expressions applied`);
        console.log(`[TEXT POSITION] ${mediaItem.id}: AREA BOUNDS: (${itemX}, ${itemY}) to (${itemX + itemWidth}, ${itemY + itemHeight})`);
        console.log(`[TEXT POSITION] ${mediaItem.id}: TEXT PLACEMENT: ${textLines.length > 1 ? 'multi-line center' : 'single line center'}, lines=${textLines.length}`);
        console.log(`[TEXT POSITION] ${mediaItem.id}: TEXT DIMENSIONS: height=${textHeight}px`);
        
        // Text escaping already done above
        
        // ENABLE TEXT RENDERING - Implement the same algorithm as preview
        console.log(`[TEXT RENDERING] Rendering text: ${mediaItem.id}`);
        
        // Build comprehensive text filter matching preview algorithm
        // Use the wrapped text for proper line breaks
        // Escape only single quotes for FFmpeg, keep newlines as actual line breaks
        const ffmpegEscapedText = wrappedText.replace(/'/g, "\\'");
        let textFilter = `drawtext=text='${ffmpegEscapedText}'`;
        
        // Debug: Log the text being rendered
        console.log(`[TEXT DEBUG] ${mediaItem.id}: Original text: "${wrappedText}"`);
        console.log(`[TEXT DEBUG] ${mediaItem.id}: Escaped text: "${ffmpegEscapedText}"`);
        
        // Font properties
        textFilter += `:fontsize=${fontSize}`;
        textFilter += `:fontcolor=${fontColor}`;
        
        // Debug: Make text more visible for testing
        console.log(`[TEXT DEBUG] ${mediaItem.id}: Font size: ${fontSize}px, Color: ${fontColor}`);
        
        // Log the exact fontSize being applied
        console.log(`[APPLIED FONT SIZE] ${mediaItem.id}: fontSize=${fontSize}px applied to FFmpeg filter`);
        
        // Font family - use system fonts that FFmpeg can find (cross-platform)
        let fontPath = '';
        if (mediaItem.fontFamily) {
          // Cross-platform font mapping with bold/italic variants
          const fontMap: { [key: string]: string } = {
            'Arial': platform() === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Arial.ttf',
            'Helvetica': platform() === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Helvetica.ttc',
            'Times New Roman': platform() === 'win32' ? 'C:/Windows/Fonts/times.ttf' : '/System/Library/Fonts/Times.ttc',
            'Georgia': platform() === 'win32' ? 'C:/Windows/Fonts/georgia.ttf' : '/System/Library/Fonts/Georgia.ttf',
            'Verdana': platform() === 'win32' ? 'C:/Windows/Fonts/verdana.ttf' : '/System/Library/Fonts/Verdana.ttf'
          };
          
          let baseFont = fontMap[mediaItem.fontFamily] || (platform() === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Arial.ttf');
          
          // Handle bold and italic font variants by selecting appropriate font files
          if (mediaItem.fontBold && mediaItem.fontItalic) {
            // Bold italic - try to find bold italic variant
            if (platform() === 'win32') {
              if (mediaItem.fontFamily === 'Arial') {
                fontPath = 'C:/Windows/Fonts/arialbi.ttf';
              } else if (mediaItem.fontFamily === 'Times New Roman') {
                fontPath = 'C:/Windows/Fonts/timesbi.ttf';
              } else {
                fontPath = baseFont; // Fallback to regular font
              }
            } else {
              fontPath = baseFont; // Fallback for non-Windows
            }
          } else if (mediaItem.fontBold) {
            // Bold only - try to find bold variant
            if (platform() === 'win32') {
              if (mediaItem.fontFamily === 'Arial') {
                fontPath = 'C:/Windows/Fonts/arialbd.ttf';
              } else if (mediaItem.fontFamily === 'Times New Roman') {
                fontPath = 'C:/Windows/Fonts/timesbd.ttf';
              } else {
                fontPath = baseFont; // Fallback to regular font
              }
            } else {
              fontPath = baseFont; // Fallback for non-Windows
            }
          } else if (mediaItem.fontItalic) {
            // Italic only - try to find italic variant
            if (platform() === 'win32') {
              if (mediaItem.fontFamily === 'Arial') {
                fontPath = 'C:/Windows/Fonts/ariali.ttf';
              } else if (mediaItem.fontFamily === 'Times New Roman') {
                fontPath = 'C:/Windows/Fonts/timesi.ttf';
              } else {
                fontPath = baseFont; // Fallback to regular font
              }
            } else {
              fontPath = baseFont; // Fallback for non-Windows
            }
          } else {
            // Regular font
            fontPath = baseFont;
          }
        } else {
          fontPath = platform() === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Arial.ttf';
        }
        textFilter += `:fontfile=${fontPath}`;
        
        // Debug: Log font path and styling
        console.log(`[TEXT DEBUG] ${mediaItem.id}: Font path: ${fontPath}`);
        console.log(`[TEXT DEBUG] ${mediaItem.id}: Bold: ${mediaItem.fontBold}, Italic: ${mediaItem.fontItalic}`);
        
        // Note: Removed :fontweight=bold and :fontstyle=italic parameters as they can cause render failures
        // Font styling is now handled by selecting appropriate font files instead
        
        // Text positioning with manual centering (FFmpeg drawtext doesn't have text_align)
        textFilter += `:x=${textX}:y=${textY}`;
        
        // Multi-line spacing
        if (textLines.length > 1) {
          // Calculate line spacing to match preview's actualLineHeight
          const lineSpacing = actualLineHeight / fontSize; // Ratio of line height to font size
          textFilter += `:line_spacing=${lineSpacing}`;
          
          console.log(`[MULTI-LINE] ${mediaItem.id}: Added line_spacing=${lineSpacing} (actualLineHeight=${actualLineHeight}px / fontSize=${fontSize}px)`);
          console.log(`[MULTI-LINE] ${mediaItem.id}: Manual centering applied (text_align not supported)`);
        }
        
        // Word wrapping already handled above in the font calculation
        // We're already using wrappedText in the initial filter
        
        // Don't use FFmpeg's box parameter - it only creates tight text bounds
        // Instead, we'll create a separate background rectangle filter that fills entire area
        console.log(`[TEXT BACKGROUND] ${mediaItem.id}: Not using box parameter - will create separate background rectangle`);
        
        // Text shadow for readability (simulate preview shadow)
        // Add shadow for better text visibility
        textFilter += `:shadowcolor=black:shadowx=2:shadowy=2`;
        
        // Note: enable parameter is not supported in drawtext filter
        // We'll handle timing through the filter chain instead
        // textFilter += `:enable='between(t,${item.startTime},${item.startTime + item.duration})'`;
        
        // Log the complete text filter for debugging
        console.log(`[TEXT FILTER] ${mediaItem.id}: COMPLETE FILTER: ${textFilter}`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: FILTER BREAKDOWN:`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - text='${wrappedText}'`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - fontsize=${fontSize}`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - fontcolor=${fontColor}`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - x=${textX} (manually centered)`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - y=${textY} (baseline adjusted)`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - Background box: ${textFilter.includes('box=1') ? 'YES' : 'NO'}`);
        
        // Add text overlay to the current video stream with proper timeline timing
        
        // Use timeline item timing information for proper text timing
        const textStartTime = item.startTime || 0;
        const textDuration = item.duration || mediaItem.duration || 5;
        const textEndTime = textStartTime + textDuration;
        
        console.log(`[TEXT TIMING] ${mediaItem.id}: startTime=${textStartTime}s, duration=${textDuration}s, endTime=${textEndTime}s`);
        
        // Step 1: Create background rectangle filter if needed (to fill entire area like preview)
        if (!mediaItem.backgroundTransparent && mediaItem.backgroundColor) {
          let bgColor = mediaItem.backgroundColor;
          console.log(`[BACKGROUND RECT] ${mediaItem.id}: Original backgroundColor="${bgColor}"`);
          
          // Convert rgba to hex if needed (FFmpeg doesn't support rgba)
          if (bgColor.startsWith('rgba') || bgColor.startsWith('rgb')) {
            const rgbaMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
            if (rgbaMatch) {
              const r = parseInt(rgbaMatch[1]);
              const g = parseInt(rgbaMatch[2]);
              const b = parseInt(rgbaMatch[3]);
              bgColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              console.log(`[BACKGROUND RECT] ${mediaItem.id}: Converted to hex: ${bgColor}`);
            }
          }
          
          // Ensure we have a valid color
          if (!bgColor.startsWith('#')) {
            bgColor = '#000000'; // Default to black if conversion failed
            console.log(`[BACKGROUND RECT] ${mediaItem.id}: Using default color: ${bgColor}`);
          }
          
          // Create a colored rectangle that fills the entire text area (like preview canvas)
          // Use drawbox filter to create a filled rectangle overlay
          const bgRectFilter = `drawbox=x=${itemX}:y=${itemY}:w=${itemWidth}:h=${itemHeight}:color=${bgColor}:t=fill:enable='between(t,${textStartTime},${textEndTime})'`;
          const bgOverlayFilter = `${currentVideoStream} ${bgRectFilter} [bg_${overlayCount}]`;
          
          console.log(`[BACKGROUND RECT] ${mediaItem.id}: Adding background rectangle ${itemWidth}x${itemHeight} at ${itemX},${itemY} with color ${bgColor}`);
          filterComplex.push(bgOverlayFilter);
        
        currentVideoStream = `[bg_${overlayCount}]`;
        overlayCount++;
        }
        
        // Step 2: Apply text overlay on top of background (without box parameter)
        const textOverlayLabel = `text_${overlayCount}`;
        const timedTextFilter = textFilter + `:enable='between(t,${textStartTime},${textEndTime})'`;
        const finalTextOverlayFilter = `${currentVideoStream} ${timedTextFilter} [${textOverlayLabel}]`;
        filterComplex.push(finalTextOverlayFilter);
        
        currentVideoStream = `[${textOverlayLabel}]`;
        overlayCount++;
        
        console.log(`[TEXT RENDERING] Successfully added text overlay: ${mediaItem.id}`);
        
      });
    });
    
    console.log(`[FFMPEG] Text processing complete. Text items found: ${textItemsFound}`);
  event.sender.send('render-progress', { progress: 34, message: `Text processing complete. Found ${textItemsFound} text items` });

  // Mix all audio segments
  let finalAudioStream = '';
  if (audioSegments.length > 0) {
    if (audioSegments.length === 1) {
      finalAudioStream = audioSegments[0];
    } else {
      filterComplex.push(`${audioSegments.join('')} amix=inputs=${audioSegments.length}:duration=longest [audio_final]`);
      finalAudioStream = '[audio_final]';
    }
  }

  // Build FFMPEG arguments
  console.log(`[FFMPEG] Building FFmpeg arguments...`);
  console.log(`[FFMPEG] Filter complex count: ${filterComplex.length}`);
  console.log(`[FFMPEG] Filter complex preview:`, filterComplex.slice(0, 3).map(filter => filter.substring(0, 100) + '...'));
  
  // Create a temporary filter complex script file to avoid long command line issues
  filterScriptPath = join(tmpdir(), `filters_${Date.now()}.txt`);
  const filterComplexString = filterComplex.join(';\n');
  
  try {
    await fs.writeFile(filterScriptPath, filterComplexString, 'utf8');
    console.log(`[FFMPEG] Filter complex script written to: ${filterScriptPath}`);
    console.log(`[FFMPEG] Filter script size: ${filterComplexString.length} characters`);
  } catch (error) {
    console.error('[FFMPEG] Failed to write filter script file:', error);
    event.sender.send('render-progress', { error: 'Failed to create filter script file. Please try again.' });
    return;
  }
  
  const ffmpegArgs: string[] = [
    ...inputs,
    '-filter_complex_script', filterScriptPath,
    '-map', currentVideoStream,
  ];

  // Add audio mapping if we have audio
  if (finalAudioStream) {
    ffmpegArgs.push('-map', finalAudioStream);
    ffmpegArgs.push('-c:a', 'aac', '-strict', 'experimental');
  } else {
    // No audio - create silent audio track
    ffmpegArgs.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=48000`);
    ffmpegArgs.push('-c:a', 'aac', '-shortest');
  }

  // Video codec and output settings
  ffmpegArgs.push(
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-t', totalDuration.toString(),
    '-y', outputPath
  );

  // Validate FFmpeg command before execution
  
  console.log(`[FFMPEG] Timeline-based command: ffmpeg ${ffmpegArgs.join(' ')}`);
  console.log(`[FFMPEG] Video: ${width}x${height}, Duration: ${totalDuration}s, Audio segments: ${audioSegments.length}`);
  console.log(`[FFMPEG] Filter complex length: ${filterComplexString.length} characters`);
  console.log(`[FFMPEG] Filter complex preview: ${filterComplexString.substring(0, 500)}...`);
  event.sender.send('render-progress', { progress: 40, message: `Filter complex created with ${filterComplexString.length} characters` });
  
  // Debug: Check if filter complex is empty or invalid
  if (filterComplex.length === 0) {
    console.error('[FFMPEG] ERROR: Filter complex is empty! No media processing filters were created.');
    event.sender.send('render-progress', { error: 'No media processing filters were created. Check if media items and layers are properly configured.' });
    return;
  }
  
  // Debug: Log the actual filter complex content
  console.log('[FFMPEG] Filter complex content:', JSON.stringify(filterComplex, null, 2));
  event.sender.send('render-progress', { progress: 35, message: `Filter complex created with ${filterComplex.length} filters` });
  
  if (filterComplexString.length > 10000) {
    console.warn(`[FFMPEG] WARNING: Filter complex is very long (${filterComplexString.length} chars). This might cause FFmpeg issues.`);
  }
  
  // Debug: Log command structure
  console.log(`[FFMPEG DEBUG] Command structure:`);
  console.log(`[FFMPEG DEBUG] - Inputs: ${inputs.length} input files`);
  console.log(`[FFMPEG DEBUG] - Filter complex: ${filterComplex.length} filters`);
  console.log(`[FFMPEG DEBUG] - Audio segments: ${audioSegments.length} audio streams`);
  console.log(`[FFMPEG DEBUG] - Output: ${outputPath}`);
  console.log(`[FFMPEG DEBUG] - Video dimensions: ${width}x${height}`);
  console.log(`[FFMPEG DEBUG] - Duration: ${totalDuration}s`);
  
  // Debug: Log each input file
  console.log('[FFMPEG] Input files:');
  inputs.forEach((input, index) => {
    if (index % 2 === 1) { // Skip the '-i' flags, only log the file paths
      console.log(`[FFMPEG DEBUG] - Input ${Math.floor(index/2)}: ${input}`);
    }
  });
  event.sender.send('render-progress', { progress: 38, message: `Found ${Math.floor(inputs.length/2)} input files` });
  
  // Validate inputs
  if (inputs.length === 0) {
    console.error('[FFMPEG] No input files specified');
    event.sender.send('render-progress', { error: 'No input files found for rendering. Please add some media to your timeline.' });
    return;
  }
  
  // Validate filter complex
  if (filterComplexString.length === 0) {
    console.error('[FFMPEG] No filter complex specified');
    event.sender.send('render-progress', { error: 'No video filters specified. Please add some content to your timeline.' });
    return;
  }
  
  // Check for common filter complex issues
  if (filterComplexString.includes('undefined') || filterComplexString.includes('null')) {
    console.error('[FFMPEG] Filter complex contains undefined/null values');
    event.sender.send('render-progress', { error: 'Invalid filter parameters detected. Please check your timeline items.' });
    return;
  }

  // Check if FFmpeg is available
  if (!ffmpegPath) {
    console.error('[FFMPEG] FFmpeg not available - cannot render video');
    event.sender.send('render-progress', { error: 'FFmpeg not available. Please restart the application.' });
    return;
  }
  
  // Create a simple fallback command for basic rendering
  const createSimpleFallbackCommand = () => {
    console.log('[FFMPEG] Creating simple fallback command...');
    event.sender.send('render-progress', { progress: 45, message: 'Creating simple fallback command (black video)' });
    
    // Simple command: just create a black video with the specified duration
    const simpleArgs = [
      '-f', 'lavfi',
      '-i', `color=black:size=${width}x${height}:duration=${totalDuration}:rate=30`,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-y', outputPath
    ];
    
    return simpleArgs;
  };

  // --- Execute FFMPEG ---
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

  // Send initial progress to show rendering has started
  event.sender.send('render-progress', { progress: 0 });

  let detectedDuration = 0;
  let lastProgress = 0;

  let ffmpegErrorOutput = '';
  
  ffmpegProcess.stderr.on('data', (data: any) => {
    const output = data.toString();
    console.log(`[FFMPEG STDErr]: ${output}`);
    
    // Collect error output for debugging
    ffmpegErrorOutput += output;
    
    // Parse progress and send to renderer
    // Look for duration in format: "Duration: 00:00:30.00, start: 0.000000, bitrate: 0 kb/s"
    const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (durationMatch && detectedDuration === 0) {
      detectedDuration = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3]) + parseInt(durationMatch[4]) / 100;
      console.log(`[FFMPEG] Total duration detected: ${detectedDuration}s`);
    }
    
    // Look for time in format: "frame=  120 fps= 24 q=28.0 size=    1024kB time=00:00:05.00 bitrate=1677.7kbits/s"
    const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (timeMatch && detectedDuration > 0) {
      const currentTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 100;
      const progress = Math.min((currentTime / detectedDuration) * 100, 100);
      
      // Only send progress if it has increased (to avoid spam)
      if (progress > lastProgress) {
        lastProgress = progress;
        console.log(`[FFMPEG] Progress: ${progress.toFixed(2)}% (${currentTime}s / ${detectedDuration}s)`);
        event.sender.send('render-progress', { progress });
      }
    }
  });

  ffmpegProcess.on('close', async (code: number) => {
    // Clean up temporary filter script file
    await cleanupFilterScript();
    
    if (code === 0) {
      console.log(`[FFMPEG] Render completed successfully. Output: ${outputPath}`);
      event.sender.send('render-progress', { filePath: outputPath });
    } else {
      console.error(`[FFMPEG] Complex render failed with error code ${code}`);
      console.error(`[FFMPEG] Complex render error output: ${ffmpegErrorOutput}`);
      event.sender.send('render-progress', { progress: 45, message: `Complex render failed with code ${code}. Trying fallback...` });
      
      // Try fallback simple render if complex render failed
      if (code !== 0 && !ffmpegErrorOutput.includes('fallback_attempted')) {
        console.log('[FFMPEG] Complex render failed, trying simple fallback...');
        console.log('[FFMPEG] Complex render error details:', ffmpegErrorOutput);
        event.sender.send('render-progress', { progress: 50, message: 'Complex render failed, trying simple fallback (black video)' });
        
        const simpleArgs = createSimpleFallbackCommand();
        const fallbackProcess = spawn(ffmpegPath, simpleArgs);
        
        fallbackProcess.stderr.on('data', (data: any) => {
          console.log(`[FFMPEG FALLBACK]: ${data.toString()}`);
        });
        
        fallbackProcess.on('close', async (fallbackCode: number) => {
          // Clean up temporary filter script file if fallback is used
          await cleanupFilterScript();
          
          if (fallbackCode === 0) {
            console.log(`[FFMPEG] Fallback render completed successfully. Output: ${outputPath}`);
            event.sender.send('render-progress', { filePath: outputPath });
          } else {
            console.error(`[FFMPEG] Fallback render also failed with code ${fallbackCode}`);
            const errorMessage = `FFMPEG complex render failed with code ${code}\n\nComplex command: ffmpeg ${ffmpegArgs.join(' ')}\n\nComplex error details:\n${ffmpegErrorOutput}\n\nFallback render also failed with code ${fallbackCode}`;
            event.sender.send('render-progress', { error: errorMessage });
          }
        });
      } else {
        // Create a detailed error message
        const errorMessage = `FFMPEG exited with code ${code}\n\nCommand: ffmpeg ${ffmpegArgs.join(' ')}\n\nError details:\n${ffmpegErrorOutput}`;
        event.sender.send('render-progress', { error: errorMessage });
      }
    }
  });
  } catch (error) {
    console.error('[FFMPEG] Error in start-render handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    event.sender.send('render-progress', { error: `Render process failed: ${errorMessage}` });
  }
});

// Handle loading the rendered video for preview
ipcMain.handle('load-rendered-video', async (event, filePath) => {
  try {
    console.log(`[Load] Loading rendered video for preview: ${event}`);
    
    // Check if file exists first
    try {
      await fs.access(filePath);
    } catch {
      console.error(`❌ Rendered video file not found: ${filePath}`);
      return {
        success: false,
        error: `File not found: ${filePath}`
      };
    }
    
    const buffer = await fs.readFile(filePath);
    console.log(`✅ Loaded rendered video: ${filePath} (${buffer.length} bytes)`);
    
    return {
      success: true,
      data: buffer
    };
  } catch (error) {
    console.error(`❌ Failed to load rendered video ${filePath}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// Handle saving the rendered video
ipcMain.handle('save-rendered-video', async (event, filePath) => {
  console.log(`[Save] Received request to save file: ${filePath}, ${event}`);
  const { canceled, filePath: savedPath } = await dialog.showSaveDialog({
    title: 'Save Video',
    defaultPath: `story_${Date.now()}.mp4`,
    filters: [{ name: 'Videos', extensions: ['mp4'] }]
  });

  if (!canceled && savedPath) {
    try {
      copyFileSync(filePath, savedPath);
      console.log(`[Save] Successfully saved to: ${savedPath}`);
      return true;
    } catch (error) {
      console.error('[Save] Failed to save video:', error);
      return false;
    }
  }
  return false;
});

