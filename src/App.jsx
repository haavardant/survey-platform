import React, { useState, useEffect } from "react";
import SurveyForm from "./SurveyForm";
import SurveyEditor from "./SurveyEditor";
import AdminView from "./AdminView";
import Login from "./Login";
import { useAuth } from "./AuthProvider";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

// SVG Icons for the admin navigation
const FormBuilderIcon = ({ className }) => (
  <svg
    className={`w-4 h-4 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const LiveViewIcon = ({ className }) => (
  <svg
    className={`w-4 h-4 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const SubmissionsIcon = ({ className }) => (
  <svg
    className={`w-4 h-4 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export default function App() {
  const { currentUser } = useAuth();

  // List of all surveys and the selected survey
  const [surveys, setSurveys] = useState([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const [loadingSurveys, setLoadingSurveys] = useState(true);

  const [mode, setMode] = useState("live");
  const [liveSurvey, setLiveSurvey] = useState(null);

  // Load all surveys on mount
  useEffect(() => {
    if (!currentUser) return;
    setLoadingSurveys(true);
    getDocs(collection(db, "surveys")).then(snapshot => {
      const loaded = [];
      snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() }));
      setSurveys(loaded);
      // Default to the first survey if none is selected
      if (!selectedSurveyId && loaded.length > 0) {
        setSelectedSurveyId(loaded[0].id);
      }
      setLoadingSurveys(false);
    });
    // eslint-disable-next-line
  }, [currentUser]);

  // If not authenticated, show login
  if (!currentUser) {
    return <Login />;
  }

  // While loading surveys
  if (loadingSurveys || surveys.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading surveys...</div>
      </div>
    );
  }

  // Current survey object
  const survey = surveys.find(s => s.id === selectedSurveyId);

  // Admin logic
  const isAdmin = currentUser.role === "admin";
  const handlePreview = (editedSurvey) => {
    setMode("live");
    setLiveSurvey(editedSurvey);
  };
  const surveyToShow = mode === "live" && liveSurvey ? liveSurvey : survey;

  // For regular users
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <SurveyForm
          survey={survey}
          surveys={surveys}
          onSurveyChange={setSelectedSurveyId}
        />
      </div>
    );
  }

  // For admins
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Admin Navigation */}
      <div className="bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-center gap-2">
            <button
              onClick={() => {
                setLiveSurvey(null);
                setMode("editor");
              }}
              className={`
                px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 shadow-lg
                ${mode === "editor" 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl" 
                  : "bg-white/50 text-gray-700 hover:bg-white/80 hover:shadow-xl"
                }
              `}
            >
              <FormBuilderIcon className="text-current" />
              <span>Form Builder</span>
            </button>
            <button
              onClick={() => {
                setMode("live");
                setLiveSurvey(null);
              }}
              className={`
                px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 shadow-lg
                ${mode === "live" 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl" 
                  : "bg-white/50 text-gray-700 hover:bg-white/80 hover:shadow-xl"
                }
              `}
            >
              <LiveViewIcon className="text-current" />
              <span>Live View</span>
            </button>
            <button
              onClick={() => {
                setLiveSurvey(null);
                setMode("admin");
              }}
              className={`
                px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 shadow-lg
                ${mode === "admin" 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl" 
                  : "bg-white/50 text-gray-700 hover:bg-white/80 hover:shadow-xl"
                }
              `}
            >
              <SubmissionsIcon className="text-current" />
              <span>Submissions</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {mode === "editor" && (
          <SurveyEditor onPreview={handlePreview} survey={survey} />
        )}
        {mode === "live" && surveyToShow && (
          <SurveyForm
            survey={surveyToShow}
            surveys={surveys}
            onSurveyChange={setSelectedSurveyId}
          />
        )}
        {mode === "admin" && <AdminView survey={survey} />}
      </div>
    </div>
  );
}