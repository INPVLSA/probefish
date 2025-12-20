import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer | null = null;

/**
 * Connect to an in-memory MongoDB instance for testing
 */
export async function connectTestDB(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

/**
 * Disconnect from the test database and stop the server
 */
export async function disconnectTestDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * Clear all collections in the test database
 */
export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Get the URI of the test database
 */
export function getTestDBUri(): string | null {
  return mongoServer?.getUri() || null;
}
