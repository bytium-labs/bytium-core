module.exports = {
  "testEnvironment": "node",
  "rootDir": ".",
  "setupFiles": [
    "<rootDir>/src/jest.setup.ts"
  ],
  "testMatch": [
    "**/*.spec.ts"
  ],
  "moduleNameMapper": {
    "^@testing$": "<rootDir>/src/testing/index.ts",
    "^@testing/(.*)$": "<rootDir>/src/testing/$1",
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
