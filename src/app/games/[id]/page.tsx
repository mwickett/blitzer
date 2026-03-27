import ScoreEntry from "./scoreEntry";
import ScoreDisplay from "./scoreDisplay";
import { getGameById } from "@/server/queries";
import { notFound } from "next/navigation";
import transformGameData, { GameWithPlayersAndScores } from "@/lib/gameLogic";
import { auth } from "@clerk/nextjs/server";

export default async function GameView(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const gameData = await getGameById(params.id);

  if (!gameData) {
    notFound();
  }

  // Validate that game data is properly formed
  if (!gameData.players || !Array.isArray(gameData.players)) {
    throw new Error("Game data is malformed: players array is missing");
  }

  // Check for any null/undefined players
  const validPlayers = gameData.players.filter(
    (player) => player !== null && player !== undefined
  );
  if (validPlayers.length !== gameData.players.length) {
    console.warn(
      "Some players in the game are null or undefined, filtering them out"
    );
    gameData.players = validPlayers;
  }

  // Adapt the database model to match our application interface
  // This converts 'null' values to 'undefined' for optional properties
  const game: GameWithPlayersAndScores = {
    ...gameData,
    players: gameData.players.map((player) => ({
      ...player,
      id: player.id || "",
      gameId: player.gameId,
      userId: player.userId || undefined,
      guestId: player.guestId || undefined,
      user: player.user || undefined,
      guestUser: player.guestUser || undefined,
    })),
  };

  // Ensure each player has a valid ID
  for (const player of game.players) {
    if (!player.id && !player.userId && !player.guestId) {
      console.warn("Player is missing an ID, assigning a temporary one");
      player.id = `temp-${crypto.randomUUID()}`;
    }
  }

  const displayScores = await transformGameData(game);

  // calculate the current round number
  const currentRoundNumber = game.rounds.length + 1;

  const { userId, orgId } = await auth();
  const isAuthenticated = !!userId;

  // ScoreEntry is only visible to circle members for non-finished games
  const canEnterScores =
    isAuthenticated &&
    !game.isFinished &&
    !!game.organizationId &&
    game.organizationId === orgId;

  return (
    <section className="py-6">
      {game.winThreshold !== 75 && (
        <p className="text-center text-sm text-muted-foreground mb-2">
          Playing to {game.winThreshold} points
        </p>
      )}
      <ScoreDisplay
        displayScores={displayScores}
        numRounds={game.rounds.length}
        gameId={game.id}
        isFinished={game.isFinished}
      />
      {canEnterScores && (
        <ScoreEntry
          game={game}
          currentRoundNumber={currentRoundNumber}
          displayScores={displayScores}
        />
      )}
    </section>
  );
}
