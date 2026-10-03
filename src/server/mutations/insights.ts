"use server";

import prisma from "@/server/db/db";
import { isLlmFeaturesEnabled } from "@/featureFlags";
import { captureServerEvent } from "@/server/telemetry";
import { requireAuthContext } from "./common";
import { STORY_PROMPT_MAX_LENGTH, storyPromptSchema } from "@/lib/validation/submissions";

export type SaveStoryPromptResult =
  | { ok: true; storyPrompt: string | null }
  | { ok: false; message: string };

/** Saves the signed-in player's story style for game-complete emails. Blank clears it. */
export async function saveStoryPrompt(input: unknown): Promise<SaveStoryPromptResult> {
  const { userId, prismaUserId, posthog } = await requireAuthContext("prismaId");
  if (!(await isLlmFeaturesEnabled())) {
    return { ok: false, message: "This feature is currently disabled." };
  }

  const parsed = storyPromptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: `Keep your story style to ${STORY_PROMPT_MAX_LENGTH} characters or fewer.` };
  }

  await prisma.user.update({
    where: { id: prismaUserId },
    data: { storyPrompt: parsed.data },
  });

  // The prompt itself is user content and stays out of analytics.
  captureServerEvent(posthog, {
    distinctId: userId,
    event: parsed.data ? "story_prompt_saved" : "story_prompt_cleared",
  });

  return { ok: true, storyPrompt: parsed.data };
}
