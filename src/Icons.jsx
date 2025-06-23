// src/Icons.jsx
import React from 'react';

// Consolidated Icons Component
export const Icon = ({ type, className = "w-4 h-4" }) => {
  const icons = {
    plus: "M12 4v16m8-8H4",
    save: "M5 13l4 4L19 7",
    eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0a9 9 0 11-18 0 9 9 0 0118 0z",
    link: "M13.828 10.172a4 4 0 015.656 5.656l-1.415 1.415a4 4 0 01-5.656-5.656m-3.414 3.414a4 4 0 01-5.656-5.656l1.414-1.414a4 4 0 015.657 5.656",
    builder: "M3 7v13h18V7M3 7l9-4 9 4",
    palette: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3H5a2 2 0 00-2 2v12a4 4 0 004 4h2a2 2 0 002-2V5a2 2 0 00-2-2z",
    document: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1V4m7 3H4",
    text: "M4 6h16M4 12h16M4 18h7",
    textarea: "M4 6h16M4 10h16M4 14h16M4 18h10",
    up: "M5 15l7-7 7 7",
    down: "M19 9l-7 7-7-7",
    logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
  };

  const specialIcons = {
    radio: (
      <>
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="10" fill="none" />
      </>
    ),
    checkbox: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      </>
    ),
    dropdown: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" ry="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l5 5 5-5" />
      </>
    ),
    none: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
      </>
    )
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      {specialIcons[type] ? (
        specialIcons[type]
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d={icons[type]} />
      )}
    </svg>
  );
};