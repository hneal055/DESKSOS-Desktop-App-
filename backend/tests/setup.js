// Use an in-memory SQLite DB for every test file.
// Jest isolates module registry per file so each test file gets a fresh DB.
process.env.DATABASE_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret-key";
