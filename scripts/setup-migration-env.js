#!/usr/bin/env node

/**
 * Setup script for migration environment
 *
 * This script helps you set up the environment variables needed for the migration.
 * It will guide you through getting your Supabase service role key.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, ".env");

console.log("🔧 Migration Environment Setup");
console.log("==============================\n");

// Check if .env file exists
if (fs.existsSync(envPath)) {
  console.log("✅ .env file found");

  // Read existing .env content
  const envContent = fs.readFileSync(envPath, "utf8");
  const hasServiceKey = envContent.includes("SUPABASE_SERVICE_ROLE_KEY");

  if (hasServiceKey) {
    console.log("✅ SUPABASE_SERVICE_ROLE_KEY already configured");
    console.log("🚀 You can now run the migration script!");
    console.log("\nNext steps:");
    console.log("1. Test with dry run: npm run migrate-images:dry-run");
    console.log("2. Run migration: npm run migrate-images");
  } else {
    console.log("⚠️  SUPABASE_SERVICE_ROLE_KEY not found in .env file");
    console.log("\n📋 To get your service role key:");
    console.log("1. Go to your Supabase project dashboard");
    console.log("2. Navigate to Settings > API");
    console.log('3. Copy the "service_role" key (not the anon key)');
    console.log("4. Add it to your .env file as:");
    console.log("   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here");
    console.log("\n⚠️  WARNING: The service role key bypasses RLS policies.");
    console.log("   Keep it secure and never commit it to version control!");
  }
} else {
  console.log("❌ .env file not found");
  console.log("\n📋 Create a .env file with the following variables:");
  console.log("VITE_SUPABASE_URL=your_supabase_url");
  console.log("VITE_SUPABASE_ANON_KEY=your_anon_key");
  console.log("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key");
  console.log(
    "\n💡 You can find these in your Supabase project dashboard under Settings > API"
  );
}

console.log("\n📚 For more information, see IMAGE_MIGRATION.md");
