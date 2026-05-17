## PR Title (Conventional Commits)
<!--
日本語: PR タイトルは Conventional Commits に準拠してください
  形式: <type>(<scope>): <summary>
  scope は apps/**/project.json または packages/**/project.json の name を優先
  project 非依存の変更は workspace / docs / ci / build / deps などを使用
  詳細: .cursor/rules/commits/41-pull-request-title.mdc / .cursor/rules/nx/30-nx-project-scope.mdc / .cursor/skills/conventional-commits/
English: PR title MUST follow Conventional Commits.
  Format: <type>(<scope>): <summary>
  Prefer scope from apps/**/project.json or packages/**/project.json (name field).
  Use workspace / docs / ci / build / deps for project-agnostic changes.
  See: .cursor/rules/commits/41-pull-request-title.mdc / .cursor/rules/nx/30-nx-project-scope.mdc / .cursor/skills/conventional-commits/

例 / Examples:
  feat(web-serial-rxjs): add SerialSession API
  fix(example-react): handle StrictMode remount in useSerialSession
  docs(workspace): update README quick start
  ci(workspace): update npm publish workflow
-->

## Summary
<!--
日本語: 何を・なぜ変更したかを1〜3行で書いてください
English: Briefly describe what you changed and why (1–3 lines)
-->

## Type of change
<!--
日本語: 該当するものにチェックを入れてください
English: Check the relevant items
-->
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation
- [ ] Chore (build/test/ci)
- [ ] Breaking change

## Related issues
<!--
日本語: 関連する Issue があれば記載してください
English: Link related issues (use "Fixes #123" to auto-close)
-->
- Fixes #

## What changed?
<!--
日本語: 主な変更点を箇条書きで書いてください
English: List the main changes in bullet points
-->
- 
- 

## API / Compatibility
<!--
日本語: 公開 API や互換性への影響があれば明記してください
English: Describe any impact on public APIs or compatibility
-->
- [ ] Public API changes (export / function signature / behavior)
  - Details:
- [ ] This change is backward compatible
- [ ] This change introduces a breaking change
  - Migration notes:

## How to test
<!--
日本語: 動作確認の手順を具体的に書いてください
English: Describe how reviewers can test this change
-->
1.
2.
3.

## Environment (if relevant)
<!--
日本語: バグ修正・挙動変更の場合は記載してください
English: Required for bug fixes or behavior changes
-->
- Browser: Chrome / Edge / Opera / etc. (version: )
- OS: macOS / Windows / Linux
- web-serial-rxjs version (for verification):
- RxJS version:

## Checklist
<!--
日本語: PR 作成前の確認事項です
English: Please confirm before submitting
-->
- [ ] PR title follows Conventional Commits (`<type>(<scope>): <summary>`)
- [ ] Commit messages follow Conventional Commits (commitlint passes)
- [ ] I ran tests locally (if available)
- [ ] I verified behavior on a Chromium-based browser (Web Serial API)
- [ ] I updated docs/README if needed
- [ ] I added/updated types and kept exports consistent
- [ ] I considered error handling (disconnect, permission denied, timeouts, etc.)
