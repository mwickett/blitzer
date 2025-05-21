import { Page } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

export const authenticateUser = async (page: Page) => {
  await page.goto('/');
  
  await setupClerkTestingToken({ 
    page,
  });
  
  await page.waitForTimeout(1000);
  
  await page.reload();
  
  await page.waitForLoadState('networkidle');
};
