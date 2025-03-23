# Error Tracking in Blitzer

This document outlines the error tracking implementation in Blitzer using both PostHog and Sentry.

## Overview

Blitzer uses a dual error tracking approach:

1. **Sentry** - For comprehensive error tracking and performance monitoring
2. **PostHog** - For integrated error tracking with analytics and feature flags

Both systems capture errors in parallel, allowing for a smooth transition if we decide to standardize on one platform in the future.

## Error Boundary Layers

The application implements a layered approach to error boundaries:

### Global Error Handling

- **Global Error Boundary**: `src/app/global-error.tsx`

  - Captures application-level errors that occur outside of specific routes
  - Reports to both Sentry and PostHog

- **Server-Side Error Handling**: `src/instrumentation.ts`
  - Implements `onRequestError` handler for server-side errors
  - Extracts user information from cookies when available
  - Reports detailed error context to both tracking systems

### Section-Level Error Boundaries

Key application sections have custom error boundaries:

- **Games Section**: `src/app/games/error.tsx`

  - Handles errors in the games listing page
  - Provides a user-friendly recovery UI

- **Game Detail**: `src/app/games/[id]/error.tsx`

  - Handles errors in specific game views
  - Captures game ID context with errors
  - Offers options to retry or return to games list

- **Dashboard**: `src/app/dashboard/error.tsx`
  - Handles errors in the dashboard section
  - Provides recovery options

### Component-Level Error Boundary

- **Reusable ErrorBoundary Component**: `src/components/ErrorBoundary.tsx`
  - Class component that implements React's error boundary API
  - Can be used to wrap any complex component
  - Captures component-specific context
  - Example usage in `ScoreEntry` component

## Context Enhancement

All error reporting includes additional context to aid debugging:

1. **Global Errors**:

   - Error digest (for identification)
   - Error type

2. **Server-Side Errors**:

   - Request path
   - HTTP method
   - User ID (when available)

3. **Section Errors**:

   - Section identifier
   - Related IDs (e.g., game ID)

4. **Component Errors**:
   - Component name
   - Custom context (e.g., game data, round number)

## Testing Error Tracking

A test component is provided to verify error tracking:

- **ErrorTestTrigger**: `src/components/ErrorTestTrigger.tsx`
  - Only visible in development mode
  - Tests component errors (via error boundaries)
  - Tests manual error capture
  - Tests unhandled promise rejections

To test error tracking:

1. Import and render the `ErrorTestTrigger` component in any page
2. Use the provided buttons to generate different types of errors
3. Verify errors appear in both PostHog and Sentry dashboards

## PostHog Integration Details

PostHog error tracking is implemented using:

- `posthog.captureException(error, properties)` - For direct error capture
- `$exception` event for more detailed error reporting

### Example Custom Properties

```javascript
posthog.captureException(error, {
  errorSource: "component",
  component: "ScoreEntry",
  gameId: "game-123",
  roundNumber: 2,
});
```

## Best Practices

1. **Always add context**: Include relevant information with errors

   ```javascript
   posthog.captureException(error, {
     section: "gameplay",
     action: "score-submission",
   });
   ```

2. **Use component error boundaries**: Wrap complex UI components

   ```jsx
   <ErrorBoundary
     componentName="ChartComponent"
     context={{ chartType: "scores" }}
   >
     <ComplexChart data={data} />
   </ErrorBoundary>
   ```

3. **Create section-specific error UIs**: Add error.tsx files to route segments

   ```
   src/app/analytics/error.tsx
   src/app/profile/error.tsx
   ```

4. **Handle async operations safely**: Catch rejected promises
   ```javascript
   try {
     await saveData();
   } catch (error) {
     posthog.captureException(error, { action: "data-save" });
     setError("Failed to save data");
   }
   ```

## Future Improvements

1. Add more granular error boundaries to additional sections
2. Create PostHog dashboards for error analysis
3. Implement error rate monitoring and alerting
4. Add user feedback collection on error scenarios
