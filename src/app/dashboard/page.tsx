import { getPlayerBattingAverage } from "@/server/queries";
import BattingAverage from "./_components/BattingAverage";

export default async function Dashboard() {
  const battingAverage = await getPlayerBattingAverage();

  return (
    <section className="border-zinc-500 p-5">
      <BattingAverage battingAverage={battingAverage} />
    </section>
  );
}
