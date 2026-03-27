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
import { createGuestUser, getCircleGuestUsers, inviteGuestUser } from "./guests";
import { inviteFriendToCircle } from "./circles";

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
  getCircleGuestUsers,
  inviteGuestUser,
  inviteFriendToCircle,
};
