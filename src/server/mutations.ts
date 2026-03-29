"use server";

/**
 * This file has been refactored to improve maintainability.
 * All server actions have been moved to the mutations/ directory
 * and organized by domain.
 *
 * This file now explicitly re-exports each server action to maintain
 * backward compatibility with existing imports.
 *
 * Note: In "use server" files, we must explicitly export each async
 * function instead of using "export * from".
 */

// Re-export game-related mutations
import { createGame, updateGameAsFinished, cloneGame } from "./mutations/games";
export { createGame, updateGameAsFinished, cloneGame };

// Re-export round-related mutations
import { createRoundForGame, updateRoundScores, deleteLatestRound } from "./mutations/rounds";
export { createRoundForGame, updateRoundScores, deleteLatestRound };

// Re-export guest-related mutations
import {
  createGuestUser,
  getCircleGuestUsers,
  inviteGuestUser,
} from "./mutations/guests";
export { createGuestUser, getCircleGuestUsers, inviteGuestUser };

// Re-export circle-related mutations
import { inviteFriendToCircle } from "./mutations/circles";
export { inviteFriendToCircle };

