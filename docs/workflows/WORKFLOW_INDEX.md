# Workflow Index

This catalog describes the active GitHub Actions workflows for NightDevWeb2.

## Active workflow docs
- `docs/workflows/ci.md` — CI Pipeline: PR and `main` validation with lint, build, tests, security scans, and docs freshness enforcement.
- `docs/workflows/staging-verify.md` — Staging Post-Deploy Verification: staging smoke checks after deployment or manual dispatch.

## Current automation scope
- CI validation and gating via `.github/workflows/ci.yml`
- Staging smoke verification via `.github/workflows/staging-verify.yml`

## Project board integration
- No GitHub Projects / board automation is documented in this repository today.
- If project-board automation is added, document field-to-meaning mapping and agent touchpoints here.
