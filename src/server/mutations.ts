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
import { createRoundForGame, updateRoundScores } from "./mutations/rounds";
export { createRoundForGame, updateRoundScores };

// Re-export friend-related mutations
import {
  createFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
} from "./mutations/friends";
export { createFriendRequest, acceptFriendRequest, rejectFriendRequest };

// Re-export guest-related mutations
import {
  createGuestUser,
  getMyGuestUsers,
  inviteGuestUser,
} from "./mutations/guests";
export { createGuestUser, getMyGuestUsers, inviteGuestUser };

// Re-export key moment mutations
import {
  createKeyMoment,
  getKeyMomentsForGame,
  deleteKeyMoment,
} from "./mutations/keyMoments";
export { createKeyMoment, getKeyMomentsForGame, deleteKeyMoment };
