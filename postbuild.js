const fs = require('fs');
const path = require('path');

console.log('📦 Running postbuild script...');

try {
    // Check if ffmpeg-static is available
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic) {
        console.log('✅ FFmpeg static binary found:', ffmpegStatic);
    } else {
        console.log('⚠️  FFmpeg static binary not found');
    }
    
    console.log('✅ Postbuild completed successfully');
    console.log('   FFmpeg will be extracted at runtime for production builds');
} catch (error) {
    console.log('⚠️  Postbuild script failed:', error.message);
} 