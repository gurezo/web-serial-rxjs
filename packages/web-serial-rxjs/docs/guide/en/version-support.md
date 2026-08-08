# Version support and release policy

This page summarizes how `@gurezo/web-serial-rxjs` versions releases, what support to expect for past majors, and where release notes live. It is for **upgrade and maintenance decisions**. It does **not** declare LTS or long-term support commitments.

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#565](https://github.com/gurezo/web-serial-rxjs/issues/565) · Related: [Browser support](./browser-support.md)

## Semantic Versioning

This project follows [Semantic Versioning](https://semver.org/). Package versions on npm and Git tags use `MAJOR.MINOR.PATCH` (tags are prefixed with `v`, for example `v4.1.0`).

| Bump | Meaning |
| --- | --- |
| **MAJOR** | Breaking changes to the public API or documented behavior |
| **MINOR** | New features that remain backward compatible |
| **PATCH** | Bug fixes that remain backward compatible |

Release mechanics (tag → CI → npm → GitHub Release) are described in the repository [RELEASING.md](https://github.com/gurezo/web-serial-rxjs/blob/main/RELEASING.md).

## Breaking changes

Breaking changes ship in a **major** release only.

When a major release changes public APIs that adopters must migrate, this Guide adds or updates a **Migration Guide** (for example [v3 → v4](./migration-v4.md)). Prefer those pages over reading every commit.

## Deprecated APIs

- APIs marked `@deprecated` remain available within the **current major** so existing apps can migrate gradually.
- Removal is deferred to a **future major** (today: **v5+**), not a minor or patch.
- Concrete deprecated surfaces in v4 are listed in [API concepts – Deprecated exports](./concepts.md#deprecated-exports) and the relevant Migration Guides.

## Support window (no LTS)

This project does **not** promise LTS or multi-year support for older majors.

| Concern | Policy |
| --- | --- |
| **Security fixes** | Considered only for the **latest major** line (currently **4.x**). See [SECURITY.md](https://github.com/gurezo/web-serial-rxjs/blob/main/SECURITY.md). |
| **Bug fixes** | Land on `main` for the current major by default. Upgrade to the latest `4.x` when possible. |
| **Backports to past majors** | **Not promised.** If a `release/v*` maintenance branch exists, hotfixes may be applied on a **best-effort** basis (see [CONTRIBUTING.md – Release from Maintenance Branches](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.md#release-from-maintenance-branches)). Absence of such a branch means older majors receive no further fixes. |

Browser / environment support (what we test) is separate from version support — see [Browser support and support policy](./browser-support.md).

## GitHub Release, npm, and CHANGELOG

| Channel | Role |
| --- | --- |
| **GitHub Release** | Canonical user-facing release notes for each tagged version |
| **npm** | Package distribution (`@gurezo/web-serial-rxjs`) |
| **CHANGELOG.md** | Optional; may be updated when maintained. Prefer GitHub Releases when in doubt |

## Related

- Repository [SECURITY.md](https://github.com/gurezo/web-serial-rxjs/blob/main/SECURITY.md) · [日本語](https://github.com/gurezo/web-serial-rxjs/blob/main/SECURITY.ja.md)
- Repository [RELEASING.md](https://github.com/gurezo/web-serial-rxjs/blob/main/RELEASING.md) · [日本語](https://github.com/gurezo/web-serial-rxjs/blob/main/RELEASING.ja.md)
- [Browser support and support policy](./browser-support.md)
- [v3 → v4 Migration](./migration-v4.md) · [v2 → v3](./migration-v3.md) · [v1 → v2](./migration-v2.md)
- Repository [README – Development and Release Strategy](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md#development-and-release-strategy)
