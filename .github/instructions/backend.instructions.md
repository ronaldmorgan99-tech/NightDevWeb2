---
name: backend
description: Backend-specific guidelines for Node.js/Express server and APIs
applyTo: server.ts, src/lib/**, test/**
---

# Backend Instructions

## API Design
- RESTful endpoints with consistent naming
- JSON responses with proper HTTP status codes
- Input validation with Zod schemas
- Comprehensive error handling

## Authentication & Security
- JWT tokens in httpOnly cookies
- CSRF protection for state-changing requests
- Input sanitization and validation
- Rate limiting and abuse prevention

## Database
- SQLite with proper migrations
- Parameterized queries to prevent SQL injection
- Connection pooling for scalability
- Transaction management for data integrity

## Real-time Features
- Socket.IO for WebSocket connections
- Room-based messaging
- Authentication integration
- Error handling and reconnection logic

## Testing
- Integration tests with real server/database
- Mock external dependencies
- Test error scenarios
- CI/CD integration

## Performance
- Efficient database queries
- Caching strategies
- Background job processing
- Monitoring and logging

## Deployment
- Environment-specific configuration
- Health checks and monitoring
- Graceful shutdown handling
- Security hardening