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
    "^@http$": "<rootDir>/src/http/index.ts",
    "^@http/(.*)$": "<rootDir>/src/http/$1",
    "^@bytium-core/common/server$": "<rootDir>/../common/dist/server.js",
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
