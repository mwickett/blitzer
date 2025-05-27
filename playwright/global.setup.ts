import { clerkSetup } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';

export default async function globalSetup() {
  await clerkSetup({
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_TESTING_SECRET_KEY,
  });
}
