// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://1de6afaad74a11eed2548e79e65170bd@o87852.ingest.us.sentry.io/4507369955459072",

  // Sample all traces in development, 10% in production to control quota
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
