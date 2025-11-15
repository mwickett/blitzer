/**
 * File upload utilities for key moment photos
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an image file for upload
 */
export function validateImageFile(file: File): FileValidationResult {
  // Check if file exists
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: "File must be a JPEG or PNG image",
    };
  }

  return { valid: true };
}

/**
 * Generate a unique filename for uploaded images
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalFilename.split(".").pop();
  return `key-moment-${timestamp}-${randomString}.${extension}`;
}

/**
 * Convert bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}
