#!/usr/bin/env node

/**
 * Regenerate Thumbnails Script
 *
 * This script allows you to regenerate thumbnails for specific photos by ID or all photos.
 * It provides better control and flexibility compared to the original generate-thumbnails.js script.
 *
 * Usage:
 *   npm run regenerate-thumbnails
 *   node regenerate-thumbnails.js --all
 *   node regenerate-thumbnails.js --id=123
 *   node regenerate-thumbnails.js --id=123,456,789
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

// Configuration - High quality settings
const THUMBNAIL_CONFIG = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 85,
  format: "jpeg",
  preserveOrientation: true,
};

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 2000;
const QUERY_TIMEOUT = 30000;
const MAX_RETRIES = 3;

// Parse command line arguments
const args = process.argv.slice(2);
const allMode = args.includes("--all");
const idArg = args.find((arg) => arg.startsWith("--id="));
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const dryRun = args.includes("--dry-run");

// Parse photo IDs
let photoIds = [];
if (idArg) {
  const idString = idArg.split("=")[1];
  photoIds = idString
    .split(",")
    .map((id) => parseInt(id.trim()))
    .filter((id) => !isNaN(id));
}

// Parse limit
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : null;

/**
 * Retry wrapper for database operations
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
        const delay = attempt * 2000;
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
 * Create a thumbnail from base64 image data using Sharp
 */
async function createThumbnail(base64Image, config = THUMBNAIL_CONFIG) {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, "");

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Create thumbnail using Sharp
    const thumbnailBuffer = await sharp(imageBuffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(config.maxWidth, config.maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .jpeg({
        quality: config.quality,
        progressive: true,
        mozjpeg: true,
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
 * Get photos by specific IDs
 */
async function getPhotosByIds(ids) {
  try {
    console.log(`🔍 Fetching photos with IDs: ${ids.join(", ")}...`);

    const { data: photos, error } = await supabase
      .from("photos")
      .select("id, image_data, thumbnail_data, filename, created_at")
      .in("id", ids);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!photos || photos.length === 0) {
      console.log("❌ No photos found with the specified IDs");
      return { photos: [], hasMore: false, total: 0 };
    }

    console.log(`📊 Found ${photos.length} photos with the specified IDs`);
    return {
      photos,
      hasMore: false,
      total: photos.length,
    };
  } catch (error) {
    console.error("❌ Error fetching photos by IDs:", error);
    throw error;
  }
}

/**
 * Get all photos (with pagination)
 */
async function getAllPhotos(limit = 50, offset = 0) {
  try {
    console.log(
      `🔍 Fetching all photos (limit: ${limit}, offset: ${offset})...`
    );

    const { data: photos, error } = await supabase
      .from("photos")
      .select("id, image_data, thumbnail_data, filename, created_at")
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const hasMore = photos.length === limit;
    console.log(
      `📊 Found ${photos.length} photos${hasMore ? " (more available)" : ""}`
    );

    return {
      photos: photos || [],
      hasMore,
      total: photos?.length || 0,
    };
  } catch (error) {
    console.error("❌ Error fetching all photos:", error);
    throw error;
  }
}

/**
 * Get total count of all photos
 */
async function getAllPhotosCount() {
  try {
    console.log("🔢 Counting all photos...");

    const { count, error } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.warn(
        "⚠️ Could not get total count, proceeding without it:",
        error.message
      );
      return null;
    }

    console.log(`📊 Total photos: ${count}`);
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

      if (dryRun) {
        console.log(
          `    🔍 [DRY RUN] Would regenerate thumbnail for photo ${photo.id}`
        );
        results.successful++;
        results.processed++;
        continue;
      }

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
          `    ✅ Successfully regenerated thumbnail for photo ${photo.id}`
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
 * Main function to regenerate thumbnails
 */
async function regenerateThumbnails() {
  console.log(`🚀 Starting thumbnail regeneration process...\n`);

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  try {
    let photos;
    let totalCount = null;

    if (photoIds.length > 0) {
      // Process specific photo IDs
      console.log(`🎯 Processing specific photos: ${photoIds.join(", ")}`);
      const result = await getPhotosByIds(photoIds);
      photos = result.photos;
      totalCount = photos.length;
    } else if (allMode) {
      // Process all photos
      console.log("🌍 Processing all photos");
      totalCount = await getAllPhotosCount();

      // Process photos in paginated batches
      const FETCH_BATCH_SIZE = 3;
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
      console.log();

      while (hasMore) {
        const fetchSize = limit
          ? Math.min(FETCH_BATCH_SIZE, limit - overallResults.processed)
          : FETCH_BATCH_SIZE;

        if (limit && overallResults.processed >= limit) {
          console.log(`🔢 Reached limit of ${limit} photos. Stopping.`);
          break;
        }

        const result = await retryOperation(
          () => getAllPhotos(fetchSize, offset),
          `Fetching photos batch (offset: ${offset})`
        );
        const batchPhotos = result.photos;
        hasMore = result.hasMore;

        if (batchPhotos.length === 0) {
          console.log("✅ No more photos found.");
          break;
        }

        if (overallResults.total === 0) {
          overallResults.total = totalCount || batchPhotos.length;
        }

        console.log(
          `\n📸 Processing batch starting at offset ${offset} (${batchPhotos.length} photos)...`
        );

        const processingBatches = Math.ceil(batchPhotos.length / BATCH_SIZE);

        for (let batchIndex = 0; batchIndex < processingBatches; batchIndex++) {
          const startIndex = batchIndex * BATCH_SIZE;
          const endIndex = Math.min(
            startIndex + BATCH_SIZE,
            batchPhotos.length
          );
          const batchPhotosSlice = batchPhotos.slice(startIndex, endIndex);

          const batchResults = await processBatch(batchPhotosSlice, batchIndex);

          overallResults.processed += batchResults.processed;
          overallResults.successful += batchResults.successful;
          overallResults.failed += batchResults.failed;
          overallResults.errors.push(...batchResults.errors);

          if (batchIndex < processingBatches - 1) {
            console.log(
              `⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next processing batch...`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, DELAY_BETWEEN_BATCHES)
            );
          }
        }

        offset += FETCH_BATCH_SIZE;

        if (hasMore) {
          console.log(
            `⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before fetching next batch...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, DELAY_BETWEEN_BATCHES)
          );
        }
      }

      // Print final results for all mode
      console.log("\n📊 Thumbnail Regeneration Complete!");
      console.log("====================================");
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
        console.log("\n🎉 Thumbnail regeneration completed successfully!");
      } else if (overallResults.processed === 0) {
        console.log("\n✅ No photos found to process.");
      }

      return;
    } else {
      console.error("❌ Please specify either --all or --id=<photo_ids>");
      console.error("Use --help for more information");
      process.exit(1);
    }

    // Process specific photo IDs
    if (photos.length === 0) {
      console.log("✅ No photos found to process.");
      return;
    }

    console.log(`\n📸 Processing ${photos.length} photos...`);

    const processingBatches = Math.ceil(photos.length / BATCH_SIZE);
    let overallResults = {
      total: photos.length,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (let batchIndex = 0; batchIndex < processingBatches; batchIndex++) {
      const startIndex = batchIndex * BATCH_SIZE;
      const endIndex = Math.min(startIndex + BATCH_SIZE, photos.length);
      const batchPhotos = photos.slice(startIndex, endIndex);

      const batchResults = await processBatch(batchPhotos, batchIndex);

      overallResults.processed += batchResults.processed;
      overallResults.successful += batchResults.successful;
      overallResults.failed += batchResults.failed;
      overallResults.errors.push(...batchResults.errors);

      if (batchIndex < processingBatches - 1) {
        console.log(
          `⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next processing batch...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES)
        );
      }
    }

    // Print final results
    console.log("\n📊 Thumbnail Regeneration Complete!");
    console.log("====================================");
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
      console.log("\n🎉 Thumbnail regeneration completed successfully!");
    } else if (overallResults.processed === 0) {
      console.log("\n✅ No photos found to process.");
    }
  } catch (error) {
    console.error("💥 Fatal error during thumbnail regeneration:", error);
    process.exit(1);
  }
}

// Handle command line arguments
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Regenerate Thumbnails Script

Usage:
  npm run regenerate-thumbnails
  node regenerate-thumbnails.js --all
  node regenerate-thumbnails.js --id=123
  node regenerate-thumbnails.js --id=123,456,789
  node regenerate-thumbnails.js --all --limit=50
  node regenerate-thumbnails.js --id=123 --dry-run

Options:
  --help, -h           Show this help message
  --all                Regenerate thumbnails for all photos
  --id=ID1,ID2,ID3     Regenerate thumbnails for specific photo IDs (comma-separated)
  --limit=N            Limit processing to N photos (only works with --all)
  --dry-run            Show what would be done without making changes

Environment Variables:
  VITE_SUPABASE_URL        Your Supabase project URL
  VITE_SUPABASE_ANON_KEY  Your Supabase anonymous key

Examples:
  # Regenerate thumbnails for all photos
  npm run regenerate-thumbnails -- --all
  
  # Regenerate thumbnails for specific photos
  node regenerate-thumbnails.js --id=123,456,789
  
  # Test with dry run
  node regenerate-thumbnails.js --all --dry-run
  
  # Limit processing to 10 photos
  node regenerate-thumbnails.js --all --limit=10
`);
  process.exit(0);
}

// Validate arguments
if (!allMode && photoIds.length === 0) {
  console.error("❌ Please specify either --all or --id=<photo_ids>");
  console.error("Use --help for more information");
  process.exit(1);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  regenerateThumbnails()
    .then(() => {
      console.log("\n🏁 Script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Script failed:", error);
      process.exit(1);
    });
}
