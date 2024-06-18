import { cloneGame } from "@/server/mutations";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: { gameId: string } }) {
  const user = auth();
  if (!user.userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { gameId } = params;

  if (!gameId || typeof gameId !== "string") {
    return new Response('Missing game ID', { status: 400 });
  }

  try {
    const newGame = await cloneGame(gameId);
    return NextResponse.json({newGameId: newGame}, { status: 200 })
  } catch (err) {
    console.log(err);
    return new Response('Failed to clone game', { status: 500 });
  }
}