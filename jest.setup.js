import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util'

global.TextDecoder = TextDecoder
global.TextEncoder = TextEncoder

// Domain/component tests assert events without running Next background tasks.
// telemetry.test.ts unmocks this boundary to verify actual deferred delivery.
jest.mock('@/server/telemetry', () => ({
  captureServerEvent: (client, event) => client.capture(event),
}))

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
