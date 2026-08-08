# Security Policy

日本語版: [SECURITY.ja.md](SECURITY.ja.md)

## Supported Versions

Security fixes are considered only for the latest major release line.

| Version | Supported          |
| ------- | ------------------ |
| 4.x     | :white_check_mark: |
| < 4     | :x:                |

Older major versions (`3.x`, `2.x`, `1.x`) are not supported for security updates. Please upgrade to the latest `4.x` release when possible.

For SemVer bumps, deprecation policy, and the non-LTS support window, see the Guide: [Version support and release policy](packages/web-serial-rxjs/docs/guide/en/version-support.md) ([日本語](packages/web-serial-rxjs/docs/guide/ja/version-support.md)).

## Reporting a Vulnerability

**Do not** open a public GitHub Issue or Discussion with vulnerability details.

Please report security issues privately using **[GitHub Private Vulnerability Reporting](https://github.com/gurezo/web-serial-rxjs/security/advisories/new)**.

You can also start a report from the repository **Security** tab → **Advisories** → **Report a vulnerability**.

This project is a browser-facing library that sends and receives data over serial ports. Reports may involve unintended device control, leakage of sensitive communication content, excessive information in errors or logs, npm publishing, GitHub Actions / Trusted Publishing, dependencies, or build artifacts—these should be handled privately, not as ordinary feature bugs.

## What to Include

When filing a private report, include as much of the following as you can:

- Affected package version(s) of `@gurezo/web-serial-rxjs` (and RxJS / browser if relevant)
- Clear description of the issue and its security impact
- Steps to reproduce (minimal example preferred)
- Affected surface area, for example:
  - Unintended device operations via Web Serial
  - Exposure of sensitive serial traffic or credentials
  - Excessive detail in errors, logs, or documentation examples
  - Compromised or misleading npm package contents
  - GitHub Actions, release, or Trusted Publishing weaknesses
  - Vulnerable or malicious dependencies / build outputs
- Any known workarounds

## Disclosure Process

This project is maintained by a single maintainer on a best-effort basis.

- Reports are reviewed when possible; **there is no guaranteed response time or fix timeline**.
- We may ask for clarification or a minimal reproduction.
- Please do **not** disclose the issue publicly until a fix is released, or until we agree that public discussion is appropriate.
- After a fix is published, we intend to mention the security-relevant change in the release notes for that version (without unnecessarily amplifying exploit detail).

Thank you for helping keep users of `@gurezo/web-serial-rxjs` safe.
