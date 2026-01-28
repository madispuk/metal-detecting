#!/usr/bin/env node

/**
 * Migration Script: Move Base64 Images from Database to Supabase Storage
 *
 * This script migrates existing base64 images stored in the database to Supabase Storage.
 * It processes images in batches to avoid memory issues and provides progress tracking.
 *
 * Usage:
 *   node migrate-images-to-storage.js [options]
 *
 * Options:
 *   --batch-size=N     Number of images to process per batch (default: 10)
 *   --dry-run          Show what would be migrated without making changes
 *   --resume           Resume from where the script left off
 *   --cleanup          Remove base64 data after successful migration
 *   --auth-email=EMAIL Authenticate with email (requires password prompt)
 *   --help             Show this help message
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_BATCH_SIZE = 10;
const PROGRESS_FILE = path.join(__dirname, "migration-progress.json");
const LOG_FILE = path.join(__dirname, "migration.log");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  batchSize: DEFAULT_BATCH_SIZE,
  dryRun: false,
  resume: false,
  cleanup: false,
  authEmail: null,
  help: false,
};

// Parse arguments
for (const arg of args) {
  if (arg.startsWith("--batch-size=")) {
    options.batchSize = parseInt(arg.split("=")[1]) || DEFAULT_BATCH_SIZE;
  } else if (arg === "--dry-run") {
    options.dryRun = true;
  } else if (arg === "--resume") {
    options.resume = true;
  } else if (arg === "--cleanup") {
    options.cleanup = true;
  } else if (arg.startsWith("--auth-email=")) {
    options.authEmail = arg.split("=")[1];
  } else if (arg === "--help") {
    options.help = true;
  }
}

// Show help
if (options.help) {
  console.log(`
Migration Script: Move Base64 Images from Database to Supabase Storage

Usage:
  node migrate-images-to-storage.js [options]

Options:
  --batch-size=N     Number of images to process per batch (default: 10)
  --dry-run       Show what would be migrated without making changes
  --resume        Resume from where the script left off
  --cleanup       Remove base64 data after successful migration
  --auth-email=EMAIL  Authenticate with email (requires password prompt)
  --help          Show this help message

Examples:
  node migrate-images-to-storage.js --dry-run
  node migrate-images-to-storage.js --batch-size=5 --resume
  node migrate-images-to-storage.js --cleanup
  node migrate-images-to-storage.js --auth-email=admin@example.com

Environment Variables:
  VITE_SUPABASE_URL          Your Supabase project URL
  VITE_SUPABASE_ANON_KEY     Your Supabase anon key
  SUPABASE_SERVICE_ROLE_KEY  Service role key (bypasses RLS) - recommended for migrations
`);
  process.exit(0);
}

// Initialize Supabase client
let supabase;
try {
  // Try to load environment variables from .env file
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const envLines = envContent.split("\n");
    for (const line of envLines) {
      const [key, value] = line.split("=");
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  // Use service role key if available (bypasses RLS), otherwise use anon key
  const keyToUse = supabaseServiceKey || supabaseKey;
  supabase = createClient(supabaseUrl, keyToUse);

  if (supabaseServiceKey) {
    console.log(
      "✅ Supabase client initialized with service role key (bypasses RLS)"
    );
  } else {
    console.log("✅ Supabase client initialized with anon key");
    console.log(
      "⚠️  Note: You may need to authenticate or use service role key for storage operations"
    );
  }
} catch (error) {
  console.error("❌ Failed to initialize Supabase client:", error.message);
  console.error(
    "Please ensure your .env file contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  );
  console.error(
    "For storage operations, consider adding SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

// Authentication function
const authenticateUser = async (email) => {
  if (!email) {
    return false;
  }

  try {
    console.log(`🔐 Attempting to authenticate with email: ${email}`);

    // For now, we'll just log that authentication would be needed
    // In a real implementation, you'd prompt for password and authenticate
    console.log("⚠️  Authentication not implemented in this version.");
    console.log(
      "💡 Recommended: Use SUPABASE_SERVICE_ROLE_KEY environment variable instead"
    );
    console.log(
      "💡 Or update your storage RLS policies to allow anonymous uploads"
    );

    return false;
  } catch (error) {
    console.error("❌ Authentication failed:", error.message);
    return false;
  }
};

// Logging utility
const log = (message, level = "INFO") => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);

  // Write to log file
  fs.appendFileSync(LOG_FILE, logMessage + "\n");
};

// Progress tracking
const loadProgress = () => {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
    } catch (error) {
      log(`Warning: Could not load progress file: ${error.message}`, "WARN");
    }
  }
  return {
    processed: 0,
    successful: 0,
    failed: 0,
    lastProcessedId: 0,
    startTime: new Date().toISOString(),
  };
};

const saveProgress = (progress) => {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
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

// Helper function to create unique filename
const createUniqueFilename = (photo) => {
  const timestamp = photo.timestamp || photo.created_at;
  const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, "-");
  const filename = photo.filename || "photo.jpg";
  const userId = photo.user_id || "unknown";
  return `${userId}/${dateStr}_${filename}`;
};

// Upload image to storage
const uploadToStorage = async (base64Image, filename) => {
  try {
    const blob = base64ToBlob(base64Image);

    const { data, error } = await supabase.storage
      .from("original-images")
      .upload(filename, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    return data.path;
  } catch (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
};

// Update database record with storage path
const updatePhotoStoragePath = async (photoId, storagePath) => {
  try {
    const { error } = await supabase
      .from("photos")
      .update({ storage_path: storagePath })
      .eq("id", photoId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    throw new Error(`Database update failed: ${error.message}`);
  }
};

// Clean up base64 data from database
const cleanupBase64Data = async (photoId) => {
  try {
    const { error } = await supabase
      .from("photos")
      .update({
        image_data: null,
        thumbnail_data: null,
      })
      .eq("id", photoId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    throw new Error(`Cleanup failed: ${error.message}`);
  }
};

// Get photos that need migration
const getPhotosToMigrate = async (batchSize, lastProcessedId = 0) => {
  try {
    const { data, error } = await supabase
      .from("photos")
      .select(
        "id, image_data, thumbnail_data, timestamp, filename, user_id, created_at, storage_path"
      )
      .is("storage_path", null) // Only get photos without storage path
      .not("image_data", "is", null) // Only get photos with image data
      .gt("id", lastProcessedId) // Resume from where we left off
      .order("id", { ascending: true })
      .limit(batchSize);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    throw new Error(`Failed to fetch photos: ${error.message}`);
  }
};

// Get total count of photos that need migration
const getTotalPhotosToMigrate = async () => {
  try {
    const { count, error } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .is("storage_path", null)
      .not("image_data", "is", null);

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    log(`Warning: Could not get total count: ${error.message}`, "WARN");
    return 0;
  }
};

// Process a single photo
const processPhoto = async (photo) => {
  try {
    // Skip if already has storage path
    if (photo.storage_path) {
      return { success: true, skipped: true, reason: "Already migrated" };
    }

    // Skip if no image data
    if (!photo.image_data) {
      return { success: true, skipped: true, reason: "No image data" };
    }

    if (options.dryRun) {
      return { success: true, skipped: true, reason: "Dry run mode" };
    }

    // Create unique filename
    const filename = createUniqueFilename(photo);

    // Upload to storage
    const storagePath = await uploadToStorage(photo.image_data, filename);

    // Update database with storage path
    await updatePhotoStoragePath(photo.id, storagePath);

    // Clean up base64 data if requested
    if (options.cleanup) {
      await cleanupBase64Data(photo.id);
    }

    return { success: true, storagePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Main migration function
const runMigration = async () => {
  log("🚀 Starting image migration to Supabase Storage");
  log(
    `Configuration: batchSize=${options.batchSize}, dryRun=${options.dryRun}, resume=${options.resume}, cleanup=${options.cleanup}`
  );

  // Handle authentication if requested
  if (options.authEmail) {
    const authSuccess = await authenticateUser(options.authEmail);
    if (!authSuccess) {
      log("❌ Authentication failed. Exiting.", "ERROR");
      process.exit(1);
    }
  }

  // Load progress
  const progress = loadProgress();

  if (options.resume && progress.lastProcessedId > 0) {
    log(`📋 Resuming from photo ID ${progress.lastProcessedId}`);
  }

  // Get total count
  const totalPhotos = await getTotalPhotosToMigrate();
  log(`📊 Total photos to migrate: ${totalPhotos}`);

  if (totalPhotos === 0) {
    log("✅ No photos need migration");
    return;
  }

  let processed = progress.processed;
  let successful = progress.successful;
  let failed = progress.failed;
  let lastProcessedId = progress.lastProcessedId;

  try {
    while (true) {
      // Get batch of photos
      const photos = await getPhotosToMigrate(
        options.batchSize,
        lastProcessedId
      );

      if (photos.length === 0) {
        log("✅ No more photos to process");
        break;
      }

      log(`📦 Processing batch of ${photos.length} photos`);

      // Process each photo in the batch
      for (const photo of photos) {
        const result = await processPhoto(photo);

        processed++;

        if (result.success) {
          if (result.skipped) {
            log(`⏭️  Skipped photo ${photo.id}: ${result.reason}`);
          } else {
            successful++;
            log(`✅ Migrated photo ${photo.id} to ${result.storagePath}`);
          }
        } else {
          failed++;
          log(
            `❌ Failed to migrate photo ${photo.id}: ${result.error}`,
            "ERROR"
          );
        }

        lastProcessedId = photo.id;

        // Save progress after each photo
        saveProgress({
          processed,
          successful,
          failed,
          lastProcessedId,
          startTime: progress.startTime,
        });

        // Add small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Add delay between batches
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Final summary
    const duration = new Date() - new Date(progress.startTime);
    const durationMinutes = Math.round(duration / 60000);

    log("🎉 Migration completed!");
    log(`📊 Final Statistics:`);
    log(`   Total processed: ${processed}`);
    log(`   Successful: ${successful}`);
    log(`   Failed: ${failed}`);
    log(`   Duration: ${durationMinutes} minutes`);

    if (failed > 0) {
      log(
        `⚠️  ${failed} photos failed to migrate. Check the log for details.`,
        "WARN"
      );
    }

    // Clean up progress file if successful
    if (failed === 0) {
      fs.unlinkSync(PROGRESS_FILE);
      log("🧹 Progress file cleaned up");
    }
  } catch (error) {
    log(`💥 Migration failed: ${error.message}`, "ERROR");
    process.exit(1);
  }
};

// Run the migration
runMigration().catch((error) => {
  log(`💥 Unexpected error: ${error.message}`, "ERROR");
  process.exit(1);
});
