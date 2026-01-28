import React, { useState, useEffect } from "react";
import {
  getFullImageData,
  getOriginalImageData,
  updatePhotoDetails,
} from "./photoService";

const PhotoModal = ({
  showModal,
  setShowModal,
  selectedPhoto,
  onDeletePhoto,
  isAdmin = false,
  user = null,
}) => {
  const [originalImageData, setOriginalImageData] = useState(null);
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [photoDescription, setPhotoDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Load original image data when modal opens
  useEffect(() => {
    if (showModal && selectedPhoto && selectedPhoto.id) {
      // Reset image states when a new photo is selected
      setOriginalImageData(null);
      setIsLoadingOriginal(true);

      setPhotoName(selectedPhoto.name || "");
      setPhotoDescription(selectedPhoto.description || "");

      // Always load the original image
      getOriginalImageData(selectedPhoto.id)
        .then((result) => {
          if (result.success) {
            setOriginalImageData(result.data);
          } else {
            console.error("Failed to load original image:", result.error);
            // Fallback to compressed image if original fails
            getFullImageData(selectedPhoto.id)
              .then((fallbackResult) => {
                if (fallbackResult.success) {
                  setOriginalImageData(fallbackResult.data);
                }
              })
              .catch((error) => {
                console.error("Error loading fallback image:", error);
              });
          }
        })
        .catch((error) => {
          console.error("Error loading original image:", error);
          // Fallback to compressed image if original fails
          getFullImageData(selectedPhoto.id)
            .then((fallbackResult) => {
              if (fallbackResult.success) {
                setOriginalImageData(fallbackResult.data);
              }
            })
            .catch((fallbackError) => {
              console.error("Error loading fallback image:", fallbackError);
            });
        })
        .finally(() => {
          setIsLoadingOriginal(false);
        });
    }
  }, [showModal, selectedPhoto]);

  const handleDelete = () => {
    if (selectedPhoto) {
      onDeletePhoto(selectedPhoto.id);
      setShowModal(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPhoto || !user) return;

    setIsSaving(true);
    try {
      // Update photo name and description if changed
      if (
        photoName !== selectedPhoto.name ||
        photoDescription !== selectedPhoto.description
      ) {
        const detailsResult = await updatePhotoDetails(
          selectedPhoto.id,
          photoName,
          photoDescription,
          user
        );
        if (detailsResult.success) {
          selectedPhoto.name = photoName;
          selectedPhoto.description = photoDescription;
          console.log("Photo details updated successfully");
          setShowModal(false);
        } else {
          console.error("Failed to update photo details:", detailsResult.error);
        }
      } else {
        // No changes, just close the modal
        setShowModal(false);
      }
    } catch (error) {
      console.error("Error updating photo:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (open) => {
    setShowModal(open);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={() => setShowModal(false)}
      />
      <div className="relative z-[10000] w-full max-w-6xl max-h-[95vh] bg-gray-900 rounded-xl shadow-2xl border border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Photo Details</h2>
          <button
            className="p-1.5 hover:bg-gray-800 rounded-md transition-colors"
            onClick={() => setShowModal(false)}
          >
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 flex-1 overflow-y-auto">
          {selectedPhoto ? (
            <div className="space-y-4 sm:space-y-6">
              {/* Image and Details Row */}
              <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 h-full">
                {/* Image - Left - Takes more space */}
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Image Display - Takes remaining space */}
                  <div
                    className="flex-1 max-h-[500px] flex items-center justify-center rounded-lg overflow-hidden p-2 sm:p-3 bg-gray-800 cursor-pointer hover:bg-gray-750 transition-colors"
                    onClick={() => setShowFullscreen(true)}
                    title="Click to view full screen"
                  >
                    {isLoadingOriginal ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        <span className="ml-2 text-gray-400">
                          Loading original image...
                        </span>
                      </div>
                    ) : (
                      <img
                        src={
                          originalImageData ||
                          selectedPhoto.image_data ||
                          selectedPhoto.imageData
                        }
                        alt="Selected photo"
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Details - Right */}
                <div className="w-full lg:w-80 space-y-6 sm:space-y-10 flex-shrink-0">
                  {/* Location */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Location
                    </h3>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center rounded-md">
                        <span className="text-sm text-gray-400">Latitude</span>
                        <span className="text-sm font-mono text-white">
                          {selectedPhoto?.lat?.toFixed(6)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center rounded-md">
                        <span className="text-sm text-gray-400">Longitude</span>
                        <span className="text-sm font-mono text-white">
                          {selectedPhoto?.lng?.toFixed(6)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Details
                    </h3>
                    <div className="space-y-1">
                      {/* Photo Name */}
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-gray-400">Name</span>
                        {isAdmin ? (
                          <input
                            type="text"
                            value={photoName}
                            onChange={(e) => setPhotoName(e.target.value)}
                            placeholder="Enter photo name..."
                            className="px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 min-h-[44px] touch-manipulation"
                          />
                        ) : (
                          <span className="text-sm text-white">
                            {selectedPhoto?.name || "No name"}
                          </span>
                        )}
                      </div>

                      {/* Photo Description */}
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-gray-400">
                          Description
                        </span>
                        {isAdmin ? (
                          <textarea
                            value={photoDescription}
                            onChange={(e) =>
                              setPhotoDescription(e.target.value)
                            }
                            placeholder="Enter photo description..."
                            rows={3}
                            className="px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 resize-none min-h-[44px] touch-manipulation"
                          />
                        ) : (
                          <span className="text-sm text-white">
                            {selectedPhoto?.description || "No description"}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center rounded-md">
                        <span className="text-sm text-gray-400">Filename</span>
                        <span className="text-sm text-white truncate max-w-20">
                          {selectedPhoto?.filename || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center rounded-md">
                        <span className="text-sm text-gray-400">Captured</span>
                        <span className="text-sm text-white">
                          {selectedPhoto?.timestamp
                            ? new Date(
                                selectedPhoto.timestamp
                              ).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center border border-gray-600">
                  <svg
                    className="w-6 h-6 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <p className="text-sm">No photo selected</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-700 flex-shrink-0">
          <button
            className="px-5 py-3 text-gray-300 bg-gray-800 border border-gray-600 rounded-md hover:bg-gray-700 transition-colors font-medium text-sm min-h-[44px] touch-manipulation"
            onClick={() => setShowModal(false)}
          >
            Close
          </button>
          {selectedPhoto && isAdmin && (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-3 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium text-sm min-h-[44px] touch-manipulation"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-3 text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors font-medium text-sm min-h-[44px] touch-manipulation"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Full-screen Image Modal */}
      {showFullscreen && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Close button */}
            <button
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
              onClick={() => setShowFullscreen(false)}
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Full-screen image */}
            <img
              src={
                originalImageData ||
                selectedPhoto?.image_data ||
                selectedPhoto?.imageData
              }
              alt="Full screen photo"
              className="max-w-full max-h-full object-contain"
              onClick={() => setShowFullscreen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoModal;
