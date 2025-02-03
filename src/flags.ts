import { flag } from "@vercel/flags/next";
import { get } from "@vercel/edge-config";

// Define the flag keys
const FLAGS = {
  SCORE_CHARTS: "flag-score-charts",
  COOL_BUTTON: "flag-cool-button",
  // NEW_FEATURE: 'flag-new-feature',
} as const;

// Create type for flag keys
type FlagKey = (typeof FLAGS)[keyof typeof FLAGS];

// Create type for flag values
type FlagValues = {
  [K in FlagKey]: boolean;
};

// Helper function to get all flags with proper typing
async function getFlags(): Promise<FlagValues> {
  try {
    // Since getBatch isn't available, we'll fetch each flag individually
    const flags = await Promise.all(
      Object.entries(FLAGS).map(async ([key, flagKey]) => {
        const value = await get<boolean>(flagKey);
        return [flagKey, value ?? false] as const;
      })
    );
    return Object.fromEntries(flags) as FlagValues;
  } catch (error) {
    // Return all flags as false if edge config fails
    return Object.values(FLAGS).reduce(
      (acc, key) => ({
        ...acc,
        [key]: false,
      }),
      {} as FlagValues
    );
  }
}

// Create and export flags
export const chartFlag = flag<boolean>({
  key: "score-charts",
  decide: async () => {
    const flags = await getFlags();
    return flags[FLAGS.SCORE_CHARTS] ?? false;
  },
});

export const coolButtonFlag = flag<boolean>({
  key: "cool-button",
  decide: async () => {
    const flags = await getFlags();
    return flags[FLAGS.COOL_BUTTON] ?? false;
  },
});
