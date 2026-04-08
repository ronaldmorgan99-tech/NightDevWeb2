---
name: agents
description: Multi-agent workflow definitions for NightDevWeb2 project
---

# NightDevWeb2 Agents

## Stack Summary
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + TanStack Query
- **Backend**: Node.js + Express + SQLite (local) + MySQL (production) + Socket.IO + JWT auth
- **Testing**: Node test runner + regression tests
- **Deployment**: Vite build + Express server

## How to Run Checks
- `npm run lint` - TypeScript type checking
- `npm run build` - Production build with bundle analysis
- `npm run test:integration` - Real server/database integration tests
- `npm run dev` - Development server

## Coding Standards
- Use TypeScript strict mode
- Prefer functional components with hooks
- Handle errors with try/catch, return user-friendly messages
- Use TanStack Query for API state management
- Keep components small and focused
- Use absolute imports from project root

## Workflow Rules
- **Plan before coding**: Break down tasks into small, verifiable steps
- **Small diffs**: Make incremental changes with clear commit messages
- **Validation**: Run relevant tests/checks after each change
- **Docs consistency check**: When changing core dependencies, update AGENTS.md and README.md stack sections in the same PR
- **Security**: Never expose secrets, validate inputs, use HTTPS in production

## Output Format Conventions
- Use markdown tables for comparisons/options
- Link to specific files/lines with [file.ts](file.ts#L10) format
- Provide runnable code blocks for commands
- Summarize changes with before/after examples
- Use KaTeX for math equations when needed