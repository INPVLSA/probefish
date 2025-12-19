#!/usr/bin/env npx tsx

/**
 * CLI tool to manage user roles
 *
 * Usage:
 *   npx tsx scripts/manage-user.ts super-admin <email> [--revoke]
 *   npx tsx scripts/manage-user.ts org-admin <email> <org-slug> [--revoke]
 *   npx tsx scripts/manage-user.ts list-orgs <email>
 *
 * Examples:
 *   npx tsx scripts/manage-user.ts super-admin admin@example.com
 *   npx tsx scripts/manage-user.ts super-admin admin@example.com --revoke
 *   npx tsx scripts/manage-user.ts org-admin user@example.com my-org
 *   npx tsx scripts/manage-user.ts org-admin user@example.com my-org --revoke
 *   npx tsx scripts/manage-user.ts list-orgs user@example.com
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Import models after dotenv
import User from "../lib/db/models/user";
import Organization from "../lib/db/models/organization";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI environment variable is not set");
  process.exit(1);
}

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  console.log("Disconnected from MongoDB");
}

async function findUserByEmail(email: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`Error: User with email "${email}" not found`);
    process.exit(1);
  }
  return user;
}

async function findOrgBySlug(slug: string) {
  const org = await Organization.findOne({ slug: slug.toLowerCase() });
  if (!org) {
    console.error(`Error: Organization with slug "${slug}" not found`);
    process.exit(1);
  }
  return org;
}

async function setSuperAdmin(email: string, revoke: boolean) {
  const user = await findUserByEmail(email);

  if (revoke) {
    if (!user.isSuperAdmin) {
      console.log(`User "${email}" is not a super admin`);
      return;
    }
    user.isSuperAdmin = false;
    await user.save();
    console.log(`✓ Revoked super admin from "${email}"`);
  } else {
    if (user.isSuperAdmin) {
      console.log(`User "${email}" is already a super admin`);
      return;
    }
    user.isSuperAdmin = true;
    await user.save();
    console.log(`✓ Granted super admin to "${email}"`);
  }
}

async function setOrgAdmin(email: string, orgSlug: string, revoke: boolean) {
  const user = await findUserByEmail(email);
  const org = await findOrgBySlug(orgSlug);

  // Find the member in the organization
  const memberIndex = org.members.findIndex(
    (m: { userId: mongoose.Types.ObjectId }) => m.userId.toString() === user._id.toString()
  );

  if (memberIndex === -1) {
    if (revoke) {
      console.error(`Error: User "${email}" is not a member of organization "${orgSlug}"`);
      process.exit(1);
    }

    // Add user as admin
    org.members.push({
      userId: user._id,
      role: "admin",
      joinedAt: new Date(),
    });

    // Add org to user's organizationIds if not already present
    if (!user.organizationIds.some((id: mongoose.Types.ObjectId) => id.toString() === org._id.toString())) {
      user.organizationIds.push(org._id);
      await user.save();
    }

    await org.save();
    console.log(`✓ Added "${email}" as admin to organization "${orgSlug}"`);
    return;
  }

  const member = org.members[memberIndex];

  if (revoke) {
    if (member.role === "owner") {
      console.error(`Error: Cannot revoke admin from organization owner`);
      process.exit(1);
    }
    if (member.role !== "admin") {
      console.log(`User "${email}" is not an admin in organization "${orgSlug}" (current role: ${member.role})`);
      return;
    }
    member.role = "member";
    await org.save();
    console.log(`✓ Demoted "${email}" from admin to member in organization "${orgSlug}"`);
  } else {
    if (member.role === "owner") {
      console.log(`User "${email}" is already the owner of organization "${orgSlug}"`);
      return;
    }
    if (member.role === "admin") {
      console.log(`User "${email}" is already an admin in organization "${orgSlug}"`);
      return;
    }
    member.role = "admin";
    await org.save();
    console.log(`✓ Promoted "${email}" to admin in organization "${orgSlug}"`);
  }
}

async function setOrgOwner(email: string, orgSlug: string) {
  const user = await findUserByEmail(email);
  const org = await findOrgBySlug(orgSlug);

  // Find current owner
  const currentOwnerIndex = org.members.findIndex(
    (m: { role: string }) => m.role === "owner"
  );

  // Find the user in the organization
  const userMemberIndex = org.members.findIndex(
    (m: { userId: mongoose.Types.ObjectId }) => m.userId.toString() === user._id.toString()
  );

  if (userMemberIndex === -1) {
    // Add user as owner
    org.members.push({
      userId: user._id,
      role: "owner",
      joinedAt: new Date(),
    });

    // Add org to user's organizationIds if not already present
    if (!user.organizationIds.some((id: mongoose.Types.ObjectId) => id.toString() === org._id.toString())) {
      user.organizationIds.push(org._id);
      await user.save();
    }
  } else {
    org.members[userMemberIndex].role = "owner";
  }

  // Demote previous owner to admin
  if (currentOwnerIndex !== -1 && currentOwnerIndex !== userMemberIndex) {
    org.members[currentOwnerIndex].role = "admin";
    console.log(`Note: Previous owner demoted to admin`);
  }

  await org.save();
  console.log(`✓ Set "${email}" as owner of organization "${orgSlug}"`);
}

async function listUserOrgs(email: string) {
  const user = await findUserByEmail(email);

  console.log(`\nUser: ${user.name} <${user.email}>`);
  console.log(`Super Admin: ${user.isSuperAdmin ? "Yes" : "No"}`);
  console.log(`\nOrganizations:`);

  if (user.organizationIds.length === 0) {
    console.log("  (none)");
    return;
  }

  const orgs = await Organization.find({
    _id: { $in: user.organizationIds }
  });

  for (const org of orgs) {
    const member = org.members.find(
      (m: { userId: mongoose.Types.ObjectId }) => m.userId.toString() === user._id.toString()
    );
    const role = member?.role || "unknown";
    console.log(`  - ${org.name} (${org.slug}) - Role: ${role}`);
  }
}

async function listAllOrgs() {
  const orgs = await Organization.find().populate("members.userId", "name email");

  console.log(`\nAll Organizations (${orgs.length}):\n`);

  for (const org of orgs) {
    console.log(`${org.name} (${org.slug})`);
    console.log(`  Members: ${org.members.length}`);
    for (const member of org.members) {
      const user = member.userId as unknown as { name: string; email: string };
      if (user && typeof user === "object" && "email" in user) {
        console.log(`    - ${user.name} <${user.email}> [${member.role}]`);
      }
    }
    console.log();
  }
}

function printUsage() {
  console.log(`
Usage: npx tsx scripts/manage-user.ts <command> [options]

Commands:
  super-admin <email> [--revoke]     Grant or revoke super admin status
  org-admin <email> <org-slug> [--revoke]  Set user as org admin or demote to member
  org-owner <email> <org-slug>       Transfer organization ownership
  list-orgs <email>                  List organizations for a user
  list-all-orgs                      List all organizations and their members

Examples:
  npx tsx scripts/manage-user.ts super-admin admin@example.com
  npx tsx scripts/manage-user.ts super-admin admin@example.com --revoke
  npx tsx scripts/manage-user.ts org-admin user@example.com my-org
  npx tsx scripts/manage-user.ts org-admin user@example.com my-org --revoke
  npx tsx scripts/manage-user.ts org-owner newowner@example.com my-org
  npx tsx scripts/manage-user.ts list-orgs user@example.com
  npx tsx scripts/manage-user.ts list-all-orgs
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];

  await connectDB();

  try {
    switch (command) {
      case "super-admin": {
        const email = args[1];
        const revoke = args.includes("--revoke");
        if (!email) {
          console.error("Error: Email is required");
          printUsage();
          process.exit(1);
        }
        await setSuperAdmin(email, revoke);
        break;
      }

      case "org-admin": {
        const email = args[1];
        const orgSlug = args[2];
        const revoke = args.includes("--revoke");
        if (!email || !orgSlug) {
          console.error("Error: Email and org-slug are required");
          printUsage();
          process.exit(1);
        }
        await setOrgAdmin(email, orgSlug, revoke);
        break;
      }

      case "org-owner": {
        const email = args[1];
        const orgSlug = args[2];
        if (!email || !orgSlug) {
          console.error("Error: Email and org-slug are required");
          printUsage();
          process.exit(1);
        }
        await setOrgOwner(email, orgSlug);
        break;
      }

      case "list-orgs": {
        const email = args[1];
        if (!email) {
          console.error("Error: Email is required");
          printUsage();
          process.exit(1);
        }
        await listUserOrgs(email);
        break;
      }

      case "list-all-orgs": {
        await listAllOrgs();
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
