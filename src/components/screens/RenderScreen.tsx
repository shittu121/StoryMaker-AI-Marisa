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
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-blue-600 mb-3" />
            <h2 className="text-xl font-semibold mb-2">Rendering Video...</h2>
            <p className="text-gray-500 mb-4">
              Please wait, this may take a few moments.
            </p>
            <Progress value={progress} className="w-full" />
            <p className="text-base font-mono mt-3">{progress.toFixed(2)}%</p>
          </div>
        );
      case "complete":
        return (
          <div className="text-center">
            <CheckCircle className="w-10 h-10 mx-auto text-green-600 mb-3" />
            <p className="text-gray-500 mb-4">
              Preview your video below and save it to your computer.
            </p>
            {renderedVideoUrl && (
              <video
                src={renderedVideoUrl}
                controls
                className="w-full rounded-lg mb-4"
                onError={(e) => {
                  console.error('Video loading error:', e);
                  console.error('Video URL:', renderedVideoUrl);
                }}
              />
            )}
            <div className="flex space-x-3 justify-center">
              <Button onClick={handleSaveVideo} size="lg">
                <Download className="w-5 h-5 mr-2" />
                Save Video
              </Button>
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
      case "error":
        return (
          <div className="text-center">
            <XCircle className="w-10 h-10 mx-auto text-red-600 mb-3" />
            <h2 className="text-xl font-semibold mb-2">Render Failed</h2>
            <p className="text-gray-500 mb-3">
              An error occurred during rendering.
            </p>
            <Card className="bg-red-50 text-red-800 p-3 text-left">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {errorMessage}
              </pre>
            </Card>
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className=" flex flex-col items-center justify-center"
    >
      <Card className="w-full max-w-4xl">
        <CardContent className="p-6">{renderContent()}</CardContent>
      </Card>
    </motion.div>
  );
};
