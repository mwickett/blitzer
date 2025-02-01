// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://1de6afaad74a11eed2548e79e65170bd@o87852.ingest.us.sentry.io/4507369955459072",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Enhanced error context
  beforeSend(event) {
    // Don't send errors in development
    if (process.env.NODE_ENV === "development") {
      return null;
    }

    // Clean error messages and add additional context
    if (event.exception) {
      // Add React error boundary context if available
      const errorInfo = (event.extra && event.extra.componentStack) 
        ? `React Component Stack: ${event.extra.componentStack}\n` 
        : "";

      // Enhance error message
      event.exception.values = event.exception.values?.map(value => ({
        ...value,
        value: `${value.value}\n${errorInfo}`
      }));
    }

    return event;
  },

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

// Add user context when available
export const setUserContext = (user: { id: string; email?: string; username?: string }) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
};

// Clear user context on logout
export const clearUserContext = () => {
  Sentry.setUser(null);
};
