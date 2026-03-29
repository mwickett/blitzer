import ScoreEntry from "./scoreEntry";
import ScoreDisplay from "./scoreDisplay";
import GameOver from "./GameOver";
import { ScoringShell } from "@/components/scoring/ScoringShell";
import { getGameById } from "@/server/queries";
import { notFound } from "next/navigation";
import transformGameData, { GameWithPlayersAndScores } from "@/lib/gameLogic";
import { isFeatureEnabled } from "@/featureFlags";
import {
  resolvePlayerColor,
  assignColorsToPlayers,
} from "@/lib/scoring/colors";
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
      accentColor: player.accentColor ?? undefined,
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

  const useScoringRevamp = await isFeatureEnabled("scoring-revamp");

  // Resolve accent colors for all players
  const playerColorInputs = game.players.map((p) => ({
    id: p.id,
    resolvedColor: resolvePlayerColor({
      gameColor: p.accentColor ?? null,
      userDefault: p.user?.accentColor ?? null,
    }),
  }));
  const colorAssignments = assignColorsToPlayers(playerColorInputs);

  // Build PlayerWithScore array for the new scoring shell
  // DisplayScores.id is the participant's userId or guestId (stable ID from gameLogic.ts)
  const scoringPlayers = displayScores.map((ds) => {
    const gamePlayer = game.players.find(
      (p) => p.userId === ds.id || p.guestId === ds.id
    );
    return {
      id: ds.id,
      name: ds.username,
      color: colorAssignments[gamePlayer?.id ?? ds.id] ?? "#3b82f6",
      isGuest: ds.isGuest,
      userId: gamePlayer?.userId ?? undefined,
      guestId: gamePlayer?.guestId ?? undefined,
      score: ds.total,
    };
  });

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
      {useScoringRevamp ? (
        <>
          {canEnterScores && (
            <ScoringShell
              gameId={game.id}
              currentRoundNumber={currentRoundNumber}
              players={scoringPlayers}
              winThreshold={game.winThreshold}
              isFinished={game.isFinished}
              rounds={game.rounds.map((r) => ({
                id: r.id,
                scores: r.scores.map((s) => ({
                  userId: s.userId,
                  guestId: s.guestId,
                  blitzPileRemaining: s.blitzPileRemaining,
                  totalCardsPlayed: s.totalCardsPlayed,
                })),
              }))}
            />
          )}
          {game.isFinished && displayScores.find((s) => s.isWinner) && (
            <GameOver
              gameId={game.id}
              winner={displayScores.find((s) => s.isWinner)!.username}
            />
          )}
        </>
      ) : (
        canEnterScores && (
          <ScoreEntry
            game={game}
            currentRoundNumber={currentRoundNumber}
            displayScores={displayScores}
          />
        )
      )}
    </section>
  );
}
