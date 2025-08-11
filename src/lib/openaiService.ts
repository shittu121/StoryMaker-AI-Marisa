import OpenAI from "openai";

export interface StoryGenerationData {
  title: string;
  genre?: string;
  duration?: number;
  mainPrompt: string;
  characterDetails?: string;
  settingAtmosphere?: string;
  narrativePerspective?: string;
  format?: string;
  audienceAgeGroup?: string;
  approximateLength?: string;
}

export interface StoryChunk {
  type: "start" | "chunk" | "complete" | "error";
  content?: string;
  chunkNumber?: number;
  storyId?: number;
  message?: string;
  error?: string;
  totalChunks?: number;
}

class OpenAIService {
  private openai: OpenAI | null = null;

  constructor() {
    // Initialize OpenAI client when API key is available
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true, // Required for browser usage
      });
    }
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      throw new Error(
        "OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your environment variables."
      );
    }
    return this.openai;
  }

  async generateStoryStream(
    storyData: StoryGenerationData,
    onChunk: (chunk: StoryChunk) => void,
    onComplete: (data: StoryChunk) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const openai = this.getOpenAI();

      // Send initial response
      onChunk({
        type: "start",
        message: "Starting story generation...",
      });

      // Build the prompt
      const fullPrompt = `Create a compelling story with the following specifications:

Title: ${storyData.title}
Genre: ${storyData.genre || "Fantasy"}
Duration: ${storyData.duration || 180} seconds
Main Prompt: ${storyData.mainPrompt}
Character Details: ${storyData.characterDetails || "Not specified"}
Setting/Atmosphere: ${storyData.settingAtmosphere || "Not specified"}
Narrative Perspective: ${
        storyData.narrativePerspective || "Third Person Limited"
      }
Format: ${storyData.format || "Short Story"}
Target Audience: ${storyData.audienceAgeGroup || "All Ages"}
Approximate Length: ${storyData.approximateLength || "Short (5-15 minutes)"}

Please create a story that:
1. Is engaging and appropriate for the target audience
2. Fits within the specified duration when narrated
3. Incorporates all the provided details and specifications
4. Has a clear beginning, middle, and end
5. Uses the specified narrative perspective
6. Matches the genre and atmosphere described

Write the story in a way that would be suitable for audio narration.`;

      // Generate story with streaming
      const stream = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a creative storyteller who creates engaging, well-structured stories suitable for audio narration. Write in a clear, flowing style that captures the listener's attention.",
          },
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        stream: true,
        max_tokens: 2000,
        temperature: 0.8,
      });

      let fullContent = "";
      let chunkCount = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullContent += content;
          chunkCount++;

          // Send chunk to client
          onChunk({
            type: "chunk",
            content: content,
            chunkNumber: chunkCount,
          });
        }
      }

      // Send completion message
      onComplete({
        type: "complete",
        message: "Story generation completed successfully",
        totalChunks: chunkCount,
      });
    } catch (error) {
      console.error("AI generation error:", error);
      onError(
        error instanceof Error
          ? error
          : new Error("Failed to generate story content")
      );
    }
  }

  async generateStory(storyData: StoryGenerationData): Promise<string> {
    try {
      const openai = this.getOpenAI();

      // Build the prompt
      const fullPrompt = `Create a compelling story with the following specifications:

Title: ${storyData.title}
Genre: ${storyData.genre || "Fantasy"}
Duration: ${storyData.duration || 180} seconds
Main Prompt: ${storyData.mainPrompt}
Character Details: ${storyData.characterDetails || "Not specified"}
Setting/Atmosphere: ${storyData.settingAtmosphere || "Not specified"}
Narrative Perspective: ${
        storyData.narrativePerspective || "Third Person Limited"
      }
Format: ${storyData.format || "Short Story"}
Target Audience: ${storyData.audienceAgeGroup || "All Ages"}
Approximate Length: ${storyData.approximateLength || "Short (5-15 minutes)"}

Please create a story that:
1. Is engaging and appropriate for the target audience
2. Fits within the specified duration when narrated
3. Incorporates all the provided details and specifications
4. Has a clear beginning, middle, and end
5. Uses the specified narrative perspective
6. Matches the genre and atmosphere described

Write the story in a way that would be suitable for audio narration.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a creative storyteller who creates engaging, well-structured stories suitable for audio narration. Write in a clear, flowing style that captures the listener's attention.",
          },
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.8,
      });

      return completion.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("AI generation error:", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to generate story content");
    }
  }
}

export const openaiService = new OpenAIService();
