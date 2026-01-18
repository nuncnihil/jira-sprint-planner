module.exports = {
  displayName: 'server',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    '*.js',
    '!index.js',
    '!jest.config.cjs'
  ],
  coverageDirectory: '<rootDir>/coverage'
};
