import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FiMapPin,
  FiCalendar,
  FiTag,
  FiHash,
  FiNavigation,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import {
  loadPhotosMetadataOnly,
  loadPhotoThumbnail,
  deletePhotoFromDatabase,
} from "../photoService";
import PhotoModal from "../PhotoModal";
import ToastNotification from "../ToastNotification";
import { formatTypeName } from "../lib/utils";

// Lazy thumbnail component that loads when visible
const LazyThumbnail = ({ photoId, onLoad }) => {
  const [thumbnail, setThumbnail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !thumbnail && !isLoading) {
          setIsLoading(true);
          loadPhotoThumbnail(photoId).then((result) => {
            if (result.success) {
              setThumbnail(result.data);
              if (onLoad) onLoad(photoId, result.data);
            }
            setIsLoading(false);
          });
        }
      },
      { rootMargin: "100px" }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [photoId, thumbnail, isLoading, onLoad]);

  return (
    <div ref={ref} className="w-full h-full">
      {thumbnail ? (
        <img
          src={thumbnail}
          alt="Photo thumbnail"
          className="w-full h-full object-cover rounded"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100 rounded">
          {isLoading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-300"></div>
          ) : (
            <FiMapPin size={16} />
          )}
        </div>
      )}
    </div>
  );
};

const ListView = ({ onViewChange }) => {
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [sortBy, setSortBy] = useState("timestamp"); // timestamp, type, location
  const [filterBy, setFilterBy] = useState("all"); // all, or specific type
  const [thumbnailCache, setThumbnailCache] = useState({});

  const { user, isAdmin } = useAuth();

  // Cache loaded thumbnails
  const handleThumbnailLoad = useCallback((photoId, thumbnailData) => {
    setThumbnailCache((prev) => ({ ...prev, [photoId]: thumbnailData }));
  }, []);

  // Load photos metadata on component mount (fast, no image data)
  useEffect(() => {
    const loadPhotos = async () => {
      setIsLoading(true);
      try {
        console.log("Loading photos metadata for list view...");
        const result = await loadPhotosMetadataOnly(100, 0);
        console.log("Photos metadata loading result:", result);
        if (result.success) {
          setPhotos(result.data);
          console.log(`Loaded ${result.data.length} photos metadata for list view`);
        } else {
          console.error("Failed to load photos:", result.error);
          setToastMessage("Failed to load photos");
          setToastOpen(true);
        }
      } catch (error) {
        console.error("Error loading photos:", error);
        setToastMessage("Error loading photos");
        setToastOpen(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadPhotos();
  }, []);

  // Handle photo deletion
  const handleDeletePhoto = async (photoId) => {
    try {
      const result = await deletePhotoFromDatabase(photoId, user);
      if (result.success) {
        setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
        setToastMessage("Photo deleted successfully!");
        setToastOpen(true);
      } else {
        console.error("Failed to delete photo:", result.error);
        setToastMessage("Failed to delete photo");
        setToastOpen(true);
      }
    } catch (error) {
      console.error("Error deleting photo:", error);
      setToastMessage("Error deleting photo");
      setToastOpen(true);
    }
  };

  // Handle photo view
  const handleViewPhoto = (photo) => {
    setSelectedPhoto(photo);
    setShowModal(true);
  };

  // Handle jump to map
  const handleJumpToMap = (photo, event) => {
    event.stopPropagation(); // Prevent triggering the photo view modal

    // Switch to map view
    onViewChange("map");

    // Update URL with photo coordinates to center the map
    const url = new URL(window.location);
    url.searchParams.set("view", "map");
    url.searchParams.set("lat", photo.lat.toFixed(6));
    url.searchParams.set("lng", photo.lng.toFixed(6));
    url.searchParams.set("zoom", "18"); // Higher zoom to focus on the specific location
    window.history.replaceState({}, "", url);
  };

  // Sort and filter photos
  const sortedAndFilteredPhotos = photos
    .filter((photo) => {
      if (filterBy === "all") return true;
      return photo.type === filterBy;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "timestamp":
          return new Date(b.timestamp) - new Date(a.timestamp);
        case "type":
          return a.type.localeCompare(b.type);
        case "location":
          return a.lat - b.lat;
        default:
          return 0;
      }
    });

  // Get unique types for filter
  const uniqueTypes = [...new Set(photos.map((photo) => photo.type))];

  // Format date
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format coordinates
  const formatCoordinates = (lat, lng) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-300 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading photos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 flex flex-col">
      {/* Header with filters */}
      <div className="bg-white border-b border-slate-200 p-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2">
            <h2 className="text-lg font-semibold text-slate-800">
              Targets ({sortedAndFilteredPhotos.length})
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm text-slate-700 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="timestamp">Sort by Date</option>
              <option value="type">Sort by Type</option>
              <option value="location">Sort by Location</option>
            </select>

            {/* Filter dropdown */}
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="px-3 py-2 text-sm text-slate-700 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {formatTypeName(type)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Photos list */}
      <div className="flex-1 overflow-y-auto p-2">
        {sortedAndFilteredPhotos.length === 0 ? (
          <div className="text-center py-8">
            <FiMapPin className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <h3 className="text-sm font-medium text-slate-600 mb-1">
              No photos found
            </h3>
            <p className="text-xs text-slate-500">
              {filterBy === "all"
                ? "No photos have been uploaded yet."
                : `No photos found for type "${filterBy}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedAndFilteredPhotos.map((photo) => (
              <div
                key={photo.id}
                className="bg-white rounded border border-slate-200 hover:border-slate-300 transition-colors duration-200 group cursor-pointer"
                onClick={() => handleViewPhoto(photo)}
              >
                <div className="flex items-center p-2">
                  {/* Photo thumbnail */}
                  <div className="w-48 h-48 bg-slate-100 rounded relative flex-shrink-0 mr-4">
                    {thumbnailCache[photo.id] ? (
                      <img
                        src={thumbnailCache[photo.id]}
                        alt="Photo thumbnail"
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <LazyThumbnail
                        photoId={photo.id}
                        onLoad={handleThumbnailLoad}
                      />
                    )}
                  </div>

                  {/* Photo details */}
                  <div className="flex-1 min-w-0">
                    {/* Photo name/title */}
                    {photo.name && (
                      <div className="mb-2">
                        <h3 className="text-sm font-semibold text-slate-800 truncate">
                          {photo.name}
                        </h3>
                      </div>
                    )}

                    {/* Photo description */}
                    {photo.description && (
                      <div className="mb-2">
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {photo.description}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-1">
                      <FiHash
                        size={12}
                        className="text-slate-400 flex-shrink-0"
                      />
                      <span className="text-xs text-slate-500 font-mono truncate">
                        ID: {photo.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <FiTag
                        size={12}
                        className="text-slate-400 flex-shrink-0"
                      />
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {formatTypeName(photo.type)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <FiMapPin
                        size={12}
                        className="text-slate-400 flex-shrink-0"
                      />
                      <span className="text-xs text-slate-500 font-mono truncate">
                        {formatCoordinates(photo.lat, photo.lng)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <FiCalendar
                        size={12}
                        className="text-slate-400 flex-shrink-0"
                      />
                      <span className="text-xs text-slate-500 truncate">
                        {formatDate(photo.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Jump to Map Button */}
                  <div className="flex-shrink-0 ml-4">
                    <button
                      onClick={(e) => handleJumpToMap(photo, e)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors duration-200 group"
                      title="Jump to map location"
                    >
                      <FiNavigation size={14} />
                      <span className="hidden sm:inline">Jump to Map</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Modal */}
      <PhotoModal
        showModal={showModal}
        setShowModal={setShowModal}
        selectedPhoto={selectedPhoto}
        onDeletePhoto={handleDeletePhoto}
        isAdmin={isAdmin}
        user={user}
      />

      {/* Toast notifications */}
      <ToastNotification
        toastOpen={toastOpen}
        setToastOpen={setToastOpen}
        toastMessage={toastMessage}
      />
    </div>
  );
};

export default ListView;
