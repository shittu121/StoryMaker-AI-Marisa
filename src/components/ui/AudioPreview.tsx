import React, { useState, useRef, useEffect } from "react";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { apiService } from "../../lib/api";
import { audioStorageService } from "../../lib/audioStorage";
import { AudioChunk } from "../../types/audio";
import {
  Play,
  Pause,
  Square,
  ArrowRight,
  Loader2,
  Volume2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

interface AudioPreviewProps {
  storyContent: string;
  selectedVoiceId: string;
  generatedAudioVoiceId?: string;
  onAudioGenerated: (audioChunks: AudioChunk[], totalDuration: number) => void;
  onNext: () => void;
  onAudioControlRef?: (audioControl: {
    handlePlayPause: () => void;
    isPlaying: () => boolean;
  }) => void;
  className?: string;
  autoStart?: boolean;
  storyId?: string; // Required for file storage
  existingAudioChunks?: Array<{
    id: string;
    name: string;
    text: string;
    duration: number;
    startTime: number;
    filePath: string;
  }>;
}

// Voice data for display (supports Murf + legacy IDs)
const VOICE_DATA: Record<string, { name: string; description: string }> = {
  // Murf.ai voices
  "en-US-natalie": { name: "Natalie", description: "Warm and professional female voice" },
  "en-US-amara": { name: "Amara", description: "Friendly female voice, great for storytelling" },
  "en-US-miles": { name: "Miles", description: "Clear male voice, perfect for narration" },
  "en-US-ryan": { name: "Ryan", description: "Versatile male voice for various content types" },

  "21m00Tcm4TlvDq8ikWAM": { name: "Rachel", description: "Calm narrator" },
  AZnzlk1XvdvUeBnXmlld: { name: "Alice", description: "British accent" },
  EXAVITQu4vr4xnSDxMaL: { name: "Lily", description: "Young female voice" },
  ErXwobaYiN019PkySvjV: { name: "Henry", description: "Narrative voice" },
  MF3mGyEYCl7XYWbV9V6O: { name: "Elli", description: "Emotional range" },
  kdmDKE6EkgrWrrykO9Qt: {
    name: "Alexandra",
    description: "Super realistic, young female voice that likes to chat",
  },
  L0Dsvb3SLTyegXwtm47J: {
    name: "Archer",
    description: "Grounded and friendly young British male with charm",
  },
  g6xIsTj2HwM6VR4iXFCw: {
    name: "Jessica Anne Bogart",
    description: "Empathetic and expressive, great for wellness coaches",
  },
  OYTbf65OHHFELVut7v2H: {
    name: "Hope",
    description: "Bright and uplifting, perfect for positive interactions",
  },
  dj3G1R1ilKoFKhBnWOzG: {
    name: "Eryn",
    description: "Friendly and relatable, ideal for casual interactions",
  },
  HDA9tsk27wYi3uq0fPcK: {
    name: "Stuart",
    description:
      "Professional & friendly Aussie, ideal for technical assistance",
  },
  "1SM7GgM6IMuvQlz2BwM3": {
    name: "Mark",
    description: "Relaxed and laid back, suitable for nonchalant chats",
  },
  PT4nqlKZfc06VW1BuClj: {
    name: "Angela",
    description: "Raw and relatable, great listener and down to earth",
  },
  vBKc2FfBKJfcZNyEt1n6: {
    name: "Finn",
    description: "Tenor pitched, excellent for podcasts and light chats",
  },
  "56AoDkrOh6qfVPDXZ7Pt": {
    name: "Cassidy",
    description: "Engaging and energetic, good for entertainment contexts",
  },
  NOpBlnGInO9m6vDvFkFC: {
    name: "Grandpa Spuds Oxley",
    description: "Distinctive character voice for unique agents",
  },
};

// Build voice info from Murf dynamically when available
type VoiceInfo = { name: string; description?: string };

const AudioPreview: React.FC<AudioPreviewProps> = ({
  storyContent,
  selectedVoiceId,
  generatedAudioVoiceId,
  onAudioGenerated,
  onNext,
  onAudioControlRef,
  className = "",
  autoStart = false,
  storyId,
  existingAudioChunks,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [allGenerated, setAllGenerated] = useState(false);

  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(
    null
  );
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(
    null
  );

  // Debug state transitions
  useEffect(() => {
    console.log("=== STATE CHANGE ===", {
      allGenerated,
      isGenerating,
      audioChunksLength: audioChunks.length,
      chunksWithValidBlobs: audioChunks.filter(
        (c) => c.blobUrl && c.blobUrl.startsWith("blob:")
      ).length,
      generatedChunks: audioChunks.filter((c) => c.isGenerated).length,
    });
  }, [allGenerated, isGenerating, audioChunks]);



  // Monitor completion of audio generation
  useEffect(() => {
    if (!isGenerating && allGenerated && audioChunks.length > 0) {
      const validChunks = audioChunks.filter(
        (c) => c.blobUrl && c.blobUrl.startsWith("blob:")
      );
      console.log(
        "=== GENERATION COMPLETED - UI SHOULD SWITCH TO PLAYBACK ===",
        {
          allGenerated,
          isGenerating,
          totalChunks: audioChunks.length,
          validChunks: validChunks.length,
          shouldShowPlayback: !isGenerating && allGenerated,
        }
      );
    }
  }, [isGenerating, allGenerated, audioChunks]);

  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
  const timelineRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  // Split story into reasonable paragraphs
  const splitStoryIntoParagraphs = (content: string): string[] => {
    // Split by double line breaks first
    let paragraphs = content
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0);

    // If paragraphs are too long (>2500 chars), split by sentences
    const finalParagraphs: string[] = [];

    paragraphs.forEach((paragraph) => {
      if (paragraph.length <= 2500) {
        finalParagraphs.push(paragraph.trim());
      } else {
        // Split by sentences and group them
        const sentences = paragraph
          .split(/[.!?]+/)
          .filter((s) => s.trim().length > 0);
        let currentChunk = "";

        sentences.forEach((sentence) => {
          const trimmedSentence = sentence.trim();
          if (currentChunk.length + trimmedSentence.length + 1 <= 2500) {
            currentChunk += (currentChunk ? ". " : "") + trimmedSentence;
          } else {
            // Current chunk is full, save it and start a new one
            if (currentChunk) {
              finalParagraphs.push(currentChunk + ".");
            }
            currentChunk = trimmedSentence;
          }
        });

        // Add the final chunk if it has content
        if (currentChunk) {
          finalParagraphs.push(currentChunk + ".");
        }
      }
    });

    return finalParagraphs;
  };

  // Estimate duration based on text length (~150 words per minute)
  const estimateDuration = (text: string): number => {
    const wordCount = text.split(/\s+/).length;
    return Math.max(2, Math.round((wordCount / 150) * 60)); // minimum 2 seconds
  };

  // Initialize audio chunks when component mounts
  useEffect(() => {
    // If we have existing audio chunks, try to load them from disk
    if (existingAudioChunks && existingAudioChunks.length > 0) {
      console.log("Loading existing audio chunks:", existingAudioChunks);

      const loadExistingChunks = async () => {
        const loadedChunks: AudioChunk[] = [];
        let hasValidAudio = true;

        for (const chunk of existingAudioChunks) {
          let blobUrl: string | undefined;
          let relativePath: string | undefined;

          // Try to load from saved file first
          if (
            storyId &&
            chunk.filePath &&
            !chunk.filePath.startsWith("blob:")
          ) {
            try {
              // Treat filePath as relativePath for saved files
              relativePath = chunk.filePath;
              blobUrl = await audioStorageService.loadAudioFile(relativePath);
              console.log(`✅ Loaded audio from disk: ${relativePath}`);
            } catch (error) {
              console.warn(`Failed to load audio from disk: ${error}`);
              hasValidAudio = false;
            }
          } else if (chunk.filePath && chunk.filePath.startsWith("blob:")) {
            // Old blob URL - likely invalid after page refresh
            console.warn(`Chunk ${chunk.id} has blob URL that may be invalid`);
            hasValidAudio = false;
          }

          loadedChunks.push({
            id: chunk.id,
            name: chunk.name,
            text: chunk.text,
            duration: chunk.duration,
            startTime: chunk.startTime,
            filePath: blobUrl || relativePath || "",
            blobUrl,
            relativePath,
            isGenerated: !!blobUrl,
          });
        }

        console.log(
          "Mapped chunks:",
          loadedChunks.map((c) => ({
            id: c.id,
            hasBlobUrl: !!c.blobUrl,
            hasRelativePath: !!c.relativePath,
            isGenerated: c.isGenerated,
          }))
        );

        setAudioChunks(loadedChunks);
        setAllGenerated(hasValidAudio);

        // Create audio elements for chunks with valid audio
        audioRefs.current = new Array(loadedChunks.length).fill(null);
        loadedChunks.forEach((chunk, index) => {
          if (chunk.blobUrl) {
            try {
              const audio = new Audio(chunk.blobUrl);
              audioRefs.current[index] = audio;
              console.log(
                `Created audio element for chunk ${chunk.id} at index ${index}`
              );

              audio.onerror = () => {
                console.error(
                  `Error loading audio chunk ${chunk.id} - marking for regeneration`
                );
                // Mark chunk as needing regeneration
                setAudioChunks((prev) =>
                  prev.map((c) =>
                    c.id === chunk.id
                      ? { ...c, blobUrl: "", isGenerated: false }
                      : c
                  )
                );
                setAllGenerated(false);
              };

              audio.onloadedmetadata = () => {
                console.log(
                  `Loaded audio chunk ${chunk.id}, duration: ${audio.duration}s`
                );
              };
            } catch (error) {
              console.error(
                `Failed to create audio element for chunk ${chunk.id}:`,
                error
              );
            }
          }
        });

        const totalDur = loadedChunks.reduce(
          (sum, chunk) => sum + chunk.duration,
          0
        );
        setTotalDuration(totalDur);
      };

      loadExistingChunks();
      return;
    }

    // Otherwise, create new chunks from story content
    const paragraphs = splitStoryIntoParagraphs(storyContent);
    console.log(`Story split into ${paragraphs.length} paragraphs/chunks:`);
    paragraphs.forEach((p, i) => {
      console.log(`Chunk ${i + 1}: "${p.substring(0, 100)}..." (${p.length} chars)`);
    });
    
    let cumulativeTime = 0;

    const chunks: AudioChunk[] = paragraphs.map((paragraph, index) => {
      const duration = estimateDuration(paragraph);
      const chunk: AudioChunk = {
        id: `chunk-${index + 1}`,
        name: `Paragraph ${index + 1}`,
        text: paragraph,
        duration,
        startTime: cumulativeTime,
        filePath: "",
        isGenerated: false,
      };
      cumulativeTime += duration;
      return chunk;
    });

    console.log(`Created ${chunks.length} audio chunks for processing`);
    setAudioChunks(chunks);
    setTotalDuration(cumulativeTime);
    audioRefs.current = new Array(chunks.length).fill(null);
  }, [storyContent, existingAudioChunks]);

  // Auto-start generation when autoStart is true
  useEffect(() => {
    if (autoStart && audioChunks.length > 0 && !allGenerated && !isGenerating) {
      console.log("Auto-starting audio generation...");
      handleGenerateAudio();
    }
  }, [autoStart, audioChunks, allGenerated, isGenerating]);

  // Pass audio control object to parent (stable reference)
  useEffect(() => {
    if (onAudioControlRef) {
      onAudioControlRef({
        handlePlayPause,
        isPlaying: () => isPlaying, // Function that returns current isPlaying state
      });
    }
  }, [onAudioControlRef]); // Only depend on onAudioControlRef, not isPlaying

  // Recreate blob URL from stored blob if needed
  const recreateBlobUrl = (chunk: AudioChunk): string | null => {
    if (chunk.audioBlob) {
      const newBlobUrl = URL.createObjectURL(chunk.audioBlob);
      console.log(`Recreated blob URL for chunk ${chunk.id}:`, newBlobUrl);

      // Update the chunk with new blob URL
      setAudioChunks((prev) =>
        prev.map((c) => (c.id === chunk.id ? { ...c, blobUrl: newBlobUrl } : c))
      );

      return newBlobUrl;
    }
    console.warn(
      `Cannot recreate blob URL for chunk ${chunk.id} - no stored blob available`
    );
    return null;
  };

  // Generate audio for a single chunk
  const generateSingleAudio = async (chunkIndex: number): Promise<void> => {
    const chunk = audioChunks[chunkIndex];
    if (!chunk || chunk.isGenerated) return;

    try {
      // Generate TTS audio
      const audioBlob = await apiService.generateTTS(
        selectedVoiceId,
        chunk.text
      );

      // Save audio file to disk if storyId is available
      let relativePath: string | undefined;
      let savedBlobUrl = URL.createObjectURL(audioBlob);

      if (storyId) {
        try {
          const fileInfo = await audioStorageService.saveAudioFile(
            storyId,
            chunk.id,
            audioBlob
          );
          relativePath = fileInfo.relativePath;
          console.log(`✅ Audio saved to disk: ${relativePath}`);
        } catch (error) {
          console.warn(
            `Failed to save audio to disk, using blob URL: ${error}`
          );
        }
      }

      // Create audio element for playback
      const audio = new Audio(savedBlobUrl);
      audioRefs.current[chunkIndex] = audio;

      // Wait for audio to load to get actual duration
      await new Promise<void>((resolve) => {
        audio.onloadedmetadata = () => {
          const actualDuration = audio.duration;

          // Update chunk with actual duration, blob URL, file path, and store the blob
          setAudioChunks((prev) => {
            const updated = [...prev];
            updated[chunkIndex] = {
              ...updated[chunkIndex],
              duration: actualDuration,
              blobUrl: savedBlobUrl,
              audioBlob, // Store the actual blob for recreation if needed
              relativePath, // Store the file path
              isGenerated: true,
            };

            // Recalculate start times for subsequent chunks
            let cumulativeTime = 0;
            updated.forEach((chunk) => {
              chunk.startTime = cumulativeTime;
              cumulativeTime += chunk.duration;
            });

            return updated;
          });

          // Update total duration with actual cumulative time
          let newTotal = 0;
          setAudioChunks((currentChunks) => {
            newTotal = currentChunks.reduce(
              (sum, chunk) => sum + chunk.duration,
              0
            );
            return currentChunks;
          });
          setTotalDuration(newTotal);

          resolve();
        };

        audio.onerror = () => {
          console.error(`Failed to load audio for chunk ${chunkIndex}`);
          resolve(); // Continue even if one chunk fails
        };
      });
    } catch (error) {
      console.error(`Error generating audio for chunk ${chunkIndex}:`, error);
      throw error;
    }
  };

  // Generate audio for a single chunk with progress tracking
  const generateSingleAudioWithProgress = async (
    chunkIndex: number
  ): Promise<void> => {
    console.log(
      `Starting generation for chunk ${chunkIndex + 1}/${audioChunks.length}`
    );

    await generateSingleAudio(chunkIndex);

    console.log(
      `Completed generation for chunk ${chunkIndex + 1}/${audioChunks.length}`
    );

    // Update progress (this will show the highest completed index)
    setCurrentGeneratingIndex(chunkIndex);
  };

  // Generate all audio chunks sequentially (one by one)
  const handleGenerateAudio = async () => {
    console.log("=== STARTING AUDIO GENERATION ===");
    setIsGenerating(true);
    setCurrentGeneratingIndex(0);

    try {
      // Generate chunks one by one sequentially
      for (let i = 0; i < audioChunks.length; i++) {
        console.log(`Generating chunk ${i + 1}/${audioChunks.length}`);
        
        try {
          await generateSingleAudioWithProgress(i);
          console.log(`Successfully generated chunk ${i + 1}/${audioChunks.length}`);
        } catch (error) {
          console.error(`Error generating chunk ${i + 1}:`, error);
          // Continue with next chunk even if one fails
          continue;
        }
      }

      console.log("All audio chunks generated successfully");
      console.log(`Total chunks processed: ${audioChunks.length}`);

      // Get the updated chunks with latest state first
      setAudioChunks((prev) => {
        const finalChunks = prev.map((chunk) => ({
          ...chunk,
          isGenerated: true,
        }));

        console.log("Calling onAudioGenerated with final chunks:", finalChunks);
        console.log(`Final chunks count: ${finalChunks.length}`);
        console.log("Chunk details:", finalChunks.map((c, i) => ({ 
          index: i, 
          id: c.id, 
          name: c.name, 
          hasBlobUrl: !!c.blobUrl,
          text: c.text.substring(0, 50) + "..." 
        })));
        onAudioGenerated(finalChunks, totalDuration);
        return finalChunks;
      });

      console.log("=== AUDIO GENERATION COMPLETED SUCCESSFULLY ===");

      // Set final states after chunk update
      setCurrentGeneratingIndex(-1);
      setIsGenerating(false);
      setAllGenerated(true);

      // Verify state after small delay
      setTimeout(() => {
        console.log("Final state verification:", {
          allGenerated: true,
          isGenerating: false,
          shouldShowPlayback: true,
        });
      }, 50);
    } catch (error) {
      console.error("Error generating audio:", error);
      setAllGenerated(false); // Reset on error
      setIsGenerating(false);
      setCurrentGeneratingIndex(-1);
    }

    console.log("=== AUDIO GENERATION PROCESS FINISHED ===");
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle timeline click for seeking (like media players)
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || !allGenerated || totalDuration === 0) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(clickX / rect.width, 1));
    const newTime = percentage * totalDuration;

    console.log(
      `Timeline clicked: seeking to ${newTime.toFixed(
        2
      )}s of ${totalDuration.toFixed(2)}s (${(percentage * 100).toFixed(1)}%)`
    );

    // Update current time immediately for UI responsiveness
    setCurrentTime(newTime);

    // Seek to the new time
    seekToTime(newTime);
  };

  // Seek to specific time (like media players)
  const seekToTime = (time: number) => {
    console.log(`Seeking to time: ${time.toFixed(2)}s`);

    // Ensure all audio elements have proper chunk advancement and time updates
    ensureChunkAdvancement();
    ensureTimeUpdates();

    // Pause all audio elements
    audioRefs.current.forEach((audio) => {
      if (audio) {
        audio.pause();
      }
    });

    // Find which chunk should be playing at this time
    const activeChunk = audioChunks.find(
      (chunk) =>
        chunk.isGenerated &&
        time >= chunk.startTime &&
        time < chunk.startTime + chunk.duration
    );

    if (!activeChunk) {
      console.warn(`No chunk found for time ${time.toFixed(2)}s`);
      return;
    }

    const chunkIndex = audioChunks.findIndex((c) => c.id === activeChunk.id);
    const offsetInChunk = time - activeChunk.startTime;

    console.log(
      `Found chunk ${
        activeChunk.id
      } at index ${chunkIndex}, seeking to offset ${offsetInChunk.toFixed(2)}s`
    );

    let audio = audioRefs.current[chunkIndex];

    // Create audio element if it doesn't exist
    if (!audio && activeChunk.blobUrl) {
      console.log(`Creating new audio element for chunk ${activeChunk.id}`);
      audio = new Audio(activeChunk.blobUrl);
      audioRefs.current[chunkIndex] = audio;

      // Set up seamless advancement for this chunk
      setupChunkAdvancement(audio, chunkIndex, "seek");
    }

    if (audio) {
      try {
        // Set the audio time to the correct offset
        audio.currentTime = offsetInChunk;
        setCurrentAudio(audio);

        console.log(
          `✅ Audio seeked to ${offsetInChunk.toFixed(2)}s in chunk ${
            activeChunk.id
          }`
        );
        console.log(`📍 Timeline position maintained at: ${time.toFixed(2)}s`);

        // If currently playing, resume playback from new position
        if (isPlaying) {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log(
                  `▶️ Resumed playback from ${offsetInChunk.toFixed(2)}s`
                );
                // Ensure time update loop is running for smooth indicator movement
                if (!animationFrameRef.current) {
                  startTimeUpdateLoop();
                }
              })
              .catch((error) => {
                console.error(
                  "Failed to resume playback after seeking:",
                  error
                );
                setIsPlaying(false);
              });
          }
        }
      } catch (error) {
        console.error(
          `Failed to seek audio for chunk ${activeChunk.id}:`,
          error
        );
      }
    } else {
      console.error(`No audio element available for chunk ${activeChunk.id}`);
    }
  };

  // Handle play/pause
  const handlePlayPause = () => {
    console.log("=== AUDIO PLAYBACK DEBUG ===");
    console.log("Play/Pause clicked. Current state:", {
      isPlaying,
      currentTime,
      totalDuration,
      audioChunksLength: audioChunks.length,
      allGenerated,
    });

    if (audioChunks.length === 0) {
      console.error("No audio chunks available for playback");
      return;
    }

    console.log(
      "Audio chunks for playback:",
      audioChunks.map((chunk) => ({
        id: chunk.id,
        name: chunk.name,
        hasBlobUrl: !!chunk.blobUrl,
        blobUrl: chunk.blobUrl,
        startTime: chunk.startTime,
        duration: chunk.duration,
      }))
    );

    if (isPlaying) {
      // Pause playback (maintain current position)
      console.log("Pausing playback");
      handlePause();
    } else {
      // Check if we're resuming or starting fresh
      if (currentTime > 0 && currentTime < totalDuration) {
        // Resume from current position (not at the end)
        handleResume();
        return;
      }

      // If we're at the end or at the beginning, start from the beginning
      if (currentTime >= totalDuration) {
        console.log("🔄 At end of playback, restarting from beginning");
        setCurrentTime(0);
      }

      // Starting fresh from beginning
      console.log("▶️ Starting playback from beginning");

      // Ensure all audio elements have proper chunk advancement and time updates
      ensureChunkAdvancement();
      ensureTimeUpdates();

      // Pause any other audio first (but don't reset position)
      audioRefs.current.forEach((audio) => {
        if (audio && audio !== currentAudio) {
          audio.pause();
        }
      });

      setIsPlaying(true);

      // Find which chunk should be playing at current time
      const activeChunk = audioChunks.find(
        (chunk) =>
          chunk.isGenerated &&
          currentTime >= chunk.startTime &&
          currentTime < chunk.startTime + chunk.duration
      );

      if (activeChunk && activeChunk.blobUrl) {
        console.log("Found active chunk for playback:", {
          id: activeChunk.id,
          name: activeChunk.name,
          startTime: activeChunk.startTime,
          duration: activeChunk.duration,
          currentTime: currentTime,
          offsetInChunk: currentTime - activeChunk.startTime,
          blobUrl: activeChunk.blobUrl,
        });

        // Pre-flight check: Test if blob URL is still valid
        try {
          const testAudio = new Audio();
          testAudio.src = activeChunk.blobUrl;

          // If the blob URL is invalid, try to recreate it
          testAudio.onerror = () => {
            console.warn("Blob URL appears invalid, attempting to recreate...");
            const newBlobUrl = recreateBlobUrl(activeChunk);
            if (newBlobUrl) {
              console.log("Successfully recreated blob URL:", newBlobUrl);
              // Update activeChunk reference for this playback attempt
              activeChunk.blobUrl = newBlobUrl;
            }
          };
        } catch (prefightError) {
          console.warn(
            "Preflight check failed, will attempt recreation on error"
          );
        }

        try {
          // Find the index of this chunk to get the pre-generated audio element
          const chunkIndex = audioChunks.findIndex(
            (c) => c.id === activeChunk.id
          );
          let audio = audioRefs.current[chunkIndex];

          // If no pre-existing audio element, create a new one
          if (!audio) {
            console.log("Creating new audio element for chunk", activeChunk.id);
            audio = new Audio(activeChunk.blobUrl);
            audioRefs.current[chunkIndex] = audio;
          } else {
            console.log(
              "Using pre-existing audio element for chunk",
              activeChunk.id
            );
          }

          // Set up event listeners
          audio.onloadeddata = () => {
            console.log("Audio loaded successfully, duration:", audio.duration);
          };

          audio.oncanplaythrough = () => {
            console.log("Audio can play through");
          };

          audio.onerror = (e) => {
            console.error("Audio error:", e);
            console.error("Audio error details:", {
              error: audio.error,
              networkState: audio.networkState,
              readyState: audio.readyState,
              src: audio.src,
            });

            // Try to recreate the blob URL and audio element if it fails
            console.log("Attempting to recreate blob URL and audio element...");
            try {
              const newBlobUrl = recreateBlobUrl(activeChunk);
              if (newBlobUrl) {
                const newAudio = new Audio(newBlobUrl);
                audioRefs.current[chunkIndex] = newAudio;
                setCurrentAudio(newAudio);
                newAudio.currentTime = currentTime - activeChunk.startTime;
                newAudio.play().catch((playError) => {
                  console.error("Failed to play recreated audio:", playError);
                  setIsPlaying(false);
                });
              } else {
                console.error(
                  "Could not recreate blob URL - no stored blob available"
                );
                setIsPlaying(false);
              }
            } catch (recreateError) {
              console.error("Failed to recreate audio element:", recreateError);
              setIsPlaying(false);
            }
          };

          // Set up seamless advancement for this chunk
          setupChunkAdvancement(audio, chunkIndex, "playback");

          // Add additional safety for last chunk
          if (chunkIndex === audioChunks.length - 1) {
            console.log(
              `🔄 This is the last chunk (${chunkIndex}) - will loop to beginning when finished`
            );
          }

          // Verify blob URL is still valid before setting source
          if (!audio.src || audio.src !== activeChunk.blobUrl) {
            console.log("Setting audio source to:", activeChunk.blobUrl);
            audio.src = activeChunk.blobUrl;
          }

          // Calculate offset within the chunk
          const offsetInChunk = currentTime - activeChunk.startTime;
          console.log(
            `▶️ Starting playback in chunk ${
              activeChunk.id
            } at offset ${offsetInChunk.toFixed(
              2
            )}s (global time: ${currentTime.toFixed(2)}s)`
          );

          // Set time before loading to avoid race conditions
          audio.currentTime = offsetInChunk;
          console.log(
            `🎯 Audio element seeked to: ${audio.currentTime.toFixed(2)}s`
          );

          // Set current audio BEFORE starting playback for time tracking
          setCurrentAudio(audio);
          console.log(`🎯 Current audio set for chunk: ${activeChunk.id}`);

          // Set up robust time updates for this chunk
          setupTimeUpdates(audio, activeChunk, chunkIndex);

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log("✅ Audio playback started successfully");

                // Start time update loop AFTER audio actually starts playing
                if (!animationFrameRef.current) {
                  console.log(
                    "🎬 Starting time update loop for indicator movement"
                  );
                  startTimeUpdateLoop();
                }
                console.log("🎬 Time update loop should now be running");
              })
              .catch((error) => {
                console.error("Error playing audio:", error);
                setIsPlaying(false);
              });
          }
        } catch (error) {
          console.error("Error creating audio element:", error);
          setIsPlaying(false);
        }
      } else {
        console.warn("No active chunk found or chunk has no blobUrl", {
          activeChunk: activeChunk
            ? {
                id: activeChunk.id,
                blobUrl: activeChunk.blobUrl,
                isValidBlobUrl: activeChunk.blobUrl?.startsWith("blob:"),
              }
            : null,
          currentTime,
          audioChunks: audioChunks.map((c) => ({
            id: c.id,
            startTime: c.startTime,
            duration: c.duration,
            hasBlobUrl: !!c.blobUrl,
            isValidBlobUrl: c.blobUrl?.startsWith("blob:"),
            isGenerated: c.isGenerated,
          })),
        });

        // Try to play the first available chunk with valid blob URL
        const firstChunkWithAudio = audioChunks.find(
          (chunk) =>
            chunk.isGenerated &&
            chunk.blobUrl &&
            chunk.blobUrl.startsWith("blob:")
        );
        if (firstChunkWithAudio) {
          console.log(
            "No chunk found for current time, starting with first available chunk:",
            firstChunkWithAudio.name
          );
          try {
            const audio = new Audio(firstChunkWithAudio.blobUrl);

            // Find the audio element index for this chunk
            const chunkIndex = audioChunks.findIndex(
              (c) => c.id === firstChunkWithAudio.id
            );
            if (chunkIndex >= 0) {
              audioRefs.current[chunkIndex] = audio;
            }

            setCurrentAudio(audio);
            setCurrentTime(firstChunkWithAudio.startTime); // Start from beginning of this chunk

            // Set up robust time updates for first chunk
            setupTimeUpdates(audio, firstChunkWithAudio, chunkIndex);

            // Set up seamless advancement for this chunk
            setupChunkAdvancement(audio, chunkIndex, "first-chunk");

            audio.onerror = (e) => {
              console.error("Error playing first chunk:", e);
              setIsPlaying(false);
            };

            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log("✅ First chunk playback started");

                  // Start time update loop AFTER audio actually starts playing
                  if (!animationFrameRef.current) {
                    console.log("🎬 Starting time update loop for first chunk");
                    startTimeUpdateLoop();
                  }
                })
                .catch((error) => {
                  console.error("Error playing first chunk:", error);
                  setIsPlaying(false);
                });
            }
          } catch (error) {
            console.error("Error creating audio for first chunk:", error);
            setIsPlaying(false);
          }
        } else {
          console.error("No audio chunks have valid blobUrl");
          setIsPlaying(false);

          // Check if we have generated chunks but invalid blob URLs
          const hasGeneratedButInvalidChunks = audioChunks.some(
            (chunk) =>
              chunk.isGenerated &&
              (!chunk.blobUrl || !chunk.blobUrl.startsWith("blob:"))
          );

          if (hasGeneratedButInvalidChunks) {
            console.warn(
              "Audio was previously generated but blob URLs are invalid. Audio may need to be regenerated."
            );
          }
        }
      }
    }
  };

  // Start the time update loop for smooth indicator movement
  const startTimeUpdateLoop = () => {
    // Cancel any existing animation frame to avoid duplicates
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    console.log("🎬 Time update loop started for smooth indicator movement");
    animationFrameRef.current = requestAnimationFrame(updateTimePosition);
  };

  // Update time position during playback (real-time like media players)
  const updateTimePosition = () => {
    // Check if we have current audio and it's actually playing
    if (!currentAudio) {
      // Don't immediately stop if currentAudio is null - it might be getting set up
      // Continue the loop to give it a chance to be set
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateTimePosition);
      }
      return;
    }

    if (currentAudio.paused || currentAudio.ended) {
      // Don't immediately stop during chunk transitions or restarts
      // The onended handler will manage chunk advancement
      if (currentAudio.ended) {
        console.log(
          "⏰ Current audio ended, onended handler will manage transition/restart"
        );
        // Continue the loop in case we're transitioning to next chunk or restarting
        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(updateTimePosition);
        }
        return;
      }

      // Only stop if audio is actually paused (not ended) AND user initiated pause
      if (currentAudio.paused && isPlaying) {
        console.log(
          "⏸️ Audio paused but isPlaying=true, continuing time loop for restart"
        );
        // During restart, audio might be paused briefly - don't stop the loop
        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(updateTimePosition);
        }
        return;
      } else if (currentAudio.paused && !isPlaying) {
        console.log(
          "⏸️ Audio paused and isPlaying=false, stopping time updates"
        );
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
        }
        return;
      }
    }

    // Find which chunk this audio belongs to
    const currentChunkIndex = audioRefs.current.findIndex(
      (audio) => audio === currentAudio
    );

    if (currentChunkIndex >= 0 && currentChunkIndex < audioChunks.length) {
      const chunk = audioChunks[currentChunkIndex];

      if (chunk && chunk.isGenerated) {
        // Calculate global time position with smooth updates
        const globalTime = chunk.startTime + currentAudio.currentTime;
        const clampedTime = Math.min(Math.max(globalTime, 0), totalDuration);

        // Update the time smoothly (this moves the indicator)
        setCurrentTime(clampedTime);

        // Check if this chunk has ended
        if (currentAudio.ended) {
          console.log("⏰ Chunk ended, checking if this is the last chunk");

          // Check if this is the last chunk
          const isLastChunk = currentChunkIndex === audioChunks.length - 1;

          if (isLastChunk) {
            console.log(
              "🏁 Last chunk ended in updateTimePosition - stopping playback"
            );
            handleEndOfPlayback();
            return;
          } else {
            // Not the last chunk - advance immediately for seamless playback
            if (!advanceToNextChunk()) {
              console.log(
                "⏹️ Could not advance to next chunk from update loop; stopping"
              );
              handleEndOfPlayback();
            }
            return;
          }
        }
      }
    }

    // Continue the animation loop for smooth 60fps updates
    animationFrameRef.current = requestAnimationFrame(updateTimePosition);
  };

  // Pause playback - maintain current position (like media players)
  const handlePause = () => {
    console.log("⏸️ Pausing audio playback - maintaining position");

    // Pause all audio but DON'T reset time
    audioRefs.current.forEach((audio) => {
      if (audio) {
        audio.pause();
        // DON'T reset currentTime on pause
      }
    });

    // Pause current audio but maintain position
    if (currentAudio) {
      currentAudio.pause();
      // DON'T reset currentTime on pause
    }

    // Pause preview audio
    if (previewAudio) {
      previewAudio.pause();
    }

    // Stop the time update loop but keep current time
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
      console.log("⏸️ Time update loop paused");
    }

    // Set playing state to false but DON'T reset currentTime
    setIsPlaying(false);
    setIsPlayingSelectedPreview(false);
    setIsPlayingGeneratedPreview(false);

    console.log(`⏸️ Paused at position: ${currentTime.toFixed(2)}s`);
  };

  // Resume playback from current position (seamless across chunks)
  const handleResume = () => {
    console.log(
      `▶️ Resuming playback from position: ${currentTime.toFixed(2)}s`
    );

    // Ensure all audio elements have proper chunk advancement and time updates
    ensureChunkAdvancement();
    ensureTimeUpdates();

    // Find which chunk should be playing at current time
    const activeChunk = audioChunks.find(
      (chunk) =>
        chunk.isGenerated &&
        currentTime >= chunk.startTime &&
        currentTime < chunk.startTime + chunk.duration
    );

    if (activeChunk && activeChunk.blobUrl) {
      const chunkIndex = audioChunks.findIndex((c) => c.id === activeChunk.id);
      let audio = audioRefs.current[chunkIndex];

      // Create audio element if it doesn't exist
      if (!audio) {
        console.log(
          `📱 Creating audio element for resume at chunk ${chunkIndex}`
        );
        audio = new Audio(activeChunk.blobUrl);
        audioRefs.current[chunkIndex] = audio;

        // Set up seamless advancement for this chunk
        setupChunkAdvancement(audio, chunkIndex, "resume");
      }

      // Set current audio and time position
      setCurrentAudio(audio);
      const offsetInChunk = currentTime - activeChunk.startTime;
      audio.currentTime = offsetInChunk;

      console.log(
        `🎯 Resuming chunk ${chunkIndex} at offset ${offsetInChunk.toFixed(2)}s`
      );

      // Start playing
      setIsPlaying(true);
      const playPromise = audio.play();

      if (playPromise) {
        playPromise
          .then(() => {
            console.log("✅ Successfully resumed playback");
            // Start time update loop
            if (!animationFrameRef.current) {
              startTimeUpdateLoop();
            }
          })
          .catch((error) => {
            console.error("❌ Failed to resume playback:", error);
            setIsPlaying(false);
          });
      }
    } else {
      console.log("❌ No active chunk found for resume position");
      // Start from beginning if no valid position
      setCurrentTime(0);
      const firstChunk = audioChunks.find((chunk) => chunk.isGenerated);
      if (firstChunk) {
        // Start from the first available chunk
        handlePlayPause();
      }
    }
  };

  // Stop playback - reset to beginning (like media players)
  const handleStop = () => {
    console.log("⏹️ Stopping all audio playback");

    // Stop main audio playback
    audioRefs.current.forEach((audio) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    // Stop current audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }

    // Stop preview audio
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }

    // Stop the time update loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
      console.log("⏹️ Time update loop stopped");
    }

    // Reset all states
    setIsPlaying(false);
    setCurrentTime(0);
    setIsPlayingSelectedPreview(false);
    setIsPlayingGeneratedPreview(false);
  };

  // Cleanup on unmount only (no dependencies to avoid premature cleanup)
  useEffect(() => {
    return () => {
      console.log("AudioPreview unmounting - cleaning up resources");

      // Only revoke blob URLs that are not from generated chunks
      if (previewAudio?.src && previewAudio.src.startsWith("blob:")) {
        URL.revokeObjectURL(previewAudio.src);
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Pause current audio but don't revoke generated blob URLs
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, []); // Empty dependency array - only runs on unmount

  // Separate cleanup for preview audio changes
  useEffect(() => {
    return () => {
      // Only cleanup previous preview audio, not generated audio
      if (previewAudio?.src && previewAudio.src.startsWith("blob:")) {
        console.log("Cleaning up previous preview audio");
        URL.revokeObjectURL(previewAudio.src);
      }
    };
  }, [previewAudio]);

  // Get voice info for both voices
  // Resolve selected voice name/description from VOICE_DATA or Murf list via window cache
  // **NEW: Function to get selected voice info from localStorage cache**
  const getSelectedVoiceFromCache = (voiceId: string): { name: string; description?: string } | null => {
    try {
      const cachedVoices = localStorage.getItem('murfVoicesCache');
      if (cachedVoices) {
        const voices = JSON.parse(cachedVoices);
        const cachedVoice = voices.find((v: any) => v.voice_id === voiceId);
        if (cachedVoice) {
          console.log(`🎵 AudioPreview: Found voice in cache: ${cachedVoice.name} (${voiceId})`);
          return {
            name: cachedVoice.name,
            description: cachedVoice.description
          };
        }
      }
    } catch (error) {
      console.warn('AudioPreview: Failed to get voice from cache:', error);
    }
    return null;
  };

  const resolveVoiceInfo = (id: string): VoiceInfo => {
    if (!id) return { name: "Unknown Voice", description: "Voice not found" };
    
    // **FIXED: Check localStorage cache first for selected voice name/description**
    const cachedVoice = getSelectedVoiceFromCache(id);
    if (cachedVoice) {
      return { 
        name: cachedVoice.name, 
        description: cachedVoice.description || "Voice from cache" 
      };
    }
    
    // Fallback to local VOICE_DATA
    const local = VOICE_DATA[id];
    if (local) return local;
    
    // Fallback to window.murfVoices (API)
    const murf = (window as any)?.murfVoices?.find?.((v: any) => v.voice_id === id);
    if (murf) {
      return { name: murf.name, description: murf.description };
    }
    
    return { name: "Unknown Voice", description: "Voice not found" };
  };



  const selectedVoiceInfo = resolveVoiceInfo(selectedVoiceId);

  const generatedVoiceInfo = generatedAudioVoiceId
    ? resolveVoiceInfo(generatedAudioVoiceId)
    : null;

  // States for both voice previews
  const [isPlayingSelectedPreview, setIsPlayingSelectedPreview] =
    useState(false);
  const [isPlayingGeneratedPreview, setIsPlayingGeneratedPreview] =
    useState(false);

  // Timeline hover state for preview
  const [timelineHoverTime, setTimelineHoverTime] = useState<number | null>(
    null
  );

  // Handle timeline hover for seeking preview
  const handleTimelineHover = (e: React.MouseEvent) => {
    if (!timelineRef.current || totalDuration === 0) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(hoverX / rect.width, 1));
    const hoverTime = percentage * totalDuration;

    setTimelineHoverTime(hoverTime);
  };

  const handleTimelineLeave = () => {
    setTimelineHoverTime(null);
  };

  // Helper function to set up time updates for any audio element
  const setupTimeUpdates = (
    audio: HTMLAudioElement,
    chunk: any,
    chunkIndex: number
  ) => {
    console.log(`⏰ Setting up time updates for chunk ${chunkIndex}`);

    // Set up robust time update listener
    audio.ontimeupdate = () => {
      // Always update time if this audio is playing, regardless of currentAudio state
      if (!audio.paused && !audio.ended) {
        const globalTime = chunk.startTime + audio.currentTime;
        const newTime = Math.min(globalTime, totalDuration);
        setCurrentTime(newTime);

        // Debug log every second to confirm movement
        if (Math.floor(newTime) !== Math.floor(newTime - 0.5)) {
          console.log(
            `⏰ Time indicator moving: ${newTime.toFixed(
              2
            )}s (chunk ${chunkIndex})`
          );
        }
      }
    };

    // Also set up a backup timer for smooth updates
    const updateTimer = setInterval(() => {
      if (!audio.paused && !audio.ended && audio === currentAudio) {
        const globalTime = chunk.startTime + audio.currentTime;
        const newTime = Math.min(globalTime, totalDuration);
        setCurrentTime(newTime);
      } else if (audio.paused || audio.ended) {
        clearInterval(updateTimer);
      }
    }, 100);
  };

  // Handle end of playback - stop when all chunks are finished
  const handleEndOfPlayback = () => {
    console.log("🏁 End of playback reached - stopping");
    console.log(`📊 All ${audioChunks.length} chunks have been played`);

    // Stop and clean up all audio elements
    audioRefs.current.forEach((audio) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0; // Reset for potential future playback
      }
    });

    // Stop the time update loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
      console.log("⏹️ Time update loop stopped");
    }

    // Set final state - playback is complete
    setIsPlaying(false);
    setCurrentAudio(null);
    
    // Keep the time indicator at the end to show completion
    setCurrentTime(totalDuration);
    
    console.log("✅ Playback completed - all chunks played successfully");
  };

  // Helper function to set up seamless chunk advancement for any audio element
  const setupChunkAdvancement = (
    audio: HTMLAudioElement,
    chunkIndex: number,
    context: string = ""
  ) => {
    console.log(
      `🔧 Setting up chunk advancement for chunk ${chunkIndex} (${context})`
    );

    audio.onended = () => {
      console.log(`🏁 Chunk ${chunkIndex} ended (${context}), advancing...`);
      console.log(`${context} chunk audio that ended:`, audio);
      console.log("Current audio state:", currentAudio);
      console.log("Is audio ended?", audio.ended);
      console.log("Audio current time:", audio.currentTime);
      console.log("Audio duration:", audio.duration);

      // Check if this is the last chunk
      const isLastChunk = chunkIndex === audioChunks.length - 1;
      console.log(
        `🔍 Is this the last chunk? ${isLastChunk} (${chunkIndex}/${
          audioChunks.length - 1
        })`
      );

      if (isLastChunk) {
        // This is the last chunk - stop playback
        console.log(
          "🏁 Last chunk finished - stopping playback"
        );
        handleEndOfPlayback();
      } else {
        // Ensure currentAudio is set to this ended audio before advancing
        if (currentAudio !== audio) {
          console.log("🔄 Setting currentAudio to ended audio before advancing");
          setCurrentAudio(audio);
        }
        
        // Try to advance to next chunk immediately
        console.log(`🔄 Attempting to advance from ${context} chunk...`);
        
        // Use a small timeout to ensure state updates are processed
        setTimeout(() => {
          if (!advanceToNextChunk()) {
            console.log("🏁 No more chunks available - stopping playback");
            handleEndOfPlayback();
          }
        }, 10);
      }
    };

    audio.onerror = (e) => {
      console.error(`❌ Error in chunk ${chunkIndex} (${context}):`, e);
      // Try to continue to next chunk on error
      setTimeout(() => {
        if (!advanceToNextChunk()) {
          setIsPlaying(false);
        }
      }, 10);
    };
  };

  // Ensure all existing audio elements have proper chunk advancement
  const ensureChunkAdvancement = () => {
    console.log("🔧 Ensuring all audio elements have proper chunk advancement");
    audioRefs.current.forEach((audio, index) => {
      if (
        audio &&
        (!audio.onended ||
          audio.onended.toString().indexOf("advanceToNextChunk") === -1)
      ) {
        console.log(`🔄 Setting up missing advancement for chunk ${index}`);
        setupChunkAdvancement(audio, index, "existing");
      }
    });
  };

  // Ensure all existing audio elements have proper time updates
  const ensureTimeUpdates = () => {
    console.log("⏰ Ensuring all audio elements have proper time updates");
    audioRefs.current.forEach((audio, index) => {
      if (audio && audioChunks[index]) {
        const chunk = audioChunks[index];
        console.log(`⏰ Setting up time updates for existing chunk ${index}`);

        // Set up robust time update listener
        audio.ontimeupdate = () => {
          // Always update time if this audio is playing
          if (!audio.paused && !audio.ended) {
            const globalTime = chunk.startTime + audio.currentTime;
            const newTime = Math.min(globalTime, totalDuration);
            setCurrentTime(newTime);
          }
        };
      }
    });
  };

  // Helper function to advance from a specific chunk index
  const advanceFromIndex = (fromIndex: number) => {
    console.log(`🔄 Advancing from index ${fromIndex}`);

    // Look for next available chunk
    for (let i = fromIndex + 1; i < audioChunks.length; i++) {
      const nextChunk = audioChunks[i];
      console.log(`🔍 Checking chunk ${i}:`, {
        exists: !!nextChunk,
        isGenerated: nextChunk?.isGenerated,
        hasBlobUrl: !!nextChunk?.blobUrl,
      });

      if (nextChunk && nextChunk.isGenerated && nextChunk.blobUrl) {
        console.log(`🎯 Found next chunk: ${nextChunk.id} at index ${i}`);

        // Get or create audio element for next chunk
        let nextAudio = audioRefs.current[i];
        if (!nextAudio) {
          console.log(`📱 Creating new audio element for chunk ${i}`);
          nextAudio = new Audio(nextChunk.blobUrl);
          audioRefs.current[i] = nextAudio;

          // Set up time update listener for this chunk
          nextAudio.ontimeupdate = () => {
            if (
              nextAudio &&
              nextAudio === currentAudio &&
              !nextAudio.paused &&
              !nextAudio.ended
            ) {
              const globalTime = nextChunk.startTime + nextAudio.currentTime;
              const newTime = Math.min(globalTime, totalDuration);
              setCurrentTime(newTime);
            }
          };

          // Set up seamless advancement for this chunk
          setupChunkAdvancement(nextAudio, i, "advance");
        } else {
          console.log(`♻️ Reusing existing audio element for chunk ${i}`);
          // Ensure advancement handlers are attached even for reused elements
          setupChunkAdvancement(nextAudio, i, "advance-reuse");
        }

        // Switch to next chunk (with null check)
        if (nextAudio) {
          console.log(`🔄 Switching currentAudio to chunk ${i}`);

          // CRITICAL: Stop and cleanup previous audio before starting next chunk
          if (currentAudio && currentAudio !== nextAudio) {
            console.log("⏸️ Stopping previous audio before advancing");
            currentAudio.pause();
            currentAudio.currentTime = 0;
            
            // Remove event listeners from previous audio to prevent conflicts
            currentAudio.onended = null;
            currentAudio.ontimeupdate = null;
            currentAudio.onerror = null;
          }

          // Pause all other audio elements to prevent overlapping playback
          audioRefs.current.forEach((audio, index) => {
            if (audio && audio !== nextAudio && index !== i) {
              audio.pause();
              audio.currentTime = 0;
            }
          });

          // CRITICAL: Update currentAudio state immediately to prevent UI desync
          setCurrentAudio(nextAudio);
          nextAudio.currentTime = 0;

          // Ensure isPlaying stays true during transition
          console.log(
            `📊 Ensuring isPlaying remains true during chunk transition`
          );
          setIsPlaying(true);

          // Start playing next chunk
          console.log(`▶️ Starting playback of chunk ${i}`);
          // Always ensure advancement handler is present before play
          setupChunkAdvancement(nextAudio, i, "advance");

          const playPromise = nextAudio.play();
          if (playPromise) {
            playPromise
              .then(() => {
                console.log(`✅ Successfully started chunk ${i}`);
                console.log(`📊 Confirming isPlaying state: true`);
                setIsPlaying(true); // Ensure UI stays in playing state

                // Ensure time update loop continues
                if (!animationFrameRef.current) {
                  console.log(`🔄 Restarting time update loop for chunk ${i}`);
                  startTimeUpdateLoop();
                }
              })
              .catch((error) => {
                console.error(`❌ Failed to play chunk ${i}:`, error);
                // Try next chunk on failure
                if (!advanceFromIndex(i)) {
                  setIsPlaying(false);
                }
              });
          }
        } else {
          console.log(`❌ nextAudio is null for chunk ${i}`);
          return false;
        }

        return true; // Successfully advanced
      }
    }

    console.log("🔚 No more chunks available");
    return false;
  };

  // Unified chunk advancement logic for seamless playback
  const advanceToNextChunk = () => {
    console.log("🔄 advanceToNextChunk called");
    console.log("Current audio:", currentAudio);
    console.log(
      "Audio chunks:",
      audioChunks.map((c) => ({
        id: c.id,
        isGenerated: c.isGenerated,
        hasBlobUrl: !!c.blobUrl,
      }))
    );
    console.log(
      "Audio refs:",
      audioRefs.current.map((audio, i) => ({
        index: i,
        exists: !!audio,
        src: audio?.src,
        ended: audio?.ended,
      }))
    );

    let currentChunkIndex = -1;

    // First, try to find current chunk index using currentAudio
    if (currentAudio) {
      currentChunkIndex = audioRefs.current.findIndex(
        (audio) => audio === currentAudio
      );
      console.log(`🔍 Current chunk index from currentAudio: ${currentChunkIndex}`);
    }

    // If currentAudio is null or not found, try alternative approaches
    if (currentChunkIndex === -1) {
      console.log("❌ CurrentAudio not found, trying alternative approaches...");
      
      // Alternative 1: find the ended audio element
      const endedAudioIndex = audioRefs.current.findIndex(
        (audio) => audio && audio.ended
      );
      console.log(`🔍 Found ended audio at index: ${endedAudioIndex}`);

      if (endedAudioIndex >= 0) {
        console.log("✅ Using ended audio index as current chunk index");
        currentChunkIndex = endedAudioIndex;
      } else {
        // Alternative 2: find the last playing audio based on currentTime
        let bestMatchIndex = -1;
        let bestMatchTime = -1;
        
        audioRefs.current.forEach((audio, index) => {
          if (audio && audioChunks[index] && audioChunks[index].isGenerated) {
            const chunkEndTime = audioChunks[index].startTime + audioChunks[index].duration;
            if (currentTime >= audioChunks[index].startTime && currentTime <= chunkEndTime) {
              if (audioChunks[index].startTime > bestMatchTime) {
                bestMatchIndex = index;
                bestMatchTime = audioChunks[index].startTime;
              }
            }
          }
        });
        
        if (bestMatchIndex >= 0) {
          console.log(`✅ Using time-based match at index: ${bestMatchIndex}`);
          currentChunkIndex = bestMatchIndex;
        }
      }
    }

    if (currentChunkIndex === -1) {
      console.log("❌ Could not determine current chunk index, cannot advance");
      return false;
    }

    // Look for next available chunk
    console.log(`🔍 Looking for chunks after index ${currentChunkIndex}`);
    console.log(`Total chunks available: ${audioChunks.length}`);

    // Check if we're already at the last chunk
    if (currentChunkIndex >= audioChunks.length - 1) {
      console.log(
        "🔚 Already at or past the last chunk - no advancement possible"
      );
      return false;
    }

    for (let i = currentChunkIndex + 1; i < audioChunks.length; i++) {
      const nextChunk = audioChunks[i];
      console.log(`🔍 Checking chunk ${i}:`, {
        exists: !!nextChunk,
        isGenerated: nextChunk?.isGenerated,
        hasBlobUrl: !!nextChunk?.blobUrl,
        chunkId: nextChunk?.id,
        startTime: nextChunk?.startTime,
        duration: nextChunk?.duration,
      });

      if (nextChunk && nextChunk.isGenerated && nextChunk.blobUrl) {
        console.log(`🎯 Found next chunk: ${nextChunk.id} at index ${i}`);

        // Get or create audio element for next chunk
        let nextAudio = audioRefs.current[i];
        if (!nextAudio) {
          console.log(`📱 Creating new audio element for chunk ${i}`);
          nextAudio = new Audio(nextChunk.blobUrl);
          audioRefs.current[i] = nextAudio;

          // Set up time update listener for this chunk
          nextAudio.ontimeupdate = () => {
            if (
              nextAudio &&
              nextAudio === currentAudio &&
              !nextAudio.paused &&
              !nextAudio.ended
            ) {
              const globalTime = nextChunk.startTime + nextAudio.currentTime;
              const newTime = Math.min(globalTime, totalDuration);
              setCurrentTime(newTime);
            }
          };

          // Set up seamless advancement for this chunk
          setupChunkAdvancement(nextAudio, i, "advance");
        } else {
          console.log(`♻️ Reusing existing audio element for chunk ${i}`);
          // Ensure handlers are set for reused elements
          setupChunkAdvancement(nextAudio, i, "advance-reuse");
          setupTimeUpdates(nextAudio, nextChunk, i);
        }

        // Switch to next chunk
        console.log(`🔄 Switching currentAudio to chunk ${i}`);

        // CRITICAL: Stop and cleanup previous audio before starting next chunk
        if (currentAudio && currentAudio !== nextAudio) {
          console.log("⏸️ Stopping previous audio before advancing");
          currentAudio.pause();
          currentAudio.currentTime = 0;
          
          // Remove event listeners from previous audio to prevent conflicts
          currentAudio.onended = null;
          currentAudio.ontimeupdate = null;
          currentAudio.onerror = null;
        }

        // Pause all other audio elements to prevent overlapping playback
        audioRefs.current.forEach((audio, index) => {
          if (audio && audio !== nextAudio && index !== i) {
            audio.pause();
            audio.currentTime = 0;
          }
        });

        // CRITICAL: Update currentAudio state immediately to prevent UI desync
        setCurrentAudio(nextAudio);
        nextAudio.currentTime = 0;

        // Ensure isPlaying stays true during transition
        console.log(
          `📊 Ensuring isPlaying remains true during chunk transition`
        );
        setIsPlaying(true);

        // Start playing next chunk
        console.log(`▶️ Starting playback of chunk ${i}`);
        // Ensure advancement before playing
        setupChunkAdvancement(nextAudio, i, "advance");
        const playPromise = nextAudio.play();
        if (playPromise) {
          playPromise
            .then(() => {
              console.log(`✅ Successfully started chunk ${i}`);
              console.log(`📊 Confirming isPlaying state: true`);
              setIsPlaying(true); // Ensure UI stays in playing state

              // Ensure time update loop continues
              if (!animationFrameRef.current) {
                console.log(`🔄 Restarting time update loop for chunk ${i}`);
                startTimeUpdateLoop();
              }
            })
            .catch((error) => {
              console.error(`❌ Failed to play chunk ${i}:`, error);
              // Try next chunk on failure
              if (!advanceToNextChunk()) {
                setIsPlaying(false);
              }
            });
        }

        return true; // Successfully advanced
      }
    }

    // No more chunks available - this should trigger end of playback
    console.log("🔚 No more chunks available");
    return false;
  };

  // Handle voice preview for selected voice
  const handleSelectedVoicePreview = async () => {
    try {
      // Stop all audio before starting new preview (same as stop button)
      handleStop();

      setIsPlayingSelectedPreview(true);
      console.log(
        "Playing selected voice preview for:",
        selectedVoiceId,
        "with text: 'Hello, how are you'"
      );

      // Generate TTS audio
      const audioBlob = await apiService.generateTTS(
        selectedVoiceId,
        "Hello, how are you"
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and play audio element
      const audio = new Audio(audioUrl);
      setPreviewAudio(audio);

      audio.onended = () => {
        console.log("Selected voice preview finished playing");
        setIsPlayingSelectedPreview(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        console.error("Error playing selected voice preview");
        setIsPlayingSelectedPreview(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      console.log("Selected voice preview started playing");
    } catch (error) {
      console.error("Error playing selected voice preview:", error);
      setIsPlayingSelectedPreview(false);
    }
  };

  // Handle voice preview for generated audio voice
  const handleGeneratedVoicePreview = async () => {
    if (!generatedAudioVoiceId) return;

    try {
      // Stop all audio before starting new preview (same as stop button)
      handleStop();

      setIsPlayingGeneratedPreview(true);
      console.log(
        "Playing generated voice preview for:",
        generatedAudioVoiceId,
        "with text: 'Hello, how are you'"
      );

      // Generate TTS audio
      const audioBlob = await apiService.generateTTS(
        generatedAudioVoiceId,
        "Hello, how are you"
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and play audio element
      const audio = new Audio(audioUrl);
      setPreviewAudio(audio);

      audio.onended = () => {
        console.log("Generated voice preview finished playing");
        setIsPlayingGeneratedPreview(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        console.error("Error playing generated voice preview");
        setIsPlayingGeneratedPreview(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      console.log("Generated voice preview started playing");
    } catch (error) {
      console.error("Error playing generated voice preview:", error);
      setIsPlayingGeneratedPreview(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Voice Preview Section */}
      <div className="space-y-3">
        {/* Generated Audio Voice Preview (if different from selected) */}
        {generatedVoiceInfo && generatedAudioVoiceId !== selectedVoiceId && (
          <Card className="bg-white border border-green-200 rounded-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 bg-green-50 border-green-200">
                {/* Left side - Avatar and Info */}
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                    {generatedVoiceInfo.name.charAt(0)}
                  </div>

                  {/* Name and Description */}
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {generatedVoiceInfo.name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {generatedVoiceInfo.description} • Used for current audio
                    </p>
                  </div>
                </div>

                {/* Right side - Preview Button */}
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handleGeneratedVoicePreview}
                    disabled={isPlayingGeneratedPreview}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-green-100"
                  >
                    {isPlayingGeneratedPreview ? (
                      <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                    ) : (
                      <Play className="w-4 h-4 text-green-600" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Voice Preview */}
        <Card className="bg-white border border-blue-200 rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 bg-blue-50 border-blue-200">
              {/* Left side - Avatar and Info */}
              <div className="flex items-center space-x-3">
                {/* Avatar */}
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                  {selectedVoiceInfo.name.charAt(0)}
                </div>

                {/* Name and Description */}
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">
                    {selectedVoiceInfo.name}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {selectedVoiceInfo.description} •{" "}
                    {generatedVoiceInfo &&
                    generatedAudioVoiceId !== selectedVoiceId
                      ? "Selected for next generation"
                      : "Current voice"}
                  </p>
                </div>
              </div>

              {/* Right side - Preview Button */}
              <div className="flex items-center space-x-2">
                {/* Voice Preview Button */}
                <Button
                  onClick={handleSelectedVoicePreview}
                  disabled={isPlayingSelectedPreview}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-blue-100"
                >
                  {isPlayingSelectedPreview ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <Play className="w-4 h-4 text-blue-600" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!allGenerated ? (
        <div className="space-y-6">
          {/* Generate Audio Button */}
          <div className="text-center space-y-4">
            {existingAudioChunks &&
              existingAudioChunks.length > 0 &&
              !isGenerating && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                  <div className="flex items-center">
                    <Volume2 className="w-5 h-5 text-yellow-600 mr-2" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">
                        Regenerating Audio
                      </h4>
                      <p className="text-sm text-yellow-600">
                        Previous audio will be replaced with new voice
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {!isGenerating && audioChunks.length > 0 && selectedVoiceId && (
              <Button
                onClick={handleGenerateAudio}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3"
              >
                <Play className="w-5 h-5 mr-2" />
                {existingAudioChunks && existingAudioChunks.length > 0
                  ? `Regenerate Audio `
                  : `Generate Audio `}
              </Button>
            )}
          </div>

          {/* Generation Progress */}
          {isGenerating && (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                    <h3 className="text-lg font-medium">Generating Audio...</h3>
                    <p className="text-gray-600">
                      Processing part {currentGeneratingIndex + 1} of{" "}
                      {audioChunks.length}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {audioChunks.map((chunk, index) => (
                      <div
                        key={chunk.id}
                        className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50"
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                            index < currentGeneratingIndex
                              ? "bg-green-500 text-white"
                              : index === currentGeneratingIndex
                              ? "bg-blue-500 text-white"
                              : "bg-gray-300 text-gray-600"
                          }`}
                        >
                          {index < currentGeneratingIndex ? (
                            "✓"
                          ) : index === currentGeneratingIndex ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{chunk.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {chunk.text.substring(0, 100)}...
                          </p>
                        </div>
                        <div className="text-xs text-gray-500">
                          ~{formatTime(chunk.duration)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          (currentGeneratingIndex / audioChunks.length) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Check for invalid blob URLs and show warning */}
          {(() => {
            const hasInvalidBlobUrls = audioChunks.some(
              (chunk) =>
                chunk.isGenerated &&
                (!chunk.blobUrl || !chunk.blobUrl.startsWith("blob:"))
            );

            if (hasInvalidBlobUrls) {
              return (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <div className="flex-1">
                        <h4 className="font-medium text-orange-800">
                          Audio needs to be regenerated
                        </h4>
                        <p className="text-sm text-orange-700">
                          The audio was previously generated but is no longer
                          available for playback.
                        </p>
                      </div>  
                      <Button
                        onClick={() => {
                          setAllGenerated(false);
                          setAudioChunks((prev) =>
                            prev.map((chunk) => ({
                              ...chunk,
                              blobUrl: "",
                              isGenerated: false,
                            }))
                          );
                        }}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}

          {/* Audio Player Controls */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-4">
                  <Button
                    onClick={handlePlayPause}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={
                      !audioChunks.some(
                        (chunk) =>
                          chunk.blobUrl && chunk.blobUrl.startsWith("blob:")
                      )
                    }
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </Button>
                  <Button onClick={handleStop} variant="outline">
                    <Square className="w-5 h-5" />
                  </Button>
                </div>

                {/* Timeline - Interactive like media players */}
                <div className="space-y-2">
                  <div
                    ref={timelineRef}
                    className="relative h-3 bg-gray-200 rounded-full cursor-pointer hover:bg-gray-300 transition-colors group"
                    onClick={handleTimelineClick}
                    onMouseMove={handleTimelineHover}
                    onMouseLeave={handleTimelineLeave}
                  >
                    {/* Progress bar - expands with indicator */}
                    <div
                      className="absolute h-full bg-blue-600 rounded-full"
                      style={{
                        width: `${
                          totalDuration > 0
                            ? (currentTime / totalDuration) * 100
                            : 0
                        }%`,
                        transition: isPlaying ? "none" : "width 0.15s ease-out",
                      }}
                    />

                    {/* Buffered/loaded sections indicator */}
                    {audioChunks.map((chunk) => {
                      if (!chunk.isGenerated) return null;

                      const startPercentage =
                        totalDuration > 0
                          ? (chunk.startTime / totalDuration) * 100
                          : 0;
                      const widthPercentage =
                        totalDuration > 0
                          ? (chunk.duration / totalDuration) * 100
                          : 0;

                      return (
                        <div
                          key={chunk.id}
                          className="absolute h-full bg-blue-200 rounded-full opacity-50"
                          style={{
                            left: `${startPercentage}%`,
                            width: `${widthPercentage}%`,
                          }}
                        />
                      );
                    })}

                    {/* Hover preview indicator with time tooltip */}
                    {timelineHoverTime !== null && (
                      <>
                        <div
                          className="absolute w-3 h-3 bg-blue-400 rounded-full border border-white shadow-md transform -translate-y-0.5 -translate-x-1.5 opacity-75"
                          style={{
                            left: `${
                              totalDuration > 0
                                ? (timelineHoverTime / totalDuration) * 100
                                : 0
                            }%`,
                          }}
                        />
                        {/* Time tooltip */}
                        <div
                          className="absolute bg-gray-800 text-white text-xs px-2 py-1 rounded transform -translate-x-1/2 -translate-y-8 pointer-events-none"
                          style={{
                            left: `${
                              totalDuration > 0
                                ? (timelineHoverTime / totalDuration) * 100
                                : 0
                            }%`,
                          }}
                        >
                          {formatTime(timelineHoverTime)}
                          <div className="absolute left-1/2 top-full w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800 transform -translate-x-1/2" />
                        </div>
                      </>
                    )}

                    {/* Time indicator - moves with progress */}
                    <div
                      className="absolute w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-lg transform -translate-y-1 -translate-x-2.5 cursor-grab active:cursor-grabbing hover:scale-110 group-hover:opacity-100 opacity-90"
                      style={{
                        left: `${
                          totalDuration > 0
                            ? (currentTime / totalDuration) * 100
                            : 0
                        }%`,
                        transition: isPlaying
                          ? "none"
                          : "left 0.15s ease-out, transform 0.2s ease-out",
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(totalDuration)}</span>
                  </div>
                </div>

                {/* Audio Chunks List */}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {audioChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50"
                    >
                      <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-medium">
                        ✓
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{chunk.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {chunk.text.substring(0, 100)}...
                        </p>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTime(chunk.duration)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Button */}
          <div className="flex justify-center">
            <Button
              onClick={() => {
                // Stop all audio before proceeding to video creation (same as stop button)
                handleStop();
                onNext();
              }}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3"
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Create Video
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioPreview;
