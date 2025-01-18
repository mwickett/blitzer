import '@testing-library/jest-dom'

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
jest.mock('@clerk/nextjs', () => ({
  auth: () => ({
    userId: 'test-user-id',
  }),
  currentUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
  }),
}))

// Mock PostHog
jest.mock('@/app/posthog', () => ({
  __esModule: true,
  default: () => ({
    capture: jest.fn(),
  }),
}))
