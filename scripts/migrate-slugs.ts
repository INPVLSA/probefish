#!/usr/bin/env npx tsx

/**
 * Migration script to generate slugs for existing resources
 *
 * Usage:
 *   npx tsx scripts/migrate-slugs.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Preview changes without writing to database
 *
 * This script will:
 *   1. Generate slugs for all Projects without slugs
 *   2. Generate slugs for all TestSuites without slugs
 *   3. Generate slugs for all Prompts without slugs
 *   4. Generate slugs for all Endpoints without slugs
 *
 * Slug conflicts are resolved by appending -1, -2, etc.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Import models after dotenv
import Project from "../lib/db/models/project";
import TestSuite from "../lib/db/models/testSuite";
import Prompt from "../lib/db/models/prompt";
import Endpoint from "../lib/db/models/endpoint";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI environment variable is not set");
  process.exit(1);
}

const isDryRun = process.argv.includes("--dry-run");

if (isDryRun) {
  console.log("🔍 DRY RUN MODE - No changes will be written to the database\n");
}

/**
 * Generate a slug from a name string
 */
function generateSlug(name: string): string {
  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length > 50) {
    slug = slug.substring(0, 50).replace(/-+$/, "");
  }

  if (slug.length < 3) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    while (slug.length < 3) {
      slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }

  return slug;
}

/**
 * Find a unique slug by appending -1, -2, etc. if needed
 */
async function findUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  if (!(await checkExists(baseSlug))) {
    return baseSlug;
  }

  let counter = 1;
  while (counter <= 100) {
    const candidate = `${baseSlug}-${counter}`;
    if (candidate.length <= 50 && !(await checkExists(candidate))) {
      return candidate;
    }
    counter++;
  }

  // Fallback with random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${baseSlug.substring(0, 43)}-${randomSuffix}`;
}

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to MongoDB\n");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB");
}

async function migrateProjects(): Promise<number> {
  console.log("📁 Migrating Projects...");

  const projects = await Project.find({ slug: { $exists: false } });
  console.log(`   Found ${projects.length} projects without slugs`);

  let updated = 0;

  // Group by organization for uniqueness check
  const orgProjects = new Map<string, typeof projects>();
  for (const project of projects) {
    const orgId = project.organizationId.toString();
    if (!orgProjects.has(orgId)) {
      orgProjects.set(orgId, []);
    }
    orgProjects.get(orgId)!.push(project);
  }

  for (const [orgId, orgProjectList] of orgProjects) {
    const usedSlugs = new Set<string>();

    // Get existing slugs in this org
    const existingSlugs = await Project.find(
      { organizationId: orgId, slug: { $exists: true } },
      { slug: 1 }
    );
    for (const p of existingSlugs) {
      if (p.slug) usedSlugs.add(p.slug);
    }

    for (const project of orgProjectList) {
      const baseSlug = generateSlug(project.name);
      const slug = await findUniqueSlug(baseSlug, async (s) => usedSlugs.has(s));
      usedSlugs.add(slug);

      console.log(`   ${project.name} -> ${slug}`);

      if (!isDryRun) {
        await Project.updateOne({ _id: project._id }, { $set: { slug } });
      }
      updated++;
    }
  }

  console.log(`   ✓ ${updated} projects ${isDryRun ? "would be" : ""} updated\n`);
  return updated;
}

async function migrateTestSuites(): Promise<number> {
  console.log("🧪 Migrating Test Suites...");

  const suites = await TestSuite.find({ slug: { $exists: false } });
  console.log(`   Found ${suites.length} test suites without slugs`);

  let updated = 0;

  // Group by project for uniqueness check
  const projectSuites = new Map<string, typeof suites>();
  for (const suite of suites) {
    const projectId = suite.projectId.toString();
    if (!projectSuites.has(projectId)) {
      projectSuites.set(projectId, []);
    }
    projectSuites.get(projectId)!.push(suite);
  }

  for (const [projectId, suiteList] of projectSuites) {
    const usedSlugs = new Set<string>();

    // Get existing slugs in this project
    const existingSlugs = await TestSuite.find(
      { projectId, slug: { $exists: true } },
      { slug: 1 }
    );
    for (const s of existingSlugs) {
      if (s.slug) usedSlugs.add(s.slug);
    }

    for (const suite of suiteList) {
      const baseSlug = generateSlug(suite.name);
      const slug = await findUniqueSlug(baseSlug, async (s) => usedSlugs.has(s));
      usedSlugs.add(slug);

      console.log(`   ${suite.name} -> ${slug}`);

      if (!isDryRun) {
        await TestSuite.updateOne({ _id: suite._id }, { $set: { slug } });
      }
      updated++;
    }
  }

  console.log(`   ✓ ${updated} test suites ${isDryRun ? "would be" : ""} updated\n`);
  return updated;
}

async function migratePrompts(): Promise<number> {
  console.log("📝 Migrating Prompts...");

  const prompts = await Prompt.find({ slug: { $exists: false } });
  console.log(`   Found ${prompts.length} prompts without slugs`);

  let updated = 0;

  // Group by project for uniqueness check
  const projectPrompts = new Map<string, typeof prompts>();
  for (const prompt of prompts) {
    const projectId = prompt.projectId.toString();
    if (!projectPrompts.has(projectId)) {
      projectPrompts.set(projectId, []);
    }
    projectPrompts.get(projectId)!.push(prompt);
  }

  for (const [projectId, promptList] of projectPrompts) {
    const usedSlugs = new Set<string>();

    // Get existing slugs in this project
    const existingSlugs = await Prompt.find(
      { projectId, slug: { $exists: true } },
      { slug: 1 }
    );
    for (const p of existingSlugs) {
      if (p.slug) usedSlugs.add(p.slug);
    }

    for (const prompt of promptList) {
      const baseSlug = generateSlug(prompt.name);
      const slug = await findUniqueSlug(baseSlug, async (s) => usedSlugs.has(s));
      usedSlugs.add(slug);

      console.log(`   ${prompt.name} -> ${slug}`);

      if (!isDryRun) {
        await Prompt.updateOne({ _id: prompt._id }, { $set: { slug } });
      }
      updated++;
    }
  }

  console.log(`   ✓ ${updated} prompts ${isDryRun ? "would be" : ""} updated\n`);
  return updated;
}

async function migrateEndpoints(): Promise<number> {
  console.log("🔗 Migrating Endpoints...");

  const endpoints = await Endpoint.find({ slug: { $exists: false } });
  console.log(`   Found ${endpoints.length} endpoints without slugs`);

  let updated = 0;

  // Group by project for uniqueness check
  const projectEndpoints = new Map<string, typeof endpoints>();
  for (const endpoint of endpoints) {
    const projectId = endpoint.projectId.toString();
    if (!projectEndpoints.has(projectId)) {
      projectEndpoints.set(projectId, []);
    }
    projectEndpoints.get(projectId)!.push(endpoint);
  }

  for (const [projectId, endpointList] of projectEndpoints) {
    const usedSlugs = new Set<string>();

    // Get existing slugs in this project
    const existingSlugs = await Endpoint.find(
      { projectId, slug: { $exists: true } },
      { slug: 1 }
    );
    for (const e of existingSlugs) {
      if (e.slug) usedSlugs.add(e.slug);
    }

    for (const endpoint of endpointList) {
      const baseSlug = generateSlug(endpoint.name);
      const slug = await findUniqueSlug(baseSlug, async (s) => usedSlugs.has(s));
      usedSlugs.add(slug);

      console.log(`   ${endpoint.name} -> ${slug}`);

      if (!isDryRun) {
        await Endpoint.updateOne({ _id: endpoint._id }, { $set: { slug } });
      }
      updated++;
    }
  }

  console.log(`   ✓ ${updated} endpoints ${isDryRun ? "would be" : ""} updated\n`);
  return updated;
}

async function main() {
  console.log("🚀 Slug Migration Script\n");
  console.log("=".repeat(50));

  await connectDB();

  try {
    const projectCount = await migrateProjects();
    const suiteCount = await migrateTestSuites();
    const promptCount = await migratePrompts();
    const endpointCount = await migrateEndpoints();

    console.log("=".repeat(50));
    console.log("\n📊 Summary:");
    console.log(`   Projects:    ${projectCount}`);
    console.log(`   Test Suites: ${suiteCount}`);
    console.log(`   Prompts:     ${promptCount}`);
    console.log(`   Endpoints:   ${endpointCount}`);
    console.log(`   Total:       ${projectCount + suiteCount + promptCount + endpointCount}`);

    if (isDryRun) {
      console.log("\n⚠️  This was a dry run. No changes were made.");
      console.log("   Run without --dry-run to apply changes.");
    } else {
      console.log("\n✅ Migration completed successfully!");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

main();
