// src/AdminView.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";
import { motion, AnimatePresence } from "framer-motion";

// SVG Icons (keeping all the existing icons)
const AdminIcon = ({ className }) => (
  <svg
    className={`w-5 h-5 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const DocumentIcon = ({ className }) => (
  <svg
    className={`${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c0 .621-.504 1.125-1.125 1.125H9.375c-.621 0-1.125-.504-1.125-1.125V18.75m2.25-3l-3-3m3 3l-3 3m3-3H9"
    />
  </svg>
);

const ChevronDownIcon = ({ className }) => (
  <svg
    className={`w-5 h-5 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = ({ className }) => (
  <svg
    className={`w-5 h-5 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const UserIcon = ({ className }) => (
  <svg
    className={`w-4 h-4 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ClockIcon = ({ className }) => (
  <svg
    className={`w-4 h-4 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = ({ className }) => (
  <svg
    className={`w-4 h-4 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
  </svg>
);

// Helper function to safely convert timestamps to JavaScript Date objects
function safeTimestampToDate(timestamp) {
  try {
    // If it's already a Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // If it's a Firestore Timestamp with toDate method
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // If it's a number (Unix timestamp)
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    
    // If it's a string that can be parsed
    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    // Fallback to current date if all else fails
    console.warn('Could not parse timestamp:', timestamp, 'Using current date');
    return new Date();
  } catch (error) {
    console.error('Error converting timestamp:', error, timestamp);
    return new Date();
  }
}

export default function AdminView({ survey: passedSurvey }) {
  const { currentUser, logout } = useAuth();

  // List of all surveys (for filter boxes)
  const [surveys, setSurveys] = useState([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);

  // Which survey the admin has selected
  const [selectedSurveyId, setSelectedSurveyId] = useState(null);

  // Schema of the selected survey, and a map from questionId → question label
  const [surveySchema, setSurveySchema] = useState(null);
  const [questionMap, setQuestionMap] = useState({});

  // All responses for the selected survey
  const [responses, setResponses] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Which response accordion is currently open (use the response's Firestore ID)
  const [openResponseId, setOpenResponseId] = useState(null);

  // Error state
  const [error, setError] = useState(null);

  // --------------------------------------------
  // Early "admin" check
  // --------------------------------------------
  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-pink-100 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AdminIcon className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">Administrator privileges required to view this page.</p>
        </motion.div>
      </div>
    );
  }

  // --------------------------------------------
  // Fetch list of surveys on mount
  // --------------------------------------------
  useEffect(() => {
    async function fetchSurveys() {
      setLoadingSurveys(true);
      setError(null);
      try {
        console.log("🔍 Fetching surveys list...");
        const snapshot = await getDocs(collection(db, "surveys"));
        const list = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title || "Untitled Survey",
          };
        });
        console.log("✅ Surveys fetched:", list.length);
        setSurveys(list);
        
        // If a survey was passed from App.jsx, auto-select it
        if (passedSurvey && passedSurvey.id) {
          setSelectedSurveyId(passedSurvey.id);
        }
      } catch (err) {
        console.error("❌ Error fetching surveys:", err);
        setError("Failed to fetch surveys: " + err.message);
      }
      setLoadingSurveys(false);
    }

    fetchSurveys();
  }, [passedSurvey]);

  // --------------------------------------------
  // Whenever selectedSurveyId changes:
  // 1. Fetch that survey's schema & build questionMap
  // 2. Fetch all responses for that survey
  // --------------------------------------------
  useEffect(() => {
    if (!selectedSurveyId) {
      setSurveySchema(null);
      setQuestionMap({});
      setResponses([]);
      return;
    }

    async function fetchSurveyAndResponses() {
      setLoadingData(true);
      setError(null);

      try {
        console.log("🔍 Fetching survey schema for:", selectedSurveyId);
        
        // -- 1. Use passed survey if available, otherwise fetch --
        let schema;
        if (passedSurvey && passedSurvey.id === selectedSurveyId) {
          schema = passedSurvey;
          console.log("✅ Using passed survey schema");
        } else {
          const surveyDoc = await getDoc(doc(db, "surveys", selectedSurveyId));
          if (surveyDoc.exists()) {
            schema = surveyDoc.data();
            console.log("✅ Fetched survey schema from Firestore");
          } else {
            throw new Error("Survey not found");
          }
        }
        
        setSurveySchema(schema);

        // Build a questionId → question label map
        const qm = {};
        if (Array.isArray(schema.pages)) {
          schema.pages.forEach((page) => {
            if (Array.isArray(page.questions)) {
              page.questions.forEach((q) => {
                qm[q.id] = q.label || q.question || "Question";
              });
            }
          });
        }
        setQuestionMap(qm);
        console.log("✅ Survey schema loaded, questions found:", Object.keys(qm).length);

        // -- 2. Fetch responses for this survey --
        console.log("🔍 Fetching responses for survey:", selectedSurveyId);
        const q = query(
          collection(db, "responses"),
          where("surveyId", "==", selectedSurveyId)
        );
        const querySnapshot = await getDocs(q);
        console.log("📊 Found responses:", querySnapshot.size);
        
        const docs = [];

        for (let docSnap of querySnapshot.docs) {
          const data = docSnap.data();
          console.log("📄 Processing response:", docSnap.id, data);

          // Fetch the user's profile (to get email & username)
          let userInfo = { email: "Unknown", username: "Unknown" };
          try {
            if (data.userId) {
              const userDoc = await getDoc(doc(db, "users", data.userId));
              if (userDoc.exists()) {
                const ud = userDoc.data();
                userInfo = {
                  email: ud.email || "No email",
                  username: ud.username || ud.displayName || "Unnamed User",
                };
              }
            }
          } catch (e) {
            console.warn("⚠️ Could not fetch user info for:", data.userId, e);
          }

          // Get customer name from survey answers
          const answers = data.answers || {};
          const customerName = answers["customerName"] || answers["customer-name"] || answers["Customer Name"] || "";

          // Get the first field value as title
          let firstFieldTitle = "";
          if (schema?.pages) {
            for (const page of schema.pages) {
              if (page.questions && page.questions.length > 0) {
                const firstQuestion = page.questions[0];
                if (firstQuestion.id && answers[firstQuestion.id]) {
                  firstFieldTitle = answers[firstQuestion.id];
                  break;
                }
              }
            }
          }

          // Safely convert timestamp to Date
          const timestamp = safeTimestampToDate(data.timestamp);

          docs.push({
            id: docSnap.id,
            userId: data.userId,
            email: userInfo.email,
            customerName: customerName,
            firstFieldTitle: firstFieldTitle || "Untitled Submission",
            timestamp: timestamp,
            answers: answers,
          });
        }

        // Sort by timestamp (newest first)
        docs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        console.log("✅ Processed responses:", docs.length);
        setResponses(docs);
      } catch (err) {
        console.error("❌ Error fetching survey and responses:", err);
        setError("Failed to fetch survey data: " + err.message);
        setResponses([]);
        setSurveySchema(null);
        setQuestionMap({});
      }

      setLoadingData(false);
    }

    fetchSurveyAndResponses();
  }, [selectedSurveyId, passedSurvey]);

  // --------------------------------------------
  // Toggle accordion open/close
  // --------------------------------------------
  function handleAccordionToggle(respId) {
    setOpenResponseId((prev) => (prev === respId ? null : respId));
  }

  // --------------------------------------------
  // Group responses by date (YYYY-MM-DD)
  // --------------------------------------------
  function groupByDate(responseList) {
    const grouped = responseList.reduce((acc, resp) => {
      // Convert timestamp (JS Date) to ISO date string: "2025-06-01"
      const isoDate = resp.timestamp.toISOString().slice(0, 10);
      if (!acc[isoDate]) acc[isoDate] = [];
      acc[isoDate].push(resp);
      return acc;
    }, {});

    // Sort dates descending (newest date first)
    const sortedDates = Object.keys(grouped).sort((a, b) =>
      b.localeCompare(a)
    );

    return sortedDates.map((dateKey) => ({
      dateKey,
      responses: grouped[dateKey],
    }));
  }

  // --------------------------------------------
  // Calculate completion percentage for a response
  // --------------------------------------------
  function calculateCompletionPercentage(answers, schema) {
    if (!schema?.pages) return 0;

    let totalQuestions = 0;
    let answeredQuestions = 0;

    console.log("🔍 Calculating completion for answers:", answers);

    schema.pages.forEach((page, pageIndex) => {
      if (page.questions) {
        page.questions.forEach((question) => {
          // Skip questions that don't require answers
          if (question.type === "none" || question.type === "display" || question.type === "heading") {
            console.log(`⏭️ Skipping question ${question.id} (type: ${question.type})`);
            return;
          }

          // Check if question is conditionally visible
          let isVisible = true;
          if (question.visibleIf) {
            const conditionMet = answers[question.visibleIf.questionId] === question.visibleIf.value;
            if (!conditionMet) {
              console.log(`👁️ Question ${question.id} not visible (condition not met)`);
              isVisible = false;
            }
          }

          // Only count visible questions
          if (isVisible) {
            totalQuestions++;
            
            // Check if question has an answer and it's not empty
            const answer = answers[question.id];
            console.log(`❓ Question ${question.id} (${question.label}):`, answer);
            
            if (answer !== undefined && answer !== null && answer !== "") {
              // For arrays (checkboxes), check if not empty
              if (Array.isArray(answer)) {
                if (answer.length > 0) {
                  answeredQuestions++;
                  console.log(`✅ Question ${question.id} answered (array with ${answer.length} items)`);
                } else {
                  console.log(`❌ Question ${question.id} not answered (empty array)`);
                }
              } else {
                // For strings, check if not just whitespace
                if (typeof answer === 'string' && answer.trim() === '') {
                  console.log(`❌ Question ${question.id} not answered (empty string)`);
                } else {
                  answeredQuestions++;
                  console.log(`✅ Question ${question.id} answered:`, answer);
                }
              }
            } else {
              console.log(`❌ Question ${question.id} not answered (undefined/null/empty)`);
            }
          }
        });
      }
    });

    const percentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
    console.log(`📊 Completion: ${answeredQuestions}/${totalQuestions} = ${percentage}%`);
    
    return percentage;
  }

  // --------------------------------------------
  // Organize answers by page in survey order
  // --------------------------------------------
  function organizeAnswersByPage(answers, schema) {
    if (!schema?.pages) return [];

    return schema.pages.map((page, pageIndex) => {
      const pageAnswers = [];
      
      if (page.questions) {
        page.questions.forEach((question) => {
          if (answers.hasOwnProperty(question.id)) {
            pageAnswers.push({
              id: question.id,
              label: question.label || "Question",
              description: question.description || "",
              type: question.type || "text",
              value: answers[question.id]
            });
          }
        });
      }

      return {
        pageTitle: page.title || `Page ${pageIndex + 1}`,
        answers: pageAnswers
      };
    }).filter(page => page.answers.length > 0); // Only include pages with answers
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // --------------------------------------------
  // Modern branding bar for submissions
  // --------------------------------------------
  const BrandingBar = () => (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 py-6 px-8 flex justify-between items-center shadow-lg">
      <div className="flex items-center space-x-4">
        <img
          src="/logo.svg"
          alt="Company Logo"
          className="h-16 w-24"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <div className="flex items-center space-x-2">
          <AdminIcon className="text-white" />
          <span className="text-white font-semibold text-xl">Submissions</span>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-white/90 text-sm font-medium">
            {currentUser.displayName || currentUser.email}
          </span>
          {currentUser.role === "admin" && <span className="text-blue-300 text-xs">(admin)</span>}
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

  // --------------------------------------------
  // Render
  // --------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <BrandingBar />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Survey Selection Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 mb-8 overflow-hidden"
        >
          <div className="p-8">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-6">
              Select form
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {loadingSurveys ? (
                <div className="col-span-full text-center text-gray-600 py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  Loading forms...
                </div>
              ) : surveys.length === 0 ? (
                <div className="col-span-full text-center text-gray-600 py-8">
                  No forms found.
                </div>
              ) : (
                surveys.map((survey) => (
                  <motion.button
                    key={survey.id}
                    onClick={() => {
                      setSelectedSurveyId(survey.id);
                      setOpenResponseId(null);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 bg-white/50 backdrop-blur-sm p-6 h-40
                      ${
                        selectedSurveyId === survey.id
                          ? "border-blue-500 shadow-xl shadow-blue-500/20"
                          : "border-gray-200 hover:border-blue-300 hover:shadow-lg"
                      }
                    `}
                  >
                    {/* Background Gradient */}
                    <div className={`
                      absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                      ${selectedSurveyId === survey.id ? "opacity-100" : ""}
                    `}>
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100"></div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 h-full flex flex-col">
                      {/* Title */}
                      <h3 className={`
                        font-semibold text-left mb-2 transition-colors duration-300 flex-1
                        ${
                          selectedSurveyId === survey.id
                            ? "text-blue-900"
                            : "text-gray-700 group-hover:text-blue-800"
                        }
                      `}>
                        {survey.title}
                      </h3>

                      {/* Selected Indicator */}
                      {selectedSurveyId === survey.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center text-blue-600 text-sm font-medium"
                        >
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Selected
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* No survey selected state */}
        {!selectedSurveyId && !loadingSurveys && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 text-center"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AdminIcon className="text-white" />
            </div>
            <p className="text-gray-600 text-lg">Please select a form above to view responses.</p>
          </motion.div>
        )}

        {/* Loading responses state */}
        {selectedSurveyId && loadingData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 text-center"
          >
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading responses...</p>
          </motion.div>
        )}

        {/* Survey responses */}
        {selectedSurveyId && !loadingData && surveySchema && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Survey Header */}
            <motion.div
              className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 mb-8 overflow-hidden"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="p-8">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
                  {surveySchema.title || selectedSurveyId}
                </h3>
                <div className="flex items-center gap-4 text-gray-600">
                  <div className="flex items-center gap-2">
                    <UserIcon />
                    <span>{responses.length} {responses.length === 1 ? 'Response' : 'Responses'}</span>
                  </div>
                  {responses.length > 0 && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon />
                      <span>Latest: {responses[0]?.timestamp ? responses[0].timestamp.toLocaleDateString("en-GB") : 'N/A'}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {responses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 text-center"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserIcon className="text-white" />
                </div>
                <p className="text-gray-600 text-lg">No responses yet for this form.</p>
              </motion.div>
            ) : (
              // Group responses by date
              <div className="space-y-8">
                {groupByDate(responses).map(({ dateKey, responses: group }) => (
                  <motion.div
                    key={dateKey}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden"
                  >
                    {/* Date Header */}
                    <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-8 py-4 border-b border-gray-200/50">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="text-gray-600" />
                        <h4 className="text-lg font-semibold text-gray-800">
                          {new Date(dateKey).toLocaleDateString("en-GB", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </h4>
                        <span className="text-sm text-gray-600 bg-white/70 px-3 py-1 rounded-full">
                          {group.length} {group.length === 1 ? 'response' : 'responses'}
                        </span>
                      </div>
                    </div>

                    {/* Response Accordions */}
                    <div className="p-6 space-y-4">
                      <AnimatePresence>
                        {group.map((resp) => (
                          <motion.div
                            key={resp.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="border border-gray-200/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
                          >
                            {/* Accordion Header */}
                            <motion.div
                              className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-slate-700 to-slate-800 cursor-pointer hover:from-slate-600 hover:to-slate-700 transition-all duration-200"
                              onClick={() => handleAccordionToggle(resp.id)}
                              whileHover={{ backgroundColor: "rgba(51, 65, 85, 0.9)" }}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                  <UserIcon className="text-white w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <div className="font-bold text-white text-lg">{resp.firstFieldTitle}</div>
                                  <div className="font-semibold text-gray-200">{resp.customerName}</div>
                                  <div className="text-sm text-gray-300">{resp.email}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                  <ClockIcon />
                                  <span>
                                    {resp.timestamp.toLocaleTimeString("en-GB", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: false
                                    })}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-200">
                                    {calculateCompletionPercentage(resp.answers, surveySchema)}% Complete
                                  </div>
                                  <div className="w-24 bg-gray-600 rounded-full h-2 mt-1">
                                    <div 
                                      className="bg-gradient-to-r from-green-400 to-emerald-400 h-2 rounded-full transition-all duration-300"
                                      style={{ width: `${calculateCompletionPercentage(resp.answers, surveySchema)}%` }}
                                    ></div>
                                  </div>
                                </div>
                                <motion.div
                                  animate={{ rotate: openResponseId === resp.id ? 180 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronDownIcon className="text-gray-300" />
                                </motion.div>
                              </div>
                            </motion.div>

                            {/* Accordion Body */}
                            <AnimatePresence>
                              {openResponseId === resp.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-6 py-6 bg-gray-50/50 space-y-6">
                                    {/* Organize answers by page */}
                                    {organizeAnswersByPage(resp.answers, surveySchema).map((page, pageIndex) => (
                                      <motion.div 
                                        key={pageIndex} 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: pageIndex * 0.1 }}
                                        className="bg-white rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden"
                                      >
                                        {/* Page Card Header */}
                                        <div className="bg-gradient-to-r from-slate-100 to-blue-100 px-6 py-4 border-b border-gray-200/50">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center shadow-md">
                                              <span className="text-white font-bold text-lg">{pageIndex + 1}</span>
                                            </div>
                                            <div>
                                              <h5 className="text-xl font-bold text-gray-800">{page.pageTitle}</h5>
                                              <p className="text-sm text-gray-600">{page.answers.length} {page.answers.length === 1 ? 'question' : 'questions'}</p>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Page Card Content - Questions and Answers */}
                                        <div className="p-6 space-y-5">
                                          {page.answers.map((answer, answerIndex) => (
                                            <motion.div
                                              key={answer.id}
                                              initial={{ opacity: 0, x: -10 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              transition={{ delay: (pageIndex * 0.1) + (answerIndex * 0.05) }}
                                              className="bg-gradient-to-r from-gray-50/80 to-blue-50/30 rounded-xl p-5 border border-gray-200/30 hover:shadow-md transition-all duration-200"
                                            >
                                              <div className="flex items-start gap-4">
                                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                                                  <span className="text-white font-bold text-sm">Q</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="text-gray-700 font-medium mb-2 leading-relaxed">
                                                    {answer.label}
                                                  </div>
                                                  {answer.description && (
                                                    <div className="text-sm text-gray-500 mb-3 italic leading-relaxed">
                                                      {answer.description}
                                                    </div>
                                                  )}
                                                  <div className="bg-white/70 rounded-lg p-4 border border-gray-200/50">
                                                    <div className="text-gray-900 font-semibold break-words">
                                                      {Array.isArray(answer.value)
                                                        ? answer.value.length > 0 
                                                          ? answer.value.join(", ")
                                                          : "No selections made"
                                                        : answer.value || "No answer provided"}
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </motion.div>
                                          ))}
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}