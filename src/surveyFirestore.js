// src/surveyFirestore.js
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function saveSurveyProgress(surveyId, userId, answers, progress, completed = false) {
  const docRef = doc(db, "responses", `${surveyId}_${userId}`);
  const data = {
    surveyId,
    userId,
    answers,
    progress,
    completed,
    timestamp: Date.now()
  };

  try {
    await setDoc(docRef, data);
    console.log("✅ Survey response saved");
  } catch (err) {
    console.error("❌ Error saving response:", err);
  }
}

export async function loadSurveyProgress(surveyId, userId) {
  const docRef = doc(db, "responses", `${surveyId}_${userId}`);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    return snapshot.data();
  } else {
    return null;
  }
}
