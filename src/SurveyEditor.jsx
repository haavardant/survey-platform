// src/SurveyEditor.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { motion, AnimatePresence } from "framer-motion";
import VideoUpload from "./VideoUpload";
import { Icon } from "./Icons";

// Helper function to render formatted text
const renderFormattedText = (text) => {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
};

// Formatting toolbar component
const FormattingToolbar = ({ onFormat, textareaRef }) => {
  const formatText = (formatType) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    const selectedText = value.substring(start, end);
    
    const formats = {
      bold: `**${selectedText}**`,
      italic: `*${selectedText}*`
    };
    
    const formattedText = formats[formatType];
    if (!formattedText) return;
    
    const newValue = value.substring(0, start) + formattedText + value.substring(end);
    onFormat(newValue);
    
    setTimeout(() => {
      textarea.focus();
      const newPos = selectedText ? start + formattedText.length : start + (formatType === 'bold' ? 2 : 1);
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  return (
    <div className="flex items-center gap-2 mt-2 p-2 bg-gray-50/80 rounded-lg border border-gray-200/50">
      <span className="text-xs font-medium text-gray-600 mr-2">Format:</span>
      {[
        { type: 'bold', label: 'B', title: 'Bold (surround with **)' },
        { type: 'italic', label: 'I', title: 'Italic (surround with *)' }
      ].map(({ type, label, title }) => (
        <button
          key={type}
          type="button"
          onClick={() => formatText(type)}
          className={`px-2 py-1 text-xs ${type === 'bold' ? 'font-bold' : 'italic'} bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors`}
          title={title}
        >
          {type === 'bold' ? <strong>{label}</strong> : <em>{label}</em>}
        </button>
      ))}
      <div className="text-xs text-gray-500 ml-2">
        Select text then click format, or type **bold**, *italic*
      </div>
    </div>
  );
};

// Constants
const BACKGROUND_COLORS = {
  default: { value: 'default', color: 'rgb(244, 245, 247)', label: 'Light Grey', shadow: null },
  green: { value: 'green', color: '#ecfdf5', label: 'Green', shadow: '0 0 0 1px rgba(34, 197, 94, 0.2)' },
  yellow: { value: 'yellow', color: '#fefce8', label: 'Yellow', shadow: '0 0 0 1px rgba(251, 191, 36, 0.2)' },
  red: { value: 'red', color: '#fef2f2', label: 'Red', shadow: '0 0 0 1px rgba(239, 68, 68, 0.2)' }
};

const QUESTION_TYPES = [
  { value: 'text', label: 'Text Input', icon: 'text' },
  { value: 'textarea', label: 'Text Area', icon: 'textarea' },
  { value: 'radio', label: 'Radio Buttons', icon: 'radio' },
  { value: 'checkbox', label: 'Checkboxes', icon: 'checkbox' },
  { value: 'dropdown', label: 'Dropdown Menu', icon: 'dropdown' },
  { value: 'none', label: 'No Input', icon: 'none' }
];

// Utility functions
const getQuestionDepth = (questionId, allQuestionsMap, visited = new Set()) => {
  const question = allQuestionsMap.get(questionId);
  if (!question || !question.visibleIf?.questionId || visited.has(questionId)) return 0;
  visited.add(questionId);
  return 1 + getQuestionDepth(question.visibleIf.questionId, allQuestionsMap, visited);
};

const getIconColor = (backgroundColor) => backgroundColor === 'yellow' ? '#000000' : '#374151';

const getBackgroundColorStyle = (backgroundColor) => {
  const colorConfig = BACKGROUND_COLORS[backgroundColor] || BACKGROUND_COLORS.default;
  const style = { 
    backgroundColor: colorConfig.color,
    border: 'none'
  };
  
  if (backgroundColor !== 'default' && colorConfig.shadow) {
    style.boxShadow = `${colorConfig.shadow}, 0 4px 6px -1px rgba(0, 0, 0, 0.1)`;
  } else {
    style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
  }
  
  return style;
};

export default function SurveyEditor({ onPreview }) {
  const { currentUser, logout } = useAuth();
  const [surveysList, setSurveysList] = useState([]);
  const [currentSurveyId, setCurrentSurveyId] = useState(null);
  const [surveyData, setSurveyData] = useState(null);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [textareaRefs, setTextareaRefs] = useState({});

  const defaultSurveyTemplate = {
    id: "",
    title: "Untitled Survey",
    pages: [{
      title: "Page 1",
      questions: [{
        id: "q1",
        label: "Untitled Question",
        description: "",
        type: "text",
        options: [],
        backgroundColor: "default",
        videoUrl: "",
      }],
    }],
  };

  // Fetch surveys list
  useEffect(() => {
    const fetchSurveysList = async () => {
      setLoadingSurveys(true);
      try {
        const snapshot = await getDocs(collection(db, "surveys"));
        const list = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          title: docSnap.data().title || "Untitled",
        }));
        setSurveysList(list);
        if (list.length > 0) setCurrentSurveyId(list[0].id);
      } catch (err) {
        console.error("Error fetching surveys list:", err);
      }
      setLoadingSurveys(false);
    };
    fetchSurveysList();
  }, []);

  // Fetch current survey data
  useEffect(() => {
    if (!currentSurveyId) {
      setSurveyData(null);
      return;
    }
    const fetchSurveyData = async () => {
      setLoadingCurrent(true);
      try {
        const snap = await getDoc(doc(db, "surveys", currentSurveyId));
        setSurveyData(snap.exists() ? snap.data() : { ...defaultSurveyTemplate, id: currentSurveyId });
      } catch (err) {
        console.error("Error fetching survey data:", err);
        setSurveyData({ ...defaultSurveyTemplate, id: currentSurveyId });
      }
      setLoadingCurrent(false);
    };
    fetchSurveyData();
  }, [currentSurveyId]);

  // Action handlers
  const createNewSurvey = async () => {
    const newId = `survey_${Date.now()}`;
    const newSurvey = { ...defaultSurveyTemplate, id: newId, title: "Untitled Survey" };
    try {
      await setDoc(doc(db, "surveys", newId), newSurvey);
      setSurveysList(prev => [...prev, { id: newId, title: newSurvey.title }]);
      setCurrentSurveyId(newId);
    } catch (err) {
      console.error("Error creating new survey:", err);
      alert("Failed to create new survey.");
    }
  };

  const saveSurvey = async () => {
    if (!surveyData?.id) return;
    try {
      await setDoc(doc(db, "surveys", surveyData.id), surveyData);
      setSurveysList(prev => prev.map(s => s.id === surveyData.id ? { id: s.id, title: surveyData.title } : s));
      alert("Survey saved!");
    } catch (e) {
      console.error("Error saving survey:", e);
      alert("Failed to save survey");
    }
  };

  const updateSurvey = (updates) => setSurveyData(prev => ({ ...prev, ...updates }));
  
  const updatePage = (pageIndex, updates) => {
    const pages = [...surveyData.pages];
    pages[pageIndex] = { ...pages[pageIndex], ...updates };
    updateSurvey({ pages });
  };

  const updateQuestion = (pageIndex, qIndex, updates) => {
    const pages = [...surveyData.pages];
    pages[pageIndex].questions[qIndex] = { ...pages[pageIndex].questions[qIndex], ...updates };
    updateSurvey({ pages });
  };

  const moveItem = (items, index, direction) => {
    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newItems.length) {
      [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    }
    return newItems;
  };

  const addQuestion = (pageIndex) => {
    const pages = [...surveyData.pages];
    pages[pageIndex].questions.push({
      id: `q${Date.now()}`,
      label: "New Question",
      description: "",
      type: "text",
      options: [],
      backgroundColor: "default",
      videoUrl: "",
    });
    updateSurvey({ pages });
  };

  const deleteQuestion = (pageIndex, qIndex) => {
    const question = surveyData.pages[pageIndex].questions[qIndex];
    if (window.confirm(`Are you sure you want to delete "${question.label}"?`)) {
      const pages = [...surveyData.pages];
      pages[pageIndex].questions.splice(qIndex, 1);
      updateSurvey({ pages });
    }
  };

  const addPage = () => {
    const pages = [...surveyData.pages];
    pages.push({ title: `Page ${pages.length + 1}`, questions: [] });
    updateSurvey({ pages });
  };

  const deletePage = (pageIndex) => {
    const page = surveyData.pages[pageIndex];
    if (window.confirm(`Delete "${page.title}" with ${page.questions.length} questions?`)) {
      const pages = [...surveyData.pages];
      pages.splice(pageIndex, 1);
      updateSurvey({ pages });
    }
  };

  // Condition handling
  const handleConditionChange = (pageIndex, qIndex, condition) => {
    updateQuestion(pageIndex, qIndex, { visibleIf: condition });
  };

  const addCondition = (pageIndex, qIndex) => {
    const question = surveyData.pages[pageIndex].questions[qIndex];
    const newCondition = {
      operator: "AND",
      conditions: question.visibleIf.conditions || [
        { questionId: question.visibleIf.questionId, value: question.visibleIf.value }
      ]
    };
    newCondition.conditions.push({ questionId: "", value: "" });
    updateQuestion(pageIndex, qIndex, { visibleIf: newCondition });
  };

  const updateCondition = (pageIndex, qIndex, conditionIndex, field, value) => {
    const question = surveyData.pages[pageIndex].questions[qIndex];
    const conditions = [...question.visibleIf.conditions];
    conditions[conditionIndex][field] = value;
    
    if (field === 'questionId' && value) {
      const priorQuestions = surveyData.pages[pageIndex].questions.slice(0, qIndex);
      const selectedQuestion = priorQuestions.find(q => q.id === value);
      if (selectedQuestion?.options?.length > 0) {
        conditions[conditionIndex].value = selectedQuestion.options[0];
      }
    }
    
    updateQuestion(pageIndex, qIndex, { visibleIf: { ...question.visibleIf, conditions } });
  };

  const removeCondition = (pageIndex, qIndex, conditionIndex) => {
    const question = surveyData.pages[pageIndex].questions[qIndex];
    const conditions = [...question.visibleIf.conditions];
    
    if (conditions.length > 1) {
      conditions.splice(conditionIndex, 1);
      if (conditions.length === 1) {
        updateQuestion(pageIndex, qIndex, { 
          visibleIf: { questionId: conditions[0].questionId, value: conditions[0].value }
        });
      } else {
        updateQuestion(pageIndex, qIndex, { visibleIf: { ...question.visibleIf, conditions } });
      }
    } else {
      updateQuestion(pageIndex, qIndex, { visibleIf: null });
    }
  };

  // Option handling
  const addOption = (pageIndex, qIndex) => {
    const question = surveyData.pages[pageIndex].questions[qIndex];
    const options = [...(question.options || []), ""];
    updateQuestion(pageIndex, qIndex, { options });
  };

  const updateOption = (pageIndex, qIndex, optIndex, value) => {
    const question = surveyData.pages[pageIndex].questions[qIndex];
    const options = [...question.options];
    options[optIndex] = value;
    updateQuestion(pageIndex, qIndex, { options });
  };

  // UI Components
  const BrandingBar = () => (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 py-6 px-8 flex justify-between items-center shadow-lg">
      <div className="flex items-center space-x-4">
        <img src="/logo.svg" alt="Company Logo" className="h-16 w-24" style={{ filter: "brightness(0) invert(1)" }} />
        <span className="text-white font-semibold text-xl">Form Builder</span>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-white/90 text-sm font-medium">
            {currentUser.displayName || currentUser.email}
          </span>
          {currentUser.role === "admin" && <span className="text-blue-300 text-xs">(admin)</span>}
        </div>
        <button onClick={logout} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200" title="Logout">
          <Icon type="logout" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  const ActionButton = ({ onClick, disabled, icon, children, variant = "default", className = "" }) => (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={`
        p-2 rounded-lg transition-all duration-200 flex items-center space-x-2 ${className}
        ${disabled 
          ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
          : variant === "danger"
            ? "bg-transparent text-red-600 hover:bg-red-50"
            : variant === "primary"
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
              : "bg-white/50 text-gray-700 hover:bg-white hover:shadow-md"
        }
      `}
    >
      <Icon type={icon} className="w-4 h-4" />
      {children && <span>{children}</span>}
    </motion.button>
  );

  if (!currentSurveyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <BrandingBar />
        <div className="text-center text-gray-600 mt-8">Select or create a survey to edit.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <BrandingBar />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Survey Selection */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 mb-8 overflow-hidden"
        >
          <div className="p-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-6">
              Select form
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {loadingSurveys ? (
                <div className="col-span-full text-center text-gray-600 py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  Loading surveys...
                </div>
              ) : (
                <>
                  {surveysList.map((s) => (
                    <motion.button
                      key={s.id}
                      onClick={() => setCurrentSurveyId(s.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        aspect-square p-4 rounded-2xl border-2 transition-all duration-300
                        flex flex-col items-center justify-center text-center shadow-lg
                        ${s.id === currentSurveyId
                          ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-xl ring-2 ring-blue-200"
                          : "border-gray-200 bg-white/50 hover:bg-white/80 hover:shadow-xl"
                        }
                      `}
                    >
                      <Icon type="document" className="w-12 h-12 text-gray-600 mb-2" />
                      <span className="font-semibold text-base break-words leading-tight text-gray-700">
                        {s.title}
                      </span>
                    </motion.button>
                  ))}
                  <motion.button
                    onClick={createNewSurvey}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="aspect-square p-4 rounded-2xl border-2 border-dashed border-gray-400 bg-white/30 hover:bg-white/60 transition-all duration-300 flex flex-col items-center justify-center shadow-lg hover:shadow-xl"
                  >
                    <Icon type="plus" className="w-8 h-8 text-gray-600 mb-2" />
                    <span className="text-gray-600 text-sm font-medium">Add Form</span>
                  </motion.button>
                </>
              )}
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {loadingCurrent || !surveyData ? (
            <div className="text-center text-gray-600 mt-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              Loading survey...
            </div>
          ) : (
            <motion.div
              key={surveyData.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Survey Title + Actions */}
              <motion.div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden">
                <div className="p-8">
                  <div className="flex items-center gap-6">
                    <input
                      type="text"
                      value={surveyData.title}
                      onChange={(e) => updateSurvey({ title: e.target.value })}
                      className="flex-1 text-2xl font-bold bg-transparent border-0 border-b-2 border-gray-200 focus:border-blue-500 focus:outline-none px-0 py-2 transition-colors duration-200"
                      placeholder="Survey Title"
                    />
                    <div className="flex gap-3">
                      <ActionButton onClick={saveSurvey} icon="save" variant="primary" className="px-6 py-3">Save</ActionButton>
                      <ActionButton onClick={() => onPreview(surveyData)} icon="eye" variant="primary" className="px-6 py-3">Preview</ActionButton>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Pages */}
              {surveyData.pages.map((page, pageIndex) => {
                const questionMap = new Map();
                page.questions.forEach(q => questionMap.set(q.id, q));

                return (
                  <motion.div
                    key={pageIndex}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden"
                  >
                    <div className="p-8 space-y-6">
                      {/* Page Header */}
                      <div className="flex items-center gap-4">
                        <input
                          type="text"
                          value={page.title}
                          onChange={(e) => updatePage(pageIndex, { title: e.target.value })}
                          className="flex-1 text-2xl font-bold bg-transparent border-0 border-b-2 border-gray-200 focus:border-blue-500 focus:outline-none px-0 py-1 transition-colors duration-200"
                          placeholder="Page Title"
                        />
                        <div className="flex items-center gap-2">
                          <ActionButton 
                            onClick={() => updateSurvey({ pages: moveItem(surveyData.pages, pageIndex, "up") })} 
                            disabled={pageIndex === 0} 
                            icon="up" 
                          />
                          <ActionButton 
                            onClick={() => updateSurvey({ pages: moveItem(surveyData.pages, pageIndex, "down") })} 
                            disabled={pageIndex === surveyData.pages.length - 1} 
                            icon="down" 
                          />
                          <ActionButton 
                            onClick={() => deletePage(pageIndex)} 
                            disabled={surveyData.pages.length <= 1} 
                            icon="trash" 
                            variant="danger" 
                          />
                        </div>
                      </div>

                      {/* Questions */}
                      <AnimatePresence initial={false}>
                        {page.questions.map((q, qIndex) => {
                          const depth = getQuestionDepth(q.id, questionMap);
                          const priorQuestions = page.questions.slice(0, qIndex);
                          const priorMultipleChoice = priorQuestions.filter(pq => ["radio", "checkbox", "dropdown"].includes(pq.type));
                          const selectedConditionSource = q.visibleIf?.questionId ? priorMultipleChoice.find(pq => pq.id === q.visibleIf.questionId) : null;

                          // Ensure backward compatibility
                          if (!q.backgroundColor) q.backgroundColor = "default";
                          if (!q.videoUrl) q.videoUrl = "";
                          if (q.visibleIf?.questionId && !q.visibleIf.value && selectedConditionSource?.options?.length) {
                            q.visibleIf.value = selectedConditionSource.options[0];
                          }

                          return (
                            <motion.div
                              key={q.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.3 }}
                              className="relative"
                            >
                              <div
                                className="rounded-2xl p-6 space-y-4 transition-all duration-300 relative z-10"
                                style={{
                                  marginLeft: `${depth * 20}px`,
                                  ...getBackgroundColorStyle(q.backgroundColor),
                                  boxShadow: priorMultipleChoice.length > 0 
                                    ? `${getBackgroundColorStyle(q.backgroundColor).boxShadow}, 0 8px 20px -4px rgba(0, 0, 0, 0.15)`
                                    : getBackgroundColorStyle(q.backgroundColor).boxShadow
                                }}
                              >
                                {/* Question Header */}
                                <div className="flex items-center justify-between gap-4">
                                  <input
                                    type="text"
                                    value={q.label}
                                    onChange={(e) => updateQuestion(pageIndex, qIndex, { label: e.target.value })}
                                    className="flex-1 text-lg font-semibold bg-white/70 backdrop-blur-sm border-0 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-200"
                                    placeholder="Question Label"
                                  />
                                  <div className="flex items-center gap-2">
                                    <ActionButton 
                                      onClick={() => updateSurvey({ pages: surveyData.pages.map((p, i) => i === pageIndex ? { ...p, questions: moveItem(p.questions, qIndex, "up") } : p) })} 
                                      disabled={qIndex === 0} 
                                      icon="up" 
                                    />
                                    <ActionButton 
                                      onClick={() => updateSurvey({ pages: surveyData.pages.map((p, i) => i === pageIndex ? { ...p, questions: moveItem(p.questions, qIndex, "down") } : p) })} 
                                      disabled={qIndex === page.questions.length - 1} 
                                      icon="down" 
                                    />
                                    <ActionButton onClick={() => deleteQuestion(pageIndex, qIndex)} icon="trash" variant="danger" />
                                  </div>
                                </div>

                                {/* Description with formatting */}
                                <div>
                                  <textarea
                                    ref={(el) => {
                                      if (!textareaRefs[`${pageIndex}-${qIndex}`]) {
                                        setTextareaRefs(prev => ({
                                          ...prev,
                                          [`${pageIndex}-${qIndex}`]: { current: el }
                                        }));
                                      }
                                      if (textareaRefs[`${pageIndex}-${qIndex}`]) {
                                        textareaRefs[`${pageIndex}-${qIndex}`].current = el;
                                      }
                                    }}
                                    value={q.description || ""}
                                    onChange={(e) => updateQuestion(pageIndex, qIndex, { description: e.target.value })}
                                    className="w-full bg-white/70 backdrop-blur-sm border-0 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 placeholder-gray-500"
                                    placeholder="Add a description for this question (optional)"
                                    rows={4}
                                  />
                                  <FormattingToolbar 
                                    onFormat={(newValue) => updateQuestion(pageIndex, qIndex, { description: newValue })}
                                    textareaRef={textareaRefs[`${pageIndex}-${qIndex}`]}
                                  />
                                  {q.description && (
                                    <div className="mt-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                      <div className="text-xs font-medium text-blue-700 mb-1">Preview:</div>
                                      <div 
                                        className="text-sm text-gray-700 leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: renderFormattedText(q.description) }}
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Question Type */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-3">Question Type</label>
                                  <div className="flex gap-2 flex-wrap">
                                    {QUESTION_TYPES.map((type) => {
                                      const iconColor = getIconColor(q.backgroundColor || 'default');
                                      const isSelected = q.type === type.value;
                                      
                                      return (
                                        <motion.button
                                          key={type.value}
                                          type="button"
                                          onClick={() => updateQuestion(pageIndex, qIndex, { type: type.value })}
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                          className={`
                                            flex-1 min-w-0 p-3 rounded-xl border-2 transition-all duration-200 
                                            flex items-center justify-center gap-2 text-xs font-medium
                                            ${isSelected
                                              ? "border-blue-500 bg-blue-50 shadow-lg"
                                              : "border-gray-200 bg-white/50 hover:border-gray-300 hover:bg-white/80 hover:shadow-md"
                                            }
                                          `}
                                          title={type.label}
                                        >
                                          <Icon 
                                            type={type.icon}
                                            className="w-3 h-3 flex-shrink-0"
                                            style={{ stroke: iconColor }}
                                          />
                                          <span 
                                            className="leading-tight truncate"
                                            style={{ color: iconColor }}
                                          >
                                            {type.label}
                                          </span>
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Options for multi-choice questions */}
                                {["radio", "checkbox", "dropdown"].includes(q.type) && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-3"
                                  >
                                    <div className="text-sm font-medium text-gray-700">Options:</div>
                                    <div className="space-y-2">
                                      {(q.options || []).map((opt, optIndex) => (
                                        <input
                                          key={optIndex}
                                          value={opt}
                                          onChange={(e) => updateOption(pageIndex, qIndex, optIndex, e.target.value)}
                                          className="w-full bg-white/70 backdrop-blur-sm border-0 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-200"
                                          placeholder={`Option ${optIndex + 1}`}
                                        />
                                      ))}
                                    </div>
                                    <ActionButton onClick={() => addOption(pageIndex, qIndex)} icon="plus" variant="primary" className="inline-flex px-4 py-2 text-sm font-medium">
                                      Add Option
                                    </ActionButton>
                                  </motion.div>
                                )}

                                {/* Background Color */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-3">
                                    <Icon type="palette" className="w-4 h-4 inline mr-2" />
                                    Background Color
                                  </label>
                                  <div className="flex gap-3">
                                    {Object.values(BACKGROUND_COLORS).map((color) => (
                                      <motion.button
                                        key={color.value}
                                        type="button"
                                        onClick={() => updateQuestion(pageIndex, qIndex, { backgroundColor: color.value })}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={`
                                          w-10 h-10 rounded-xl border-2 transition-all duration-200 shadow-md
                                          ${q.backgroundColor === color.value
                                            ? "border-blue-500 scale-110 shadow-lg ring-2 ring-blue-200"
                                            : "border-gray-300 hover:border-gray-400 hover:shadow-lg"
                                          }
                                        `}
                                        style={{ backgroundColor: color.color }}
                                        title={color.label}
                                      />
                                    ))}
                                  </div>
                                </div>

                                {/* Video Upload */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-3">🎥 Question Video</label>
                                  <VideoUpload
                                    questionId={q.id}
                                    surveyId={surveyData.id}
                                    currentVideoUrl={q.videoUrl || ''}
                                    onVideoChange={(url) => updateQuestion(pageIndex, qIndex, { videoUrl: url })}
                                  />
                                  <p className="text-xs text-gray-500 mt-2">
                                    Add a video that will display above this question to provide context or instructions.
                                  </p>
                                </div>
                              </div>

                              {/* Conditional Logic Panel */}
                              {priorMultipleChoice.length > 0 && (
                                <div className="relative">
                                  <div
                                    className="px-6 py-4 pb-6 text-sm text-gray-700 space-y-4 bg-blue-50/80 backdrop-blur-sm rounded-b-2xl border border-blue-200/40 border-t-0 relative z-0"
                                    style={{
                                      marginLeft: `${depth * 20 + 50}px`,
                                      marginRight: '50px',
                                      boxShadow: '0 4px 12px -2px rgba(59, 130, 246, 0.15), inset 0 4px 8px -2px rgba(59, 130, 246, 0.1)',
                                      borderTopLeftRadius: '0',
                                      borderTopRightRadius: '0'
                                    }}
                                  >
                                    <div className="font-medium flex items-center gap-2 text-blue-800">
                                      <span>Show this question only if:</span>
                                    </div>

                                    {/* Handle multiple conditions */}
                                    {q.visibleIf?.conditions ? (
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-medium text-blue-700">Logic:</span>
                                          <select
                                            value={q.visibleIf.operator || "AND"}
                                            onChange={(e) => updateQuestion(pageIndex, qIndex, { 
                                              visibleIf: { ...q.visibleIf, operator: e.target.value }
                                            })}
                                            className="px-2 py-1 text-xs rounded border border-blue-200 bg-white/70 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                                          >
                                            <option value="AND">AND (all must be true)</option>
                                            <option value="OR">OR (any must be true)</option>
                                          </select>
                                        </div>

                                        {q.visibleIf.conditions.map((condition, conditionIndex) => {
                                          const conditionSource = priorMultipleChoice.find(pq => pq.id === condition.questionId);
                                          return (
                                            <div key={conditionIndex} className="flex items-center gap-2 p-3 bg-white/50 rounded-lg border border-blue-100">
                                              <div className="flex-1 grid grid-cols-2 gap-2">
                                                <select
                                                  value={condition.questionId || ""}
                                                  onChange={(e) => updateCondition(pageIndex, qIndex, conditionIndex, 'questionId', e.target.value)}
                                                  className="px-2 py-1 text-xs rounded border border-blue-200 bg-white/70 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                                                >
                                                  <option value="">Select question</option>
                                                  {priorMultipleChoice.map((pq) => (
                                                    <option key={pq.id} value={pq.id}>{pq.label}</option>
                                                  ))}
                                                </select>
                                                {condition.questionId && conditionSource?.options && (
                                                  <select
                                                    value={condition.value || ""}
                                                    onChange={(e) => updateCondition(pageIndex, qIndex, conditionIndex, 'value', e.target.value)}
                                                    className="px-2 py-1 text-xs rounded border border-blue-200 bg-white/70 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                                                  >
                                                    {conditionSource.options.map((opt, i) => (
                                                      <option key={i} value={opt}>{opt}</option>
                                                    ))}
                                                  </select>
                                                )}
                                              </div>
                                              <motion.button
                                                type="button"
                                                onClick={() => removeCondition(pageIndex, qIndex, conditionIndex)}
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-all duration-200"
                                                title="Remove condition"
                                              >
                                                <Icon type="trash" className="w-3 h-3" />
                                              </motion.button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      /* Single condition */
                                      <div className="grid grid-cols-2 gap-4">
                                        <select
                                          value={q.visibleIf?.questionId || ""}
                                          onChange={(e) => handleConditionChange(pageIndex, qIndex, {
                                            questionId: e.target.value || null,
                                            value: selectedConditionSource?.options?.[0] || "",
                                          })}
                                          className="px-3 py-2 rounded-lg border border-blue-200 bg-white/70 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all duration-200"
                                        >
                                          <option value="">Always visible</option>
                                          {priorMultipleChoice.map((pq) => (
                                            <option key={pq.id} value={pq.id}>{pq.label}</option>
                                          ))}
                                        </select>
                                        {q.visibleIf?.questionId && selectedConditionSource?.options && (
                                          <select
                                            value={q.visibleIf.value || ""}
                                            onChange={(e) => handleConditionChange(pageIndex, qIndex, {
                                              ...q.visibleIf,
                                              value: e.target.value,
                                            })}
                                            className="px-3 py-2 rounded-lg border border-blue-200 bg-white/70 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all duration-200"
                                          >
                                            {selectedConditionSource.options.map((opt, i) => (
                                              <option key={i} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Add Condition Button */}
                                    {q.visibleIf?.questionId && (
                                      <div className="flex justify-center pt-2">
                                        <ActionButton 
                                          onClick={() => addCondition(pageIndex, qIndex)} 
                                          icon="plus" 
                                          variant="primary" 
                                          className="px-4 py-2 text-xs font-medium"
                                        >
                                          Add Condition (AND/OR)
                                        </ActionButton>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center justify-center gap-2 text-xs font-medium text-blue-600 pt-2 border-t border-blue-200/50">
                                      <Icon type="link" className="w-3 h-3" />
                                      <span>Conditional Logic</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>

                      <motion.button
                        onClick={() => addQuestion(pageIndex)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                      >
                        <Icon type="plus" className="w-4 h-4" />
                        Add Question
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}

              {/* Add New Page Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center"
              >
                <ActionButton 
                  onClick={addPage} 
                  icon="plus" 
                  variant="primary" 
                  className="px-8 py-4 text-lg font-medium"
                >
                  Add New Page
                </ActionButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Save Button */}
        {currentSurveyId && surveyData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mt-8"
          >
            <ActionButton 
              onClick={saveSurvey} 
              icon="save" 
              variant="primary" 
              className="px-8 py-4 text-lg font-semibold"
            >
              Save Form
            </ActionButton>
          </motion.div>
        )}
      </div>
    </div>
  );
}