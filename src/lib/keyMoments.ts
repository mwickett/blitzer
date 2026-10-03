// Limits shared by the photo upload form and the upload route.

/** Vercel functions accept request bodies up to 4.5 MB. */
export const KEY_MOMENT_MAX_BYTES = 4 * 1024 * 1024;
export const KEY_MOMENT_MAX_CAPTION = 140;
export const KEY_MOMENT_MAX_PER_GAME = 30;
/** Longest edge the browser resizes a photo to before upload. */
export const KEY_MOMENT_MAX_EDGE_PX = 1600;
export const KEY_MOMENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** What the game page needs to show one photo. */
export type KeyMomentPhoto = {
  id: string;
  url: string;
  caption: string | null;
  roundNumber: number | null;
  uploaderName: string | null;
  canDelete: boolean;
};
