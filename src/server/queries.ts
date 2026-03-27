// Backward-compatible re-export. New code should import from @/server/queries/<domain>.
export {
  getGames,
  getGameById,
  getFriends,
  getFriendsForNewGame,
  getIncomingFriendRequests,
  getOutgoingPendingFriendRequests,
  getFilteredUsers,
  getPlayerBattingAverage,
  getHighestAndLowestScore,
  getCumulativeScore,
  getLongestAndShortestGamesByRounds,
} from "./queries/index";
