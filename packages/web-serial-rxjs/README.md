# web-serial-rxjs

A TypeScript library that provides a reactive RxJS-based wrapper for the Web Serial API, enabling easy serial port communication in web applications.

## Table of Contents

- [Features](#features)
- [Browser Support](#browser-support)
- [Installation](#installation)
- [Documentation](#documentation)
- [Framework Examples](#framework-examples)
- [Contributing](#contributing)
- [License](#license)
- [Links](#links)

## Features

- **RxJS-based reactive API**: Leverage the power of RxJS Observables for reactive serial port communication
- **TypeScript support**: Full TypeScript type definitions included
- **Browser detection**: Built-in browser support detection and error handling
- **Error handling**: Comprehensive error handling with custom error classes and error codes
- **Framework agnostic**: Works with any JavaScript/TypeScript framework or vanilla JavaScript

## Browser Support

The Web Serial API is currently only supported in Chromium-based browsers:

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+

The library includes built-in browser detection utilities to check for Web Serial API support before attempting to use it.

## Installation

Install the package using npm or pnpm:

```bash
npm install @gurezo/web-serial-rxjs
# or
pnpm add @gurezo/web-serial-rxjs
```

### Peer Dependencies

This library requires RxJS as a peer dependency:

```bash
npm install rxjs
# or
pnpm add rxjs
```

**Minimum required version**: RxJS ^7.8.0

## Documentation

- **[Quick Start](docs/QUICK_START.md)** - Get started with basic examples and usage patterns
- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation with detailed descriptions
- **[Advanced Usage](docs/ADVANCED_USAGE.md)** - Advanced patterns, stream processing, and error recovery

## Framework Examples

This repository includes example applications demonstrating how to use web-serial-rxjs with different frameworks:

- **[Vanilla JavaScript](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vanilla-js)** - Basic usage with vanilla JavaScript
- **[Vanilla TypeScript](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vanilla-ts)** - TypeScript example with RxJS
- **[React](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-react)** - React example with custom hook (`useSerialClient`)
- **[Vue](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vue)** - Vue 3 example using Composition API
- **[Svelte](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-svelte)** - Svelte example using Svelte Store
- **[Angular](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-angular)** - Angular example using a Service

Each example includes a README with setup and usage instructions.

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.md) for details on:

- Development setup
- Code style guidelines
- Commit message conventions
- Pull request process

For Japanese contributors, please see [CONTRIBUTING.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.ja.md).

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/gurezo/web-serial-rxjs/blob/main/LICENSE) file for details.

## Links

- **GitHub Repository**: [https://github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **Issues**: [https://github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API Specification**: [https://wicg.github.io/serial/](https://wicg.github.io/serial/)
