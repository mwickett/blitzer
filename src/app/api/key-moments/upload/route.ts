import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  validateImageFile,
  generateUniqueFilename,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from "@/lib/fileUpload";

export async function POST(request: Request) {
  try {
    const user = await auth();
    if (!user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type and size on the server side
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG and PNG are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`,
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const filename = generateUniqueFilename(file.name);

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "public", "uploads", "key-moments");
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Save file to public/uploads/key-moments
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    // Return the public URL
    const imageUrl = `/uploads/key-moments/${filename}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      filename,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
