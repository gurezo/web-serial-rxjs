# Contributing to web-serial-rxjs

Thank you for your interest in contributing to web-serial-rxjs! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Code Style and Standards](#code-style-and-standards)
- [Testing Guidelines](#testing-guidelines)
- [Building and Linting](#building-and-linting)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Getting Help](#getting-help)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please be respectful and considerate of others when contributing.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18.x or higher
- **pnpm**: Version 8.x or higher ([Installation Guide](https://pnpm.io/installation))
- **Git**: Latest stable version

### Questions?

If you have questions or need help, please:

- Open an issue on [GitHub Issues](https://github.com/gurezo/web-serial-rxjs/issues)
- Check existing issues and discussions before creating a new one

## Development Setup

### 1. Fork and Clone the Repository

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/web-serial-rxjs.git
cd web-serial-rxjs

# Add the upstream repository
git remote add upstream https://github.com/gurezo/web-serial-rxjs.git
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Verify Installation

```bash
# Run all tests to verify everything is set up correctly
pnpm test
```

### 4. Git Hooks Setup

This project uses Husky to automatically validate commit messages. When you install dependencies, the `prepare` script will automatically run and set up Git hooks.

If you need to set up Git hooks manually or if they are not configured correctly, run:

```bash
pnpm run prepare
```

This will ensure that commit messages are automatically checked for Conventional Commits compliance when you commit.

## Branch Strategy

This project follows a **trunk-based development** approach, which is well-suited for npm library projects.

### Trunk-based Development

- **`main` branch**: Always kept in a release-ready state (Green)
- **Short-lived branches**: All development work happens in temporary branches (`feature/*`, `fix/*`, `docs/*`, etc.)
- **Workflow**: Create branch → Make changes → Open PR → CI passes → Merge to `main` (squash merge or rebase merge)

This approach keeps the repository simple and avoids branch proliferation, making it easier to maintain and release.

### Branch Types

- **`main`**: The main development branch, always in a release-ready state
- **`feature/*`**, **`fix/*`**, **`docs/*`**, **`chore/*`**, **`ci/*`**: Short-lived branches for pull requests
- **`release/v*`**: Maintenance branches for older major versions (only added when needed)

**Examples of branch names:**
- `feat/observable-read-loop`
- `fix/disconnect-cleanup`
- `docs/usage-examples`
- `chore/deps-bump`
- `ci/publish-workflow`

### Release Management

Releases are managed via **Git tags**, not branches:

- Version tags: `v0.1.0`, `v1.0.0`, `v2.0.0`, etc.
- When ready to release, create a tag on `main` branch
- `CHANGELOG.md` should be updated (manually or automatically)
- npm publish is triggered by the tag (manually or via CI)

This approach aligns well with npm package versioning, where the version number is the primary identifier.

### Major Version Maintenance

When you need to maintain multiple major versions (e.g., `v1` while developing `v2`):

- **`main`**: Next version development (e.g., v2.x)
- **`release/v1`**: Maintenance branch for v1.x (bug fixes only)

**Hotfix workflow:**
1. Create PR to `release/v1` branch
2. After merge, create tag (e.g., `v1.0.1`)
3. Publish to npm
4. If needed, cherry-pick the fix to `main` branch

**Note**: Only add maintenance branches when actually needed. For most small-to-medium libraries, trunk-based development with tags is sufficient.

## Development Workflow

### Branch Naming Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/) naming conventions for branches. All branches are short-lived and created from `main`:

- `feat/scope-description` - New features
- `fix/scope-description` - Bug fixes
- `docs/scope-description` - Documentation updates
- `refactor/scope-description` - Code refactoring
- `test/scope-description` - Test additions or updates
- `chore/scope-description` - Maintenance tasks (dependencies, tooling, etc.)
- `build/scope-description` - Build system or external dependencies changes
- `ci/scope-description` - CI/CD workflow changes

**Examples:**

- `feat/web-serial-rxjs/add-filter-function`
- `fix/example-angular/test-errors`
- `docs/workspace/update-readme`
- `refactor/apps/restructure-directories`
- `feat/observable-read-loop`
- `fix/disconnect-cleanup`
- `docs/usage-examples`
- `chore/deps-bump`
- `ci/publish-workflow`

### Workflow Steps

1. **Create a feature branch** from the main branch:

   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** and commit them following our [commit message guidelines](#commit-message-guidelines)

3. **Push your branch** to your fork:

   ```bash
   git push origin feat/your-feature-name
   ```

4. **Create a Pull Request** on GitHub with a clear description of your changes

5. **Ensure all checks pass** - CI will run tests and linting automatically

## Commit Message Guidelines

We strictly follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This helps automate versioning, changelog generation, and makes the git history more readable.

### Automatic Validation

This project automatically checks if commit messages follow the Conventional Commits specification:

- **Local validation**: Uses Husky and commitlint to automatically validate messages when you commit. Commits that don't comply will be rejected.
- **Pull request validation**: Uses GitHub Actions to validate all commit messages in a PR. If any commit doesn't comply, the CI will fail.

If your commit message is rejected, check the error message and fix it to follow the correct format.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

The type must be one of the following:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Changes to the build process or auxiliary tools and libraries (such as documentation generation)
- `build`: Changes that affect the build system or external dependencies

### Scope

The scope should be the name of the package or area affected:

- `web-serial-rxjs` - Changes to the main library package
- `example-angular`, `example-react`, `example-vue`, `example-svelte`, `example-vanilla-js`, `example-vanilla-ts` - Changes to example applications
- `workspace` - Changes to workspace configuration, root-level files

If multiple scopes are affected, you can omit the scope or use a broader scope like `workspace`.

### Subject

The subject contains a succinct description of the change:

- Use the imperative, present tense: "change" not "changed" nor "changes"
- Don't capitalize the first letter
- No period (.) at the end
- Maximum 72 characters

### Body (Optional)

The body should include:

- The motivation for the change
- Contrast with previous behavior
- Wrap at 72 characters

### Footer (Optional)

The footer should contain:

- Any issue references: `Closes #123`, `Fixes #456`
- Breaking changes: `BREAKING CHANGE: <description>`

### Examples

**Good commit messages:**

```
feat(web-serial-rxjs): add filter function for data processing

Add a new filter function that allows users to process incoming
serial data before it reaches the observable stream.

Closes #42
```

```
fix(example-angular): resolve test errors in component

Fix type errors and missing dependencies in Angular component tests.
```

```
docs(workspace): update README with new commands

Update installation and usage instructions to reflect current
project structure.
```

```
refactor(apps): move vue-e2e to example-vue-e2e

Restructure directory to follow consistent naming convention
across all example applications.
```

```
build(workspace): migrate from npm to pnpm

Migrate package manager to pnpm for better monorepo support
and faster installations.
```

**Bad commit messages:**

```
❌ Fixed bug
❌ update docs
❌ changes
❌ feat: Added new feature (wrong capitalization, "Added" not imperative)
❌ fix: fixed the bug (redundant "fix:")
```

## Code Style and Standards

### TypeScript

- Follow TypeScript best practices and use proper typing
- Avoid `any` type when possible
- Use meaningful variable and function names
- Keep functions focused and single-purpose

### ESLint

We use ESLint for code quality. Run linting before committing:

```bash
# Lint all projects
nx run-many --target=lint --all

# Lint a specific project
nx lint web-serial-rxjs
nx lint example-angular
```

### Prettier

We use Prettier for code formatting. The project is configured to format code automatically. Make sure your editor is set up to format on save.

### Import Organization

- Group imports: external packages, then internal packages
- Use absolute imports when possible (via TypeScript path mapping)
- Avoid circular dependencies

## Testing Guidelines

### Running Tests

```bash
# Run all tests across all projects
pnpm test

# Run tests for a specific package
nx test web-serial-rxjs

# Run tests for a specific app
nx test example-angular
nx test example-react

# Run tests in watch mode
nx test web-serial-rxjs --watch
```

### Writing Tests

- **Unit Tests**: Use Vitest for unit testing
  - Place test files next to source files: `myfile.ts` → `myfile.test.ts`
  - Or in a `tests` directory: `src/lib/myfile.ts` → `tests/lib/myfile.test.ts`

- **Test Coverage**: Aim for good test coverage, especially for the library package

### Test File Naming

- Unit tests: `*.test.ts` or `*.spec.ts`
- E2E tests: `*.spec.ts`

## Building and Linting

### Building

```bash
# Build all projects
nx run-many --target=build --all

# Build a specific package
nx build web-serial-rxjs

# Build a specific app
nx build example-angular
```

Ensure your code builds successfully before submitting a PR.

### Linting

```bash
# Lint all projects
nx run-many --target=lint --all

# Lint a specific project
nx lint web-serial-rxjs
```

All code must pass linting checks.

## Pull Request Guidelines

### PR Principles

- **Keep PRs small**: One PR should address one specific goal or issue
- **`main` branch protection**: The `main` branch is protected:
  - Direct pushes to `main` are not allowed
  - All PRs must pass CI checks
  - Code review is required before merging
- **Commit messages**: All commits must follow [Conventional Commits](#commit-message-guidelines) specification

### Merge Strategy

PRs are typically merged using one of the following methods:

- **Squash merge**: Recommended for most PRs - combines all commits into a single commit
- **Rebase merge**: Preserves individual commits with a linear history

The maintainer will choose the appropriate merge strategy based on the PR.

## Pull Request Process

### Before Submitting

- [ ] Code follows the project's style guidelines
- [ ] All tests pass locally (`pnpm test`)
- [ ] Code has been linted and passes (`nx run-many --target=lint --all`)
- [ ] Code builds successfully (`nx run-many --target=build --all`)
- [ ] Commit messages follow the [commit message guidelines](#commit-message-guidelines)
- [ ] Documentation has been updated (if applicable)
- [ ] Your branch is up to date with `upstream/main`

### Pull Request Description

Include the following in your PR description:

- **Summary**: Brief description of changes
- **Type of Change**: Feature, Bug fix, Documentation, etc.
- **Motivation**: Why is this change needed?
- **Testing**: How was this tested?
- **Checklist**: Confirm you've completed all requirements

### Review Process

1. Automated checks will run (tests, linting, builds)
2. Maintainers will review your code
3. Address any feedback or requested changes
4. Once approved, your PR will be merged

### Keeping Your PR Up to Date

If your PR is out of date with the main branch:

```bash
git checkout feat/your-feature-name
git fetch upstream
git rebase upstream/main
git push --force-with-lease origin feat/your-feature-name
```

## Release Process

Releases are managed via Git tags on the `main` branch and are **fully automated** via GitHub Actions.

For detailed release instructions, see **[RELEASING.md](RELEASING.md)**.

**Quick summary**:
1. Update version in `package.json` (if needed) via PR
2. Merge to `main`
3. Create and push a version tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push origin vX.Y.Z`
4. GitHub Actions automatically builds, tests, publishes to npm, and creates a GitHub release

No manual `npm publish` is required - the entire process is automated!

### Release from Maintenance Branches

When maintaining multiple major versions (e.g., `release/v1`):

1. **Create a hotfix branch** from the maintenance branch:
   ```bash
   git checkout release/v1
   git pull origin release/v1
   git checkout -b fix/critical-bug
   ```

2. **Make the fix and create a PR** to `release/v1`

3. **After merge, create a tag**:
   ```bash
   git checkout release/v1
   git tag -a v1.0.1 -m "Release v1.0.1 - Critical bug fix"
   git push origin v1.0.1
   ```

4. **Publish to npm**:
   ```bash
   npm publish
   ```

5. **Cherry-pick to `main`** (if the fix is also needed in the next version):
   ```bash
   git checkout main
   git cherry-pick <commit-hash>
   ```

## Project Structure

This is an [Nx](https://nx.dev) monorepo workspace with the following structure:

```
web-serial-rxjs/
├── packages/
│   └── web-serial-rxjs/       # Main library package
├── apps/
│   ├── example-angular/        # Angular example app
│   ├── example-react/          # React example app
│   ├── example-vue/            # Vue example app
│   ├── example-svelte/         # Svelte example app
│   ├── example-vanilla-js/     # Vanilla JavaScript example
│   └── example-vanilla-ts/     # Vanilla TypeScript example
└── tools/                      # Build and development tools
```

### Key Packages

- **`@gurezo/web-serial-rxjs`**: Main library providing RxJS-based Web Serial API functionality

### Nx Commands

Common Nx commands you might use:

```bash
# Run commands for a specific project
nx <target> <project>

# Run commands for multiple projects
nx run-many --target=<target> --all
nx run-many --target=<target> --projects=<project1>,<project2>

# Generate new code
nx generate @nx/react:component MyComponent --project=example-react

# Graph dependencies
nx graph
```

## Getting Help

- **GitHub Issues**: [Open an issue](https://github.com/gurezo/web-serial-rxjs/issues)
- **GitHub Repository**: [web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)

Thank you for contributing to web-serial-rxjs! 🎉
