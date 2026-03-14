module.exports = {
  testEnvironment: "node",
  setupFiles: ["./tests/setup.js"],
  testMatch: ["**/tests/**/*.test.js"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "./tsconfig.json" }]
  },
  moduleNameMapper: {
    "^(\\.{1,2}\\/.+)\\.js$": "$1"
  },
  verbose: true,
};
