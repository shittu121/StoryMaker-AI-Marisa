import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Card, CardContent} from "../ui/card";
import { Progress } from "../ui/progress";
import { Loader2, CheckCircle, XCircle, Download } from "lucide-react";
import { motion } from "framer-motion";

interface RenderScreenProps {
  onBackToEditor: () => void;
  onSaveComplete: () => void;
}

type RenderStatus = "rendering" | "complete" | "error";

export const RenderScreen: React.FC<RenderScreenProps> = ({
  onBackToEditor,
  onSaveComplete,
}) => {
  const [status, setStatus] = useState<RenderStatus>("rendering");
  const [progress, setProgress] = useState(0);
  const [renderedFilePath, setRenderedFilePath] = useState<string | null>(null);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // Listen for progress updates from the main process
    const handleProgress = async (
      _event: any,
      {
        progress,
        error,
        filePath,
      }: { progress: number; error?: string; filePath?: string }
    ) => {
      console.log("Render progress update received:", {
        progress,
        error,
        filePath,
      });
      if (error) {
        setStatus("error");
        setErrorMessage(error);
      } else if (filePath) {
        setStatus("complete");
        setRenderedFilePath(filePath);
        setProgress(100);
        
        // Load the video file and convert to blob URL for preview
        try {
          const result = await window.electron.loadRenderedVideo(filePath);
          if (result.success) {
            const uint8Array = new Uint8Array(result.data);
            const blob = new Blob([uint8Array], { type: 'video/mp4' });
            const videoUrl = URL.createObjectURL(blob);
            setRenderedVideoUrl(videoUrl);
          } else {
            console.error('Failed to load rendered video:', result.error);
          }
        } catch (error) {
          console.error('Error loading rendered video for preview:', error);
        }
      } else {
        setProgress(progress);
      }
    };

    window.electron.onRenderProgress(handleProgress);

    return () => {
      window.electron.removeRenderProgressListener(handleProgress);
    };
  }, []);

  // Cleanup blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (renderedVideoUrl) {
        URL.revokeObjectURL(renderedVideoUrl);
      }
    };
  }, [renderedVideoUrl]);

  const handleSaveVideo = async () => {
    if (renderedFilePath) {
      const success = await window.electron.saveRenderedVideo(renderedFilePath);
      if (success) {
        onSaveComplete();
      } else {
        // Handle failed save, e.g., show a toast
      }
    }
  };

  const renderContent = () => {
    switch (status) {
      case "rendering":
        return (
          <div className="text-center">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Rendering Your Video...</h2>
            <p className="text-gray-500 mb-6">
              Please wait while we process your video. This may take a few moments depending on the length and complexity.
            </p>
            <div className="w-full max-w-md mx-auto">
              <Progress value={progress} className="w-full mb-3" />
              <p className="text-base font-mono text-blue-600">{progress.toFixed(1)}% Complete</p>
            </div>
            <div className="mt-6 text-sm text-gray-400">
              <p>Processing timeline, media files, and text overlays...</p>
            </div>
          </div>
        );
      case "complete":
        return (
          <div className="text-center">
            <CheckCircle className="w-10 h-10 mx-auto text-green-600 mb-3" />
            <h2 className="text-xl font-semibold mb-2">Video Render Complete!</h2>
            <p className="text-gray-500 mb-6">
              Your video has been successfully rendered. Preview it below and save it to your computer.
            </p>
            {renderedVideoUrl && (
              <div className="w-full max-w-4xl mx-auto mb-4">
                <video
                  src={renderedVideoUrl}
                  controls
                  className="w-full h-auto max-h-[70vh] rounded-lg shadow-lg"
                  style={{
                    objectFit: 'contain',
                    maxWidth: '100%'
                  }}
                  onError={(e) => {
                    console.error('Video loading error:', e);
                    console.error('Video URL:', renderedVideoUrl);
                  }}
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-6">
              <Button onClick={handleSaveVideo} size="lg" className="w-full sm:w-auto">
                <Download className="w-5 h-5 mr-2" />
                Save Video to Computer
              </Button>
              <Button
                variant="outline"
                onClick={onBackToEditor}
                size="lg"
                className="w-full sm:w-auto"
              >
                Back to Editor
              </Button>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              The video will be saved to your Downloads folder
            </p>
          </div>
        );
      case "error":
        return (
          <div className="text-center">
            <XCircle className="w-10 h-10 mx-auto text-red-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Video Render Failed</h2>
            <p className="text-gray-500 mb-4">
              An error occurred while rendering your video. Please check the details below and try again.
            </p>
            <Card className="bg-red-50 border-red-200 text-red-800 p-4 text-left max-w-2xl mx-auto">
              <h3 className="font-semibold mb-2">Error Details:</h3>
              <pre className="whitespace-pre-wrap font-mono text-sm overflow-auto max-h-40">
                {errorMessage}
              </pre>
            </Card>
            <div className="mt-6">
              <Button
                variant="outline"
                onClick={onBackToEditor}
                size="lg"
              >
                Back to Editor
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50"
    >
      <Card className="w-full max-w-6xl">
        <CardContent className="p-8">{renderContent()}</CardContent>
      </Card>
    </motion.div>
  );
};
