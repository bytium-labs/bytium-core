module.exports = {
  "testEnvironment": "jsdom",
  "rootDir": ".",
  "testMatch": [
    "**/*.spec.ts"
  ],
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
