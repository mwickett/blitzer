import {
  getPlayerBattingAverage,
  getHighestAndLowestScore,
  getCumulativeScore,
} from "@/server/queries";
import BattingAverage from "./_components/BattingAverage";
import HighLowScore from "./_components/HighLowScore";
import CumulativeScore from "./_components/CumulativeScore";

export default async function Dashboard() {
  const battingAverage = await getPlayerBattingAverage();
  const { highest, lowest } = await getHighestAndLowestScore();
  const cumulativeScore = await getCumulativeScore();

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
      <div className="">
        <CumulativeScore cumulativeScore={cumulativeScore} />
      </div>
    </section>
  );
}
