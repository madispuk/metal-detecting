import React from "react";

const LocationError = ({ locationError }) => {
  if (!locationError) return null;

  return (
    <div className="absolute top-4 left-4 right-4 z-50 bg-red-500 text-white p-4 rounded-lg shadow-lg text-center animate-slide-up">
      <div className="flex items-center justify-center space-x-2">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span className="font-medium">Location Error:</span>
        <span>{locationError}. Using default location (Estonia).</span>
      </div>
    </div>
  );
};

export default LocationError;
