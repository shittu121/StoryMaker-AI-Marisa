const express = require('express');
const router = express.Router();

// Initialize Pexels client
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

if (!PEXELS_API_KEY) {
  console.warn('⚠️ PEXELS_API_KEY not found in environment variables');
}

/**
 * Helper function to download media file from URL and return file data
 */
const downloadMediaFile = async (url, fileName) => {
  try {
    // Download file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }
    
    // Get file buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`✅ Downloaded media file: ${fileName} (${buffer.length} bytes)`);
    
    // Return file data for frontend to save using Electron IPC
    return {
      fileName,
      fileBuffer: Array.from(new Uint8Array(buffer)), // Convert to array for JSON transfer
      fileType: fileName.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'
    };
  } catch (error) {
    console.error(`❌ Error downloading file ${fileName}:`, error);
    throw error;
  }
};

/**
 * Helper function to download thumbnail image and return file data
 */
const downloadThumbnailFile = async (url, fileName) => {
  try {
    // Download thumbnail
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download thumbnail: ${response.status}`);
    }
    
    // Get file buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`✅ Downloaded thumbnail: ${fileName} (${buffer.length} bytes)`);
    
    // Return thumbnail data
    return {
      fileName,
      fileBuffer: Array.from(new Uint8Array(buffer)),
      fileType: 'image/jpeg'
    };
  } catch (error) {
    console.error(`❌ Error downloading thumbnail ${fileName}:`, error);
    throw error;
  }
};

/**
 * Helper function to search Pexels videos
 */
const searchPexelsVideos = async (query, perPage = 5) => {
  try {
    const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`, {
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();
    return data.videos || [];
  } catch (error) {
    console.error('Error searching Pexels videos:', error);
    throw error;
  }
};

/**
 * Helper function to search Pexels photos
 */
const searchPexelsPhotos = async (query, perPage = 5) => {
  try {
    const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`, {
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();
    return data.photos || [];
  } catch (error) {
    console.error('Error searching Pexels photos:', error);
    throw error;
  }
};

/**
 * Helper function to generate search queries from transcript segments
 */
const generateSearchQueries = (segments) => {
  const queries = [];
  
  for (const segment of segments) {
    // Extract key words from segment text
    const text = segment.text.toLowerCase();
    
    // Remove common words and extract meaningful terms
    const words = text
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['this', 'that', 'with', 'have', 'they', 'were', 'been', 'their', 'said', 'each', 'which', 'what', 'there', 'when', 'where', 'while', 'will', 'would', 'could', 'should', 'might', 'must'].includes(word)
      );
    
    // Create queries from the most meaningful words
    if (words.length > 0) {
      // Take up to 3 most meaningful words for search
      const query = words.slice(0, 3).join(' ');
      queries.push({
        segmentId: segment.id,
        startTime: segment.start,
        endTime: segment.end,
        query: query,
        originalText: segment.text
      });
    }
  }
  
  return queries;
};

/**
 * POST /api/media/fetch-stock-media
 * Fetch related videos and images from Pexels based on transcript segments
 */
router.post('/fetch-stock-media', async (req, res) => {
  try {
    const { segments, storyId } = req.body;

    if (!segments || !Array.isArray(segments)) {
      return res.status(400).json({
        success: false,
        error: 'Transcript segments are required'
      });
    }

    if (!PEXELS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Pexels API key not configured'
      });
    }

    console.log(`🎬 Starting stock media fetching for ${segments.length} transcript segments`);

    // Generate search queries from transcript segments
    const searchQueries = generateSearchQueries(segments);
    console.log(`🔍 Generated ${searchQueries.length} search queries from transcript`);

    const stockMediaItems = [];

         // Fetch media for each query (one item per segment)
     for (const queryData of searchQueries) {
       try {
         console.log(`🔍 Searching for: "${queryData.query}" (segment ${queryData.segmentId})`);
 
         // Randomly decide whether to fetch video or image for this segment
         const fetchVideo = Math.random() < 0.5;
         console.log(`🎲 Random choice for segment ${queryData.segmentId}: ${fetchVideo ? 'video' : 'image'}`);
 
         let mediaItem = null;
 
         if (fetchVideo) {
           // Search for videos only
           const videos = await searchPexelsVideos(queryData.query, 3);
           
           if (videos.length > 0) {
             const video = videos[0]; // Take the first video
             // Find the best quality video file (prefer HD)
             const videoFile = video.video_files.find(file => 
               file.quality === 'hd' || file.quality === 'sd'
             ) || video.video_files[0];
 
             if (videoFile) {
               // Generate file name
               const fileName = `pexels_video_${video.id}_${queryData.segmentId}.mp4`;
               const thumbnailFileName = `pexels_video_${video.id}_${queryData.segmentId}_thumb.jpg`;
               
               // Download the video file data and thumbnail
               const fileData = await downloadMediaFile(videoFile.link, fileName);
               const thumbnailData = await downloadThumbnailFile(video.image, thumbnailFileName);
               mediaItem = {
                 id: `pexels_video_${video.id}_${queryData.segmentId}`,
                 type: 'video',
                 name: `Video: ${queryData.query}`,
                 description: queryData.originalText,
                 url: videoFile.link, // Keep original URL for reference
                 fileData: fileData, // Downloaded file data for frontend to save
                 thumbnailUrl: video.image, // Keep original for reference
                 thumbnailData: thumbnailData, // Downloaded thumbnail data
                 duration: video.duration || 10, // Default to 10 seconds if no duration
                 width: videoFile.width,
                 height: videoFile.height,
                 segmentId: queryData.segmentId,
                 startTime: queryData.startTime,
                 endTime: queryData.endTime,
                 searchQuery: queryData.query,
                 pexelsId: video.id,
                 photographer: video.user.name,
                 source: 'pexels'
               };
             }
           }
         } else {
           // Search for photos only
           const photos = await searchPexelsPhotos(queryData.query, 3);
           
           if (photos.length > 0) {
             const photo = photos[0]; // Take the first photo
             // Use the large size for better quality
             const imageUrl = photo.src.large || photo.src.medium || photo.src.original;
             
             // Generate file name with proper extension
             const extension = imageUrl.includes('.jpg') ? '.jpg' : '.jpeg';
             const fileName = `pexels_photo_${photo.id}_${queryData.segmentId}${extension}`;
             const thumbnailFileName = `pexels_photo_${photo.id}_${queryData.segmentId}_thumb.jpg`;
             
             // Download the image file data and thumbnail
             const fileData = await downloadMediaFile(imageUrl, fileName);
             const thumbnailData = await downloadThumbnailFile(photo.src.medium, thumbnailFileName);
             
             mediaItem = {
               id: `pexels_photo_${photo.id}_${queryData.segmentId}`,
               type: 'image',
               name: `Image: ${queryData.query}`,
               description: photo.alt || queryData.originalText,
               url: imageUrl, // Keep original URL for reference
               fileData: fileData, // Downloaded file data for frontend to save
               thumbnailUrl: photo.src.medium, // Keep original for reference
               thumbnailData: thumbnailData, // Downloaded thumbnail data
               duration: 5, // Default duration for images
               width: photo.width,
               height: photo.height,
               segmentId: queryData.segmentId,
               startTime: queryData.startTime,
               endTime: queryData.endTime,
               searchQuery: queryData.query,
               pexelsId: photo.id,
               photographer: photo.photographer,
               source: 'pexels'
             };
           }
         }
 
         // Add the single media item if found
         if (mediaItem) {
           stockMediaItems.push(mediaItem);
           console.log(`✅ Added ${mediaItem.type} for segment ${queryData.segmentId}: ${mediaItem.name}`);
         } else {
           console.log(`⚠️ No ${fetchVideo ? 'video' : 'image'} found for query: "${queryData.query}"`);
         }
 
         // Add a small delay to respect rate limits
         await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        console.error(`❌ Error fetching media for query "${queryData.query}":`, error);
        // Continue with other queries even if one fails
      }
    }

    console.log(`✅ Stock media fetching completed: ${stockMediaItems.length} items found`);

    res.json({
      success: true,
      data: {
        stockMedia: stockMediaItems,
        totalItems: stockMediaItems.length,
        segments: searchQueries.length
      }
    });

  } catch (error) {
    console.error('❌ Stock media fetching failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch stock media'
    });
  }
});

/**
 * GET /api/media/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Media service is running',
    pexelsConfigured: !!PEXELS_API_KEY
  });
});

module.exports = router; 