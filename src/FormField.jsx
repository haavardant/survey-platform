// src/FormField.jsx
import React from "react";

export default function FormField({ question, value, onChange, mode = "edit" }) {
  const { label, type, options = [] } = question;
  const isReadOnly = mode === "view";

  const handleCheckboxChange = (option) => {
    const current = value || [];
    if (current.includes(option)) {
      onChange(current.filter((item) => item !== option));
    } else {
      onChange([...current, option]);
    }
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-md space-y-3 border border-gray-200">
      <label className="block text-lg font-semibold text-gray-900">{label}</label>

      {type === "text" && (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={isReadOnly}
          className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring focus:ring-blue-400 disabled:bg-gray-100"
        />
      )}

      {type === "textarea" && (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={isReadOnly}
          className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring focus:ring-blue-400 disabled:bg-gray-100"
          rows={4}
        />
      )}

      {type === "radio" && (
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-gray-800">
              <input
                type="radio"
                name={label}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                disabled={isReadOnly}
                className="accent-blue-500"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {type === "checkbox" && (
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-gray-800">
              <input
                type="checkbox"
                value={opt}
                checked={(value || []).includes(opt)}
                onChange={() => handleCheckboxChange(opt)}
                disabled={isReadOnly}
                className="accent-blue-500"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {type === "dropdown" && (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={isReadOnly}
          className="w-full px-4 py-2 border rounded-xl bg-white focus:outline-none focus:ring focus:ring-blue-400 disabled:bg-gray-100"
        >
          <option value="">Select an option</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
