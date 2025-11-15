import {
  validateImageFile,
  generateUniqueFilename,
  formatFileSize,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from "../fileUpload";

describe("fileUpload utilities", () => {
  describe("validateImageFile", () => {
    it("should accept valid JPEG files", () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid PNG files", () => {
      const file = new File(["test"], "test.png", { type: "image/png" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject files larger than MAX_FILE_SIZE", () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: MAX_FILE_SIZE + 1 });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("5MB");
    });

    it("should reject non-image files", () => {
      const file = new File(["test"], "test.txt", { type: "text/plain" });
      Object.defineProperty(file, "size", { value: 1024 });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("JPEG or PNG");
    });

    it("should reject GIF files", () => {
      const file = new File(["test"], "test.gif", { type: "image/gif" });
      Object.defineProperty(file, "size", { value: 1024 });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("JPEG or PNG");
    });

    it("should handle null file", () => {
      const result = validateImageFile(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No file provided");
    });

    it("should handle undefined file", () => {
      const result = validateImageFile(undefined as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No file provided");
    });
  });

  describe("generateUniqueFilename", () => {
    it("should generate a unique filename with correct extension", () => {
      const filename = generateUniqueFilename("photo.jpg");
      expect(filename).toMatch(/^key-moment-\d+-[a-z0-9]+\.jpg$/);
    });

    it("should handle different extensions", () => {
      const filename = generateUniqueFilename("image.png");
      expect(filename).toMatch(/^key-moment-\d+-[a-z0-9]+\.png$/);
    });

    it("should generate different filenames for consecutive calls", () => {
      const filename1 = generateUniqueFilename("test.jpg");
      const filename2 = generateUniqueFilename("test.jpg");
      expect(filename1).not.toBe(filename2);
    });

    it("should handle files without extensions gracefully", () => {
      const filename = generateUniqueFilename("test");
      expect(filename).toMatch(/^key-moment-\d+-[a-z0-9]+\.test$/);
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
      expect(formatFileSize(500)).toBe("500 Bytes");
    });

    it("should format KB correctly", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("should format MB correctly", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    });

    it("should format GB correctly", () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
      expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
    });
  });

  describe("constants", () => {
    it("should have correct allowed image types", () => {
      expect(ALLOWED_IMAGE_TYPES).toContain("image/jpeg");
      expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
      expect(ALLOWED_IMAGE_TYPES).toHaveLength(2);
    });

    it("should have correct max file size", () => {
      expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024); // 5MB
    });
  });
});
