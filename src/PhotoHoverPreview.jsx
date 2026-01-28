import React from "react";
import { cn } from "./lib/utils";

const PhotoHoverPreview = ({ hoveredPhoto, mousePosition, onHoverChange }) => {
  if (!hoveredPhoto) return null;

  // Calculate position at bottom right of cursor
  const offsetX = 15; // pixels to the right of cursor
  const offsetY = 15; // pixels below cursor

  // Get viewport dimensions to prevent preview from going off-screen
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const previewWidth = 256; // w-64 = 16rem = 256px
  const previewHeight = 200; // estimated height

  // Adjust position if preview would go off-screen
  let adjustedX = mousePosition.x + offsetX;
  let adjustedY = mousePosition.y + offsetY;

  // If preview would go off right edge, show it to the left of cursor
  if (adjustedX + previewWidth > viewportWidth) {
    adjustedX = mousePosition.x - offsetX - previewWidth;
  }

  // If preview would go off bottom edge, show it above cursor
  if (adjustedY + previewHeight > viewportHeight) {
    adjustedY = mousePosition.y - offsetY - previewHeight;
  }

  const previewStyle = {
    position: "fixed",
    left: `${adjustedX}px`,
    top: `${adjustedY}px`,
    zIndex: 99999,
    pointerEvents: "none",
    // No transform needed - positioned at top right of cursor
  };

  return (
    <div
      className={cn(
        "w-64 bg-slate-800 shadow-2xl",
        "animate-in fade-in-0 zoom-in-95 duration-200"
      )}
      style={previewStyle}
    >
      <img
        src={hoveredPhoto.image_data || hoveredPhoto.imageData}
        alt="Preview"
        className="w-full h-auto shadow-md"
      />
      <div className="my-2 text-center">
        <div className="text-xs font-medium text-gray-200 capitalize">
          {hoveredPhoto.type || "Photo"}
        </div>
      </div>
    </div>
  );
};

export default PhotoHoverPreview;
