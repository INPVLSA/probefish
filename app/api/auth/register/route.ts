import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import connectDB from "@/lib/db/mongodb";
import { User, Organization } from "@/lib/db/models";
import { createSession } from "@/lib/auth/session";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  organizationName: z.string().min(2, "Organization name is required").optional(),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, name, organizationName } = validation.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      passwordHash: password, // Will be hashed by pre-save hook
      name,
      settings: {
        theme: "system",
      },
    });

    await user.save();

    // Create default organization if name provided or use user's name
    const orgName = organizationName || `${name}'s Workspace`;
    const orgSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    // Ensure unique slug
    let finalSlug = orgSlug;
    let counter = 1;
    while (await Organization.findOne({ slug: finalSlug })) {
      finalSlug = `${orgSlug}-${counter}`;
      counter++;
    }

    const organization = new Organization({
      name: orgName,
      slug: finalSlug,
      ownerId: user._id,
      members: [
        {
          userId: user._id,
          role: "owner",
          joinedAt: new Date(),
        },
      ],
      settings: {
        maxConcurrentTests: 5,
      },
    });

    await organization.save();

    // Update user with organization
    user.organizationIds.push(organization._id);
    await user.save();

    // Create session
    await createSession({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    return NextResponse.json(
      {
        message: "Registration successful",
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        },
        organization: {
          id: organization._id.toString(),
          name: organization.name,
          slug: organization.slug,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
