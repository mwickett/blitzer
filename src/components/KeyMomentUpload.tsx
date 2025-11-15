"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, Upload, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { validateImageFile, formatFileSize } from "@/lib/fileUpload";
import { createKeyMoment } from "@/server/mutations";
import { useRouter } from "next/navigation";

interface KeyMomentUploadProps {
  gameId: string;
  roundId?: string;
}

export default function KeyMomentUpload({
  gameId,
  roundId,
}: KeyMomentUploadProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate the file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid file");
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload the file
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadResponse = await fetch("/api/key-moments/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || "Failed to upload file");
      }

      const { imageUrl } = await uploadResponse.json();

      // Save the key moment to database
      await createKeyMoment(gameId, imageUrl, description, roundId);

      // Show success message
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        handleClearFile();
        setDescription("");
        router.refresh(); // Refresh the page to show the new key moment
      }, 1500);
    } catch (err) {
      console.error("Error uploading key moment:", err);
      setError(err instanceof Error ? err.message : "Failed to upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Camera className="h-4 w-4" />
          Upload Key Moment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Key Moment</DialogTitle>
          <DialogDescription>
            Capture a memorable moment from the game! Upload a photo (JPEG or
            PNG, max 5MB) and add an optional description.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Key moment uploaded successfully!
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="photo">Photo</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="cursor-pointer"
                />
                {selectedFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleClearFile}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            {previewUrl && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What made this moment special?"
                disabled={uploading}
                className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                maxLength={500}
              />
              {description && (
                <p className="text-xs text-muted-foreground text-right">
                  {description.length}/500
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!selectedFile || uploading}>
                {uploading ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-pulse" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
