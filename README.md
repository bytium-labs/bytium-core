# bytium-core

> Modern TypeScript framework for FiveM Enhanced with dependency injection, modules, decorator-driven handling of the FiveM runtime (commands, events, ticks, NUI, HTTP), and cross-resource communication.

[![npm](https://img.shields.io/npm/v/@bytium-core/common.svg)](https://www.npmjs.com/package/@bytium-core/common)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/bytium-labs/bytium-core/actions/workflows/ci.yml/badge.svg)](https://github.com/bytium-labs/bytium-core/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D26-brightgreen.svg)](https://nodejs.org)

**bytium-core** is a TypeScript framework for building FiveM resources on **FiveM for GTA V Enhanced**.
You write decorated classes (services, controllers, handlers) and the framework wires them into
FiveM's runtime (commands, events, ticks, NUI, HTTP) with dependency injection, module boundaries,
and lifecycle handled for you. It brings a decorator and module architecture familiar from modern
TypeScript backends, built for how FiveM actually runs: a single process, hot paths measured in
microseconds, and resources that need to talk to each other.

## Features

- 🧩 **Dependency injection and modules:** decorator-based DI with encapsulated modules (share providers
  via `exports` / `imports`), singleton, transient, and per-request (contextual) scopes, and a
  guards / pipes / interceptors / filters pipeline.
- 🎮 **The FiveM runtime, decorated:** `@Command`, `@Tick`, `@Cron`, `@KeyBind`, net and game events,
  NUI and net callbacks, resource lifecycle hooks, and ACE-permission guards.
- 🔗 **Cross-resource communication:** `@Transferable` classes callable across resources, without
  hand-rolled event plumbing.
- 🌐 **Feature packages:** HTTP controllers, TypeORM integration, config, i18n, vector math, a
  browser-side NUI SDK (with React hooks), and testing utilities.
- ⚡ **Built for Enhanced:** targets the Node 26 / V8 server runtime and the pre-build resource model.

## Quick start

```bash
npm install @bytium-core/server
```

```typescript
import {
  bootstrap,
  BytiumResource,
  BytiumResourceModule,
  Controller,
  Command,
  Injectable,
  Logger,
} from '@bytium-core/server';

@Injectable()
class GreetService {
  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}

@Controller()
class GreetController {
  readonly #logger = new Logger(GreetController.name);

  constructor(private readonly greet: GreetService) {}

  @Command('hello')
  hello(): void {
    this.#logger.log(this.greet.greet('world'));
  }
}

@BytiumResourceModule({
  controllers: [GreetController],
  providers: [GreetService],
})
class AppModule {}

@BytiumResource({ modules: [AppModule] })
class App {}

bootstrap(App);
```

Run the `hello` command in the server console and it greets you. Dependency injection, command
registration, and lifecycle are handled by the framework.

## Documentation

Full guides, API reference, and recipes live at [docs.bytium.dev](https://docs.bytium.dev).

## Packages

| Package | Description |
| --- | --- |
| [`@bytium-core/common`](./packages/common) | Core dependency injection, modules, and decorators. |
| [`@bytium-core/server`](./packages/server) | FiveM server-side decorators and utilities. |
| [`@bytium-core/client`](./packages/client) | FiveM client-side decorators and utilities. |
| [`@bytium-core/http`](./packages/http) | HTTP controllers, routing, and request-scoped DI. |
| [`@bytium-core/http-multipart`](./packages/http-multipart) | multipart/form-data (file upload) support for the HTTP package. |
| [`@bytium-core/database`](./packages/database) | TypeORM database integration. |
| [`@bytium-core/config`](./packages/config) | Configuration and environment management. |
| [`@bytium-core/i18n`](./packages/i18n) | Internationalization and translatable messages. |
| [`@bytium-core/math`](./packages/math) | Vector math and numeric utilities. |
| [`@bytium-core/nui`](./packages/nui) | Browser-side NUI SDK. |
| [`@bytium-core/nui-react`](./packages/nui-react) | React hooks for the NUI SDK. |
| [`@bytium-core/dev-utils`](./packages/dev-utils) | Webpack build tooling and development utilities. |
| [`@bytium-core/testing`](./packages/testing) | Testing utilities and builders. |

## License

[MIT](./LICENSE) © Jakub Michalski (lilabyte)
