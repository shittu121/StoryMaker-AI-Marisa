const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const router = express.Router();

// Configure multer storage with proper extensions
const storage = multer.diskStorage({
  destination: 'uploads/temp/',
  filename: (req, file, cb) => {
    // Generate filename with proper extension based on MIME type
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    let extension = '.mp3'; // default
    
    // Map MIME types to extensions
    const mimeToExt = {
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'audio/wave': '.wav',
      'audio/x-wav': '.wav',
      'audio/flac': '.flac',
      'audio/m4a': '.m4a',
      'audio/mp4': '.m4a',
      'audio/ogg': '.ogg',
      'audio/webm': '.webm',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/mpeg': '.mpeg'
    };
    
    if (mimeToExt[file.mimetype]) {
      extension = mimeToExt[file.mimetype];
    }
    
    const filename = `audio_${timestamp}_${random}${extension}`;
    console.log(`📄 Generated filename: ${filename} for MIME type: ${file.mimetype}`);
    cb(null, filename);
  }
});

// Configure multer for file uploads with proper extensions
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log(`📤 Received file: ${file.originalname}, MIME: ${file.mimetype}`);
    // Accept audio and video files
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio and video files are allowed'), false);
    }
  }
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadsDir}`);
} else {
  console.log(`📁 Using existing uploads directory: ${uploadsDir}`);
}

// Helper function to safely delete files
const safeDeleteFile = (filePath, description = 'file') => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🧹 Cleaned up ${description}: ${filePath}`);
      return true;
    } catch (cleanupError) {
      console.warn(`⚠️ Failed to cleanup ${description}: ${cleanupError.message}`);
      return false;
    }
  }
  return false;
};

// Helper function to cleanup multiple filesf
const cleanupFiles = (filePaths) => {
  let cleanedCount = 0;
  filePaths.forEach(({ path, description }) => {
    if (safeDeleteFile(path, description)) {
      cleanedCount++;
    }
  });
  console.log(`🧹 Cleanup completed: ${cleanedCount}/${filePaths.length} files removed`);
};

// Periodic cleanup function to remove old temporary files (older than 1 hour)
const cleanupOldTempFiles = () => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour in milliseconds
    let removedCount = 0;

    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.mtime.getTime() < oneHourAgo) {
          fs.unlinkSync(filePath);
          removedCount++;
          console.log(`🧹 Removed old temp file: ${file}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to process temp file ${file}: ${error.message}`);
      }
    });

    if (removedCount > 0) {
      console.log(`🧹 Periodic cleanup: removed ${removedCount} old temp files`);
    }
  } catch (error) {
    console.warn(`⚠️ Periodic cleanup failed: ${error.message}`);
  }
};

// Run periodic cleanup every 30 minutes
setInterval(cleanupOldTempFiles, 30 * 60 * 1000);

// Run initial cleanup when server starts
console.log(`🧹 Running initial cleanup of temp directory...`);
cleanupOldTempFiles();

// Cleanup all temp files on server shutdown
const cleanupAllTempFiles = () => {
  try {
    const files = fs.readdirSync(uploadsDir);
    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log(`🧹 Shutdown cleanup: removed ${file}`);
      } catch (error) {
        console.warn(`⚠️ Failed to remove temp file ${file}: ${error.message}`);
      }
    });
    console.log(`🧹 Shutdown cleanup completed: removed ${files.length} temp files`);
  } catch (error) {
    console.warn(`⚠️ Shutdown cleanup failed: ${error.message}`);
  }
};

// Register cleanup handlers for graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, cleaning up temp files...');
  cleanupAllTempFiles();
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, cleaning up temp files...');
  cleanupAllTempFiles();
});

process.on('exit', () => {
  console.log('🛑 Process exiting, cleaning up temp files...');
  cleanupAllTempFiles();
});

/**
 * POST /api/transcript/generate
 * Generate transcript from uploaded audio/video file
 */
router.post('/generate', upload.single('audio'), async (req, res) => {
  let filesToCleanup = []; // Track all files that need cleanup
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    const originalTempPath = req.file.path;
    filesToCleanup.push({ path: originalTempPath, description: 'original uploaded file' });
    
    const { storyId } = req.body;

    console.log(`🎙️ Starting transcript generation for: ${req.file.originalname}`);
    console.log(`📁 Temporary file saved: ${originalTempPath}`);
    console.log(`📄 File info - MIME: ${req.file.mimetype}, Size: ${req.file.size} bytes`);
    console.log(`📂 Final filename: ${req.file.filename}`);

    // Validate file exists and has content
    if (!fs.existsSync(originalTempPath)) {
      throw new Error('Uploaded file not found');
    }
    
    const fileStats = fs.statSync(originalTempPath);
    console.log(`📊 File stats - Size: ${fileStats.size} bytes, Modified: ${fileStats.mtime}`);
    
    if (fileStats.size === 0) {
      throw new Error('Uploaded file is empty');
    }

    // Create a properly named file with extension for OpenAI
    const properFileName = req.file.filename;
    const properFilePath = path.join(path.dirname(originalTempPath), properFileName);
    let finalFilePath = originalTempPath; // Track the final file path for OpenAI
    
    // Copy the uploaded file to the proper location with extension if needed
    if (originalTempPath !== properFilePath) {
      fs.copyFileSync(originalTempPath, properFilePath);
      console.log(`📋 Copied file to proper location: ${properFilePath}`);
      
      // Track the copied file for cleanup
      filesToCleanup.push({ path: properFilePath, description: 'copied file with proper extension' });
      finalFilePath = properFilePath;
    }

    // Call OpenAI Whisper API
    console.log(`🚀 Calling OpenAI Whisper with file: ${finalFilePath}`);
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(finalFilePath),
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    console.log(`📝 Whisper API response received`);

    // Format the response with timestamps
    const formattedResponse = {
      text: transcription.text,
      segments: transcription.segments?.map((segment, index) => ({
        id: index,
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
      })) || []
    };

    console.log(`✅ Transcript formatted with ${formattedResponse.segments.length} segments`);

    res.json({
      success: true,
      data: formattedResponse
    });

    console.log(`🎉 Transcript generation completed successfully`);

  } catch (error) {
    console.error('❌ Transcript generation failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate transcript'
    });
  } finally {
    // Clean up all temporary files
    if (filesToCleanup.length > 0) {
      console.log(`🧹 Starting cleanup of ${filesToCleanup.length} temporary files...`);
      cleanupFiles(filesToCleanup);
    } else {
      console.log(`🧹 No temporary files to clean up`);
    }
  }
});

/**
 * POST /api/transcript/generate-from-voiceover
 * Generate transcript from existing voiceover file path
 */
router.post('/generate-from-voiceover', async (req, res) => {
  try {
    const { mediaId, fileName, filePath, storyId } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      });
    }

    console.log(`🎙️ Starting transcript generation for voiceover: ${fileName} (${mediaId})`);

    // For this endpoint, we expect the frontend to send the actual file data
    // since the backend doesn't have access to the Electron's user data directory
    return res.status(400).json({
      success: false,
      error: 'This endpoint requires the file to be uploaded. Use /generate endpoint instead.'
    });

  } catch (error) {
    console.error('❌ Voiceover transcript generation failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate transcript from voiceover'
    });
  }
});

/**
 * GET /api/transcript/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Transcript service is running',
    openaiConfigured: !!process.env.OPENAI_API_KEY
  });
});

module.exports = router; 