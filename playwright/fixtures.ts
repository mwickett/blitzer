import { test as base, expect, Page } from '@playwright/test';
import { authenticateUser } from './utils/auth';

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await authenticateUser(page);
    await use(page);
  },
});

export { expect };
