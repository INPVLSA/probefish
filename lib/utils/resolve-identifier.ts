/**
 * Utility functions to resolve identifiers (ObjectId or slug) to database documents
 */

import mongoose from "mongoose";
import { isObjectIdFormat } from "./slug";

// Import models - these will be imported at runtime to avoid circular dependencies
import Project, { IProject } from "@/lib/db/models/project";
import TestSuite, { ITestSuite } from "@/lib/db/models/testSuite";
import Prompt, { IPrompt } from "@/lib/db/models/prompt";
import Endpoint, { IEndpoint } from "@/lib/db/models/endpoint";

/**
 * Resolve a project by ObjectId or slug
 * @param identifier - ObjectId string or slug
 * @param organizationId - Organization ID to scope the slug lookup
 * @returns Project document or null
 */
export async function resolveProjectByIdentifier(
  identifier: string,
  organizationId: string | mongoose.Types.ObjectId
): Promise<IProject | null> {
  // Try ObjectId first if it looks like one
  if (isObjectIdFormat(identifier)) {
    const project = await Project.findById(identifier);
    if (project) {
      return project;
    }
  }

  // Try slug lookup within organization scope
  return Project.findOne({
    slug: identifier.toLowerCase(),
    organizationId: new mongoose.Types.ObjectId(organizationId.toString()),
  });
}

/**
 * Resolve a project by ObjectId or slug, searching across multiple organizations
 * @param identifier - ObjectId string or slug
 * @param organizationIds - Array of organization IDs to search
 * @returns Project document or null
 */
export async function resolveProjectAcrossOrgs(
  identifier: string,
  organizationIds: (string | mongoose.Types.ObjectId)[]
): Promise<IProject | null> {
  // Try ObjectId first if it looks like one
  if (isObjectIdFormat(identifier)) {
    const project = await Project.findById(identifier);
    if (project) {
      return project;
    }
  }

  // Try slug lookup across all provided organizations
  const orgObjectIds = organizationIds.map(
    (id) => new mongoose.Types.ObjectId(id.toString())
  );

  return Project.findOne({
    slug: identifier.toLowerCase(),
    organizationId: { $in: orgObjectIds },
  });
}

/**
 * Resolve a test suite by ObjectId or slug
 * @param identifier - ObjectId string or slug
 * @param projectId - Project ID to scope the slug lookup
 * @returns TestSuite document or null
 */
export async function resolveTestSuiteByIdentifier(
  identifier: string,
  projectId: string | mongoose.Types.ObjectId
): Promise<ITestSuite | null> {
  // Try ObjectId first if it looks like one
  if (isObjectIdFormat(identifier)) {
    const testSuite = await TestSuite.findOne({
      _id: identifier,
      projectId: new mongoose.Types.ObjectId(projectId.toString()),
    });
    if (testSuite) {
      return testSuite;
    }
  }

  // Try slug lookup within project scope
  return TestSuite.findOne({
    slug: identifier.toLowerCase(),
    projectId: new mongoose.Types.ObjectId(projectId.toString()),
  });
}

/**
 * Resolve a prompt by ObjectId or slug
 * @param identifier - ObjectId string or slug
 * @param projectId - Project ID to scope the slug lookup
 * @returns Prompt document or null
 */
export async function resolvePromptByIdentifier(
  identifier: string,
  projectId: string | mongoose.Types.ObjectId
): Promise<IPrompt | null> {
  // Try ObjectId first if it looks like one
  if (isObjectIdFormat(identifier)) {
    const prompt = await Prompt.findOne({
      _id: identifier,
      projectId: new mongoose.Types.ObjectId(projectId.toString()),
    });
    if (prompt) {
      return prompt;
    }
  }

  // Try slug lookup within project scope
  return Prompt.findOne({
    slug: identifier.toLowerCase(),
    projectId: new mongoose.Types.ObjectId(projectId.toString()),
  });
}

/**
 * Resolve an endpoint by ObjectId or slug
 * @param identifier - ObjectId string or slug
 * @param projectId - Project ID to scope the slug lookup
 * @returns Endpoint document or null
 */
export async function resolveEndpointByIdentifier(
  identifier: string,
  projectId: string | mongoose.Types.ObjectId
): Promise<IEndpoint | null> {
  // Try ObjectId first if it looks like one
  if (isObjectIdFormat(identifier)) {
    const endpoint = await Endpoint.findOne({
      _id: identifier,
      projectId: new mongoose.Types.ObjectId(projectId.toString()),
    });
    if (endpoint) {
      return endpoint;
    }
  }

  // Try slug lookup within project scope
  return Endpoint.findOne({
    slug: identifier.toLowerCase(),
    projectId: new mongoose.Types.ObjectId(projectId.toString()),
  });
}
