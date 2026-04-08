# Main Branch Protection

Configure GitHub branch protection for `main` with these required status checks:

- `Lint, Build, and Integration Tests`

## Pull request gate settings

Use this table when configuring **Settings → Branches → Add branch protection rule** for `main`.

| Setting | Required | Recommended |
| --- | --- | --- |
| Minimum approvals | At least **1** approval before merge | Use **2+** approvals for high-risk changes (auth, data, infra) |
| Dismiss stale reviews | Enabled when new commits are pushed | Keep enabled to avoid merging after unreviewed code changes |
| Require conversation resolution | Enabled | Keep enabled to prevent unresolved review threads |
| Require CODEOWNERS review (if used) | Enabled **if** a `CODEOWNERS` file is enforced for critical paths | Add/maintain CODEOWNERS for sensitive areas so domain owners must approve |
| Restrict force-push/deletion | Disable force pushes and branch deletion on `main` | Also enable “Do not allow bypassing the above settings” when available |

## Required checks and CI job-name synchronization

Branch protection matches checks by the status check name shown in PRs. In this repository, the required check name is set by the CI job `name` field in `.github/workflows/ci.yml`:

- Workflow job id: `validate`
- Required check display name: `Lint, Build, and Integration Tests`

To keep settings synchronized:

1. If you change the CI job `name`, update branch protection required checks in GitHub immediately.
2. If you add required jobs, add each job display name as a required check.
3. Re-validate on a test PR that all required checks appear with the exact expected names.

## Org-level overrides

Enterprise or organization policies can override repository-level branch rules (for example through organization rulesets or mandatory repository rules).

When repository settings appear to differ from this document:

1. Check **Organization/Enterprise Rulesets** first.
2. Confirm whether bypass permissions are granted at org level.
3. Update this repository document to reflect the effective policy (repo + org overrides), not only the repo UI settings.

## Quarterly verification

Once per quarter, verify the documented policy still matches live GitHub configuration:

1. Open `main` branch protection/ruleset settings.
2. Confirm required checks still match `.github/workflows/ci.yml` job names.
3. Confirm approval/review resolution/CODEOWNERS/force-push and deletion rules still match this document.
4. Record verification date and any deltas in the team’s engineering ops log.

This keeps `main` gated by the CI workflow in `.github/workflows/ci.yml` and aligned with governance policy.
