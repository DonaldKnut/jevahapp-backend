/** Jest project for HTTP + Mongo + Redis like acceptance tests */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/integration/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
  testTimeout: 90000,
  verbose: true,
  forceExit: true,
  clearMocks: false,
  resetMocks: false,
  restoreMocks: false,
};
