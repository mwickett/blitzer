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
  usePathname: () => '/',
}))

// Clerk's <Show when="signed-in|signed-out"> renders exactly one branch at
// runtime. Tests select which via global.__setClerkAuthState. Defaults to
// signed-out, the state the marketing pages are written for.
let mockClerkAuthState = 'signed-out'
global.__setClerkAuthState = (state) => {
  mockClerkAuthState = state
}

// Mock clerk/nextjs
jest.mock('@clerk/nextjs', () => ({
  auth: () => ({
    userId: 'test-user-id',
  }),
  currentUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
  }),
  Show: ({ when, children }) => (when === mockClerkAuthState ? children : null),
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
