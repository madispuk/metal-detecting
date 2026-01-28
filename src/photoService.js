import { supabase } from "./supabase";
import { requireAdmin } from "./lib/utils";

// Storage bucket name for original images
const STORAGE_BUCKET = "original-images";

// Helper function to compress image data
const compressImage = (
  base64Image,
  maxWidth = 800,
  maxHeight = 600,
  quality = 0.8
) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Calculate compressed dimensions
      let { width, height } = img;
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw compressed image
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = base64Image;
  });
};

// Helper function to create thumbnail from base64 image
// Matches quality settings from regenerate-thumbnails.js: 800x800, quality 85%
const createThumbnail = (base64Image, maxWidth = 800, maxHeight = 800) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Calculate thumbnail dimensions (fit inside, preserve aspect ratio, without enlargement)
      // This matches Sharp's behavior: fit: "inside", withoutEnlargement: true
      let { width, height } = img;
      
      // Only resize if image exceeds max dimensions (withoutEnlargement: true)
      if (width > maxWidth || height > maxHeight) {
        // Calculate scale factors for both dimensions
        const scaleX = maxWidth / width;
        const scaleY = maxHeight / height;
        
        // Use the smaller scale to ensure image fits inside bounds (preserves aspect ratio)
        const scale = Math.min(scaleX, scaleY);
        
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;

      // Use high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Draw thumbnail with high quality (0.85 = 85% quality, matching regenerate-thumbnails.js)
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = base64Image;
  });
};

// Helper function to validate image size
const validateImageSize = (base64Image) => {
  const sizeInBytes = (base64Image.length * 3) / 4; // Approximate size in bytes
  const maxSizeInMB = 2; // 2MB limit
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

  if (sizeInBytes > maxSizeInBytes) {
    throw new Error(
      `Image is too large (${(sizeInBytes / 1024 / 1024).toFixed(
        2
      )}MB). Maximum size is ${maxSizeInMB}MB.`
    );
  }

  return true;
};

// Helper function to convert base64 to blob
const base64ToBlob = (base64Data, contentType = "image/jpeg") => {
  const byteCharacters = atob(base64Data.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
};

// Upload original image to Supabase Storage
const uploadOriginalImage = async (base64Image, filename, userId) => {
  try {
    // Convert base64 to blob
    const blob = base64ToBlob(base64Image);

    // Create unique filename with timestamp and user ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const uniqueFilename = `${userId}/${timestamp}_${filename}`;

    // Upload to storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(uniqueFilename, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading to storage:", error);
      throw error;
    }

    return data.path;
  } catch (error) {
    console.error("Error in uploadOriginalImage:", error);
    throw error;
  }
};

// Download original image from Supabase Storage
const downloadOriginalImage = async (storagePath) => {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (error) {
      console.error("Error downloading from storage:", error);
      throw error;
    }

    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(data);
    });
  } catch (error) {
    console.error("Error in downloadOriginalImage:", error);
    throw error;
  }
};

// Delete original image from Supabase Storage
const deleteOriginalImage = async (storagePath) => {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error("Error deleting from storage:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Error in deleteOriginalImage:", error);
    throw error;
  }
};

// Save photo to Supabase
export const savePhotoToDatabase = async (photoData, user) => {
  try {
    // Check admin permission
    requireAdmin(user);

    // Validate image size before processing
    validateImageSize(photoData.imageData);

    // Upload original image to storage
    const storagePath = await uploadOriginalImage(
      photoData.imageData,
      photoData.filename || "photo.jpg",
      user.id
    );

    // Compress the main image to reduce size for database storage
    const compressedImage = await compressImage(
      photoData.imageData,
      800,
      600,
      0.8
    );

    // Create thumbnail with high quality (800x800, 85% quality - matching regenerate-thumbnails.js)
    const thumbnail = await createThumbnail(compressedImage);

    const { data, error } = await supabase
      .from("photos")
      .insert([
        {
          lat: photoData.lat,
          lng: photoData.lng,
          image_data: compressedImage, // Store compressed image for quick access
          thumbnail_data: thumbnail,
          storage_path: storagePath, // Store path to original image in storage
          timestamp: photoData.timestamp,
          filename: photoData.filename,
          type: photoData.type || null,
          name: photoData.name || null,
          description: photoData.description || null,
          user_id: user.id, // Track which user uploaded the photo
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("Error saving photo to database:", error);
      // If database insert fails, clean up the uploaded file
      try {
        await deleteOriginalImage(storagePath);
      } catch (cleanupError) {
        console.error("Error cleaning up uploaded file:", cleanupError);
      }
      return { success: false, error };
    }

    console.log("Photo saved to database and storage:", data);
    return { success: true, data: data[0] };
  } catch (error) {
    console.error("Error saving photo:", error);
    return { success: false, error };
  }
};

// Load photos from Supabase with pagination
export const loadPhotosFromDatabase = async (limit = 50, offset = 0) => {
  try {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error loading photos from database:", error);
      return { success: false, error };
    }

    // Ensure both imageData and image_data fields are available for compatibility
    const processedData = data.map((photo) => ({
      ...photo,
      imageData: photo.image_data, // Add imageData field for compatibility
    }));

    console.log(
      `Photos loaded from database (${processedData.length} photos):`,
      processedData
    );
    return { success: true, data: processedData };
  } catch (error) {
    console.error("Error loading photos:", error);
    return { success: false, error };
  }
};

// Load all photos with pagination to avoid timeout
export const loadAllPhotosFromDatabase = async () => {
  try {
    const allPhotos = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const result = await loadPhotosFromDatabase(limit, offset);

      if (!result.success) {
        return result;
      }

      allPhotos.push(...result.data);

      // If we got fewer photos than the limit, we've reached the end
      hasMore = result.data.length === limit;
      offset += limit;

      // Add a small delay to prevent overwhelming the database
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      `All photos loaded from database (${allPhotos.length} total):`,
      allPhotos
    );
    return { success: true, data: allPhotos };
  } catch (error) {
    console.error("Error loading all photos:", error);
    return { success: false, error };
  }
};

// Load photos metadata only (no image data) for fast initial load
export const loadPhotosMetadataOnly = async (limit = 50, offset = 0) => {
  try {
    const { data, error } = await supabase
      .from("photos")
      .select(
        "id, lat, lng, timestamp, filename, type, name, description, created_at"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error loading photos metadata:", error);
      return { success: false, error };
    }

    console.log(`Photos metadata loaded (${data.length} photos)`);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading photos metadata:", error);
    return { success: false, error };
  }
};

// Load thumbnail for a single photo
export const loadPhotoThumbnail = async (photoId) => {
  try {
    const { data, error } = await supabase
      .from("photos")
      .select("thumbnail_data")
      .eq("id", photoId)
      .single();

    if (error) {
      console.error("Error loading photo thumbnail:", error);
      return { success: false, error };
    }

    return { success: true, data: data.thumbnail_data };
  } catch (error) {
    console.error("Error loading photo thumbnail:", error);
    return { success: false, error };
  }
};

// Load photos with thumbnails only for better performance
export const loadPhotosWithThumbnails = async (limit = 50, offset = 0) => {
  try {
    const { data, error } = await supabase
      .from("photos")
      .select(
        "id, lat, lng, thumbnail_data, timestamp, filename, type, name, description, created_at"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error loading photos with thumbnails:", error);
      return { success: false, error };
    }

    // Process data to use thumbnail as imageData for display
    const processedData = data.map((photo) => ({
      ...photo,
      imageData: photo.thumbnail_data, // Use thumbnail for display
      hasFullImage: !!photo.thumbnail_data, // Flag to indicate if full image is available
    }));

    console.log(
      `Photos with thumbnails loaded (${processedData.length} photos):`,
      processedData
    );
    return { success: true, data: processedData };
  } catch (error) {
    console.error("Error loading photos with thumbnails:", error);
    return { success: false, error };
  }
};

// Get full image data for a specific photo (for modal view)
export const getFullImageData = async (photoId) => {
  try {
    const { data, error } = await supabase
      .from("photos")
      .select("image_data, storage_path")
      .eq("id", photoId)
      .single();

    if (error) {
      console.error("Error loading full image data:", error);
      return { success: false, error };
    }

    return { success: true, data: data.image_data };
  } catch (error) {
    console.error("Error loading full image:", error);
    return { success: false, error };
  }
};

// Get original image from storage for a specific photo
export const getOriginalImageData = async (photoId) => {
  try {
    const { data, error } = await supabase
      .from("photos")
      .select("storage_path")
      .eq("id", photoId)
      .single();

    if (error) {
      console.error("Error loading photo storage path:", error);
      return { success: false, error };
    }

    if (!data.storage_path) {
      return {
        success: false,
        error: { message: "No original image found in storage" },
      };
    }

    // Download original image from storage
    const originalImageData = await downloadOriginalImage(data.storage_path);
    return { success: true, data: originalImageData };
  } catch (error) {
    console.error("Error loading original image:", error);
    return { success: false, error };
  }
};

// Update photo type in Supabase
export const updatePhotoType = async (photoId, newType, user) => {
  try {
    // Check admin permission
    requireAdmin(user);

    const { data, error } = await supabase
      .from("photos")
      .update({ type: newType })
      .eq("id", photoId)
      .select();

    if (error) {
      console.error("Error updating photo type:", error);
      return { success: false, error };
    }

    console.log("Photo type updated in database:", data);
    return { success: true, data: data[0] };
  } catch (error) {
    console.error("Error updating photo type:", error);
    return { success: false, error };
  }
};

// Update photo name and description in Supabase
export const updatePhotoDetails = async (photoId, name, description, user) => {
  try {
    // Check admin permission
    requireAdmin(user);

    const { data, error } = await supabase
      .from("photos")
      .update({
        name: name || null,
        description: description || null,
      })
      .eq("id", photoId)
      .select();

    if (error) {
      console.error("Error updating photo details:", error);
      return { success: false, error };
    }

    console.log("Photo details updated in database:", data);
    return { success: true, data: data[0] };
  } catch (error) {
    console.error("Error updating photo details:", error);
    return { success: false, error };
  }
};

// Delete photo from Supabase
export const deletePhotoFromDatabase = async (photoId, user) => {
  try {
    // Check admin permission
    requireAdmin(user);

    // First, get the storage path before deleting from database
    const { data: photoData, error: fetchError } = await supabase
      .from("photos")
      .select("storage_path")
      .eq("id", photoId)
      .single();

    if (fetchError) {
      console.error("Error fetching photo storage path:", fetchError);
      // Continue with database deletion even if we can't get storage path
    }

    // Delete from database
    const { error } = await supabase.from("photos").delete().eq("id", photoId);

    if (error) {
      console.error("Error deleting photo from database:", error);
      return { success: false, error };
    }

    // Delete from storage if storage path exists
    if (photoData && photoData.storage_path) {
      try {
        await deleteOriginalImage(photoData.storage_path);
        console.log("Original image deleted from storage");
      } catch (storageError) {
        console.error(
          "Error deleting from storage (non-critical):",
          storageError
        );
        // Don't fail the entire operation if storage deletion fails
      }
    }

    console.log("Photo deleted from database and storage");
    return { success: true };
  } catch (error) {
    console.error("Error deleting photo:", error);
    return { success: false, error };
  }
};
