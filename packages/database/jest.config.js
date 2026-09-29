module.exports = {
  "testEnvironment": "node",
  "rootDir": ".",
  "setupFiles": [
    "<rootDir>/../testing/dist/jest.setup.js"
  ],
  "testMatch": [
    "**/*.spec.ts"
  ],
  "moduleNameMapper": {
    "^@database$": "<rootDir>/src/database/index.ts",
    "^@database/(.*)$": "<rootDir>/src/database/$1",
    "^@bytium-core/common/internal/(.*)$": "<rootDir>/../common/dist/core/$1"
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
