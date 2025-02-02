import { flag } from "@vercel/flags/next";

export const chartFlag = flag<boolean>({
  key: "score-charts",
  decide() {
    // this flag will be on for 50% of visitors
    // return Math.random() > 0.5;
    return true;
  },
});
