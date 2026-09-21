/** @type {import('jest').Config} */
module.exports = {
  displayName: '@smartosa/core',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
};
