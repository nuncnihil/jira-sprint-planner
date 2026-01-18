module.exports = {
  displayName: 'server',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    '*.js',
    '!index.js',
    '!jest.config.js',
    '!constants.js',
    '!logger.js'
  ],
  coverageThreshold: {
    global: {
      lines: 60,
      functions: 60,
      branches: 50,
      statements: 60
    }
  }
};
