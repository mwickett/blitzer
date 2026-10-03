import "server-only";

/** Photos are on only once the Vercel Blob store is connected to the project. */
export function isKeyMomentStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
