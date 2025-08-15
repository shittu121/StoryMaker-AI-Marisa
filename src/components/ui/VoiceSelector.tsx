import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./card";
import { CheckCircle, Play, Loader2 } from "lucide-react";
import { Button } from "./button";
import { apiService } from "../../lib/api";

interface Voice {
  voice_id: string;
  name: string;
  avatar?: string;
  description?: string;
}

interface VoiceSelectorProps {
  selectedVoice?: string;
  onVoiceSelect: (voiceId: string) => void;
  className?: string;
}

// No default voices - only use API voices
const DEFAULT_VOICES: Voice[] = [];

const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoice,
  onVoiceSelect,
  className = "",
}) => {

  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(
    null
  );
  const [voices, setVoices] = useState(DEFAULT_VOICES);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);



  useEffect(() => {
    let isMounted = true;
    const loadVoices = async () => {
      try {
        setLoadingVoices(true);
        setVoicesError(null);
        const result = await apiService.fetchMurfVoices();
        if (isMounted && result?.success && Array.isArray(result.data?.voices) && result.data.voices.length > 0) {
          setVoices(result.data.voices);
          // Cache for other components (e.g., AudioPreview) to resolve names
          (window as any).murfVoices = result.data.voices;
        }
      } catch (e: any) {
        if (isMounted) {
          setVoicesError(e?.message || "Failed to load voices");
        }
      } finally {
        if (isMounted) setLoadingVoices(false);
      }
    };
    loadVoices();
    return () => {
      isMounted = false;
    };
  }, []);



  const handleSelectVoice = (voiceId: string) => {
    onVoiceSelect(voiceId);
  };

  // Handle voice preview with "Hello, how are you"
  const handleVoicePreview = async (voiceId: string, voiceName: string) => {
    try {
      // Stop current preview if playing
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
        setPreviewingVoice(null);
      }

      setPreviewingVoice(voiceId);
      console.log(`Playing voice preview for: ${voiceName} (${voiceId})`);

      // Generate TTS audio
      const audioBlob = await apiService.generateTTS(
        voiceId,
        "Hello, how are you"
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and play audio element
      const audio = new Audio(audioUrl);
      setPreviewAudio(audio);

      audio.onended = () => {
        console.log("Voice preview finished playing");
        setPreviewingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        console.error("Error playing preview audio");
        setPreviewingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      console.log("Voice preview started playing");
    } catch (error) {
      console.error("Error playing voice preview:", error);
      setPreviewingVoice(null);
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        if (previewAudio.src) {
          URL.revokeObjectURL(previewAudio.src);
        }
      }
    };
  }, [previewAudio]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Choose a Voice
        </h3>
        <p className="text-sm text-gray-600">
          Select a voice for your story narration
        </p>
      </div>

      {loadingVoices ? (
        // Loading State
        <div className="w-full">
          <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    Loading Voices...
                  </h4>
                  <p className="text-sm text-gray-600">
                    Fetching available voices
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : voicesError ? (
        // Error State
        <div className="w-full">
          <Card className="bg-white border border-red-200 rounded-xl overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">⚠️</span>
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-red-900 mb-2">
                    Failed to Load Voices
                  </h4>
                  <p className="text-sm text-red-600 mb-4">
                    {voicesError}
                  </p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : voices.length === 0 ? (
        // No Voices State
        <div className="w-full">
          <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 text-xl">🎤</span>
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    No Voices Available
                  </h4>
                  <p className="text-sm text-gray-600">
                    No voices were returned from the API
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Voices Grid
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column */}
          <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="space-y-0">
                {voices.slice(0, Math.ceil(voices.length / 2)).map((voice, index) => (
                  <div
                    key={voice.voice_id}
                    className={`flex items-center justify-between p-4 cursor-pointer transition-all duration-200 ${
                      index !== voices.slice(0, Math.ceil(voices.length / 2)).length - 1
                        ? "border-b border-gray-100"
                        : ""
                    } ${
                      selectedVoice === voice.voice_id
                        ? "bg-blue-50 border-blue-200"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {/* Left side - Avatar and Info */}
                    <div
                      className="flex items-center space-x-3 flex-1"
                      onClick={() => handleSelectVoice(voice.voice_id)}
                    >
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {voice.name.charAt(0)}
                      </div>

                      {/* Name and Description */}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {voice.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {voice.description}
                        </p>
                      </div>
                    </div>

                    {/* Right side - Controls */}
                    <div className="flex items-center space-x-2">
                      {/* Preview Button */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVoicePreview(voice.voice_id, voice.name);
                        }}
                        disabled={previewingVoice === voice.voice_id}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-blue-100"
                      >
                        {previewingVoice === voice.voice_id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        ) : (
                          <Play className="w-4 h-4 text-blue-600" />
                        )}
                      </Button>

                      {/* Selected Indicator */}
                      {selectedVoice === voice.voice_id && (
                        <CheckCircle className="w-6 h-6 text-blue-600 fill-current" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right Column */}
          <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="space-y-0">
                {voices.slice(Math.ceil(voices.length / 2)).map(
                  (voice, index) => (
                    <div
                      key={voice.voice_id}
                      className={`flex items-center justify-between p-4 cursor-pointer transition-all duration-200 ${
                        index !== voices.slice(Math.ceil(voices.length / 2)).length - 1
                          ? "border-b border-gray-100"
                          : ""
                      } ${
                        selectedVoice === voice.voice_id
                          ? "bg-blue-50 border-blue-200"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Left side - Avatar and Info */}
                      <div
                        className="flex items-center space-x-3 flex-1"
                        onClick={() => handleSelectVoice(voice.voice_id)}
                      >
                        {/* Avatar */}
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                          {voice.name.charAt(0)}
                        </div>

                        {/* Name and Description */}
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {voice.name}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {voice.description}
                          </p>
                        </div>
                      </div>

                      {/* Right side - Controls */}
                      <div className="flex items-center space-x-2">
                        {/* Preview Button */}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVoicePreview(voice.voice_id, voice.name);
                          }}
                          disabled={previewingVoice === voice.voice_id}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-blue-100"
                        >
                          {previewingVoice === voice.voice_id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          ) : (
                            <Play className="w-4 h-4 text-blue-600" />
                          )}
                        </Button>

                        {/* Selected Indicator */}
                        {selectedVoice === voice.voice_id && (
                          <CheckCircle className="w-6 h-6 text-blue-600 fill-current" />
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default VoiceSelector;
