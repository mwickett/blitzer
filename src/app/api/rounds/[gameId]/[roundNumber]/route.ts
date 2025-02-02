import { NextResponse } from "next/server";
import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ gameId: string; roundNumber: string }> }
) {
  const params = await context.params;
  const user = await auth();
  if (!user.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const round = await prisma.round.findFirst({
      where: {
        gameId: params.gameId,
        round: parseInt(params.roundNumber),
      },
      include: {
        scores: true,
      },
    });

    if (!round) {
      console.log("round not found for gameId:", params.gameId);
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    return NextResponse.json(round);
  } catch (error) {
    console.error("Failed to fetch round:", error);
    return NextResponse.json(
      { error: "Failed to fetch round" },
      { status: 500 }
    );
  }
}
