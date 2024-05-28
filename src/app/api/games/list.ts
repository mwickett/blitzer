import { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@clerk/nextjs/server";
import prisma from "../../../db"; // Adjust the import path as needed

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the authenticated user's ID from Clerk
  const { userId } = auth();

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Fetch all games where the logged-in user has participated
    const games = await prisma.game.findMany({
      where: {
        players: {
          some: {
            user: {
              clerk_user_id: userId,
            },
          },
        },
      },
      include: {
        players: {
          include: {
            user: true,
          },
        },
        scores: true,
      },
    });

    // Send the games data as JSON response
    res.status(200).json(games);
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
