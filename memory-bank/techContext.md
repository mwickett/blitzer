# Technical Context for Blitzer

## Technologies Used

### Frontend

| Technology   | Version | Purpose                                          |
| ------------ | ------- | ------------------------------------------------ |
| Next.js      | 14.x    | React framework for server and client components |
| React        | 18.x    | UI library                                       |
| Tailwind CSS | 3.x     | Utility-first CSS framework                      |
| ShadCN UI    | N/A     | Component library built on Radix UI              |
| TypeScript   | 5.x     | Type-safe JavaScript                             |

### Backend

| Technology             | Version | Purpose                        |
| ---------------------- | ------- | ------------------------------ |
| Next.js API Routes     | 14.x    | API endpoints                  |
| Next.js Server Actions | 14.x    | Server-side mutations          |
| Prisma                 | 5.x     | ORM for database access        |
| PostgreSQL             | 16.x    | Relational database (via Neon) |

### Authentication & User Management

| Technology | Version | Purpose                            |
| ---------- | ------- | ---------------------------------- |
| Clerk      | N/A     | Authentication and user management |

### Monitoring & Observability

| Technology  | Version | Purpose                                   |
| ----------- | ------- | ----------------------------------------- |
| Sentry      | N/A     | Error tracking and performance monitoring |
| PostHog     | N/A     | Product analytics and feature flags       |
| @posthog/ai | N/A     | LLM observability and monitoring          |

### Testing

| Technology | Version | Purpose                      |
| ---------- | ------- | ---------------------------- |
| Jest       | 29.x    | JavaScript testing framework |
| Playwright | N/A     | End-to-end testing           |

## Development Setup

### Local Environment

The development environment requires:

- Node.js 18.x or later
- npm or pnpm for package management
- Git for version control
- VSCode as the preferred editor with recommended extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - Prisma

### Development Server

Start the development server with:

```bash
npm run dev
```

This launches the application at `http://localhost:3000` with:

- Hot module replacement for client components
- Auto-refresh for server components
- Automatic TypeScript type checking

### Feature Flags

The application uses PostHog for feature flags:

- Server-side feature flags with PostHog Node.js client
- Client-side feature flags with PostHog React hooks
- Documented usage patterns in `src/FEATURE_FLAGS.md`
- Current flags:
  - `score-charts`: Controls visibility of score charts in game view

### Environment Variables

The application requires several environment variables to function correctly:

```
# Database
DATABASE_URL=postgresql://...

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# PostHog Analytics and Feature Flags
NEXT_PUBLIC_POSTHOG_KEY=phc_...
POSTHOG_HOST=https://app.posthog.com

# Error monitoring
NEXT_PUBLIC_SENTRY_DSN=https://...
```

These are configured through a `.env.local` file which is not committed to version control.

## Technical Constraints

### Infrastructure Limitations

- PostgreSQL database hosted on Neon's serverless tier with:

  - Connection limits
  - Storage constraints
  - Potential cold-start latency

- Vercel deployment with:
  - Function execution time limits
  - Edge function size limits
  - API route payload size restrictions

### Browser Compatibility

- The application targets modern browsers:

  - Chrome/Edge (last 2 versions)
  - Firefox (last 2 versions)
  - Safari (last 2 versions)
  - Mobile Safari & Chrome for iOS/Android

- No explicit support for Internet Explorer or legacy browsers

### Performance Targets

- Initial page load: < 2s
- Time to interactive: < 3s
- First input delay: < 100ms
- Core Web Vitals targets:
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1

### Security Considerations

- Authentication handled by Clerk
- API routes and Server Actions secure against CSRF
- Input validation using schema validation (Zod)
- Database queries parameterized through Prisma
- CSP headers implemented for content security

## Dependencies

### Core Dependencies

- `next`: React framework
- `react`: UI library
- `react-dom`: React DOM bindings
- `@clerk/nextjs`: Authentication components and hooks
- `@prisma/client`: Prisma client for database access
- `@radix-ui/*`: Primitive UI components
- `@sentry/nextjs`: Sentry integration for error tracking
- `posthog-js`: PostHog analytics and feature flags client
- `posthog-node`: PostHog server-side client for feature flags
- `@posthog/ai`: PostHog LLM observability integration
- `ai`: Vercel AI SDK utilities
- `@ai-sdk/react`: React hooks for AI interactions
- `@ai-sdk/openai`: OpenAI integration for AI SDK
- `tailwindcss`: CSS utility framework
- `typescript`: TypeScript language

### Development Dependencies

- `@types/*`: TypeScript type definitions
- `eslint`: Linting tool
- `jest`: Testing framework
- `prisma`: Prisma CLI for database management
- `tailwindcss`: Tailwind CSS CLI

## Development Workflow

### Code Organization

The project follows a specific structure:

- `/src/app`: Next.js App Router pages and layouts
- `/src/components`: Reusable UI components
- `/src/lib`: Utility functions and helper code
- `/src/server`: Server-side logic (mutations, queries)
- `/src/server/db`: Database schema and migrations

### Git Workflow

- Feature branches named with patterns like `feature/score-entry` or `fix/authentication-issue`
- Direct commits to `main` for solo development
- Commit messages follow conventional format when possible

### Testing Strategy

- Unit tests for utility functions and isolated components
- Basic integration tests for critical user flows
- End-to-end tests for core functionality

## Technical Debt and Known Issues

### Current Technical Debt

- Inconsistent usage of Server Actions vs. API Routes
- Some components need refactoring for better reusability
- Test coverage is incomplete
- Mobile responsiveness needs improvement in some areas

### Performance Considerations

- Some database queries could be optimized
- Client-side caching strategy needs improvement
- Bundle size optimization needed for some pages
- Image optimization could be improved

### Accessibility Status

- Basic accessibility implemented but not comprehensively tested
- Need to improve keyboard navigation
- Screen reader compatibility needs verification
- Color contrast meets WCAG AA standards in most places

## Future Technical Plans

- Migrate to a consistent data fetching approach with React Query
- Improve test coverage across the application
- Implement more comprehensive error handling and fallbacks
- Add PWA capabilities for offline mode
- Explore server-side analytics to reduce client bundle
