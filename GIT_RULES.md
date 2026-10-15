# Git Rules

These rules apply to human and AI contributors. Git is the source of truth for the POS repository, and every committed change must be reviewable, testable, and reversible.

## Branch workflow

- `staging` is the integration branch. Normal feature work is committed and pushed here first.
- `main` is production. Never commit directly to `main` and never push to it without an approved release pull request.
- Use descriptive branches for isolated work, for example `feat/reward-delivery`, `fix/buyer-claim-history`, or `docs/git-rules`.
- Keep branches focused and avoid mixing unrelated work.
- Promote the tested `staging` commit to `main`; do not recreate the change manually during release.

## Before committing

- Confirm the current branch with `git branch --show-current`.
- Review `git status` and `git diff` before staging anything.
- Preserve unrelated work already present in the working tree.
- Never commit `.env`, `.env.local`, credentials, tokens, private keys, or other secrets.
- Do not commit generated `.next/`, build output, screenshots, or caches unless intentionally tracked by the repository.
- Update relevant documentation when behavior, routes, API usage, or user flows change.

## Commit rules

- Keep commits atomic: one logical change per commit.
- Use Conventional Commits with an imperative subject:
  - `feat(buyer): preserve claimed campaigns after archive`
  - `fix(auth): keep Rewardor password reset in Rewardor`
  - `docs: add Git workflow rules`
- Keep the subject concise and describe intent, not only the files changed.
- Add a body when the reason, compatibility impact, migration behavior, or rollout risk is not obvious.
- AI-generated commit messages must be reviewed and corrected by a human before committing.
- Do not use vague messages such as `update`, `changes`, or `fix stuff`.

## Verification

Before handoff or opening a pull request, run:

```bash
npm run typecheck
npm run build
```

Check the final diff with `git diff --check`. A change should not be committed as complete when required checks fail unless the failure is explicitly documented.

AI-generated code receives the same review, testing, security, accessibility, and maintainability checks as human-written code. Verify business intent; do not assume a successful build proves correctness.

## Safety and documentation

- Route application data through the existing typed API clients and preserve the backend as the source of truth.
- Do not introduce secrets, direct database access, or a second data store into the frontend.
- Keep user-facing behavior and relevant documentation synchronized.
- Never perform destructive data or repository operations without explicit confirmation and a verified target.

## Tags and releases

- Use annotated Semantic Versioning tags such as `v0.0.1`, `v0.1.0`, and `v1.0.0`.
- Create release tags only on a tested commit that is ready for promotion.
- For coordinated KOMOLA releases, use the same version tag across the API, POS, and Rewardor repositories.
- Treat published tags as immutable. Never move or reuse a released tag.

## Commit and push checklist

1. Confirm the target branch is `staging`.
2. Inspect the diff and exclude secrets and unrelated files.
3. Run type checking, build, and relevant tests.
4. Create an atomic Conventional Commit.
5. Review the committed diff and commit message.
6. Push `staging` and report the commit hash.
7. After testing and approval, merge the exact tested commit into `main`.

