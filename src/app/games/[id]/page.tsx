import ScoreEntry from "./scoreEntry";
import ScoreDisplay from "./scoreDisplay";
import { getGameById } from "@/server/queries";
import { notFound } from "next/navigation";
import transformGameData, { GameWithPlayersAndScores } from "@/lib/gameLogic";
import { isScoreChartsEnabled } from "@/featureFlags";
import KeyMomentUpload from "@/components/KeyMomentUpload";
import KeyMomentGallery from "@/components/KeyMomentGallery";
import { getKeyMomentsForGame } from "@/server/mutations";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";

export default async function GameView(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const gameData = await getGameById(params.id);
  const showCharts = await isScoreChartsEnabled();
  const user = await auth();

  if (!gameData) {
    notFound();
  }

  if (!user.userId) {
    throw new Error("Unauthorized");
  }

  // Get current user's Prisma ID
  const currentUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
    select: { id: true },
  });

  if (!currentUser) {
    throw new Error("User not found");
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

  // Fetch key moments for the game
  const keyMoments = await getKeyMomentsForGame(game.id);

  return (
    <section className="py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Game</h1>
        {!game.isFinished && (
          <KeyMomentUpload gameId={game.id} />
        )}
      </div>

      <ScoreDisplay
        displayScores={displayScores}
        numRounds={game.rounds.length}
        gameId={game.id}
        isFinished={game.isFinished}
        showCharts={showCharts}
      />
      
      <ScoreEntry
        game={game}
        currentRoundNumber={currentRoundNumber}
        displayScores={displayScores}
      />

      {keyMoments.length > 0 && (
        <KeyMomentGallery
          keyMoments={keyMoments}
          currentUserId={currentUser.id}
        />
      )}
    </section>
  );
}
