import { connectTestDB, disconnectTestDB, clearTestDB } from '@/__mocks__/lib/db/mongodb';

export { connectTestDB, disconnectTestDB, clearTestDB };

/**
 * Helper to seed the database with test data
 */
export async function seedTestData<T>(
  Model: { create: (data: T | T[]) => Promise<unknown> },
  data: T | T[]
): Promise<void> {
  await Model.create(data);
}

/**
 * Test database lifecycle helper for use with beforeAll/afterAll
 */
export function setupTestDB() {
  return {
    async connect() {
      await connectTestDB();
    },
    async disconnect() {
      await disconnectTestDB();
    },
    async clear() {
      await clearTestDB();
    },
  };
}
