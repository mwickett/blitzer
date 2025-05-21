# Blitzer Playwright Tests

## Overview

This directory contains end-to-end tests for the Blitzer application using Playwright, primarily focusing on mobile testing since the application is primarily used on smartphones.

## Setup

1. Install dependencies:
   ```
   npm install --save-dev @playwright/test @clerk/testing
   ```

2. Install Playwright browsers:
   ```
   npx playwright install chromium
   ```

3. Set up environment variables in a `.env` file:
   ```
   CLERK_TESTING_SECRET_KEY=your_clerk_test_key
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   TEST_USER_EMAIL=your_test_email
   TEST_USER_PASSWORD=your_test_password
   ```

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run tests with UI
npm run test:e2e:ui
```

## Test Structure

- `fixtures.ts`: Custom test fixtures
- `utils/auth.ts`: Authentication utilities
- `tests/*.spec.ts`: Test files organized by feature
