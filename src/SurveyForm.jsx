import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "./AuthProvider";
import { addDoc, collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import { AnimatePresence, motion } from "framer-motion";

// Helper function to render formatted text
function renderFormattedText(text) {
  if (!text) return "";
  
  // Convert **bold** to <strong>
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Convert line breaks to <br>
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}

// Background color options (matching the editor)
const BACKGROUND_COLORS = {
  default: { value: 'default', color: '#f3f4f6', label: 'Light Grey', textColor: '#1f2937', shadow: null },
  green: { value: 'green', color: '#ecfdf5', label: 'Green', textColor: '#065f46', shadow: '0 0 0 1px rgba(34, 197, 94, 0.2)' },
  yellow: { value: 'yellow', color: '#fefce8', label: 'Yellow', textColor: '#92400e', shadow: '0 0 0 1px rgba(251, 191, 36, 0.2)' },
  red: { value: 'red', color: '#fef2f2', label: 'Red', textColor: '#991b1b', shadow: '0 0 0 1px rgba(239, 68, 68, 0.2)' }
};

// Get background color style with modern shadow
function getBackgroundColorStyle(backgroundColor) {
  const colorConfig = BACKGROUND_COLORS[backgroundColor] || BACKGROUND_COLORS.default;
  const style = { 
    backgroundColor: colorConfig.color,
    border: 'none'
  };
  
  // Add subtle border for colored backgrounds
  if (backgroundColor !== 'default' && colorConfig.shadow) {
    style.boxShadow = `${colorConfig.shadow}, 0 4px 6px -1px rgba(0, 0, 0, 0.1)`;
  } else {
    style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
  }
  
  return style;
}

// Replace the entire VideoPlayer component in SurveyForm.jsx with this:

// Video Player Component - Sync Detection Removed
const VideoPlayer = ({ videoUrl, questionLabel, isFullWidth = false }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(false);
  
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);

  // Icons
  const RefreshIcon = ({ className }) => (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );

  // Reset function
  const resetVideo = async (e) => {
    // Prevent form submission
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const wasPlaying = !video.paused;
    const savedTime = video.currentTime;
    
    console.log('🔄 Resetting video');
    
    try {
      // Pause and reset
      video.pause();
      setIsPlaying(false);
      
      // Force a complete reload
      const originalSrc = video.src;
      video.src = '';
      video.load();
      
      // Restore source and position
      video.src = originalSrc;
      video.currentTime = savedTime;
      
      // If it was playing, resume after a short delay
      if (wasPlaying) {
        setTimeout(async () => {
          try {
            video.currentTime = savedTime;
            await video.play();
            setIsPlaying(true);
          } catch (error) {
            console.error('Error resuming playback after reset:', error);
          }
        }, 200);
      }
    } catch (error) {
      console.error('Error during video reset:', error);
    }
  };

  // Video event handlers
  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    console.error('Video playback error');
  };

  const handlePlay = async () => {
    setIsPlaying(true);
    
    // Ensure audio context is resumed (for autoplay policies)
    if (videoRef.current && videoRef.current.audioTracks) {
      try {
        for (let i = 0; i < videoRef.current.audioTracks.length; i++) {
          videoRef.current.audioTracks[i].enabled = true;
        }
      } catch (e) {
        // Audio tracks API not supported in all browsers
      }
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    
    // Reset video completely to prevent issues on replay
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.load();
      }
    }, 100);
  };

  const handleSeek = (e) => {
    // Prevent form submission
    e.preventDefault();
    e.stopPropagation();
    
    if (!videoRef.current || !progressBarRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const togglePlay = async (e) => {
    // Prevent form submission
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!videoRef.current) return;
    
    try {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Error toggling play state:', error);
      setHasError(true);
    }
  };

  const handleVolumeChange = (e) => {
    // Prevent form submission
    e.preventDefault();
    e.stopPropagation();
    
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleVideoClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePlay(e);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!videoUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={isFullWidth ? "" : "mb-6"}
    >
      <div 
        className={`relative bg-black overflow-hidden shadow-lg group ${
          isFullWidth ? "rounded-xl" : "rounded-xl"
        }`}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              <span className="text-white text-sm">Loading video...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {hasError ? (
          <div className="aspect-video flex items-center justify-center bg-gray-100 text-gray-500">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">Unable to load video</p>
              <button 
                type="button"
                onClick={() => {
                  setHasError(false);
                  setIsLoading(true);
                  if (videoRef.current) {
                    videoRef.current.load();
                  }
                }}
                className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Video Element */}
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full aspect-video cursor-pointer"
              preload="auto"
              playsInline
              onLoadStart={handleLoadStart}
              onCanPlay={handleCanPlay}
              onError={handleError}
              onPlay={handlePlay}
              onPause={handlePause}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onClick={handleVideoClick}
              aria-label={`Video for question: ${questionLabel}`}
            >
              Your browser does not support the video tag.
            </video>

            {/* Branding Overlay */}
            <div className="absolute top-3 right-3 z-10 pointer-events-none">
              <img
                src="/logo.svg"
                alt="Company Logo"
                className="h-10 w-15 opacity-60 transition-opacity duration-300 p-2 m-2"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>

            {/* Custom Controls Overlay */}
            <div className={`
              absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-30
              transition-opacity duration-300 ${showControls || isLoading ? 'opacity-100' : 'opacity-0'}
            `}>
              {/* Progress Bar */}
              <div 
                ref={progressBarRef}
                className="w-full h-2 bg-white/30 rounded-full mb-3 cursor-pointer"
                onClick={handleSeek}
              >
                <div 
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* Play/Pause Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      togglePlay(e);
                    }}
                    className="text-white hover:text-gray-300 transition-colors"
                  >
                    {isPlaying ? (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                      </svg>
                    ) : (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>

                  {/* Time Display */}
                  <span className="text-white text-sm font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  {/* Volume Control */}
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h2l5 5V0L9 5z" />
                    </svg>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      onClick={(e) => e.stopPropagation()}
                      className="w-16 h-1 bg-white/30 rounded-full appearance-none slider"
                      style={{
                        background: `linear-gradient(to right, #fff 0%, #fff ${volume * 100}%, rgba(255,255,255,0.3) ${volume * 100}%, rgba(255,255,255,0.3) 100%)`
                      }}
                    />
                  </div>
                </div>

                {/* Reset Button */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={resetVideo}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
                    title="Reset video"
                  >
                    <RefreshIcon />
                  </button>
                </div>
              </div>
            </div>

            {/* Center Play Button (when paused) */}
            {!isPlaying && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-16 h-16 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
                >
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

// Get text color for the background
function getTextColorStyle(backgroundColor) {
  const colorConfig = BACKGROUND_COLORS[backgroundColor] || BACKGROUND_COLORS.default;
  return { color: colorConfig.textColor };
}

// Accept surveys and onSurveyChange as props!
export default function SurveyForm({ survey, surveys = [], onSurveyChange }) {
  const { currentUser, logout } = useAuth();
  
  // ALL HOOKS MUST BE DECLARED FIRST - BEFORE ANY CONDITIONAL RETURNS
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingResponseId, setExistingResponseId] = useState(null);
  const [isUpdate, setIsUpdate] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [displayedPercent, setDisplayedPercent] = useState(0);

  // Safe access with fallbacks
  const totalPages = survey?.pages?.length || 1;
  const currentPage = survey?.pages?.[currentPageIndex] || { title: "Loading...", questions: [] };
  const questionsOnPage = currentPage.questions || [];

  // Map of questions for computing depth (for nested conditional questions)
  const questionMap = useMemo(() => {
    const map = new Map();
    if (questionsOnPage && Array.isArray(questionsOnPage)) {
      questionsOnPage.forEach((q) => map.set(q.id, q));
    }
    return map;
  }, [questionsOnPage]);

  // Update displayedPercent when currentPageIndex changes
  useEffect(() => {
    const target = Math.round(((currentPageIndex + 1) / totalPages) * 100);
    setDisplayedPercent(target);
  }, [currentPageIndex, totalPages]);

  // Fetch existing response when component mounts or survey changes
  useEffect(() => {
    const fetchExistingResponse = async () => {
      if (!survey?.id || !currentUser?.uid) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const q = query(
          collection(db, "responses"),
          where("surveyId", "==", survey.id),
          where("userId", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // User has already submitted this survey
          const responseDoc = querySnapshot.docs[0];
          const responseData = responseDoc.data();
          
          setAnswers(responseData.answers || {});
          setExistingResponseId(responseDoc.id);
          setIsUpdate(true);
        } else {
          // No existing response, start fresh
          setAnswers({});
          setExistingResponseId(null);
          setIsUpdate(false);
        }
      } catch (error) {
        console.error("Error fetching existing response:", error);
        // If there's an error, start fresh
        setAnswers({});
        setExistingResponseId(null);
        setIsUpdate(false);
      }
      setLoading(false);
    };

    fetchExistingResponse();
  }, [survey?.id, currentUser?.uid]);

  // NOW CONDITIONAL RETURNS ARE SAFE
  // Early validation
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to access the survey.</p>
        </div>
      </div>
    );
  }

  if (!survey || !survey.pages || !Array.isArray(survey.pages) || survey.pages.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Survey not found or invalid survey structure.</p>
        </div>
      </div>
    );
  }

  const userId = currentUser.uid;

  // Enhanced function to get question depth and parent relationships
  function getQuestionHierarchy(questionId, visited = new Set()) {
    const q = questionMap.get(questionId);
    if (!q || visited.has(questionId)) {
      return { depth: 0, parents: [] };
    }
    
    visited.add(questionId);
    
    if (!q.visibleIf) {
      return { depth: 0, parents: [] };
    }

    // Handle multiple conditions
    if (q.visibleIf.conditions && Array.isArray(q.visibleIf.conditions)) {
      // For multiple conditions, use the first condition's parent for visual hierarchy
      const firstCondition = q.visibleIf.conditions[0];
      if (firstCondition?.questionId) {
        const parentHierarchy = getQuestionHierarchy(firstCondition.questionId, visited);
        return {
          depth: parentHierarchy.depth + 1,
          parents: [...parentHierarchy.parents, firstCondition.questionId]
        };
      }
    }

    // Handle single condition
    if (q.visibleIf.questionId) {
      const parentHierarchy = getQuestionHierarchy(q.visibleIf.questionId, visited);
      return {
        depth: parentHierarchy.depth + 1,
        parents: [...parentHierarchy.parents, q.visibleIf.questionId]
      };
    }

    return { depth: 0, parents: [] };
  }

  function getQuestionDepth(questionId, visited = new Set()) {
    return getQuestionHierarchy(questionId, visited).depth;
  }

  // Enhanced function to check if a question should be visible
  function isQuestionVisible(question, answers) {
    if (!question.visibleIf) {
      return true; // Always visible if no conditions
    }

    console.log(`🔍 Checking visibility for question ${question.id}:`, question.visibleIf);
    console.log(`📋 Current answers:`, answers);

    // Handle multiple conditions (AND/OR logic)
    if (question.visibleIf.conditions && Array.isArray(question.visibleIf.conditions)) {
      const operator = question.visibleIf.operator || "AND";
      console.log(`🔗 Multiple conditions with ${operator} operator:`, question.visibleIf.conditions);
      
      const results = question.visibleIf.conditions.map(condition => {
        if (!condition.questionId || condition.value === undefined || condition.value === null) {
          console.log(`❌ Invalid condition:`, condition);
          return false;
        }
        const result = answers[condition.questionId] === condition.value;
        console.log(`   ${condition.questionId} === "${condition.value}"? ${result} (actual: "${answers[condition.questionId]}")`);
        return result;
      });

      let finalResult;
      if (operator === "AND") {
        finalResult = results.every(result => result === true);
      } else if (operator === "OR") {
        finalResult = results.some(result => result === true);
      } else {
        finalResult = false;
      }
      
      console.log(`🎯 Final result for ${question.id}: ${finalResult}`);
      return finalResult;
    }

    // Handle single condition (legacy format)
    if (question.visibleIf.questionId) {
      if (question.visibleIf.value === undefined || question.visibleIf.value === null) {
        console.log(`❌ Invalid single condition value for ${question.id}`);
        return false;
      }
      
      const result = answers[question.visibleIf.questionId] === question.visibleIf.value;
      console.log(`🎯 Single condition for ${question.id}: ${question.visibleIf.questionId} === "${question.visibleIf.value}"? ${result} (actual: "${answers[question.visibleIf.questionId]}")`);
      return result;
    }

    console.log(`❌ Malformed condition for ${question.id}, hiding question`);
    return false; // Hide if condition exists but is malformed
  }

  const handleAnswerChange = (questionId, value) => {
    console.log(`💾 Answer changed - Question ID: ${questionId}, Value:`, value, typeof value);
    
    setAnswers((prev) => {
      const newAnswers = {
        ...prev,
        [questionId]: value,
      };

      // Clear answers for questions that are no longer visible due to this change
      const clearedAnswers = { ...newAnswers };
      
      // Check all questions on current page to see if they should be cleared
      questionsOnPage.forEach((q) => {
        if (q.visibleIf && !isQuestionVisible(q, newAnswers)) {
          // This question is no longer visible, clear its answer
          delete clearedAnswers[q.id];
          console.log(`🧹 Cleared answer for question ${q.id} (no longer visible)`);
        }
      });

      console.log(`📦 Updated answers state:`, clearedAnswers);
      return clearedAnswers;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!survey?.id) {
      console.error("No survey ID available");
      return;
    }
    
    // Comprehensive debug logging
    console.log("🚀 FORM SUBMISSION DEBUG:");
    console.log("📝 All answers being submitted:", answers);
    console.log("📊 Total answers:", Object.keys(answers).length);
    
    // Log all questions across all pages
    const allQuestions = [];
    survey.pages.forEach((page, pageIndex) => {
      if (page.questions) {
        page.questions.forEach(q => {
          allQuestions.push({
            id: q.id,
            type: q.type,
            label: q.label,
            page: pageIndex + 1,
            hasAnswer: answers[q.id] !== undefined,
            value: answers[q.id]
          });
        });
      }
    });
    
    console.log("📋 All questions in survey:", allQuestions);
    console.log("❌ Questions without answers:", 
      allQuestions.filter(q => !q.hasAnswer).map(q => ({id: q.id, label: q.label, page: q.page}))
    );
    console.log("✅ Questions with answers:", 
      allQuestions.filter(q => q.hasAnswer).map(q => ({id: q.id, value: q.value, page: q.page}))
    );
    
    setSubmitting(true);
    try {
      if (isUpdate && existingResponseId) {
        // Update existing response
        await updateDoc(doc(db, "responses", existingResponseId), {
          answers,
          timestamp: Date.now(),
        });
        console.log("✅ Response updated successfully");
      } else {
        // Create new response
        const docRef = await addDoc(collection(db, "responses"), {
          surveyId: survey.id,
          userId,
          answers,
          timestamp: Date.now(),
        });
        console.log("✅ New response created with ID:", docRef.id);
      }
      setSubmitted(true);
    } catch (err) {
      console.error("❌ Error submitting response:", err);
    }
    setSubmitting(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Modern branding bar JSX
  const BrandingBar = () => (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 py-6 px-8 flex justify-between items-center shadow-lg">
      <div className="flex items-center space-x-4">
        <img
          src="/logo.svg"
          alt="Company Logo"
          className="h-16 w-24"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <span className="text-white font-semibold text-xl">Survey Platform</span>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-white/90 text-sm font-medium">
            {currentUser.displayName || currentUser.email}
          </span>
          {currentUser.isAdmin && <span className="text-blue-300 text-xs">(admin)</span>}
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          title="Logout"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
            />
          </svg>
        </button>
      </div>
    </div>
  );

  // Render question card with modern styling and hierarchy
  const renderQuestionCard = (q, hierarchy) => {
    // Ensure backgroundColor exists (backward compatibility)
    const backgroundColor = q.backgroundColor || 'default';
    const { depth, parents } = hierarchy;
    const marginLeft = depth * 32; // Increased indentation for better visibility
    
    // Check if this is a video-only question (no title and no description)
    const hasTitle = q.label && q.label.trim() !== "" && q.label !== "Untitled Question";
    const hasDescription = q.description && q.description.trim() !== "";
    const hasInput = q.type !== "none";
    const isVideoOnly = q.videoUrl && !hasTitle && !hasDescription && !hasInput;
    
    return (
      <div className="relative">
        {/* Hierarchy Lines */}
        {depth > 0 && !isVideoOnly && (
          <div className="absolute left-0 top-0 bottom-0 pointer-events-none">
            {/* Vertical line from parent */}
            <div 
              className="absolute bg-gray-300 opacity-60"
              style={{
                left: `${marginLeft - 16}px`,
                top: '-20px',
                bottom: '50%',
                width: '2px'
              }}
            />
            {/* Horizontal line to question */}
            <div 
              className="absolute bg-gray-300 opacity-60"
              style={{
                left: `${marginLeft - 16}px`,
                top: '50%',
                width: '14px',
                height: '2px'
              }}
            />
            {/* Connection dots for multiple levels */}
            {Array.from({ length: depth }, (_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-gray-400 rounded-full opacity-60"
                style={{
                  left: `${(i + 1) * 32 - 17}px`,
                  top: 'calc(50% - 4px)'
                }}
              />
            ))}
          </div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={`overflow-hidden backdrop-blur-sm relative z-10 ${
            isVideoOnly ? "rounded-xl" : "rounded-xl"
          }`}
          style={{
            marginLeft: isVideoOnly ? '0px' : `${marginLeft}px`,
            ...(isVideoOnly ? {} : getBackgroundColorStyle(backgroundColor))
          }}
        >
          {/* Video-only layout */}
          {isVideoOnly ? (
            <VideoPlayer 
              videoUrl={q.videoUrl} 
              questionLabel={q.label || "Video"}
              isFullWidth={true}
            />
          ) : (
            /* Regular question layout */
            <div className="p-6">
              {/* Video Player (with margin if not video-only) */}
              <VideoPlayer 
                videoUrl={q.videoUrl} 
                questionLabel={q.label}
                isFullWidth={false}
              />
              
              {hasTitle && (
                <label 
                  className="block text-xl font-semibold mb-3 leading-tight"
                  style={getTextColorStyle(backgroundColor)}
                >
                  {q.label}
                </label>
              )}
              
              {hasDescription && (
                <div 
                  className="mb-6 text-base leading-relaxed opacity-80"
                  style={getTextColorStyle(backgroundColor)}
                  dangerouslySetInnerHTML={{ __html: renderFormattedText(q.description) }}
                />
              )}
              
              {/* Only render input fields if not "none" type */}
              {hasInput && (
                <div className="space-y-4">
                  {/* Input fields with modern styling */}
                  {q.type === "text" && (
                    <input
                      type="text"
                      value={answers[q.id] || ""}
                      onChange={(e) =>
                        handleAnswerChange(q.id, e.target.value)
                      }
                      className="w-full px-4 py-3 rounded-lg border-0 bg-white/70 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all duration-200 placeholder-gray-500"
                      placeholder="Type your answer here..."
                    />
                  )}
                  {q.type === "textarea" && (
                    <textarea
                      value={answers[q.id] || ""}
                      onChange={(e) =>
                        handleAnswerChange(q.id, e.target.value)
                      }
                      className="w-full px-4 py-3 rounded-lg border-0 bg-white/70 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all duration-200 placeholder-gray-500 resize-none"
                      placeholder="Type your detailed answer here..."
                      rows={6}
                    />
                  )}
                  {q.type === "radio" && (
                    <div className="space-y-3">
                      {q.options && q.options.map((opt, idx) => (
                        <label 
                          key={idx} 
                          className="flex items-center group cursor-pointer"
                          style={getTextColorStyle(backgroundColor)}
                        >
                          <div className="relative">
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={answers[q.id] === opt}
                              onChange={() => handleAnswerChange(q.id, opt)}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                              answers[q.id] === opt 
                                ? 'border-blue-500 bg-blue-500' 
                                : 'border-gray-300 group-hover:border-blue-400'
                            }`}>
                              {answers[q.id] === opt && (
                                <div className="w-2 h-2 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                              )}
                            </div>
                          </div>
                          <span className="ml-3 text-base group-hover:text-opacity-80 transition-opacity duration-200">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "checkbox" && (
                    <div className="space-y-3">
                      {q.options && q.options.map((opt, idx) => {
                        const arr = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                        const isChecked = arr.includes(opt);
                        return (
                          <label 
                            key={idx} 
                            className="flex items-center group cursor-pointer"
                            style={getTextColorStyle(backgroundColor)}
                          >
                            <div className="relative">
                              <input
                                type="checkbox"
                                name={q.id}
                                value={opt}
                                checked={isChecked}
                                onChange={(e) => {
                                  let newArray = arr.slice();
                                  if (e.target.checked) {
                                    newArray.push(opt);
                                  } else {
                                    newArray = newArray.filter((o) => o !== opt);
                                  }
                                  handleAnswerChange(q.id, newArray);
                                }}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded border-2 transition-all duration-200 ${
                                isChecked 
                                  ? 'border-blue-500 bg-blue-500' 
                                  : 'border-gray-300 group-hover:border-blue-400'
                              }`}>
                                {isChecked && (
                                  <svg className="w-3 h-3 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="ml-3 text-base group-hover:text-opacity-80 transition-opacity duration-200">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {q.type === "dropdown" && (
                    <div className="relative">
                      <select
                        value={answers[q.id] || ""}
                        onChange={(e) =>
                          handleAnswerChange(q.id, e.target.value)
                        }
                        className="w-full px-4 py-3 rounded-lg border-0 bg-white/70 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all duration-200 appearance-none cursor-pointer"
                      >
                        <option value="" disabled className="text-gray-500">
                          Choose an option...
                        </option>
                        {q.options && q.options.map((opt, idx) => (
                          <option key={idx} value={opt} className="text-gray-900">
                            {opt}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <BrandingBar />
        <div className="flex justify-center items-center min-h-[80vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-12 text-center"
          >
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading survey...</p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <BrandingBar />
        <div className="flex justify-center items-center min-h-[80vh] px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl w-full bg-white/70 backdrop-blur-xl p-12 rounded-3xl shadow-2xl border border-white/20"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full mx-auto mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                {isUpdate ? "Updated Successfully!" : "Thank You!"}
              </h2>
              <p className="text-gray-600 text-lg">
                {isUpdate 
                  ? "Your responses have been successfully updated."
                  : "Your responses have been successfully recorded."
                }
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const goNext = () => {
    console.log("🚀 Going to next page. Current answers:", answers);
    console.log("📋 Current page questions answered:", 
      questionsOnPage.filter(q => answers[q.id] !== undefined).length,
      "out of", questionsOnPage.length
    );
    
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex((idx) => idx + 1);
    }
  };

  const goBack = () => {
    console.log("⬅️ Going to previous page. Current answers:", answers);
    if (currentPageIndex > 0) {
      setCurrentPageIndex((idx) => idx - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Modern Branding Bar */}
      <BrandingBar />

      {/* Main Content */}
      <div className="flex justify-center px-4">
        <div className="w-full max-w-4xl">
          
          {/* Survey Header Card */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 mt-8 mb-6 overflow-hidden"
          >
            <div className="p-8">
              {/* Survey Title & Switcher */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    {survey.title}
                  </h1>
                  {isUpdate && (
                    <p className="text-sm text-blue-600 mt-2 font-medium">
                      ✓ You have already submitted this survey. Any changes will update your previous response.
                    </p>
                  )}
                </div>
                {surveys.length > 1 && onSurveyChange && (
                  <div className="relative">
                    <select
                      className="px-4 py-2 rounded-xl border-0 bg-white/50 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 appearance-none cursor-pointer pr-10"
                      value=""
                      onChange={e => {
                        if (e.target.value) {
                          onSurveyChange(e.target.value);
                          e.target.value = ""; // Reset to show default text
                        }
                      }}
                    >
                      <option value="" disabled>
                        Select different form
                      </option>
                      {surveys.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                    
                    {/* Custom dropdown arrow */}
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Simple Modern Progress Bar */}
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Progress
                  </span>
                  <motion.span 
                    className="text-sm font-semibold text-blue-600"
                    key={displayedPercent}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {displayedPercent}%
                  </motion.span>
                </div>
                
                <div className="relative h-4 bg-gray-200/60 rounded-full overflow-hidden backdrop-blur-sm">
                  <motion.div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${displayedPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                  />
                  
                  {/* Step indicator lines */}
                  {totalPages > 1 && Array.from({ length: totalPages - 1 }).map((_, idx) => {
                    const position = ((idx + 1) / totalPages) * 100;
                    return (
                      <div
                        key={idx}
                        className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-10"
                        style={{ left: `${position}%` }}
                      />
                    );
                  })}
                  
                  {/* Subtle shine effect */}
                  <motion.div
                    className="absolute top-0 left-0 h-full w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full"
                    animate={{ x: [-32, 300] }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      repeatDelay: 3,
                      ease: "easeInOut" 
                    }}
                  />
                </div>
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Step {currentPageIndex + 1} of {totalPages}</span>
                  <span>{currentPage.title}</span>
                </div>
              </div>

              {/* Header Navigation Buttons */}
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={currentPageIndex === 0}
                  className={`
                    px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 text-sm
                    ${currentPageIndex === 0 
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                      : "bg-white/50 text-gray-700 hover:bg-white/80 hover:shadow-md"
                    }
                  `}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Previous</span>
                </button>

                {currentPageIndex < totalPages - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-md transition-all duration-200 flex items-center space-x-2 text-sm"
                  >
                    <span>Next</span>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                ) : (
                  <div className="w-20"></div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Question Card */}
          <motion.div
            key={currentPageIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
            className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 mb-8 overflow-hidden"
          >
            <div className="p-8">
              <motion.h2 
                className="text-2xl font-bold text-gray-800 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {currentPage.title}
              </motion.h2>

              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  {questionsOnPage.map((q, index) => {
                    const isVisible = isQuestionVisible(q, answers);
                    const hierarchy = getQuestionHierarchy(q.id);

                    if (!q.visibleIf) {
                      return (
                        <motion.div 
                          key={q.id} 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          {renderQuestionCard(q, hierarchy)}
                        </motion.div>
                      );
                    }

                    // Conditional question animation
                    return (
                      <AnimatePresence key={q.id} mode="wait">
                        {isVisible && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, y: -10 }}
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -10 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          >
                            {renderQuestionCard(q, hierarchy)}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    );
                  })}
                </div>

                {/* Modern Navigation Buttons */}
                <div className="flex justify-between mt-12">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={currentPageIndex === 0}
                    className={`
                      px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2
                      ${currentPageIndex === 0 
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                        : "bg-white/50 text-gray-700 hover:bg-white/80 hover:shadow-lg hover:scale-105"
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Previous</span>
                  </button>

                  {currentPageIndex < totalPages - 1 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      className="px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center space-x-2"
                    >
                      <span>Next</span>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`
                        px-8 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2
                        ${
                          submitting
                            ? "bg-gray-400 text-white cursor-not-allowed"
                            : "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 hover:shadow-lg hover:scale-105"
                        }
                      `}
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                          </svg>
                          <span>{isUpdate ? "Updating..." : "Submitting..."}</span>
                        </>
                      ) : (
                        <>
                          <span>{isUpdate ? "Update Survey" : "Submit Survey"}</span>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}