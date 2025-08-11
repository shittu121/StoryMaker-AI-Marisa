const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { verifyToken, requireSubscription } = require('../middleware/auth');
const OpenAI = require('openai');

const router = express.Router();

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Validation rules
const createStoryValidation = [
    body('title').isLength({ min: 1, max: 255 }).withMessage('Title is required and must be less than 255 characters'),
    body('content').isLength({ min: 1 }).withMessage('Story content is required'),
    body('duration').optional().isInt({ min: 30, max: 10800 }).withMessage('Duration must be between 30 seconds and 3 hours')
];

const generateStoryValidation = [
    body('title').isLength({ min: 1, max: 255 }).withMessage('Title is required and must be less than 255 characters'),
    body('mainPrompt').isLength({ min: 1 }).withMessage('Main prompt is required'),
    body('genre').optional().isString(),
    body('duration').optional().isInt({ min: 30, max: 10800 }),
    body('language').optional().isString(),
    body('additionalContext').optional().isArray(),
    body('videoToneEmotions').optional().isArray(),
];

// List Murf.ai Voices for the authenticated account (must be BEFORE parameterized routes)
router.get('/voices', verifyToken, async (req, res) => {
    try {
        if (!process.env.MURF_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'Murf.ai API key not configured'
            });
        }

        const voicesResponse = await fetch('https://api.murf.ai/v1/speech/voices', {
            method: 'GET',
            headers: {
                'api-key': process.env.MURF_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!voicesResponse.ok) {
            const errorText = await voicesResponse.text();
            console.error('Murf.ai Voices API error:', errorText);
            return res.status(voicesResponse.status).json({
                success: false,
                error: 'Failed to fetch voices'
            });
        }

        const responseData = await voicesResponse.json();

        // Support multiple possible response shapes
        const rawList = Array.isArray(responseData?.voices)
            ? responseData.voices
            : Array.isArray(responseData?.data?.voices)
            ? responseData.data.voices
            : Array.isArray(responseData)
            ? responseData
            : [];

        const voices = rawList.map(v => ({
            voice_id: v.voiceId || v.id || '',
            name: v.displayName || v.name || v.voiceId || 'Unknown',
            description: [v.locale, v.gender, v.style, v.accent]
                .filter(Boolean)
                .join(' • ')
        })).filter(v => v.voice_id);

        return res.json({ success: true, data: { voices } });
    } catch (error) {
        console.error('Voices endpoint error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Get all stories for user
router.get('/', verifyToken, async (req, res) => {
    try {
        const [stories] = await pool.execute(
            'SELECT id, title, genre, duration, status, created_at, updated_at FROM stories WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );

        res.json({
            success: true,
            data: {
                stories: stories.map(story => ({
                    id: story.id,
                    title: story.title,
                    genre: story.genre,
                    duration: story.duration,
                    status: story.status,
                    createdAt: story.created_at,
                    updatedAt: story.updated_at
                }))
            }
        });
    } catch (error) {
        console.error('Get stories error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get stories'
        });
    }
});

// Get single story
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [stories] = await pool.execute(
            'SELECT id, title, content, summary, genre, duration, status, created_at, updated_at FROM stories WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );

        if (stories.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }

        const story = stories[0];

        res.json({
            success: true,
            data: {
                story: {
                    id: story.id,
                    title: story.title,
                    content: story.content,
                    summary: story.summary,
                    genre: story.genre,
                    duration: story.duration,
                    status: story.status,
                    createdAt: story.created_at,
                    updatedAt: story.updated_at
                }
            }
        });
    } catch (error) {
        console.error('Get story error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get story'
        });
    }
});

// Create new story
router.post('/', verifyToken, createStoryValidation, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: errors.array()[0].msg
            });
        }

        const { title, content, genre, duration } = req.body;

        // Create story
        const [result] = await pool.execute(
            'INSERT INTO stories (user_id, title, content, summary, genre, duration, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, title, content, '', genre || 'fantasy', duration || 180, 'draft']
        );

        const storyId = result.insertId;

        // Get created story
        const [stories] = await pool.execute(
            'SELECT id, title, content, summary, genre, duration, status, created_at, updated_at FROM stories WHERE id = ?',
            [storyId]
        );

        const story = stories[0];

        res.status(201).json({
            success: true,
            data: {
                story: {
                    id: story.id,
                    title: story.title,
                    content: story.content,
                    summary: story.summary,
                    genre: story.genre,
                    duration: story.duration,
                    status: story.status,
                    createdAt: story.created_at,
                    updatedAt: story.updated_at
                }
            }
        });
    } catch (error) {
        console.error('Create story error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create story'
        });
    }
});

// Update story
router.put('/:id', verifyToken, createStoryValidation, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: errors.array()[0].msg
            });
        }

        const { id } = req.params;
        const { title, content, summary, genre, duration, status } = req.body;

        // Check if story exists and belongs to user
        const [existingStories] = await pool.execute(
            'SELECT id FROM stories WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );

        if (existingStories.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }

        // Build update query
        const updates = {};
        const values = [];

        if (title !== undefined) {
            updates.title = title;
            values.push(title);
        }

        if (content !== undefined) {
            updates.content = content;
            values.push(content);
        }

        if (summary !== undefined) {
            updates.summary = summary;
            values.push(summary);
        }

        if (genre !== undefined) {
            updates.genre = genre;
            values.push(genre);
        }

        if (duration !== undefined) {
            updates.duration = duration;
            values.push(duration);
        }

        if (status !== undefined) {
            updates.status = status;
            values.push(status);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }

        // Update story
        const updateFields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
        values.push(id);

        await pool.execute(
            `UPDATE stories SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values
        );

        // Get updated story
        const [stories] = await pool.execute(
            'SELECT id, title, content, summary, genre, duration, status, created_at, updated_at FROM stories WHERE id = ?',
            [id]
        );

        const story = stories[0];

        res.json({
            success: true,
            data: {
                story: {
                    id: story.id,
                    title: story.title,
                    content: story.content,
                    summary: story.summary,
                    genre: story.genre,
                    duration: story.duration,
                    status: story.status,
                    createdAt: story.created_at,
                    updatedAt: story.updated_at
                }
            }
        });
    } catch (error) {
        console.error('Update story error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update story'
        });
    }
});

// Delete story
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if story exists and belongs to user
        const [existingStories] = await pool.execute(
            'SELECT id FROM stories WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );

        if (existingStories.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }

        // Delete story
        await pool.execute(
            'DELETE FROM stories WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Story deleted successfully'
        });
    } catch (error) {
        console.error('Delete story error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete story'
        });
    }
});

// Generate story structure and metadata (first stage)
router.post('/generate-structure', verifyToken, generateStoryValidation, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: errors.array()[0].msg
            });
        }

        const {
            title,
            mainPrompt,
            genre = 'Fantasy',
            duration ,
            language = 'English',
            additionalContext = [],
            videoToneEmotions = []
        } = req.body;

        // Set headers for streaming
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Send initial response
        res.write(JSON.stringify({
            type: 'start',
            message: 'Generating story structure and metadata...'
        }) + '\n');

        const chapters = Math.round(duration / 60/5);
        console.log( "chapters", chapters);
        
        // Build additional context text
        const additionalContextText = Array.isArray(additionalContext) && additionalContext.length > 0 
            ? additionalContext.map((context, index) => `${index + 1}. ${context}`).join('\n')
            : '';
        
        // Build emotions text
        const emotionsText = Array.isArray(videoToneEmotions) && videoToneEmotions.length > 0 
            ? videoToneEmotions.join(', ')
            : '';

        const fullPrompt = `You are a world-class storyteller known for crafting emotionally gripping, realistic, first-person stories that feel like the perfect sleep story one can listen to and meditate or fall asleep.  
You speak calmly and your listener hangs on to your every single word, your words, phrases, and sentences are carefully picked to arouse and soothe the listener.  

This is NOT a comedy skit. It should feel like something that actually happened.  
Avoid scene instructions or speaker highlights. Just produce a clean voiceover script, meant to be narrated by an AI voice.  

The Genre of My Story is:  
${genre}  

Topic:  
${mainPrompt}  

Additional Context:  
${additionalContextText}  

Emotional Goals:  
The story should make the audience feel: ${emotionsText}  

Strict Instructions (Do Not Break):  
- Speak from a first-person perspective  
- Do not include any camera directions or scene formatting — just plain spoken narration  

I want a ${duration} second long video story, written as a voiceover script for YouTube Videos. The tone should be engaging enough that it can draw the listener in and put them to sleep.

At the end, provide the following outputs clearly marked for easy parsing:

### STORY_SUMMARY_START  
(Provide a detailed story summary for AI continuation)  
### STORY_SUMMARY_END  

### CHAPTER_SUMMARIES_START  
Provide each chapter summary in the following format:  
- Chapter 1: (Summary)  
- Chapter 2: (Summary)  
- Chapter 3: (Summary)
- ...  
(there are total ${chapters} chapters)
Each chapter should be max ~750 words and will take about 5 mins
if the entire story length is less than 5 min need only 1 chapter with given length)  
### CHAPTER_SUMMARIES_END  

### YOUTUBE_TITLE_START  
(Suggested YouTube title)  
### YOUTUBE_TITLE_END  

### YOUTUBE_DESCRIPTION_START  
(Short YouTube caption/description that encourages clicking and conveys the tone/genre)  
### YOUTUBE_DESCRIPTION_END  

### YOUTUBE_TAGS_START  
(List of comma-separated YouTube tags)  
### YOUTUBE_TAGS_END  

### STOCK_FOOTAGE_TERMS_START  
(Comma-separated visual search terms for matching scenes, emotions, visuals, etc.)  
### STOCK_FOOTAGE_TERMS_END  

Language: ${language} make sure all words are in ${language} including summary, youtube title, youtube description, youtube tags, stock footage terms only except for markings and chapter indicators
Length: ~${duration} seconds`;


        // Generate story structure with streaming
        const stream = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are a world-class storyteller known for crafting emotionally gripping, realistic, first-person stories that feel like the perfect sleep story one can listen to and meditate or fall asleep. You speak calmly and your listener hangs on to your every single word, your words, phrases, and sentences are carefully picked to arouse and soothe the listener.'
                },
                {
                    role: 'user',
                    content: fullPrompt
                }
            ],
            stream: true,
            max_tokens: 2000,
            temperature: 0.8
        });

        let fullContent = '';
        let chunkCount = 0;

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullContent += content;
                chunkCount++;

                // Send chunk to client
                res.write(JSON.stringify({
                    type: 'chunk',
                    content: content,
                    chunkNumber: chunkCount
                }) + '\n');
            }
        }

        // Parse the generated content to extract metadata
        const storySummary = extractBetweenMarkers(fullContent, 'STORY_SUMMARY_START', 'STORY_SUMMARY_END');
        const chapterSummaries = extractBetweenMarkers(fullContent, 'CHAPTER_SUMMARIES_START', 'CHAPTER_SUMMARIES_END');
        const youtubeTitle = extractBetweenMarkers(fullContent, 'YOUTUBE_TITLE_START', 'YOUTUBE_TITLE_END');
        const youtubeDescription = extractBetweenMarkers(fullContent, 'YOUTUBE_DESCRIPTION_START', 'YOUTUBE_DESCRIPTION_END');
        const youtubeTags = extractBetweenMarkers(fullContent, 'YOUTUBE_TAGS_START', 'YOUTUBE_TAGS_END');
        const stockFootageTerms = extractBetweenMarkers(fullContent, 'STOCK_FOOTAGE_TERMS_START', 'STOCK_FOOTAGE_TERMS_END');

        // Parse chapter summaries into array
        const chapterArray = parseChapterSummaries(chapterSummaries);

        // Send completion message with extracted metadata
        res.write(JSON.stringify({
            type: 'complete',
            message: 'Story structure generation completed successfully',
            totalChunks: chunkCount,
            storySummary: storySummary,
            chapterSummaries: chapterArray,
            youtubeTitle: youtubeTitle,
            youtubeDescription: youtubeDescription,
            youtubeTags: youtubeTags,
            stockFootageTerms: stockFootageTerms
        }) + '\n');

        res.end();
    } catch (error) {
        console.error('Generate story structure error:', error);
        
        // Send error response
        res.write(JSON.stringify({
            type: 'error',
            error: 'Failed to generate story structure'
        }) + '\n');
        
        res.end();
    }
});

// Generate chapter content (second stage)
router.post('/generate-chapter', verifyToken, async (req, res) => {
    try {
        const {
            chapterSummary,
            chapterNumber,
            storySummary,
            topic,
            genre,
            language = 'English',
            duration,
            videoToneEmotions = []
        } = req.body;

        // Validate required fields
        if (!chapterSummary || !storySummary || !topic || !genre) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields for chapter generation'
            });
        }

        // Set headers for streaming
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Send initial response
        res.write(JSON.stringify({
            type: 'start',
            message: `Generating Chapter ${chapterNumber} content...`
        }) + '\n');

        // Build emotions text
        const emotionsText = Array.isArray(videoToneEmotions) && videoToneEmotions.length > 0 
            ? videoToneEmotions.join(', ')
            : '';

        // Calculate word count for this chapter (approximately 750 words per chapter)
        const chapterWordCount = 750;

        const chapterPrompt = `You are a world-class storyteller known for crafting emotionally gripping, realistic, first-person stories that feel like the perfect sleep story one can listen to and meditate or fall asleep.  
You speak calmly and your listener hangs on to your every single word, your words, phrases, and sentences are carefully picked to arouse and soothe the listener.  

This is NOT a comedy skit. It should feel like something that actually happened.  
Avoid scene instructions or speaker highlights. Just produce a clean voiceover script, meant to be narrated by an AI voice.  

The Genre of My Story is:  
${genre}  

Topic:  
${topic}  

Emotional Goals:  
The story should make the audience feel: ${emotionsText}  

Strict Instructions (Do Not Break):  
- Speak from a first-person perspective  
- Do not include any camera directions or scene formatting — just plain spoken narration  
- Generate ONLY the story content for this specific chapter - no metadata, no summary, no YouTube information  

Story Summary:  
${storySummary}  

Chapter ${chapterNumber} Summary:  
${chapterSummary}  

Generate the full content for Chapter ${chapterNumber} based on the above summary. This should be approximately ${chapterWordCount} words of engaging, first-person narration that flows naturally and maintains the emotional tone throughout.

Language: ${language}  make sure all words are in ${language} except markings and chapter indicators
Length: ~${chapterWordCount} words`;


        // Generate chapter content with streaming
        const stream = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are a world-class storyteller known for crafting emotionally gripping, realistic, first-person stories that feel like the perfect sleep story one can listen to and meditate or fall asleep. You speak calmly and your listener hangs on to your every single word, your words, phrases, and sentences are carefully picked to arouse and soothe the listener.'
                },
                {
                    role: 'user',
                    content: chapterPrompt
                }
            ],
            stream: true,
            max_tokens: 2000,
            temperature: 0.8
        });

        let fullContent = '';
        let chunkCount = 0;

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullContent += content;
                chunkCount++;

                // Send chunk to client
                res.write(JSON.stringify({
                    type: 'chunk',
                    content: content,
                    chunkNumber: chunkCount
                }) + '\n');
            }
        }

        // Send completion message with chapter content
        res.write(JSON.stringify({
            type: 'complete',
            message: `Chapter ${chapterNumber} generation completed successfully`,
            totalChunks: chunkCount,
            chapterContent: fullContent.trim(),
            chapterNumber: chapterNumber
        }) + '\n');

        res.end();
    } catch (error) {
        console.error('Generate chapter error:', error);
        
        // Send error response
        res.write(JSON.stringify({
            type: 'error',
            error: 'Failed to generate chapter content'
        }) + '\n');
        
        res.end();
    }
});

// Text-to-Speech endpoint using Murf.ai
router.post('/tts', verifyToken, async (req, res) => {
    try {
        const { voice_id, text } = req.body;

        // Validate required fields
        if (!voice_id || !text) {
            return res.status(400).json({
                success: false,
                error: 'voice_id and text are required'
            });
        }

        // Check if Murf.ai API key is configured
        if (!process.env.MURF_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'Murf.ai API key not configured'
            });
        }

        // Make request to Murf.ai API
        const murfResponse = await fetch('https://api.murf.ai/v1/speech/generate', {
            method: 'POST',
            headers: {
                'api-key': process.env.MURF_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                voiceId: voice_id
            })
        });

        if (!murfResponse.ok) {
            const errorText = await murfResponse.text();
            console.error('Murf.ai API error:', errorText);
            return res.status(murfResponse.status).json({
                success: false,
                error: 'Failed to generate audio'
            });
        }

        const responseData = await murfResponse.json();
        
        // Murf.ai returns audio as a URL or encoded audio
        if (responseData.audioFile) {
            // If audioFile is a URL, fetch the audio data
            const audioResponse = await fetch(responseData.audioFile);
            if (!audioResponse.ok) {
                throw new Error('Failed to fetch audio from Murf.ai URL');
            }
            
            // Set response headers for audio streaming
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
            
            // Stream the audio data
            const arrayBuffer = await audioResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            res.send(buffer);
        } else if (responseData.encodedAudio) {
            // If encodedAudio is provided, decode and send
            const audioBuffer = Buffer.from(responseData.encodedAudio, 'base64');
            
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(audioBuffer);
        } else {
            throw new Error('No audio data received from Murf.ai');
        }

    } catch (error) {
        console.error('TTS endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// List Murf.ai Voices for the authenticated account
router.get('/voices', verifyToken, async (req, res) => {
    try {
        if (!process.env.MURF_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'Murf.ai API key not configured'
            });
        }

        const voicesResponse = await fetch('https://api.murf.ai/v1/speech/voices', {
            method: 'GET',
            headers: {
                'api-key': process.env.MURF_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!voicesResponse.ok) {
            const errorText = await voicesResponse.text();
            console.error('Murf.ai Voices API error:', errorText);
            return res.status(voicesResponse.status).json({
                success: false,
                error: 'Failed to fetch voices'
            });
        }

        const responseData = await voicesResponse.json();

        // Support multiple possible response shapes
        const rawList = Array.isArray(responseData?.voices)
            ? responseData.voices
            : Array.isArray(responseData?.data?.voices)
            ? responseData.data.voices
            : Array.isArray(responseData)
            ? responseData
            : [];

        const voices = rawList.map(v => ({
            voice_id: v.voiceId || v.id || '',
            name: v.displayName || v.name || v.voiceId || 'Unknown',
            description: [v.locale, v.gender, v.style, v.accent]
                .filter(Boolean)
                .join(' • ')
        })).filter(v => v.voice_id);

        return res.json({ success: true, data: { voices } });
    } catch (error) {
        console.error('Voices endpoint error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Helper function to extract content between markers
function extractBetweenMarkers(content, startMarker, endMarker) {
    const startIndex = content.indexOf(`### ${startMarker}`);
    const endIndex = content.indexOf(`### ${endMarker}`);
    
    if (startIndex === -1 || endIndex === -1) {
        return '';
    }
    
    const startPos = startIndex + startMarker.length + 4; // +4 for "### "
    return content.substring(startPos, endIndex).trim();
}

// Helper function to parse chapter summaries into array
function parseChapterSummaries(chapterSummariesText) {
    if (!chapterSummariesText) return [];
    
    const lines = chapterSummariesText.split('\n');
    const chapters = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('- Chapter') || trimmedLine.startsWith('Chapter')) {
            // Extract chapter number and summary
            const match = trimmedLine.match(/Chapter\s+(\d+):\s*(.+)/);
            if (match) {
                chapters.push({
                    number: parseInt(match[1]),
                    summary: match[2].trim()
                });
            }
        }
    }
    
    return chapters;
}

module.exports = router; 