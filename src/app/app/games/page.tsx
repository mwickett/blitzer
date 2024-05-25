import prisma from "../../../../db";
import { auth, currentUser } from "@clerk/nextjs/server";

export default async function Games() {
  const { userId } = auth();
  let games;
  if (userId) {
    games = await prisma.user.findMany({
      where: {
        clerk_user_id: userId,
      },
      include: {
        games: true,
      },
    });
    console.log(games);
    console.log(userId);
  }
  return (
    <div>
      <h2>This is the games page</h2>
      <pre>{JSON.stringify(games, null, 2)}</pre>
    </div>
  );
}
