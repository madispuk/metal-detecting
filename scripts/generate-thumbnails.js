#!/usr/bin/env node

/**
 * Thumbnail Generation Script
 *
 * This script generates thumbnails for existing photos in the database that don't have them yet.
 * It uses Sharp for efficient image processing and handles batch processing with progress tracking.
 *
 * Usage:
 *   npm run generate-thumbnails
 *   node generate-thumbnails.js
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

// Get the directory of the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, ".env") });

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing required environment variables!");
  console.error("Please create a .env file with the following variables:");
  console.error("VITE_SUPABASE_URL=your-supabase-url");
  console.error("VITE_SUPABASE_ANON_KEY=your-supabase-anon-key");
  console.error("\nExample .env file:");
  console.error("VITE_SUPABASE_URL=https://your-project.supabase.co");
  console.error("VITE_SUPABASE_ANON_KEY=your-anon-key-here");
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration - Improved quality settings
const THUMBNAIL_CONFIG = {
  maxWidth: 800, // Increased from 150 to 300 for better quality
  maxHeight: 800, // Increased from 150 to 300 for better quality
  quality: 80, // Increased from 60 to 85 for much better quality
  format: "jpeg",
  preserveOrientation: true, // Preserve EXIF orientation
};

const BATCH_SIZE = 5; // Process photos in smaller batches to avoid timeouts
const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches
const QUERY_TIMEOUT = 30000; // 30 second timeout for database queries
const MAX_RETRIES = 3; // Maximum number of retries for failed queries

// Parse command line arguments
const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : null;
const regenerateMode = args.includes("--regenerate");

/**
 * Retry wrapper for database operations
 * @param {Function} operation - The operation to retry
 * @param {string} operationName - Name of the operation for logging
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of the operation
 */
async function retryOperation(
  operation,
  operationName,
  maxRetries = MAX_RETRIES
) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isTimeout =
        error.message.includes("timeout") ||
        error.message.includes("canceling statement");

      if (isTimeout && attempt < maxRetries) {
        const delay = attempt * 2000; // Exponential backoff
        console.log(
          `⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}): ${error.message}`
        );
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Create a thumbnail from base64 image data using Sharp with improved quality
 * @param {string} base64Image - Base64 encoded image data
 * @param {Object} config - Thumbnail configuration
 * @returns {Promise<string>} Base64 encoded thumbnail
 */
async function createThumbnail(base64Image, config = THUMBNAIL_CONFIG) {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, "");

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Create thumbnail using Sharp with improved settings
    const thumbnailBuffer = await sharp(imageBuffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(config.maxWidth, config.maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3, // Better resampling algorithm
      })
      .jpeg({
        quality: config.quality,
        progressive: true, // Progressive JPEG for better loading
        mozjpeg: true, // Use mozjpeg encoder for better compression
      })
      .toBuffer();

    // Convert back to base64
    const thumbnailBase64 = thumbnailBuffer.toString("base64");
    return `data:image/jpeg;base64,${thumbnailBase64}`;
  } catch (error) {
    console.error("Error creating thumbnail:", error);
    throw error;
  }
}

/**
 * Get photos that don't have thumbnails yet (with pagination)
 * @param {number} limit - Number of photos to fetch per batch
 * @param {number} offset - Starting offset for pagination
 * @returns {Promise<Object>} Object containing photos array and hasMore flag
 */
async function getPhotosWithoutThumbnails(limit = 50, offset = 0) {
  try {
    console.log(
      `🔍 Fetching photos without thumbnails (limit: ${limit}, offset: ${offset})...`
    );

    const { data: photos, error } = await supabase
      .from("photos")
      .select("id, image_data, filename, created_at")
      .is("thumbnail_data", null)
      .order("created_at", { ascending: true }) // Process oldest first
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const hasMore = photos.length === limit;
    console.log(
      `📊 Found ${photos.length} photos without thumbnails${
        hasMore ? " (more available)" : ""
      }`
    );

    return {
      photos,
      hasMore,
      total: photos.length,
    };
  } catch (error) {
    console.error("❌ Error fetching photos:", error);
    throw error;
  }
}

/**
 * Get photos that have existing thumbnails (for regeneration)
 * @param {number} limit - Number of photos to fetch per batch
 * @param {number} offset - Starting offset for pagination
 * @returns {Promise<Object>} Object containing photos array and hasMore flag
 */
async function getPhotosWithThumbnails(limit = 50, offset = 0) {
  try {
    console.log(
      `🔍 Fetching photos with existing thumbnails for regeneration (limit: ${limit}, offset: ${offset})...`
    );

    // First, get just the IDs to avoid timeout with large data
    const { data: photoIds, error: idsError } = await supabase
      .from("photos")
      .select("id")
      .not("thumbnail_data", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (idsError) {
      throw new Error(`Database error (IDs): ${idsError.message}`);
    }

    if (!photoIds || photoIds.length === 0) {
      return {
        photos: [],
        hasMore: false,
        total: 0,
      };
    }

    // Now fetch the full data for just these IDs
    const ids = photoIds.map((p) => p.id);
    const { data: photos, error } = await supabase
      .from("photos")
      .select("id, image_data, thumbnail_data, filename, created_at")
      .in("id", ids)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Database error (full data): ${error.message}`);
    }

    const hasMore = photoIds.length === limit;
    console.log(
      `📊 Found ${photos.length} photos with existing thumbnails${
        hasMore ? " (more available)" : ""
      }`
    );

    return {
      photos: photos || [],
      hasMore,
      total: photos?.length || 0,
    };
  } catch (error) {
    console.error("❌ Error fetching photos:", error);
    throw error;
  }
}

/**
 * Get total count of photos without thumbnails (for progress tracking)
 * @returns {Promise<number>} Total count of photos without thumbnails
 */
async function getPhotosWithoutThumbnailsCount() {
  try {
    console.log("🔢 Counting photos without thumbnails...");

    const { count, error } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .is("thumbnail_data", null);

    if (error) {
      console.warn(
        "⚠️ Could not get total count, proceeding without it:",
        error.message
      );
      return null;
    }

    console.log(`📊 Total photos without thumbnails: ${count}`);
    return count;
  } catch (error) {
    console.warn(
      "⚠️ Could not get total count, proceeding without it:",
      error.message
    );
    return null;
  }
}

/**
 * Get total count of photos with thumbnails (for regeneration progress tracking)
 * @returns {Promise<number>} Total count of photos with thumbnails
 */
async function getPhotosWithThumbnailsCount() {
  try {
    console.log("🔢 Counting photos with existing thumbnails...");

    const { count, error } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .not("thumbnail_data", "is", null);

    if (error) {
      console.warn(
        "⚠️ Could not get total count, proceeding without it:",
        error.message
      );
      return null;
    }

    console.log(`📊 Total photos with existing thumbnails: ${count}`);
    return count;
  } catch (error) {
    console.warn(
      "⚠️ Could not get total count, proceeding without it:",
      error.message
    );
    return null;
  }
}

/**
 * Update a photo with its thumbnail
 * @param {number} photoId - Photo ID
 * @param {string} thumbnailData - Base64 encoded thumbnail
 * @returns {Promise<boolean>} Success status
 */
async function updatePhotoWithThumbnail(photoId, thumbnailData) {
  try {
    const { error } = await supabase
      .from("photos")
      .update({ thumbnail_data: thumbnailData })
      .eq("id", photoId);

    if (error) {
      throw new Error(`Update error: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error updating photo ${photoId}:`, error);
    return false;
  }
}

/**
 * Process a batch of photos
 * @param {Array} photos - Array of photos to process
 * @param {number} batchIndex - Current batch index
 * @returns {Promise<Object>} Processing results
 */
async function processBatch(photos, batchIndex) {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

  console.log(
    `\n🔄 Processing batch ${batchIndex + 1} (${photos.length} photos)...`
  );

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const photoNumber = batchIndex * BATCH_SIZE + i + 1;

    try {
      console.log(
        `  📸 Processing photo ${photoNumber} (ID: ${photo.id})${
          photo.filename ? ` - ${photo.filename}` : ""
        }`
      );

      // Generate thumbnail
      const thumbnail = await createThumbnail(photo.image_data);

      // Update database with retry logic
      const success = await retryOperation(
        () => updatePhotoWithThumbnail(photo.id, thumbnail),
        `Updating photo ${photo.id}`
      );

      if (success) {
        results.successful++;
        console.log(
          `    ✅ Successfully generated thumbnail for photo ${photo.id}`
        );
      } else {
        results.failed++;
        results.errors.push(`Photo ${photo.id}: Update failed`);
      }

      results.processed++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Photo ${photo.id}: ${error.message}`);
      console.error(
        `    ❌ Error processing photo ${photo.id}:`,
        error.message
      );
    }
  }

  return results;
}

/**
 * Main function to generate thumbnails for all photos without them
 */
async function generateThumbnailsForExistingPhotos() {
  const mode = regenerateMode ? "regeneration" : "generation";
  console.log(`🚀 Starting thumbnail ${mode} process...\n`);

  try {
    // Get total count for progress tracking (optional)
    const totalCount = regenerateMode
      ? await getPhotosWithThumbnailsCount()
      : await getPhotosWithoutThumbnailsCount();

    // Process photos in paginated batches
    const FETCH_BATCH_SIZE = 3; // Very small fetch batches to avoid timeouts
    let offset = 0;
    let hasMore = true;
    let overallResults = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
    };

    console.log(`📦 Processing photos in batches of ${FETCH_BATCH_SIZE}...`);
    if (limit) {
      console.log(`🔢 Limited to processing ${limit} photos maximum`);
    }
    if (regenerateMode) {
      console.log(`🔄 Regenerating existing thumbnails with improved quality`);
    }
    console.log();

    while (hasMore) {
      // Calculate how many photos to fetch this time
      const fetchSize = limit
        ? Math.min(FETCH_BATCH_SIZE, limit - overallResults.processed)
        : FETCH_BATCH_SIZE;

      if (limit && overallResults.processed >= limit) {
        console.log(`🔢 Reached limit of ${limit} photos. Stopping.`);
        break;
      }

      // Fetch next batch of photos with retry logic
      const result = await retryOperation(
        () =>
          regenerateMode
            ? getPhotosWithThumbnails(fetchSize, offset)
            : getPhotosWithoutThumbnails(fetchSize, offset),
        `Fetching photos batch (offset: ${offset})`
      );
      const photos = result.photos;
      hasMore = result.hasMore;

      if (photos.length === 0) {
        console.log("✅ No more photos found that need thumbnails.");
        break;
      }

      // Update total count
      if (overallResults.total === 0) {
        overallResults.total = totalCount || photos.length;
      }

      console.log(
        `\n📸 Processing batch starting at offset ${offset} (${photos.length} photos)...`
      );

      // Process this batch of photos in smaller processing batches
      const processingBatches = Math.ceil(photos.length / BATCH_SIZE);

      for (let batchIndex = 0; batchIndex < processingBatches; batchIndex++) {
        const startIndex = batchIndex * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, photos.length);
        const batchPhotos = photos.slice(startIndex, endIndex);

        // Process current batch
        const batchResults = await processBatch(batchPhotos, batchIndex);

        // Update overall results
        overallResults.processed += batchResults.processed;
        overallResults.successful += batchResults.successful;
        overallResults.failed += batchResults.failed;
        overallResults.errors.push(...batchResults.errors);

        // Add delay between processing batches
        if (batchIndex < processingBatches - 1) {
          console.log(
            `⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next processing batch...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, DELAY_BETWEEN_BATCHES)
          );
        }
      }

      // Update offset for next fetch
      offset += FETCH_BATCH_SIZE;

      // Add delay between fetch batches
      if (hasMore) {
        console.log(
          `⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before fetching next batch...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES)
        );
      }
    }

    // Print final results
    console.log("\n📊 Thumbnail Generation Complete!");
    console.log("================================");
    console.log(`📸 Total photos processed: ${overallResults.processed}`);
    console.log(`✅ Successfully processed: ${overallResults.successful}`);
    console.log(`❌ Failed: ${overallResults.failed}`);

    if (overallResults.processed > 0) {
      console.log(
        `📈 Success rate: ${(
          (overallResults.successful / overallResults.processed) *
          100
        ).toFixed(1)}%`
      );
    }

    if (overallResults.errors.length > 0) {
      console.log("\n❌ Errors encountered:");
      overallResults.errors.forEach((error) => console.log(`  - ${error}`));
    }

    if (overallResults.successful > 0) {
      console.log("\n🎉 Thumbnail generation completed successfully!");
    } else if (overallResults.processed === 0) {
      console.log("\n✅ No photos found that need thumbnails. All done!");
    }
  } catch (error) {
    console.error("💥 Fatal error during thumbnail generation:", error);
    process.exit(1);
  }
}

// Handle command line arguments
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Thumbnail Generation Script

Usage:
  npm run generate-thumbnails
  node generate-thumbnails.js
  node generate-thumbnails.js --limit=50
  node generate-thumbnails.js --regenerate

Options:
  --help, -h           Show this help message
  --limit=N            Limit processing to N photos (useful for testing)
  --regenerate         Regenerate existing thumbnails with improved quality

Environment Variables:
  VITE_SUPABASE_URL        Your Supabase project URL
  VITE_SUPABASE_ANON_KEY  Your Supabase anonymous key

This script will:
1. Find all photos in the database (without thumbnails OR with existing ones if --regenerate)
2. Generate high-quality thumbnails using Sharp with improved settings
3. Update the database with the generated thumbnails
4. Provide progress tracking and error reporting
5. Process photos in small batches to avoid database timeouts

Improved Quality Features:
- Higher resolution (300x300 vs 150x150)
- Better quality (85% vs 60%)
- Orientation preservation (auto-rotation)
- Better resampling (Lanczos3)
- Progressive JPEG encoding
- mozjpeg compression

Examples:
  # Process all photos without thumbnails
  npm run generate-thumbnails
  
  # Test with just 10 photos
  npm run generate-thumbnails -- --limit=10
  
  # Regenerate existing thumbnails with better quality
  npm run generate-thumbnails -- --regenerate
  
  # Regenerate up to 50 existing thumbnails
  node generate-thumbnails.js --regenerate --limit=50
`);
  process.exit(0);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateThumbnailsForExistingPhotos()
    .then(() => {
      console.log("\n🏁 Script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Script failed:", error);
      process.exit(1);
    });
}
