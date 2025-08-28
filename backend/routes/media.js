const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

// Check if global fetch is available (Node.js 18+)
if (typeof global.fetch === 'function') {
  console.log('✅ Using global fetch (Node.js 18+)');
} else {
  console.error('❌ Global fetch not available. Please upgrade to Node.js 18+ or install node-fetch');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not found in environment variables');
}

// Image allocation constants
const IMAGES_PER_PARAGRAPH = 1;
const MAX_IMAGES = 100;
const MAX_PARAGRAPHS_FOR_FULL_GENERATION = 100; // paragraphs

/**
 * Helper function to download image and return buffer (not save to filesystem)
 * Frontend will save to Electron AppData directory like the + button
 */
const downloadImageToBuffer = async (imageUrl, imageId) => {
  try {
    console.log(`💾 DOWNLOADING: Downloading image ${imageId} to buffer...`);
    
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    
    console.log(`✅ DOWNLOADED: Image ${imageId} downloaded, size: ${imageBuffer.byteLength} bytes`);
    
    return {
      buffer: Buffer.from(imageBuffer),
      contentType: contentType,
      size: imageBuffer.byteLength
    };
  } catch (error) {
    console.error(`❌ ERROR: Failed to download image ${imageId} to buffer:`, error);
    throw error;
  }
};

/**
 * Helper function to generate images using OpenAI DALL-E
 */
const generateOpenAIImage = async (prompt, size = '1024x1024') => {
  try {
    console.log(`🎨 Generating image with prompt: "${prompt}"`);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: size,
      quality: "standard",
      style: "natural"
    });

    if (response.data && response.data.length > 0) {
      const imageUrl = response.data[0].url;
      console.log(`✅ Generated image: ${imageUrl}`);
      return imageUrl;
    } else {
      throw new Error('No image generated from OpenAI');
    }
  } catch (error) {
    console.error('Error generating OpenAI image:', error);
    throw error;
  }
};

/**
 * Helper function to analyze video length and calculate optimal image distribution
 */
const calculateImageAllocation = (totalParagraphs) => {
  const totalImages = Math.min(totalParagraphs * IMAGES_PER_PARAGRAPH, MAX_IMAGES);
  const isLongContent = totalParagraphs > MAX_PARAGRAPHS_FOR_FULL_GENERATION;
  
  return {
    totalImages,
    isLongContent,
    imagesPerParagraph: totalImages / totalParagraphs,
    strategy: isLongContent ? 'distributed' : 'sequential'
  };
};

/**
 * Helper function to generate search queries from transcript segments with smart distribution
 * Now generates exactly 1 query per paragraph for sequential strategy
 */
const generateSmartSearchQueries = (segments, allocation) => {
  const queries = [];
  
  console.log(`🔍 DEBUG: generateSmartSearchQueries called with ${segments.length} segments and allocation:`, allocation);
  
  if (allocation.strategy === 'sequential') {
    // For sequential strategy: generate exactly 1 query per paragraph
    // Limit to the total number of images we want to generate
    const maxQueries = Math.min(segments.length, allocation.totalImages);
    
    console.log(`📝 Generating ${maxQueries} queries for ${segments.length} segments (1 per paragraph)`);
    
    for (let i = 0; i < maxQueries; i++) {
      const segment = segments[i];
      console.log(`🔍 DEBUG: Processing segment ${i + 1}:`, {
        id: segment.id,
        text: segment.text,
        start: segment.start,
        end: segment.end
      });
      
      const text = segment.text.toLowerCase();
      const words = text
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => 
          word.length > 3 && 
          !['this', 'that', 'with', 'have', 'they', 'were', 'been', 'their', 'said', 'each', 'which', 'what', 'there', 'when', 'where', 'while', 'will', 'would', 'could', 'should', 'might', 'must'].includes(word)
        );
      
      console.log(`🔍 DEBUG: Filtered words for segment ${i + 1}:`, words);
      
      if (words.length > 0) {
        const query = words.slice(0, 3).join(' ');
        console.log(`🔍 DEBUG: Generated query for segment ${i + 1}: "${query}"`);
        
        queries.push({
          segmentId: segment.id,
          startTime: segment.start,
          endTime: segment.end,
          query: query,
          originalText: segment.text,
          priority: 'high',
          paragraphNumber: i + 1 // Add paragraph number for proper mapping
        });
      } else {
        console.warn(`⚠️ WARNING: No valid words found for segment ${i + 1}, using fallback query`);
        // FALLBACK: Use a simple query if no words pass the filter
        const fallbackQuery = segment.text.substring(0, 50).replace(/[^\w\s]/g, ' ').trim();
        if (fallbackQuery.length > 0) {
          queries.push({
            segmentId: segment.id,
            startTime: segment.start,
            endTime: segment.end,
            query: fallbackQuery,
            originalText: segment.text,
            priority: 'high',
            paragraphNumber: i + 1
          });
          console.log(`🔍 DEBUG: Added fallback query: "${fallbackQuery}"`);
        }
      }
    }
    
    console.log(`✅ Generated ${queries.length} queries for sequential image generation:`, queries.map(q => ({ id: q.segmentId, query: q.query })));
  } else {
    // For longer videos: use OpenAI to analyze and distribute images strategically
    // This will be handled in the main endpoint
    console.log(`🔍 DEBUG: Using strategic allocation, returning empty queries array`);
    return [];
  }
  
  return queries;
};

/**
 * Helper function to create enhanced prompts for DALL-E
 * Now includes content filtering to avoid OpenAI policy violations
 */
const createEnhancedPrompt = (query, originalText) => {
  // Sanitize the query to be more family-friendly
  const sanitizedQuery = sanitizeForOpenAI(query);
  
  const basePrompt = `Create a beautiful, cinematic image that represents: ${sanitizedQuery}. `;
  
  if (originalText && originalText.length > 10) {
    // Sanitize the context text as well
    const sanitizedContext = sanitizeForOpenAI(originalText.substring(0, 100));
    return `${basePrompt}Context: ${sanitizedContext}. Style: High quality, professional, cinematic, suitable for storytelling.`;
  }
  
  return `${basePrompt}Style: High quality, professional, cinematic, suitable for storytelling.`;
};

/**
 * Helper function to sanitize text for OpenAI to avoid content policy violations
 */
const sanitizeForOpenAI = (text) => {
  if (!text) return "peaceful scene";
  
  // Convert to lowercase for easier filtering
  let sanitized = text.toLowerCase();
  
  // Remove or replace potentially problematic words/phrases
  const problematicPatterns = [
    // Violence-related
    { pattern: /\b(kill|killing|murder|death|dead|die|dying|blood|gun|weapon|fight|fighting|war|battle)\b/g, replacement: "peaceful" },
    // Adult content
    { pattern: /\b(sex|sexual|nude|naked|adult|explicit)\b/g, replacement: "appropriate" },
    // Drugs/alcohol
    { pattern: /\b(drug|alcohol|drunk|high|intoxicated)\b/g, replacement: "healthy" },
    // Hate speech indicators
    { pattern: /\b(hate|racist|discrimination|offensive)\b/g, replacement: "inclusive" },
    // Political extremism
    { pattern: /\b(extremist|radical|terror|bomb|explosion)\b/g, replacement: "peaceful" }
  ];
  
  // Apply all sanitization patterns
  problematicPatterns.forEach(({ pattern, replacement }) => {
    sanitized = sanitized.replace(pattern, replacement);
  });
  
  // If text becomes too short after sanitization, add generic content
  if (sanitized.length < 10) {
    sanitized = "peaceful and beautiful scene";
  }
  
  console.log(`🔒 SANITIZED: Original: "${text.substring(0, 50)}..." -> Sanitized: "${sanitized}"`);
  
  return sanitized;
};

/**
 * Helper function to use OpenAI to analyze long content and create strategic image plan
 */
const createStrategicImagePlan = async (segments, totalParagraphs) => {
  try {
    console.log(`🧠 Analyzing ${segments.length} segments for ${totalParagraphs} paragraph content`);
    
    // Create a summary of the content for OpenAI analysis
    const contentSummary = segments.map(segment => 
      `${segment.start}s - ${segment.end}s: ${segment.text.substring(0, 100)}`
    ).join('\n');
    
    const analysisPrompt = `Analyze this content and create a strategic plan for exactly ${totalParagraphs} images that will best represent the story:

Total Paragraphs: ${totalParagraphs}
Total Segments: ${segments.length}

Content Segments:
${contentSummary}

Requirements:
1. Generate exactly ${totalParagraphs} image prompts
2. Each prompt should represent one paragraph or key moment
3. Distribute images evenly across the content
4. Focus on visual storytelling and scene transitions
5. Return a JSON array with: startTime, endTime, prompt, description, priority, paragraphNumber

Format: Return only valid JSON array. Each item should have paragraphNumber from 1 to ${totalParagraphs}.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a video production expert. Analyze content and create strategic image plans for visual storytelling. Return only valid JSON."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    const responseText = completion.choices[0].message.content;
    const imagePlan = JSON.parse(responseText);
    
    console.log(`✅ Generated strategic plan for ${imagePlan.length} images across ${totalParagraphs} paragraphs`);
    return imagePlan;
    
  } catch (error) {
    console.error('Error creating strategic image plan:', error);
    throw error;
  }
};

/**
 * Helper function to generate story-based image segments with even distribution
 */
const generateStoryBasedSegments = (videoDuration, totalImages) => {
  const segments = [];
  const imageInterval = videoDuration / totalImages;
  
  console.log(`🎬 STORY-BASED: Generating ${totalImages} segments for ${videoDuration}s video (${(videoDuration/60).toFixed(2)} minutes)`);
  console.log(`⏰ TIMING: Each image will appear every ${imageInterval.toFixed(2)} seconds`);
  
  for (let i = 0; i < totalImages; i++) {
    const startTime = i * imageInterval;
    const endTime = startTime + imageInterval;
    const imageNumber = i + 1;
    
    segments.push({
      id: imageNumber,
      start: startTime,
      end: endTime,
      text: `Story-based image ${imageNumber} for video segment ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`,
      paragraphNumber: imageNumber,
      isStoryBased: true,
      imageNumber: imageNumber,
      startTime: startTime,
      endTime: endTime
    });
  }
  
  console.log(`✅ STORY-BASED: Created ${segments.length} segments with even timing distribution`);
  return segments;
};

/**
 * Helper function to generate story-based prompts using OpenAI
 */
const generateStoryBasedPrompts = async (totalImages, storyId) => {
  try {
    console.log(`🧠 STORY-BASED: Generating ${totalImages} story-based prompts using OpenAI`);
    
    const analysisPrompt = `Create a strategic plan for exactly ${totalImages} images that will represent a compelling story:

Total Images: ${totalImages}
Story ID: ${storyId}

Requirements:
1. Generate exactly ${totalImages} image prompts
2. Each prompt should represent a key moment or scene in the story
3. Distribute images evenly across the story timeline
4. Focus on visual storytelling and scene transitions
5. Make prompts cinematic and engaging
6. Return a JSON array with: startTime, endTime, prompt, description, priority, paragraphNumber

Format: Return only valid JSON array. Each item should have paragraphNumber from 1 to ${totalImages}.
Example structure:
[
  {
    "startTime": 0,
    "endTime": 12,
    "prompt": "A cinematic opening scene showing...",
    "description": "Opening scene",
    "priority": "high",
    "paragraphNumber": 1
  }
]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a video production expert. Create strategic image plans for visual storytelling. Return only valid JSON."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    const responseText = completion.choices[0].message.content;
    const imagePlan = JSON.parse(responseText);
    
    console.log(`✅ STORY-BASED: Generated ${imagePlan.length} story-based prompts using OpenAI`);
    return imagePlan;
    
  } catch (error) {
    console.error('❌ Error generating story-based prompts:', error);
    throw error;
  }
};

/**
 * POST /api/media/fetch-stock-media
 * Generate images using OpenAI DALL-E with smart allocation based on paragraph count
 */
router.post('/fetch-stock-media', async (req, res) => {
  try {
    const { segments, storyId, totalParagraphs } = req.body;

    console.log(`🔍 DEBUG: Received request with:`, {
      segmentsCount: segments?.length || 0,
      storyId: storyId,
      totalParagraphs: totalParagraphs,
      segmentsSample: segments?.slice(0, 2) || []
    });

    if (!segments || !Array.isArray(segments)) {
      return res.status(400).json({
        success: false,
        error: 'Transcript segments are required'
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    // Check if this is story-based generation
    const isStoryBased = segments[0]?.isStoryBased || false;
    
    if (isStoryBased) {
      console.log(`🎬 STORY-BASED GENERATION: Detected story-based image generation request`);
      
      // Frontend now sends complete image plan - backend just downloads images
      console.log(`🎬 STORY-BASED: Frontend sent ${segments.length} image plans with prompts`);
      
      // Generate images directly from the frontend's image plan
      const stockMediaItems = [];
      for (let i = 0; i < segments.length; i++) {
        try {
          const segment = segments[i];
          const prompt = segment.prompt || `Create a beautiful, cinematic image representing a compelling story moment. Scene ${i + 1}. Style: High quality, professional, cinematic, suitable for storytelling.`;
          
          console.log(`🎨 STORY-BASED: Generating image ${i + 1}/${segments.length}: "${prompt.substring(0, 100)}..."`);

          const imageUrl = await generateOpenAIImage(prompt, '1024x1024');
          
          if (imageUrl) {
            const fileName = `openai_story_${i + 1}_${Date.now()}.jpg`;
            
            // Download the image to buffer (frontend will save to Electron AppData)
            const imageData = await downloadImageToBuffer(imageUrl, `story_${i + 1}`);
            
            const mediaItem = {
              id: `openai_story_${i + 1}_${Date.now()}`,
              type: 'image',
              name: `Story-Based: ${segment.description || segment.text.substring(0, 50)}`,
              description: segment.description || segment.text,
              url: imageUrl, // Keep original URL for reference
              imageBuffer: imageData.buffer.toString('base64'), // Send base64 data to frontend
              fileName: fileName,
              contentType: imageData.contentType,
              size: imageData.size,
              duration: 5,
              width: 1024,
              height: 1024,
              startTime: segment.startTime || segment.start,
              endTime: segment.endTime || segment.end,
              prompt: prompt,
              source: 'openai-dalle',
              allocation: 'story-based',
              priority: segment.priority || 'high',
              paragraphNumber: segment.paragraphNumber || i + 1
            };
            
            stockMediaItems.push(mediaItem);
            console.log(`✅ STORY-BASED: Generated image ${i + 1}/${segments.length} successfully`);
          } else {
            console.warn(`⚠️ STORY-BASED: Failed to generate image ${i + 1}/${segments.length}`);
          }
        } catch (error) {
          console.error(`❌ STORY-BASED: Error generating image ${i + 1}/${segments.length}:`, error);
        }
      }
      
      console.log(`🎬 STORY-BASED: Completed generation of ${stockMediaItems.length}/${segments.length} images`);
      
      // Debug: Log what we're sending back
      console.log(`🔍 DEBUG: Sending back ${stockMediaItems.length} stock media items:`);
      stockMediaItems.forEach((item, index) => {
        console.log(`  Item ${index + 1}:`, {
          id: item.id,
          name: item.name,
          url: item.url?.substring(0, 100) + '...',
          fileName: item.fileName,
          hasUrl: !!item.url,
          hasImageBuffer: !!item.imageBuffer,
          hasFileName: !!item.fileName,
          urlLength: item.url?.length || 0,
          bufferSize: item.imageBuffer?.length || 0
        });
      });
      
      return res.json({
        success: true,
        data: {
          stockMedia: stockMediaItems,
          totalItems: stockMediaItems.length,
          segments: segments.length,
          paragraphCount: segments.length,
          allocation: {
            totalImages: segments.length,
            isLongContent: segments.length > 10,
            imagesPerParagraph: 1,
            strategy: 'story-based-even-distribution'
          },
          strategy: 'story-based-frontend-plan',
          debug: {
            originalSegments: segments.length,
            searchQueriesGenerated: segments.length,
            imagesGenerated: stockMediaItems.length,
            fallbackUsed: false,
            contentFilteringIssues: false
          }
        }
      });
    }

    // TRANSCRIPT-BASED GENERATION (existing logic)
    console.log(`📝 TRANSCRIPT-BASED GENERATION: Using existing transcript-based logic`);
    
    // Calculate total paragraphs if not provided
    const paragraphCount = totalParagraphs || segments.length;
    
    // Ensure we don't generate more images than paragraphs
    const actualParagraphCount = Math.min(paragraphCount, segments.length);
    
    console.log(`🎬 Starting AI image generation for ${actualParagraphCount} paragraphs with ${segments.length} transcript segments`);
    console.log(`📊 Will generate exactly ${actualParagraphCount} images (1 per paragraph)`);

    // Calculate optimal image allocation based on paragraph count
    const allocation = calculateImageAllocation(actualParagraphCount);
    console.log(`📊 Image allocation: ${allocation.totalImages} images, strategy: ${allocation.strategy}`);

    let stockMediaItems = [];

    if (allocation.strategy === 'sequential') {
      // For shorter content: generate images sequentially for each paragraph
      const searchQueries = generateSmartSearchQueries(segments, allocation);
      console.log(`🔍 Generated ${searchQueries.length} search queries for sequential generation`);
      console.log(`🔍 DEBUG: Search queries details:`, searchQueries);

      // Ensure we don't generate more images than needed
      const imagesToGenerate = Math.min(searchQueries.length, allocation.totalImages);
      console.log(`🎯 Generating exactly ${imagesToGenerate} images (1 per paragraph)`);

      if (imagesToGenerate === 0) {
        console.error(`❌ CRITICAL ERROR: No search queries generated, cannot create images!`);
        console.error(`❌ DEBUG: segments:`, segments);
        console.error(`❌ DEBUG: allocation:`, allocation);
        console.error(`❌ DEBUG: searchQueries:`, searchQueries);
      }

      // Generate images for each query (1 per paragraph)
      for (let i = 0; i < imagesToGenerate; i++) {
        const queryData = searchQueries[i];
        try {
          console.log(`🎨 Generating image for paragraph: "${queryData.query}" (segment ${queryData.segmentId})`);

          const enhancedPrompt = createEnhancedPrompt(queryData.query, queryData.originalText);
          let imageUrl = null;
          
          try {
            imageUrl = await generateOpenAIImage(enhancedPrompt, '1024x1024');
          } catch (openaiError) {
            console.warn(`⚠️ OpenAI failed for prompt "${enhancedPrompt}":`, openaiError.message);
            
            // Try with a fallback prompt if the original fails
            if (openaiError.code === 'content_policy_violation') {
              console.log(`🔄 Trying fallback prompt for segment ${queryData.segmentId}...`);
              const fallbackPrompt = `Create a beautiful, cinematic image representing a peaceful and inspiring scene. Style: High quality, professional, cinematic, suitable for storytelling.`;
              
              try {
                imageUrl = await generateOpenAIImage(fallbackPrompt, '1024x1024');
                console.log(`✅ Fallback prompt succeeded for segment ${queryData.segmentId}`);
              } catch (fallbackError) {
                console.error(`❌ Fallback prompt also failed for segment ${queryData.segmentId}:`, fallbackError.message);
              }
            }
          }
          
          if (imageUrl) {
            const fileName = `openai_image_${queryData.segmentId}_${Date.now()}.jpg`;
            
            // Download the image to buffer (frontend will save to Electron AppData)
            const imageData = await downloadImageToBuffer(imageUrl, `image_${queryData.segmentId}`);
            
            const mediaItem = {
              id: `openai_image_${queryData.segmentId}_${Date.now()}`,
              type: 'image',
              name: `AI Generated: ${queryData.query}`,
              description: queryData.originalText,
              url: imageUrl, // Keep original URL for reference
              imageBuffer: imageData.buffer.toString('base64'), // Send base64 data to frontend
              fileName: fileName,
              contentType: imageData.contentType,
              size: imageData.size,
              duration: 5,
              width: 1024,
              height: 1024,
              segmentId: queryData.segmentId,
              startTime: queryData.startTime,
              endTime: queryData.endTime,
              searchQuery: queryData.query,
              prompt: enhancedPrompt,
              source: 'openai-dalle',
              allocation: 'sequential',
              paragraphNumber: queryData.paragraphNumber || (i + 1) // Use paragraph number from query or fallback to index
            };
            
            stockMediaItems.push(mediaItem);
            console.log(`✅ Added AI-generated image for paragraph ${queryData.segmentId}: ${mediaItem.name}`);
          }

          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ Error generating image for paragraph "${queryData.query}":`, error);
        }
      }

    } else {
      // For longer content: use strategic planning
      try {
        console.log(`🧠 Using strategic planning for long content (${paragraphCount} paragraphs)`);
        
        const imagePlan = await createStrategicImagePlan(segments, paragraphCount);
        
        // Generate images based on the strategic plan
        for (let i = 0; i < Math.min(imagePlan.length, allocation.totalImages); i++) {
          try {
            const planItem = imagePlan[i];
            console.log(`🎨 Generating strategic image ${i + 1}/${allocation.totalImages}: "${planItem.prompt}"`);

            const imageUrl = await generateOpenAIImage(planItem.prompt, '1024x1024');
            
            if (imageUrl) {
              const fileName = `openai_strategic_${i + 1}_${Date.now()}.jpg`;
              
              // Download the image to buffer (frontend will save to Electron AppData)
              const imageData = await downloadImageToBuffer(imageUrl, `strategic_${i + 1}`);
              
              const mediaItem = {
                id: `openai_strategic_${i + 1}_${Date.now()}`,
                type: 'image',
                name: `Strategic: ${planItem.description || planItem.prompt.substring(0, 50)}`,
                description: planItem.description || planItem.prompt,
                url: imageUrl, // Keep original URL for reference
                imageBuffer: imageData.buffer.toString('base64'), // Send base64 data to frontend
                fileName: fileName,
                contentType: imageData.contentType,
                size: imageData.size,
                duration: 5,
                width: 1024,
                height: 1024,
                startTime: planItem.startTime || 0,
                endTime: planItem.endTime || 5,
                prompt: planItem.prompt,
                source: 'openai-dalle',
                allocation: 'strategic',
                priority: planItem.priority || 'medium',
                strategicIndex: i + 1,
                paragraphNumber: planItem.paragraphNumber || i + 1
              };
              
              stockMediaItems.push(mediaItem);
              console.log(`✅ Added strategic image ${i + 1}: ${mediaItem.name}`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (error) {
            console.error(`❌ Error generating strategic image ${i + 1}:`, error);
          }
        }

      } catch (error) {
        console.error('❌ Error in strategic planning:', error);
        
        // Fallback to basic generation if strategic planning fails
        console.log('🔄 Falling back to basic image generation');
        const fallbackQueries = generateSmartSearchQueries(segments.slice(0, allocation.totalImages), allocation);
        
        for (const queryData of fallbackQueries) {
          try {
            const enhancedPrompt = createEnhancedPrompt(queryData.query, queryData.originalText);
            const imageUrl = await generateOpenAIImage(enhancedPrompt, '1024x1024');
            
            if (imageUrl) {
              const fileName = `openai_fallback_${queryData.segmentId}_${Date.now()}.jpg`;
              
              // Download the image to buffer (frontend will save to Electron AppData)
              const imageData = await downloadImageToBuffer(imageUrl, `fallback_${queryData.segmentId}`);
              
              const mediaItem = {
                id: `openai_fallback_${queryData.segmentId}_${Date.now()}`,
                type: 'image',
                name: `Fallback: ${queryData.query}`,
                description: queryData.originalText,
                url: imageUrl, // Keep original URL for reference
                imageBuffer: imageData.buffer.toString('base64'), // Send base64 data to frontend
                fileName: fileName,
                contentType: imageData.contentType,
                size: imageData.size,
                duration: 5,
                width: 1024,
                height: 1024,
                segmentId: queryData.segmentId,
                startTime: queryData.startTime,
                endTime: queryData.endTime,
                searchQuery: queryData.query,
                prompt: enhancedPrompt,
                source: 'openai-dalle',
                allocation: 'fallback',
                paragraphNumber: queryData.segmentId
              };
              
              stockMediaItems.push(mediaItem);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (error) {
            console.error(`❌ Error in fallback generation:`, error);
          }
        }
      }
    }

    // Final validation: ensure we never generated more images than paragraphs
    if (stockMediaItems.length > actualParagraphCount) {
      console.warn(`⚠️ Generated ${stockMediaItems.length} images but only needed ${actualParagraphCount}. Trimming excess images.`);
      stockMediaItems = stockMediaItems.slice(0, actualParagraphCount);
    }

    // FINAL FALLBACK: If no images were generated due to content filtering, create at least one generic image
    if (stockMediaItems.length === 0) {
      console.warn(`⚠️ No images generated due to content filtering. Creating fallback generic image...`);
      
      try {
        const fallbackPrompt = `Create a beautiful, cinematic image representing a peaceful and inspiring storytelling scene. Style: High quality, professional, cinematic, suitable for all audiences.`;
        const fallbackImageUrl = await generateOpenAIImage(fallbackPrompt, '1024x1024');
        
        if (fallbackImageUrl) {
          const fileName = `openai_fallback_generic_${Date.now()}.jpg`;
          
          // Download the image to buffer (frontend will save to Electron AppData)
          const imageData = await downloadImageToBuffer(fallbackImageUrl, 'fallback_generic');
          
          const fallbackMediaItem = {
            id: `openai_fallback_generic_${Date.now()}`,
            type: 'image',
            name: 'AI Generated: Peaceful Storytelling Scene',
            description: 'Generic fallback image for content that was filtered by OpenAI',
            url: fallbackImageUrl, // Keep original URL for reference
            imageBuffer: imageData.buffer.toString('base64'), // Send base64 data to frontend
            fileName: fileName,
            contentType: imageData.contentType,
            size: imageData.size,
            duration: 5,
            width: 1024,
            height: 1024,
            segmentId: 'fallback',
            startTime: 0,
            endTime: 5,
            searchQuery: 'peaceful storytelling',
            prompt: fallbackPrompt,
            source: 'openai-dalle',
            allocation: 'fallback',
            paragraphNumber: 1
          };
          
          stockMediaItems.push(fallbackMediaItem);
          console.log(`✅ Created fallback generic image: ${fallbackMediaItem.name}`);
        }
      } catch (fallbackError) {
        console.error(`❌ Even fallback image generation failed:`, fallbackError.message);
      }
    }

    console.log(`✅ AI image generation completed: ${stockMediaItems.length} images created for ${actualParagraphCount} paragraphs`);

    res.json({
      success: true,
      data: {
        stockMedia: stockMediaItems,
        totalItems: stockMediaItems.length,
        segments: segments.length,
        paragraphCount: actualParagraphCount,
        allocation: allocation,
        strategy: allocation.strategy,
        // Add debugging information
        debug: {
          originalSegments: segments.length,
          searchQueriesGenerated: allocation.strategy === 'sequential' ? Math.min(segments.length, allocation.totalImages) : 0,
          imagesGenerated: stockMediaItems.length,
          fallbackUsed: stockMediaItems.some(item => item.allocation === 'fallback'),
          contentFilteringIssues: stockMediaItems.length < actualParagraphCount
        }
      }
    });

  } catch (error) {
    console.error('❌ AI image generation failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate AI images'
    });
  }
});

/**
 * GET /api/media/test-proxy
 * Test endpoint to verify the proxy functionality
 */
router.get('/test-proxy', (req, res) => {
  res.json({
    success: true,
    message: 'Media proxy service is working',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    fetchAvailable: typeof fetch !== 'undefined'
  });
});

/**
 * GET /api/media/openai-image/:storyId/:filename
 * Serve saved OpenAI images from filesystem
 */
router.get('/openai-image/:storyId/:filename', async (req, res) => {
  try {
    const { storyId, filename } = req.params;
    
    console.log(`🔄 SERVING: Serving OpenAI image ${filename} for story ${storyId}`);
    
    const imagePath = path.join(__dirname, '..', 'uploads', storyId, 'openai-images', filename);
    
    // Check if file exists
    try {
      await fs.access(imagePath);
    } catch (error) {
      console.error(`❌ ERROR: Image file not found: ${imagePath}`);
      return res.status(404).json({
        success: false,
        error: 'Image file not found'
      });
    }
    
    // Get file stats
    const stats = await fs.stat(imagePath);
    
    // Set appropriate headers
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    });
    
    // Stream the file
    const fileStream = require('fs').createReadStream(imagePath);
    fileStream.pipe(res);
    
    console.log(`✅ SERVED: OpenAI image ${filename} for story ${storyId}, size: ${stats.size} bytes`);
    
  } catch (error) {
    console.error('❌ Error serving OpenAI image:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to serve OpenAI image'
    });
  }
});

/**
 * POST /api/media/download-openai-image
 * Download OpenAI image via backend proxy to avoid CORS issues
 */
router.post('/download-openai-image', async (req, res) => {
  try {
    const { imageUrl, storyId, imageId } = req.body;

    console.log(`🔍 DEBUG: Received download request:`, { imageUrl: imageUrl?.substring(0, 100), storyId, imageId });

    if (!imageUrl || !storyId || !imageId) {
      console.error(`❌ Missing required fields:`, { imageUrl: !!imageUrl, storyId: !!storyId, imageId: !!imageId });
      return res.status(400).json({
        success: false,
        error: 'Image URL, story ID, and image ID are required'
      });
    }

    console.log(`🔄 DOWNLOADING: Backend downloading OpenAI image ${imageId} from: ${imageUrl.substring(0, 100)}...`);

    // Verify fetch is available
    if (typeof fetch !== 'function') {
      console.error(`❌ Fetch function not available. Type: ${typeof fetch}`);
      return res.status(500).json({
        success: false,
        error: 'Fetch function not available on backend'
      });
    }

    // Download the image using backend (no CORS restrictions)
    console.log(`🔄 Making fetch request to: ${imageUrl.substring(0, 100)}...`);
    const response = await fetch(imageUrl);
    
    console.log(`🔄 Fetch response received:`, { 
      status: response.status, 
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to download image ${imageId}: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        success: false,
        error: `Failed to download image: ${response.status} ${response.statusText}`
      });
    }

    // Get the image data
    console.log(`🔄 Converting response to array buffer...`);
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    
    console.log(`✅ DOWNLOADED: Backend successfully downloaded image ${imageId}, size: ${imageBuffer.byteLength} bytes`);

    // Set appropriate headers for image download
    res.set({
      'Content-Type': contentType,
      'Content-Length': imageBuffer.byteLength,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    });

    // Send the image data
    console.log(`🔄 Sending image data to frontend...`);
    res.send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('❌ Error downloading OpenAI image:', error);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download OpenAI image',
      stack: error.stack
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
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    imageAllocation: {
      imagesPerParagraph: IMAGES_PER_PARAGRAPH,
      maxImages: MAX_IMAGES,
      maxParagraphs: MAX_PARAGRAPHS_FOR_FULL_GENERATION
    },
    generationStrategies: {
      transcript: '1 image per transcript paragraph',
      story: '5 images per minute based on video duration',
      strategic: 'AI-optimized distribution for long content'
    }
  });
});

module.exports = router; 