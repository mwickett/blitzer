// Re-export all mutations from domain-specific files
// This maintains backward compatibility with existing imports

// Import and re-export async functions directly
import { createGame, cloneGame, saveUserAccentColor } from "./games";
import { createRoundForGame, updateRoundScores } from "./rounds";
import { createGuestUser, getCircleGuestUsers, inviteGuestUser } from "./guests";
import { createPickupGame, joinPickupGame, joinPickupGameByCode, startPickupGame } from "./lobbies";

// Re-export them
export {
  createGame,
  cloneGame,
  saveUserAccentColor,
  createRoundForGame,
  updateRoundScores,
  createGuestUser,
  getCircleGuestUsers,
  inviteGuestUser,
  createPickupGame,
  joinPickupGame,
  joinPickupGameByCode,
  startPickupGame,
};
