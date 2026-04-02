---
name: frontend
description: Frontend-specific coding guidelines for React/TypeScript components
applyTo: src/**
---

# Frontend Instructions

## Component Patterns
- Use functional components with hooks
- Prefer custom hooks for reusable logic
- Keep components small (< 200 lines)
- Use TypeScript interfaces for props

## State Management
- TanStack Query for server state
- React state for local UI state
- Avoid prop drilling with context when needed

## Styling
- Tailwind CSS utility classes
- Custom CSS variables for themes
- Responsive design with mobile-first approach
- Consistent spacing and typography

## Performance
- Lazy load route components
- Memoize expensive computations
- Optimize re-renders with React.memo
- Code-split large bundles

## Error Handling
- Display user-friendly error messages
- Use error boundaries for crash recovery
- Log errors for debugging
- Graceful fallbacks for failed operations

## Accessibility
- Semantic HTML elements
- ARIA labels when needed
- Keyboard navigation support
- Screen reader friendly