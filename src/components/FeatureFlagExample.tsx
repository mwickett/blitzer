"use client";

import { useScoreChartsFlag } from "@/hooks/useFeatureFlag";

export function FeatureFlagExample() {
  const showCharts = useScoreChartsFlag();

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-medium">Feature Flag Example</h3>
      <p className="mt-2">
        Score Charts Feature Flag: {showCharts ? "Enabled" : "Disabled"}
      </p>
      {showCharts && (
        <div className="mt-4 p-4 bg-green-100 rounded">
          <p>
            This content is only visible when the score-charts flag is enabled!
          </p>
        </div>
      )}
    </div>
  );
}
