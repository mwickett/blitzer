// Re-export all mutations from domain-specific files
// This maintains backward compatibility with existing imports

// Import and re-export async functions directly
import { createGame, updateGameAsFinished, cloneGame } from "./games";
import { createRoundForGame, updateRoundScores } from "./rounds";
import {
  createFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
} from "./friends";
import { createGuestUser, getMyGuestUsers, inviteGuestUser } from "./guests";
import {
  createKeyMoment,
  getKeyMomentsForGame,
  deleteKeyMoment,
} from "./keyMoments";

// Re-export them
export {
  createGame,
  updateGameAsFinished,
  cloneGame,
  createRoundForGame,
  updateRoundScores,
  createFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  createGuestUser,
  getMyGuestUsers,
  inviteGuestUser,
  createKeyMoment,
  getKeyMomentsForGame,
  deleteKeyMoment,
};
