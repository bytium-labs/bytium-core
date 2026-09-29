module.exports = {
  "testEnvironment": "node",
  "rootDir": ".",
  "setupFiles": [
    "<rootDir>/src/jest.setup.ts"
  ],
  "testMatch": [
    "**/*.spec.ts"
  ],
  "testPathIgnorePatterns": [
    "/node_modules/"
  ],
  "moduleNameMapper": {
    "^@core$": "<rootDir>/src/core/index.ts",
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@shared$": "<rootDir>/src/shared/index.ts",
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@logger$": "<rootDir>/src/logger/index.ts",
    "^@logger/(.*)$": "<rootDir>/src/logger/$1",
    "^@citizenfx$": "<rootDir>/src/citizenfx/index.ts",
    "^@citizenfx/(.*)$": "<rootDir>/src/citizenfx/$1",
    "^@math$": "<rootDir>/src/math/index.ts",
    "^@math/(.*)$": "<rootDir>/src/math/$1",
    "^logger/(.*)$": "<rootDir>/src/logger/$1"
  },
  "transform": {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        "tsconfig": {
          "target": "es2024",
          "module": "CommonJS",
          "experimentalDecorators": true,
          "emitDecoratorMetadata": true,
          "useDefineForClassFields": false,
          "esModuleInterop": true,
          "isolatedModules": true
        }
      }
    ]
  }
};
