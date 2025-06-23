// src/VideoUpload.jsx - Super Simple Version (Based on Working Debug)
import React, { useState, useRef } from 'react';
import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { motion, AnimatePresence } from 'framer-motion';

// Simple Video Preview Component (Minimal complexity)
const VideoPreview = ({ videoUrl, onRemove, disabled }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  if (!videoUrl || videoUrl === '') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative w-80 bg-black rounded-xl overflow-hidden shadow-lg"
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
              }}
              className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Simple Video Element with Native Controls - Smaller 16:9 for Editor */}
          <video
            src={videoUrl}
            className="w-80 aspect-video object-cover"
            controls
            preload="auto"
            playsInline
            onLoadStart={() => {
              setIsLoading(true);
              setHasError(false);
            }}
            onCanPlay={() => {
              setIsLoading(false);
            }}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          >
            Your browser does not support the video tag.
          </video>
        </>
      )}
      
      {/* Remove Button */}
      <div className="absolute top-2 right-2">
        {!disabled && (
          <button
            onClick={onRemove}
            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 shadow-lg"
            title="Remove video"
          >
            🗑️
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default function VideoUpload({ 
  questionId, 
  surveyId, 
  currentVideoUrl, 
  onVideoChange, 
  disabled = false 
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Supported video formats
  const supportedFormats = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  const maxFileSize = 100 * 1024 * 1024; // 100MB

  const validateFile = (file) => {
    if (!supportedFormats.includes(file.type)) {
      throw new Error('Please upload a video file (MP4, WebM, OGG, or MOV)');
    }
    if (file.size > maxFileSize) {
      throw new Error('File size must be less than 100MB');
    }
  };

  const uploadVideo = async (file) => {
    try {
      validateFile(file);
      setUploading(true);
      setError('');
      setUploadProgress(0);

      const timestamp = Date.now();
      const fileName = `surveys/${surveyId}/questions/${questionId}/video_${timestamp}.${file.name.split('.').pop()}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (error) => {
            console.error('Upload error:', error);
            setError('Upload failed. Please try again.');
            setUploading(false);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setUploading(false);
              setUploadProgress(0);
              
              if (currentVideoUrl) {
                try {
                  const oldRef = ref(storage, currentVideoUrl);
                  await deleteObject(oldRef);
                } catch (err) {
                  console.warn('Could not delete old video:', err);
                }
              }
              
              onVideoChange(downloadURL);
              resolve(downloadURL);
            } catch (err) {
              setError('Failed to get video URL');
              setUploading(false);
              reject(err);
            }
          }
        );
      });
    } catch (err) {
      setError(err.message);
      setUploading(false);
      throw err;
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file && !disabled) {
      uploadVideo(file);
    }
  };

  const removeVideo = async () => {
    if (currentVideoUrl && !disabled) {
      try {
        const videoRef = ref(storage, currentVideoUrl);
        await deleteObject(videoRef);
        onVideoChange('');
      } catch (err) {
        console.error('Error deleting video:', err);
        onVideoChange('');
      }
    }
  };

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Video Display */}
      <AnimatePresence>
        {currentVideoUrl && (
          <VideoPreview
            videoUrl={currentVideoUrl}
            onRemove={removeVideo}
            disabled={disabled}
          />
        )}
      </AnimatePresence>

      {/* Upload Area */}
      {!currentVideoUrl && !disabled && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-200">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled || uploading}
          />

          {uploading ? (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-blue-500 rounded-full mx-auto flex items-center justify-center">
                📹
              </div>
              <div>
                <p className="text-gray-700 font-medium">Uploading video...</p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">{uploadProgress}% complete</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4" onClick={openFileDialog}>
              <div className="w-12 h-12 bg-gray-400 rounded-full mx-auto flex items-center justify-center">
                📹
              </div>
              <div>
                <p className="text-gray-700 font-medium">Click to upload video</p>
                <p className="text-sm text-gray-500 mt-1">MP4, WebM, OGG, MOV • Max 100MB</p>
              </div>
              <button
                type="button"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Choose Video File
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}