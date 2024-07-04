import { getPlayerBattingAverage } from "@/server/queries";
import BattingAverage from "./_components/BattingAverage";
import { getHighestAndLowestScore } from "@/server/queries";
import HighLowScore from "./_components/HighLowScore";

export default async function Dashboard() {
  const battingAverage = await getPlayerBattingAverage();
  const { highest, lowest } = await getHighestAndLowestScore();

  return (
    <section className="border-zinc-500 p-5">
      <div className="mb-4">
        <BattingAverage battingAverage={battingAverage} />
      </div>
      <div className="">
        <HighLowScore
          highest={highest?.score ?? null}
          lowest={lowest?.score ?? null}
        />
      </div>
    </section>
  );
}
