import React, { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Card, CardContent } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Monitor,
  Square,
  Smartphone,
  Clock,
  Sparkles,
  ChevronDown,
  Wand2,
  BookOpen,
  Users,
  MessageSquare,
  Palette,
  Target,
  FileText,
  Quote,
  Zap,
  Settings,
} from "lucide-react";

interface StoryData {
  // Screen 1
  videoStyle: "landscape" | "square" | "vertical";
  storyName: string;

  // Screen 2
  duration: number; // in seconds

  // Screen 3
  mainPrompt: string;
  aiModel: string;
  characterDetails: string;
  settingAtmosphere: string;
  genre: string;
  narrativePerspective: string;
  format: string;
  audienceAgeGroup: string;
  approximateLength: string;
}

interface AITool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  action: (currentPrompt: string) => string;
}

const aiTools: AITool[] = [
  {
    id: "story-generator",
    name: "Story Generator",
    description: "Autofill general story idea",
    icon: <Sparkles className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nGenerate a creative story idea with engaging plot and characters.",
  },
  {
    id: "story-continuer",
    name: "Story Continuer",
    description: "Add continuation logic",
    icon: <ChevronRight className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nContinue the story with logical progression and character development.",
  },
  {
    id: "roleplay-scenario",
    name: "Roleplay Scenario",
    description: "Inject RPG-like theme or mission",
    icon: <Target className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nCreate a roleplay scenario with clear objectives and character roles.",
  },
  {
    id: "character-generator",
    name: "Story Character Gene",
    description: "Add character setup",
    icon: <Users className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nDevelop detailed character profiles with backgrounds and motivations.",
  },
  {
    id: "plot-generator",
    name: "Plot Generator",
    description: "Suggest narrative arc",
    icon: <Zap className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nCreate a compelling plot structure with rising action, climax, and resolution.",
  },
  {
    id: "backstory-generator",
    name: "Backstory Generator",
    description: "Autofill character background",
    icon: <BookOpen className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nDevelop rich character backstories with personal history and motivations.",
  },
  {
    id: "title-generator",
    name: "Book Title Generator",
    description: "Suggest a catchy story title",
    icon: <FileText className="w-4 h-4" />,
    action: (prompt) =>
      prompt + "\n\nGenerate creative and memorable titles for the story.",
  },
  {
    id: "comic-generator",
    name: "AI Comic Generator",
    description: "Format story like a comic",
    icon: <Palette className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nAdapt the story into comic format with visual storytelling elements.",
  },
  {
    id: "fantasy-generator",
    name: "Fantasy Story Gene",
    description: "Inject fantasy world elements",
    icon: <Wand2 className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nAdd fantasy elements including magic systems, mythical creatures, and otherworldly settings.",
  },
  {
    id: "character-profile",
    name: "Character Profile Gene",
    description: "Add full character persona",
    icon: <Users className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nCreate comprehensive character profiles with personality traits, appearance, and relationships.",
  },
  {
    id: "prompt-generator",
    name: "Story Prompt Generator",
    description: "Autofill basic plotline",
    icon: <Sparkles className="w-4 h-4" />,
    action: (prompt) =>
      prompt + "\n\nGenerate story prompts with clear conflict and resolution.",
  },
  {
    id: "dialogue-generator",
    name: "Dialogue Generator",
    description: "Suggest example conversation lines",
    icon: <MessageSquare className="w-4 h-4" />,
    action: (prompt) =>
      prompt + "\n\nCreate natural and engaging dialogue between characters.",
  },
  {
    id: "metaphor-generator",
    name: "Metaphor Generator",
    description: "Add symbolic tone/theme",
    icon: <Quote className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nIncorporate metaphors and symbolic elements to enhance the story's depth.",
  },
  {
    id: "logline-generator",
    name: "Logline Generator",
    description: "One-line elevator pitch",
    icon: <Target className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nCreate a compelling one-sentence summary that captures the essence of the story.",
  },
  {
    id: "book-writer",
    name: "AI Book Writer",
    description: "Pre-fill sections of story as book outline",
    icon: <BookOpen className="w-4 h-4" />,
    action: (prompt) =>
      prompt +
      "\n\nStructure the story as a book with chapters, scenes, and detailed narrative sections.",
  },
];

const aiModels = [
  "Gemini 2.5 Flash",
  "GPT-4 Turbo",
  "Claude 3.5 Sonnet",
  "Llama 3.1",
  "Mistral Large",
];

const genres = [
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Romance",
  "Thriller",
  "Horror",
  "Adventure",
  "Historical Fiction",
  "Contemporary",
  "Literary Fiction",
];

const narrativePerspectives = [
  "First Person",
  "Second Person",
  "Third Person Limited",
  "Third Person Omniscient",
];

const formats = [
  "Short Story",
  "Novel",
  "Novella",
  "Flash Fiction",
  "Screenplay",
  "Comic Script",
];

const audienceAgeGroups = [
  "Children (5-8)",
  "Middle Grade (9-12)",
  "Young Adult (13-18)",
  "Adult (18+)",
  "All Ages",
];

const CreateStoryWizard = ({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (data: StoryData) => void;
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [storyData, setStoryData] = useState<StoryData>({
    videoStyle: "landscape",
    storyName: "",
    duration: 60, // 1 minute default
    mainPrompt: "",
    aiModel: "Gemini 2.5 Flash",
    characterDetails: "",
    settingAtmosphere: "",
    genre: "",
    narrativePerspective: "",
    format: "",
    audienceAgeGroup: "",
    approximateLength: "",
  });

  const [showToolSelector, setShowToolSelector] = useState(false);
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false);

  const updateStoryData = (updates: Partial<StoryData>) => {
    setStoryData((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleToolSelect = (tool: AITool) => {
    const enhancedPrompt = tool.action(storyData.mainPrompt);
    updateStoryData({ mainPrompt: enhancedPrompt });
    setShowToolSelector(false);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes > 1 ? "s" : ""}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hour${hours > 1 ? "s" : ""} ${
        minutes > 0 ? `${minutes} minute${minutes > 1 ? "s" : ""}` : ""
      }`;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return storyData.storyName.trim() !== "";
      case 2:
        return storyData.duration >= 30;
      case 3:
        return storyData.mainPrompt.trim() !== "";
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg border shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold">Create New Story</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`px-2 py-1 rounded ${
                  currentStep >= 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                1
              </span>
              <span className="text-muted-foreground">→</span>
              <span
                className={`px-2 py-1 rounded ${
                  currentStep >= 2
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                2
              </span>
              <span className="text-muted-foreground">→</span>
              <span
                className={`px-2 py-1 rounded ${
                  currentStep >= 3
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                3
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">
                  SCREEN 1 - Choose Video Story Style
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Video Style
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      <Card
                        className={`cursor-pointer transition-all ${
                          storyData.videoStyle === "landscape"
                            ? "ring-2 ring-primary"
                            : ""
                        }`}
                        onClick={() =>
                          updateStoryData({ videoStyle: "landscape" })
                        }
                      >
                        <CardContent className="p-4 text-center">
                          <Monitor className="w-8 h-8 mx-auto mb-2" />
                          <div className="text-sm font-medium">Landscape</div>
                          <div className="text-xs text-muted-foreground">
                            16:9 ratio
                          </div>
                        </CardContent>
                      </Card>

                      <Card
                        className={`cursor-pointer transition-all ${
                          storyData.videoStyle === "square"
                            ? "ring-2 ring-primary"
                            : ""
                        }`}
                        onClick={() =>
                          updateStoryData({ videoStyle: "square" })
                        }
                      >
                        <CardContent className="p-4 text-center">
                          <Square className="w-8 h-8 mx-auto mb-2" />
                          <div className="text-sm font-medium">Square</div>
                          <div className="text-xs text-muted-foreground">
                            1:1 ratio
                          </div>
                        </CardContent>
                      </Card>

                      <Card
                        className={`cursor-pointer transition-all ${
                          storyData.videoStyle === "vertical"
                            ? "ring-2 ring-primary"
                            : ""
                        }`}
                        onClick={() =>
                          updateStoryData({ videoStyle: "vertical" })
                        }
                      >
                        <CardContent className="p-4 text-center">
                          <Smartphone className="w-8 h-8 mx-auto mb-2" />
                          <div className="text-sm font-medium">Vertical</div>
                          <div className="text-xs text-muted-foreground">
                            9:16 ratio
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Name Your Story
                    </label>
                    <Input
                      placeholder="Enter your story name..."
                      value={storyData.storyName}
                      onChange={(e) =>
                        updateStoryData({ storyName: e.target.value })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">
                  SCREEN 2 - Choose Story Length
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-4 block">
                      Duration: {formatDuration(storyData.duration)}
                    </label>
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="30"
                        max="10800" // 3 hours in seconds
                        step="30"
                        value={storyData.duration}
                        onChange={(e) =>
                          updateStoryData({
                            duration: parseInt(e.target.value),
                          })
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>30 seconds</span>
                        <span>3 hours</span>
                      </div>
                    </div>
                  </div>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>Recommended: 2-5 minutes for most stories</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">
                  SCREEN 3 - Optimize Your Story
                </h3>

                <div className="space-y-6">
                  {/* Main Prompt */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      What do you want to write story about?
                    </label>
                    <Textarea
                      placeholder="Describe your story idea, characters, plot, or any specific elements you want to include..."
                      value={storyData.mainPrompt}
                      onChange={(e) =>
                        updateStoryData({ mainPrompt: e.target.value })
                      }
                      className="min-h-[120px]"
                    />
                  </div>

                  {/* AI Model Selection */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Choose AI Model
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          {storyData.aiModel}
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-full">
                        {aiModels.map((model) => (
                          <DropdownMenuItem
                            key={model}
                            onClick={() => updateStoryData({ aiModel: model })}
                          >
                            {model}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* AI Tool Selector */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      AI Tools (Optional)
                    </label>
                    <Dialog
                      open={showToolSelector}
                      onOpenChange={setShowToolSelector}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <Wand2 className="w-4 h-4 mr-2" />
                          Select AI Tools to Enhance Your Story
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>AI Story Enhancement Tools</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {aiTools.map((tool) => (
                            <Card
                              key={tool.id}
                              className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => handleToolSelect(tool)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3 mb-2">
                                  {tool.icon}
                                  <div className="font-medium text-sm">
                                    {tool.name}
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {tool.description}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Advanced Options */}
                  <Collapsible
                    open={advancedOptionsOpen}
                    onOpenChange={setAdvancedOptionsOpen}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          Advanced Options
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            advancedOptionsOpen ? "rotate-180" : ""
                          }`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Character Details
                          </label>
                          <Textarea
                            placeholder="Describe your main characters..."
                            value={storyData.characterDetails}
                            onChange={(e) =>
                              updateStoryData({
                                characterDetails: e.target.value,
                              })
                            }
                            className="min-h-[80px]"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Setting & Atmosphere
                          </label>
                          <Textarea
                            placeholder="Describe the setting and mood..."
                            value={storyData.settingAtmosphere}
                            onChange={(e) =>
                              updateStoryData({
                                settingAtmosphere: e.target.value,
                              })
                            }
                            className="min-h-[80px]"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Genre
                          </label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between"
                              >
                                {storyData.genre || "Select genre"}
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-full">
                              {genres.map((genre) => (
                                <DropdownMenuItem
                                  key={genre}
                                  onClick={() => updateStoryData({ genre })}
                                >
                                  {genre}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Narrative Perspective
                          </label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between"
                              >
                                {storyData.narrativePerspective ||
                                  "Select perspective"}
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-full">
                              {narrativePerspectives.map((perspective) => (
                                <DropdownMenuItem
                                  key={perspective}
                                  onClick={() =>
                                    updateStoryData({
                                      narrativePerspective: perspective,
                                    })
                                  }
                                >
                                  {perspective}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Format
                          </label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between"
                              >
                                {storyData.format || "Select format"}
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-full">
                              {formats.map((format) => (
                                <DropdownMenuItem
                                  key={format}
                                  onClick={() => updateStoryData({ format })}
                                >
                                  {format}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Audience Age Group
                          </label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between"
                              >
                                {storyData.audienceAgeGroup ||
                                  "Select age group"}
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-full">
                              {audienceAgeGroups.map((ageGroup) => (
                                <DropdownMenuItem
                                  key={ageGroup}
                                  onClick={() =>
                                    updateStoryData({
                                      audienceAgeGroup: ageGroup,
                                    })
                                  }
                                >
                                  {ageGroup}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Approximate Length
                        </label>
                        <Input
                          placeholder="e.g., 1000 words, 5 pages, etc."
                          value={storyData.approximateLength}
                          onChange={(e) =>
                            updateStoryData({
                              approximateLength: e.target.value,
                            })
                          }
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? onClose : handleBack}
          >
            {currentStep === 1 ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            {currentStep < 3 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => onComplete(storyData)}
                disabled={!canProceed()}
                className="bg-green-600 hover:bg-green-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Story
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateStoryWizard;
