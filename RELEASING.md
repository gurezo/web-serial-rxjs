# Release Process

This document describes the release process for `@gurezo/web-serial-rxjs`. The release process is **fully automated** via GitHub Actions when you push a version tag.

## Overview

Releases are managed using Git tags. When you push a tag matching the pattern `v*.*.*` (e.g., `v1.0.0`) to the `main` branch, GitHub Actions automatically:

1. Builds the package
2. Runs tests
3. Publishes to npm (using Trusted Publishing / OIDC)
4. Creates a GitHub Release with release notes

**No manual `npm publish` is required** - the entire process is automated!

## Prerequisites

Before releasing, ensure the following:

1. **All changes are merged to `main`**: The release should be based on the latest `main` branch
2. **Tests pass**: Run `pnpm test` locally to ensure everything works
3. **Build succeeds**: Run `pnpm exec nx build web-serial-rxjs` to verify the build
4. **Version number**: Determine the appropriate version number following [Semantic Versioning](https://semver.org/)
   - **MAJOR** (e.g., `1.0.0` → `2.0.0`): Breaking changes
   - **MINOR** (e.g., `1.0.0` → `1.1.0`): New features (backward compatible)
   - **PATCH** (e.g., `1.0.0` → `1.0.1`): Bug fixes (backward compatible)
5. **package.json version**: Update the version in `packages/web-serial-rxjs/package.json` to match the tag
6. **Documentation**: Update `CHANGELOG.md` if maintained (optional)

## Release Steps

### Step 1: Prepare the Release (Optional)

If you need to update the version number in `package.json` or add changelog entries, create a release PR:

1. **Create a release branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b release/v1.0.0  # Replace with your version
   ```

2. **Update version in package.json**:
   ```bash
   # Edit packages/web-serial-rxjs/package.json
   # Change "version": "0.1.4" to "version": "1.0.0"
   ```

3. **Update CHANGELOG.md** (if maintained):
   - Document the changes in this release

4. **Commit and push**:
   ```bash
   git add packages/web-serial-rxjs/package.json
   git commit -m "chore(release): prepare release v1.0.0"
   git push origin release/v1.0.0
   ```

5. **Create a Pull Request** and merge it to `main`

**Note**: If you only need to tag and release (no version/doc updates needed), you can skip this step and go directly to Step 2.

### Step 2: Update Local `main` Branch

Ensure your local `main` branch is up to date:

```bash
git checkout main
git pull origin main
```

### Step 3: Create and Push the Version Tag

Create an annotated tag for the release:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

**Important**: 
- Tag format must be `v*.*.*` (e.g., `v1.0.0`, `v0.2.1`, `v2.0.0-beta.1`)
- The tag must be pushed from the `main` branch
- The tag name should match the version in `packages/web-serial-rxjs/package.json`

### Step 4: GitHub Actions Automatically Releases

Once you push the tag, GitHub Actions automatically:

1. ✅ Checks out the code at the tagged commit
2. ✅ Installs dependencies (`pnpm install --frozen-lockfile`)
3. ✅ Runs tests (`pnpm test`)
4. ✅ Builds the package (`pnpm exec nx build web-serial-rxjs`)
5. ✅ Creates a release zip file
6. ✅ Publishes to npm using Trusted Publishing (OIDC) - no tokens needed!
7. ✅ Creates a GitHub Release with auto-generated release notes
8. ✅ Attaches the release zip to the GitHub Release

You can monitor the progress in the [Actions tab](https://github.com/gurezo/web-serial-rxjs/actions) on GitHub.

### Step 5: Verify the Release

After the workflow completes:

1. **Check npm**: Verify the package was published at [npmjs.com/package/@gurezo/web-serial-rxjs](https://www.npmjs.com/package/@gurezo/web-serial-rxjs)
2. **Check GitHub Release**: Verify the release was created at [GitHub Releases](https://github.com/gurezo/web-serial-rxjs/releases)
3. **Test installation**: Try installing the new version:
   ```bash
   npm install @gurezo/web-serial-rxjs@latest
   ```

## Branch Protection and Tagging

The release process respects branch protection rules:

- **Tags are pushed from local `main`**: Since tags are pushed directly (not via PR), they can be created locally after merging to `main`
- **Workflow runs on tag push**: The GitHub Actions workflow triggers on tag push events, not branch push events
- **No direct commits to `main` needed**: Tags can be pushed independently

This approach ensures that:
- The `main` branch remains protected
- Only properly reviewed code (merged via PR) is released
- Releases are explicitly created via tags

## Version Numbering Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR version** (`1.0.0` → `2.0.0`): Breaking API changes
- **MINOR version** (`1.0.0` → `1.1.0`): New features, backward compatible
- **PATCH version** (`1.0.0` → `1.0.1`): Bug fixes, backward compatible

**Pre-release versions** (e.g., `1.0.0-beta.1`, `1.0.0-rc.1`) are also supported.

## Troubleshooting

### Tag push doesn't trigger the workflow

- Verify the tag name matches `v*.*.*` pattern
- Check that the tag was pushed to the remote repository: `git ls-remote --tags origin`
- Verify the workflow file exists at `.github/workflows/release.yml`

### npm publish fails

- Check the workflow logs in the Actions tab
- Verify Trusted Publishing is configured for the npm package
- Ensure the package name in `package.json` matches the npm package name

### Version mismatch

- Ensure the tag version (e.g., `v1.0.0`) matches the version in `packages/web-serial-rxjs/package.json` (e.g., `1.0.0`)
- The workflow extracts the version from the tag: `VERSION="${GITHUB_REF_NAME#v}"`

### Tests fail in the workflow

- Run tests locally before tagging: `pnpm test`
- Ensure all dependencies are properly installed
- Check for environment-specific issues

## Summary

The release process is simple:

1. **Update version** in `package.json` (if needed) via PR
2. **Merge to `main`**
3. **Create and push tag**: `git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push origin vX.Y.Z`
4. **GitHub Actions handles the rest** automatically!

No manual npm publish, no complex scripts - just tag and push! 🚀

## Related Documentation

- [Contributing Guide](CONTRIBUTING.md) - Development workflow and contribution guidelines
- [Semantic Versioning](https://semver.org/) - Version number guidelines
