// Plain limits that client forms share with the action schemas. Kept apart
// from submissions.ts so a form can read them without bundling zod.
export const GAME_NOTE_MAX_LENGTH = 280;
export const GAME_TAG_MAX_LENGTH = 24;
