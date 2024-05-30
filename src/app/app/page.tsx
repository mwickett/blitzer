import prisma from "@/db";

export default async function AppHome() {
  const games = await prisma.game.findMany();

  return (
    <div>
      <h2>This is the app homepage</h2>
      <pre>{JSON.stringify(games, null, 2)}</pre>
    </div>
  );
}
