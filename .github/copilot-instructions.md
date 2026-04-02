# NightDevWeb2 Copilot Instructions

## Project Context
This is a full-stack web application with React frontend and Node.js/Express backend. It features user forums, real-time messaging, AI-powered media generation, and premium subscriptions.

## Always Do
- Plan changes before implementing - break down into small, testable steps
- Run `npm run lint` after TypeScript changes
- Use absolute imports from project root
- Handle errors gracefully with user-friendly messages
- Validate inputs and avoid security vulnerabilities

## Never Do
- Expose sensitive data or secrets
- Make breaking changes without testing
- Skip validation for user inputs
- Use deprecated APIs or insecure patterns

## Code Style
- TypeScript strict mode
- Functional React components with hooks
- Async/await over promises
- Descriptive variable names
- Comments for complex logic

## Testing
- Use real integration tests for confidence
- Mock external APIs when testing locally
- Test error conditions and edge cases

## Deployment
- Environment variables must be configured
- Database migrations run before startup
- HTTPS required for production
- CORS properly configured for frontend domain