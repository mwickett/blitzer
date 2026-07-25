import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util'

global.TextDecoder = TextDecoder
global.TextEncoder = TextEncoder

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

// Mock clerk/nextjs
// `Show` renders its children unconditionally here. Tests that need to assert
// on a specific auth state should test the pure link sets in
// src/components/marketing/navLinks.ts instead of rendering Clerk components.
jest.mock('@clerk/nextjs', () => ({
  auth: () => ({
    userId: 'test-user-id',
  }),
  currentUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
  }),
  Show: ({ children }) => children,
  SignInButton: ({ children }) => children,
  SignUpButton: ({ children }) => children,
  UserButton: () => null,
  OrganizationSwitcher: () => null,
}))

// Mock PostHog
jest.mock('@/app/posthog', () => ({
  __esModule: true,
  default: () => ({
    capture: jest.fn(),
  }),
}))

// Mock posthog-js/react (client-side analytics)
jest.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: jest.fn() }),
  PostHogProvider: ({ children }) => children,
}))
