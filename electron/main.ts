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
import { platform } from 'os';

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
    
    const buffer = await fs.readFile(fullPath);
    console.log(`✅ Loaded media file: ${relativePath} (${buffer.length} bytes)`);
    
    // Return the expected object structure with success flag and data
    return {
      success: true,
      data: buffer
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

// New IPC handler for loading images as base64
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
    
    const buffer = await fs.readFile(fullPath);
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
      size: buffer.length
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
ipcMain.on('start-render', (event, videoAssets) => {
  console.log('[FFMPEG] Received start-render event.');
  const outputFileName = `render_${Date.now()}.mp4`;
  const outputPath = join(tempDir, outputFileName);

  // --- FFMPEG Command Generation with Timeline Support ---
  const inputs: string[] = [];
  const filterComplex: string[] = [];

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
  
  

  // Collect all unique media items used in timeline and create input mapping
  const usedMediaItems: MediaItem[] = [];
  const mediaToInputIndex: Map<string, number> = new Map();

  layers.forEach((layer: Layer) => {
    if (!layer.visible) return;
    
    layer.items.forEach((item: TimelineItem) => {
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

  if (usedMediaItems.length === 0) {
    console.error('[FFMPEG] No valid media items found');
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

  // Sort layers by index to maintain proper layering (bottom to top)
  const sortedLayers = [...layers].filter(layer => layer.visible);
  
  let overlayCount = 0;
  
  sortedLayers.forEach((layer: Layer, layerIndex: number) => {
    
    
    layer.items.forEach((item: TimelineItem, itemIndex: number) => {
      const mediaItem = mediaLibrary.find((m: MediaItem) => m.id === item.mediaId);
      if (!mediaItem) return;
      
      const inputIndex = mediaToInputIndex.get(mediaItem.id);
      if (inputIndex === undefined) return;
       
      // Skip processing for text items that don't have file inputs
      if (mediaItem.type === 'text' && inputIndex === -1) {
        // Text items are handled separately
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
    sortedLayers.forEach((layer: Layer) => {
      if (!layer.visible) return;
      
      layer.items.forEach((item: TimelineItem) => {
        const mediaItem = mediaLibrary.find((m: MediaItem) => m.id === item.mediaId);
        if (!mediaItem || mediaItem.type !== 'text') return;
        
        const inputIndex = mediaToInputIndex.get(mediaItem.id);
        if (inputIndex !== -1) return; // Skip if already processed
        
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
        
        // ALWAYS calculate font size based on text area geometry - ignore preview fontSize
        let fontSize: number;
        let baseFontSize: number;
        
        // Always calculate base font size from area dimensions (ignore mediaItem.fontSize)
        baseFontSize = Math.min(itemWidth, itemHeight) * 0.2; // 20% of smaller dimension for larger text
        fontSize = baseFontSize;
        console.log(`[FONT SIZE] ${mediaItem.id}: ALWAYS CALCULATED fontSize=${fontSize}px (20% of min(${itemWidth}, ${itemHeight}))`);
        console.log(`[FONT SIZE] ${mediaItem.id}: Ignoring any saved fontSize from preview, using area-based calculation`);
        
        // First, escape the text for FFmpeg
        console.log(`[TEXT ESCAPING] ${mediaItem.id}: BEFORE: "${textContent}"`);
        const escapedText = textContent
          .replace(/['",:;]/g, '')   // Remove quotes, apostrophes, commas, colons, semicolons
          .replace(/[\r\n]/g, ' ')   // Replace line breaks with spaces
          .replace(/\s+/g, ' ')      // Normalize multiple spaces
          .trim();                   // Trim whitespace
        console.log(`[TEXT ESCAPING] ${mediaItem.id}: AFTER: "${escapedText}"`);
        
        // Apply same optimal font size calculation as preview
        // This will simulate the canvas measureText and constraint calculations
        
        // First, do preliminary word wrapping to estimate line count
        const maxWidth = itemWidth * 0.99;
        console.log(`[WORD WRAP PRELIMINARY] ${mediaItem.id}: maxWidth=${maxWidth}px (99% of ${itemWidth}px)`);
        const preliminaryWrapped = wrapTextForFFmpeg(escapedText, Math.floor(maxWidth / (fontSize * 0.6)));
        const preliminaryLines = preliminaryWrapped.split('\\n');
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
        
        // Ensure reasonable bounds only if the calculation goes extreme
        if (fontSize < 24) {
          console.log(`[FONT SIZE] ${mediaItem.id}: WARNING: Calculated fontSize too small (${fontSize}px), forcing to 24px`);
          fontSize = 24;
        }
        if (fontSize > 200) {
          fontSize = 200;
          console.log(`[FONT SIZE] ${mediaItem.id}: Applied safety maximum: 200px`);
        }
        
        // Log final font size calculation for debugging
        console.log(`[FONT SIZE] ${mediaItem.id}: FINAL fontSize=${fontSize}px (text length: ${textContent.length}, area: ${textAreaWidth}x${textAreaHeight})`);
        
        // NOW do final word wrapping with the optimized font size
        const finalMaxCharsPerLine = Math.floor(maxWidth / (fontSize * 0.6));
        const wrappedText = wrapTextForFFmpeg(escapedText, finalMaxCharsPerLine);
        const lines = wrappedText.split('\\n');
        console.log(`[WORD WRAP FINAL] ${mediaItem.id}: With optimized fontSize=${fontSize}px`);
        console.log(`[WORD WRAP FINAL] ${mediaItem.id}: finalMaxCharsPerLine=${finalMaxCharsPerLine}`);
        console.log(`[WORD WRAP FINAL] ${mediaItem.id}: wrappedText="${wrappedText}", lines=${lines.length}`);
        
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
        
        if (lines.length === 1) {
          // Single line - EXACT SAME as preview (lines 1352-1353)
          actualLineHeight = itemHeight; // Full height for single line
          startY = itemY + (itemHeight / 2); // Perfect vertical center
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: SINGLE LINE (preview algorithm):`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - actualLineHeight=${actualLineHeight}px (full height)`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - startY=${startY}px (itemY + height/2 = ${itemY} + ${itemHeight/2})`);
        } else {
          // Multi-line - EXACT SAME as preview (lines 1356-1359)
          const totalAvailableHeight = itemHeight;
          actualLineHeight = totalAvailableHeight / lines.length; // Equal distribution
          const topMargin = actualLineHeight / 2; // Equal margin from top
          startY = itemY + topMargin; // Start with equal top margin
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: MULTI-LINE (preview algorithm):`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - totalAvailableHeight=${totalAvailableHeight}px`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - actualLineHeight=${actualLineHeight}px (${totalAvailableHeight}px / ${lines.length} lines)`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - topMargin=${topMargin}px (actualLineHeight / 2)`);
          console.log(`[TEXT POSITIONING] ${mediaItem.id}: - startY=${startY}px (itemY + topMargin = ${itemY} + ${topMargin})`);
        }
        
        // Calculate Y position for first line (FFmpeg baseline adjustment)
        // Preview uses textBaseline: "middle", FFmpeg uses baseline, so adjust
        const baselineOffset = fontSize * 0.4; // Approximate middle-to-baseline offset
        let textY = startY + baselineOffset;
        console.log(`[TEXT POSITIONING] ${mediaItem.id}: FFmpeg baseline adjustment: startY=${startY}px + baselineOffset=${baselineOffset}px = textY=${textY}px`);
        
        // Text alignment and positioning - match preview algorithm
        // For multi-line text, FFmpeg centers each line individually
        // For single line, we need to calculate the offset manually
        let textX: number;
        
        if (lines.length === 1) {
          // Single line - calculate manual centering offset
          const approximateTextWidth = lines[0].length * fontSize * 0.6;
          textX = centerX - (approximateTextWidth / 2);
          console.log(`[TEXT ALIGNMENT] ${mediaItem.id}: SINGLE LINE centering:`);
          console.log(`[TEXT ALIGNMENT] ${mediaItem.id}: - line="${lines[0]}" (length=${lines[0].length})`);
          console.log(`[TEXT ALIGNMENT] ${mediaItem.id}: - approximateTextWidth=${approximateTextWidth}px (${lines[0].length} chars * ${fontSize}px * 0.6)`);
          console.log(`[TEXT ALIGNMENT] ${mediaItem.id}: - textX=${textX}px (centerX=${centerX}px - width/2)`);
        } else {
          // Multi-line - calculate manual centering for the longest line
          const lineLengths = lines.map(line => line.length);
          const maxLineLength = Math.max(...lineLengths);
          const approximateMaxLineWidth = maxLineLength * fontSize * 0.6;
          textX = centerX - (approximateMaxLineWidth / 2);
          console.log(`[TEXT ALIGNMENT] ${mediaItem.id}: MULTI-LINE positioning:`);
          console.log(`[TEXT ALIGNMENT] ${mediaItem.id}: - lines=${lines.map(line => `"${line}"`).join(', ')}`);
          console.log(`[TEXT ALIGNMENT] ${mediaItem.id}: - maxLineLength=${maxLineLength} chars`);
          console.log(`[TEXT ALIGNMENT] ${mediaItem.id}: - approximateMaxLineWidth=${approximateMaxLineWidth}px`);
          console.log(`[TEXT ALIGNMENT] ${mediaItem.id}: - textX=${textX}px (centerX=${centerX}px - maxWidth/2)`);
        }
        
        // Final positioning summary
        console.log(`[TEXT POSITION] ${mediaItem.id}: FINAL POSITION textX=${textX}px, textY=${textY}px`);
        console.log(`[TEXT POSITION] ${mediaItem.id}: AREA BOUNDS: (${itemX}, ${itemY}) to (${itemX + itemWidth}, ${itemY + itemHeight})`);
        console.log(`[TEXT POSITION] ${mediaItem.id}: TEXT PLACEMENT: ${lines.length > 1 ? 'multi-line start' : 'single line center'}, lines=${lines.length}`);
        
        // Text escaping already done above
        
        // ENABLE TEXT RENDERING - Implement the same algorithm as preview
        console.log(`[TEXT RENDERING] Rendering text: ${mediaItem.id}`);
        
        // Build comprehensive text filter matching preview algorithm
        // Use the escaped text instead of original text content
        let textFilter = `drawtext=text='${escapedText}'`;
        
        // Font properties
        textFilter += `:fontsize=${fontSize}`;
        textFilter += `:fontcolor=${fontColor}`;
        
        // Log the exact fontSize being applied
        console.log(`[APPLIED FONT SIZE] ${mediaItem.id}: fontSize=${fontSize}px applied to FFmpeg filter`);
        
        // Font family - use system fonts that FFmpeg can find (cross-platform)
        let fontPath = '';
        if (mediaItem.fontFamily) {
          // Cross-platform font mapping
          const fontMap: { [key: string]: string } = {
            'Arial': platform() === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Arial.ttf',
            'Helvetica': platform() === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Helvetica.ttc',
            'Times New Roman': platform() === 'win32' ? 'C:/Windows/Fonts/times.ttf' : '/System/Library/Fonts/Times.ttc',
            'Georgia': platform() === 'win32' ? 'C:/Windows/Fonts/georgia.ttf' : '/System/Library/Fonts/Georgia.ttf',
            'Verdana': platform() === 'win32' ? 'C:/Windows/Fonts/verdana.ttf' : '/System/Library/Fonts/Verdana.ttf'
          };
          fontPath = fontMap[mediaItem.fontFamily] || (platform() === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Arial.ttf');
        } else {
          fontPath = platform() === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Arial.ttf';
        }
        textFilter += `:fontfile=${fontPath}`;
        
        // Font weight and style
        // Note: FFmpeg doesn't have a direct bold parameter, but we've already calculated optimal fontSize
        // Don't override the carefully calculated fontSize for bold - it's already optimized
        // if (mediaItem.fontBold) {
        //   // Bold handling should be done in font selection, not size override
        // }
        if (mediaItem.fontItalic) {
          textFilter += `:fontstyle=italic`;
        }
        
        // Text positioning - use preview algorithm results
        textFilter += `:x=${textX}:y=${textY}`;
        
        // Multi-line spacing
        if (lines.length > 1) {
          // Calculate line spacing to match preview's actualLineHeight
          const lineSpacing = actualLineHeight / fontSize; // Ratio of line height to font size
          textFilter += `:line_spacing=${lineSpacing}`;
          
          console.log(`[MULTI-LINE] ${mediaItem.id}: Added line_spacing=${lineSpacing} (actualLineHeight=${actualLineHeight}px / fontSize=${fontSize}px)`);
          console.log(`[MULTI-LINE] ${mediaItem.id}: Manual centering applied (text_align not supported)`);
        }
        
        // Word wrapping already handled above in the font calculation
        // Use the wrappedText that was already calculated
        textFilter = textFilter.replace(`text='${escapedText}'`, `text='${wrappedText}'`);
        
        // Don't use FFmpeg's box parameter - it only creates tight text bounds
        // Instead, we'll create a separate background rectangle filter that fills entire area
        console.log(`[TEXT BACKGROUND] ${mediaItem.id}: Not using box parameter - will create separate background rectangle`);
        
        // Text shadow for readability (simulate preview shadow)
        // Note: Some FFmpeg versions don't support shadow parameters, so we'll skip them for now
        // textFilter += `:shadowcolor=black:shadowx=2:shadowy=2`;
        
        // Note: enable parameter is not supported in drawtext filter
        // We'll handle timing through the filter chain instead
        // textFilter += `:enable='between(t,${item.startTime},${item.startTime + item.duration})'`;
        
        // Log the complete text filter for debugging
        console.log(`[TEXT FILTER] ${mediaItem.id}: COMPLETE FILTER: ${textFilter}`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: FILTER BREAKDOWN:`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - text='${wrappedText}'`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - fontsize=${fontSize}`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - fontcolor=${fontColor}`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - x=${textX} (centered)`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - y=${textY} (baseline adjusted)`);
        console.log(`[TEXT FILTER] ${mediaItem.id}: - Background box: ${textFilter.includes('box=1') ? 'YES' : 'NO'}`);
        
        // Add text overlay to the current video stream with proper timeline timing
        const nextStreamLabel = `text_${overlayCount}`;
        
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
          
          // Create a colored rectangle that fills the entire text area (like preview canvas)
          // Use drawbox filter to create a filled rectangle overlay
          const bgRectFilter = `drawbox=x=${itemX}:y=${itemY}:w=${itemWidth}:h=${itemHeight}:color=${bgColor}:t=fill:enable='between(t,${textStartTime},${textEndTime})'`;
          const bgOverlayFilter = `${currentVideoStream} ${bgRectFilter} [${nextStreamLabel}]`;
          
          console.log(`[BACKGROUND RECT] ${mediaItem.id}: Adding background rectangle ${itemWidth}x${itemHeight} at ${itemX},${itemY} with color ${bgColor}`);
          filterComplex.push(bgOverlayFilter);
        
        currentVideoStream = `[${nextStreamLabel}]`;
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
  const ffmpegArgs: string[] = [
    ...inputs,
    '-filter_complex', filterComplex.join(';'),
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

  console.log(`[FFMPEG] Timeline-based command: ffmpeg ${ffmpegArgs.join(' ')}`);
  console.log(`[FFMPEG] Video: ${width}x${height}, Duration: ${totalDuration}s, Audio segments: ${audioSegments.length}`);
  console.log(`[FFMPEG] Filter complex length: ${filterComplex.join(';').length} characters`);
  console.log(`[FFMPEG] Filter complex preview: ${filterComplex.join(';').substring(0, 500)}...`);

  // Check if FFmpeg is available
  if (!ffmpegPath) {
    console.error('[FFMPEG] FFmpeg not available - cannot render video');
    event.sender.send('render-progress', { error: 'FFmpeg not available. Please restart the application.' });
    return;
  }

  // --- Execute FFMPEG ---
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

  // Send initial progress to show rendering has started
  event.sender.send('render-progress', { progress: 0 });

  let detectedDuration = 0;
  let lastProgress = 0;

  ffmpegProcess.stderr.on('data', (data: any) => {
    const output = data.toString();
    console.log(`[FFMPEG STDErr]: ${output}`);
    
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

  ffmpegProcess.on('close', (code: number) => {
    if (code === 0) {
      console.log(`[FFMPEG] Render completed successfully. Output: ${outputPath}`);
      event.sender.send('render-progress', { filePath: outputPath });
    } else {
      console.error(`[FFMPEG] Exited with error code ${code}`);
      event.sender.send('render-progress', { error: `FFMPEG exited with code ${code}` });
    }
  });
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

