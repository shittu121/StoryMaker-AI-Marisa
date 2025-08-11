import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthContext } from "../auth/AuthProvider";
import { useToast } from "../ui/toast";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  BookOpen,
  Plus,
  LogOut,
  User,
  Sparkles,
  TrendingUp,
  Clock,
  Settings,
  Bell,
  Loader2,
  Calendar,
  RefreshCw,
  MoreVertical,
  Edit,
  Download,
  Trash2,
  FileText,
  Info,
} from "lucide-react";
import { apiService, Story } from "../../lib/api";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthContext();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoadingStories, setIsLoadingStories] = useState(true);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [showStoryMenu, setShowStoryMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newStoryName, setNewStoryName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStory = () => {
    navigate("/create-story");
  };

  const handleRefreshStories = async () => {
    try {
      setIsLoadingStories(true);
      const response = await apiService.getStories();
      if (response.success) {
        setStories(response.data.stories);
        addToast({
          type: "success",
          title: "Stories Updated",
          message: "Your local stories have been refreshed",
        });
      }
    } catch (error) {
      console.error("Error refreshing stories:", error);
      addToast({
        type: "error",
        title: "Refresh Failed",
        message: "Could not refresh stories",
      });
    } finally {
      setIsLoadingStories(false);
    }
  };

  const handleStoryMenu = (story: Story, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calculate position, ensuring menu doesn't go off-screen
    let x = rect.left;
    let y = rect.bottom + 5;

    // If menu would go off the right edge, position it to the left of the button
    if (x + 200 > windowWidth) {
      x = rect.right - 200;
    }

    // If menu would go off the bottom, position it above the button
    if (y + 200 > windowHeight) {
      y = rect.top - 200;
    }

    setMenuPosition({ x, y });
    setSelectedStory(story);
    setShowStoryMenu(true);
  };

  const handleRenameStory = async () => {
    if (!selectedStory || !newStoryName.trim()) return;

    setIsRenaming(true);
    try {
      const response = await apiService.updateStory(selectedStory.id, {
        title: newStoryName.trim(),
      });

      if (response.success) {
        // Update the story in the local state
        setStories(
          stories.map((story) =>
            story.id === selectedStory.id
              ? { ...story, title: newStoryName.trim() }
              : story
          )
        );

        addToast({
          type: "success",
          title: "Story Renamed",
          message: "Story name has been updated successfully",
        });
        setShowRenameDialog(false);
        setNewStoryName("");
      }
    } catch (error) {
      console.error("Error renaming story:", error);
      addToast({
        type: "error",
        title: "Rename Failed",
        message: "Failed to rename story",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteStory = async () => {
    if (!selectedStory) return;

    setIsDeleting(true);
    try {
      const response = await apiService.deleteStory(selectedStory.id);

      if (response.success) {
        // Remove the story from local state
        setStories(stories.filter((story) => story.id !== selectedStory.id));

        addToast({
          type: "success",
          title: "Story Deleted",
          message: "Story has been permanently deleted",
        });
        setShowDeleteDialog(false);
      }
    } catch (error) {
      console.error("Error deleting story:", error);
      addToast({
        type: "error",
        title: "Delete Failed",
        message: "Failed to delete story",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditStory = (story: Story) => {
    navigate("/create-story", { state: { storyId: story.id } });
  };

  const handleDownloadStory = (story: Story) => {
    console.log(story);
    // TODO: Implement video download functionality
    addToast({
      type: "info",
      title: "Download Coming Soon",
      message: "Video download functionality will be implemented soon",
    });
  };

  const generateStorySummary = (story: Story) => {
    // Use the AI-generated story summary from two-stage generation
    if (story.storySummary) {
      return story.storySummary;
    }

    // Fallback: extract summary from content if it has ***** markers (old format)
    if (story.content && story.content.includes("*****")) {
      const parts = story.content.split("*****");
      if (parts.length >= 3) {
        return parts[2].trim(); // Summary between *****
      }
    }

    // Final fallback: simple summary generation from content
    const content = story.content || "";
    const words = content.split(" ").slice(0, 50).join(" ");
    return words.length > 100 ? words.substring(0, 100) + "..." : words;
  };

  const generateStoryHeadline = (story: Story) => {
    // Use the AI-generated YouTube title if available
    if (story.youtubeTitle) {
      return story.youtubeTitle;
    }
    return story.title || "Untitled Story";
  };

  const generateStoryDescription = (story: Story) => {
    // Use the AI-generated YouTube description if available
    if (story.youtubeDescription) {
      return story.youtubeDescription;
    }

    // Fallback: use story content
    const content = story.content || "";
    return content.length > 200 ? content.substring(0, 200) + "..." : content;
  };

  const generateStoryTags = (story: Story) => {
    const tags = [];
    if (story.genre) tags.push(story.genre);
    if (story.videoStyle) tags.push(story.videoStyle);
    if (story.language) tags.push(story.language);

    // Add YouTube tags if available
    if (story.youtubeTags) {
      const youtubeTags = story.youtubeTags.split(",").map((tag) => tag.trim());
      tags.push(...youtubeTags);
    }

    return tags;
  };

  // Fetch stories from API
  useEffect(() => {
    const fetchStories = async () => {
      try {
        setIsLoadingStories(true);
        const response = await apiService.getStories();
        console.log(response);
        if (response.success) {
          setStories(response.data.stories);
        } else {
          addToast({
            type: "error",
            title: "Failed to load stories",
            message: "Could not fetch your local stories",
          });
        }
      } catch (error) {
        console.error("Error fetching stories:", error);
        addToast({
          type: "error",
          title: "Failed to load stories",
          message: "Could not fetch your local stories",
        });
      } finally {
        setIsLoadingStories(false);
      }
    };

    fetchStories();

    // Check if we need to refresh (e.g., coming back from story creation)
    if (location.state?.refresh) {
      // Clear the state to prevent infinite refreshes
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [addToast, location.state?.refresh, navigate, location.pathname]);

  // Calculate stats from real data
  const completedStories = stories.filter(
    (story) => story.status === "completed"
  ).length;
  const totalStories = stories.length;

  // Stats calculated from real data
  const stats = [
    {
      title: "Stories Created",
      value: totalStories.toString(),
      icon: BookOpen,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Completed Stories",
      value: completedStories.toString(),
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50"
    >
      {/* Header */}
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.2,
                duration: 0.5,
                type: "spring",
                stiffness: 200,
              }}
              className="flex items-center space-x-3"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  StoryMaker AI
                </h1>
                <p className="text-xs text-gray-500">Create amazing stories</p>
              </div>
            </motion.div>

            {/* Navigation */}
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900"
              >
                <Bell className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900"
              >
                <Settings className="w-5 h-5" />
              </Button>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.email}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user?.subscriptionStatus}
                  </p>
                </div>
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoading}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span className="ml-2">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-8"
        >
          <div className="text-center">
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-3xl font-bold text-gray-900 mb-2"
            >
              Welcome back, {user?.email?.split("@")[0]}! 👋
            </motion.h2>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-gray-600 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Ready to create your next amazing story?
            </motion.p>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mb-8"
        >
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Quick Actions
                  </h3>
                  <p className="text-gray-600">
                    Start creating your next masterpiece
                  </p>
                </div>
                <Button
                  onClick={handleCreateStory}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:scale-[0.98]"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create New Story
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {stats.map((stat) => (
            <motion.div key={stat.title} variants={itemVariants}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}
                    >
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent Stories */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">
                    My Video Stories
                  </CardTitle>
                  <CardDescription>Your latest creative works</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshStories}
                  disabled={isLoadingStories}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  {isLoadingStories ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingStories ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading stories...</span>
                </div>
              ) : stories.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No stories yet
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Create your first story to get started!
                  </p>
                  <Button
                    onClick={handleCreateStory}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Story
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stories.map((story: Story, index: number) => (
                    <motion.div
                      key={story.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.9 + index * 0.1, duration: 0.5 }}
                      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden"
                    >
                      {/* Story Preview Thumbnail */}
                      <div className="relative h-48 bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>
                        <div className="relative z-10 text-center">
                          <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                          <div className="text-xs text-blue-600 font-medium">
                            {story.videoStyle || "landscape"} •{" "}
                            {story.genre || "Unknown"}
                          </div>
                        </div>
                        {story.status === "completed" && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            Ready
                          </div>
                        )}
                        {story.status !== "completed" && story.isDraft && (
                          <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                            Draft
                          </div>
                        )}
                      </div>

                      {/* Story Info */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">
                              {story.title}
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {new Date(story.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleStoryMenu(story, e)}
                            className="ml-2 p-1 h-8 w-8"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Story Meta */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {Math.round((story.duration || 0) / 60)}m
                          </span>
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {story.status}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Story Menu Dropdown */}
      {showStoryMenu && selectedStory && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50"
          onClick={() => setShowStoryMenu(false)}
        >
          <motion.div
            className="bg-white rounded-lg shadow-xl p-2 min-w-48 border border-gray-200"
            style={{
              position: "absolute",
              left: menuPosition.x,
              top: menuPosition.y,
              zIndex: 51,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <button
                onClick={() => {
                  setNewStoryName(selectedStory.title);
                  setShowRenameDialog(true);
                  setShowStoryMenu(false);
                }}
                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <Edit className="w-4 h-4 mr-2" />
                Rename Story
              </button>

              <button
                onClick={() => {
                  setShowSummaryDialog(true);
                  setShowStoryMenu(false);
                }}
                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <FileText className="w-4 h-4 mr-2" />
                Story Summary
              </button>

              {selectedStory.status === "completed" ? (
                <button
                  onClick={() => {
                    handleDownloadStory(selectedStory);
                    setShowStoryMenu(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Video
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleEditStory(selectedStory);
                    setShowStoryMenu(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Video
                </button>
              )}

              <button
                onClick={() => {
                  setShowMetadataDialog(true);
                  setShowStoryMenu(false);
                }}
                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <Info className="w-4 h-4 mr-2" />
                Show Meta Data
              </button>

              <div className="border-t border-gray-200 my-1"></div>

              <button
                onClick={() => {
                  setShowDeleteDialog(true);
                  setShowStoryMenu(false);
                }}
                className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Story
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Rename Dialog */}
      {showRenameDialog && selectedStory && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Rename Story
            </h3>
            <input
              type="text"
              value={newStoryName}
              onChange={(e) => setNewStoryName(e.target.value)}
              placeholder="Enter new story name"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRenameDialog(false);
                  setNewStoryName("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRenameStory}
                disabled={isRenaming || !newStoryName.trim()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold transition-all duration-200 transform hover:scale-[1.02] focus:scale-[0.98]"
              >
                {isRenaming ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Rename
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Story Summary Dialog */}
      {showSummaryDialog && selectedStory && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Story Summary
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  AI Generated Summary
                </h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {generateStorySummary(selectedStory)}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Story Content
                </h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                  {selectedStory.content || "No content available"}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowSummaryDialog(false)}
              className="mt-6"
            >
              Close
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* Meta Data Dialog */}
      {showMetadataDialog && selectedStory && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Story Meta Data
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  AI Generated Headline
                </h4>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {generateStoryHeadline(selectedStory)}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {generateStoryDescription(selectedStory)}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {generateStoryTags(selectedStory).map((tag, index) => (
                    <span
                      key={index}
                      className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              {selectedStory.stockFootageTerms && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    Stock Footage Terms
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedStory.stockFootageTerms
                      .split(",")
                      .map((term, index) => (
                        <span
                          key={index}
                          className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full"
                        >
                          {term.trim()}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              {selectedStory.totalChapters &&
                selectedStory.totalChapters > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Chapter Information
                    </h4>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                      Total Chapters: {selectedStory.totalChapters}
                      {selectedStory.chapterSummaries &&
                        selectedStory.chapterSummaries.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium mb-1">
                              Chapter Summaries:
                            </p>
                            {selectedStory.chapterSummaries.map(
                              (chapter, index) => (
                                <div
                                  key={index}
                                  className="text-sm text-gray-600 mb-1"
                                >
                                  <strong>Chapter {chapter.number}:</strong>{" "}
                                  {chapter.summary}
                                </div>
                              )
                            )}
                          </div>
                        )}
                    </p>
                  </div>
                )}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Story Summary
                </h4>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {generateStorySummary(selectedStory)}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Story Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Genre:</span>{" "}
                    {selectedStory.genre || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span>{" "}
                    {selectedStory.duration
                      ? `${Math.round(selectedStory.duration / 60)}m`
                      : "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Language:</span>{" "}
                    {selectedStory.language || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Video Style:</span>{" "}
                    {selectedStory.videoStyle || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{" "}
                    {selectedStory.status || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>{" "}
                    {selectedStory.createdAt
                      ? new Date(selectedStory.createdAt).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={() => setShowMetadataDialog(false)}
              className="mt-6"
            >
              Close
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && selectedStory && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
          >
            <div className="flex items-center space-x-3 mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Story
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{selectedStory.title}"? This
              action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteStory}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Dashboard;
