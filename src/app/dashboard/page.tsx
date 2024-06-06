import { getPlayerWinRate } from "@/server/queries";

export default async function Dashboard() {
  const winRate = await getPlayerWinRate();

  return (
    <section className="border-zinc-500 p-5">
      <div>
        <h2 className="">Welcome to Blitzer {winRate.email}</h2>
        <p>Your stats:</p>
        <p>Win Rate: {winRate.winRate}%</p>
        <p>Games hands played: {winRate.totalHandsPlayed}</p>
        <p>Games hands won: {winRate.totalHandsWon}</p>
      </div>
    </section>
  );
}
