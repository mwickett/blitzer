# Guest Players Feature

## Overview

The Guest Players feature allows authenticated users to create and manage guest players for in-person games. Guest players are intended for people who don't have accounts but are physically present when playing a game.

## Implementation Status

- **Phase 1 (Core Support)**: ✅ Completed
- **Phase 2 (Management)**: ⏳ In Progress
- **Phase 3 (Conversion Path)**: 📅 Planned

## Implementation

### Database Schema

- `GuestUser` model with fields: ✅

  - `id`: UUID primary key
  - `name`: Name of the guest player
  - `createdById`: Reference to the authenticated user who created the guest
  - `createdAt`: Timestamp when the guest was created
  - `invitationSent`: Boolean indicating if an invitation was sent
  - `invitationSentAt`: Timestamp when the invitation was sent
  - `emailSent`: Email address an invitation was sent to (optional)

- Modified `GamePlayers` model to support either a regular User or a GuestUser: ✅

  - Added `guestId` field (nullable)
  - Changed primary key structure to accommodate both user and guest players
  - Added appropriate constraints to ensure either userId or guestId is present
  - Fixed database constraints for properly handling null values

- Modified `Score` model to support scores from guest players: ✅
  - Added `guestId` field (nullable)
  - Modified relations to support both user and guest players
  - Fixed schema to properly handle scores from either user or guest

### Server Mutations

- Updated `createGame` to support adding guest players during game creation ✅
- Updated all game-related mutations to handle guest players properly: ✅
  - `createRoundForGame` - Fixed to handle null constraint issues
  - `updateGameAsFinished` - Added support for guest winners
  - `cloneGame` - Enhanced to preserve guest players
  - `updateRoundScores` - Modified to support both user and guest scores
- Added new mutations: ✅
  - `createGuestUser`
  - `getMyGuestUsers`
  - `inviteGuestUser`

### Feature Flag

Added feature flag support for gradual rollout: ✅

- Server-side flag: `isGuestPlayersEnabled()`
- Client-side hook: `useGuestPlayersFlag()`

### UI Changes

- Updated `NewGameChooser` component to support adding guest players ✅
- Added UI conditionally shown based on feature flag: ✅
  - Guest player tab in player selector
  - Appropriate UI in player cards to identify guest players
- Enhanced error handling throughout the UI ✅
- Added defensive coding for handling null/undefined values ✅

### Implementation Challenges Addressed

- **NULL Constraints**: Fixed database schema to properly handle either userId OR guestId being NULL but not both
- **Type Safety**: Added proper type guards and interfaces to handle both user and guest player types
- **Data Conversion**: Created robust conversion between database models and application interfaces
- **Score Creation**: Refactored to process scores individually to prevent constraint violations
- **Client Navigation**: Fixed Next.js navigation to prevent NEXT_REDIRECT errors
- **Visual Identification**: Added clear visual indicators for guest players throughout the UI

## Usage Flow

1. The authenticated user creates a new game
2. When adding players, they can select "Guest Player" tab (if feature is enabled)
3. They enter a name for the guest player and add them to the game
4. The game is created with both regular and guest players
5. The authenticated user manages all scoring for guest players

## Future Enhancements

- Email invitation system to convert guest players to registered users
- Guest player management interface to view/edit/delete created guests
- Guest player persistence across games

## Feature Flag

The feature is controlled by the `guest-players` feature flag, allowing phased rollout and testing.
