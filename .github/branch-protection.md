# Main Branch Protection

Configure GitHub branch protection for `main` with these required status checks:

- `Lint, Build, and Integration Tests`

## Recommended settings

1. Go to **Settings → Branches → Add branch protection rule**.
2. Branch name pattern: `main`.
3. Enable:
   - **Require a pull request before merging**
   - **Require status checks to pass before merging**
   - Select `Lint, Build, and Integration Tests`
   - **Require branches to be up to date before merging**
   - **Do not allow bypassing the above settings** (if your org policy supports it)

This keeps `main` gated by the CI workflow in `.github/workflows/ci.yml`.
