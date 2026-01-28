import React, { createContext, useContext, useState, useEffect } from "react";
import {
  loadPhotosFromDatabase,
  loadAllPhotosFromDatabase,
  loadPhotosWithThumbnails,
  getFullImageData,
  getOriginalImageData,
  updatePhotoType,
  updatePhotoDetails,
  deletePhotoFromDatabase,
} from "../photoService";
import { useAuth } from "./AuthContext";

const PhotosContext = createContext();

export const usePhotos = () => {
  const context = useContext(PhotosContext);
  if (!context) {
    throw new Error("usePhotos must be used within a PhotosProvider");
  }
  return context;
};

export const PhotosProvider = ({ children }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const { user } = useAuth();

  // Load photos with pagination
  const loadPhotos = async (limit = 50, offset = 0, useThumbnails = false) => {
    try {
      setLoading(true);
      setError(null);

      let result;
      if (useThumbnails) {
        result = await loadPhotosWithThumbnails(limit, offset);
      } else {
        result = await loadPhotosFromDatabase(limit, offset);
      }

      if (result.success) {
        if (offset === 0) {
          // First load - replace photos
          setPhotos(result.data);
        } else {
          // Subsequent loads - append photos
          setPhotos((prev) => [...prev, ...result.data]);
        }

        // Check if we have more photos
        setHasMore(result.data.length === limit);
        setCurrentOffset(offset + result.data.length);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load all photos (for migration or admin purposes)
  const loadAllPhotos = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await loadAllPhotosFromDatabase();

      if (result.success) {
        setPhotos(result.data);
        setHasMore(false);
        setCurrentOffset(result.data.length);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load more photos (for pagination)
  const loadMorePhotos = async () => {
    if (!loading && hasMore) {
      await loadPhotos(50, currentOffset, true); // Use thumbnails for better performance
    }
  };

  // Get full image data for a specific photo
  const getFullImage = async (photoId) => {
    try {
      const result = await getFullImageData(photoId);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error.message);
      }
    } catch (err) {
      console.error("Error loading full image:", err);
      throw err;
    }
  };

  // Get original image data from storage
  const getOriginalImage = async (photoId) => {
    try {
      const result = await getOriginalImageData(photoId);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error.message);
      }
    } catch (err) {
      console.error("Error loading original image:", err);
      throw err;
    }
  };

  // Update photo type
  const updateType = async (photoId, newType) => {
    try {
      const result = await updatePhotoType(photoId, newType, user);
      if (result.success) {
        // Update the photo in the local state
        setPhotos((prev) =>
          prev.map((photo) =>
            photo.id === photoId ? { ...photo, type: newType } : photo
          )
        );
        return result.data;
      } else {
        throw new Error(result.error.message);
      }
    } catch (err) {
      console.error("Error updating photo type:", err);
      throw err;
    }
  };

  // Update photo details (name and description)
  const updateDetails = async (photoId, name, description) => {
    try {
      const result = await updatePhotoDetails(photoId, name, description, user);
      if (result.success) {
        // Update the photo in the local state
        setPhotos((prev) =>
          prev.map((photo) =>
            photo.id === photoId ? { ...photo, name, description } : photo
          )
        );
        return result.data;
      } else {
        throw new Error(result.error.message);
      }
    } catch (err) {
      console.error("Error updating photo details:", err);
      throw err;
    }
  };

  // Delete photo
  const deletePhoto = async (photoId) => {
    try {
      const result = await deletePhotoFromDatabase(photoId, user);
      if (result.success) {
        // Remove the photo from local state
        setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
        return true;
      } else {
        throw new Error(result.error.message);
      }
    } catch (err) {
      console.error("Error deleting photo:", err);
      throw err;
    }
  };

  // Refresh photos (reload from database)
  const refreshPhotos = async () => {
    setCurrentOffset(0);
    setHasMore(true);
    await loadPhotos(50, 0, true);
  };

  // Clear photos
  const clearPhotos = () => {
    setPhotos([]);
    setCurrentOffset(0);
    setHasMore(true);
    setError(null);
  };

  // Initialize photos on mount
  useEffect(() => {
    if (user) {
      loadPhotos(50, 0, true); // Start with thumbnails for better performance
    }
  }, [user]);

  const value = {
    photos,
    loading,
    error,
    hasMore,
    currentOffset,
    loadPhotos,
    loadAllPhotos,
    loadMorePhotos,
    getFullImage,
    getOriginalImage,
    updateType,
    updateDetails,
    deletePhoto,
    refreshPhotos,
    clearPhotos,
  };

  return (
    <PhotosContext.Provider value={value}>{children}</PhotosContext.Provider>
  );
};
