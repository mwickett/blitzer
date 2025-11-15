"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Trash2 } from "lucide-react";
import { deleteKeyMoment } from "@/server/mutations";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface KeyMoment {
  id: string;
  imageUrl: string;
  description: string | null;
  createdAt: Date;
  uploadedBy: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  round: {
    id: string;
    round: number;
  } | null;
}

interface KeyMomentGalleryProps {
  keyMoments: KeyMoment[];
  currentUserId: string;
}

export default function KeyMomentGallery({
  keyMoments,
  currentUserId,
}: KeyMomentGalleryProps) {
  const router = useRouter();
  const [selectedMoment, setSelectedMoment] = useState<KeyMoment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (keyMoments.length === 0) {
    return null;
  }

  const handleDelete = async (keyMomentId: string) => {
    if (!confirm("Are you sure you want to delete this key moment?")) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteKeyMoment(keyMomentId);
      setSelectedMoment(null);
      router.refresh();
    } catch (err) {
      console.error("Error deleting key moment:", err);
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Key Moments</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {keyMoments.map((moment) => (
            <Card
              key={moment.id}
              className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
              onClick={() => setSelectedMoment(moment)}
            >
              <div className="aspect-square relative bg-gray-100">
                <img
                  src={moment.imageUrl}
                  alt={moment.description || "Key moment"}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8">
                    <UserAvatar
                      src={moment.uploadedBy.avatarUrl || ""}
                      username={moment.uploadedBy.username}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {moment.uploadedBy.username}
                    </p>
                    {moment.round && (
                      <p className="text-xs text-muted-foreground">
                        Round {moment.round.round}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Full size dialog */}
      <Dialog
        open={!!selectedMoment}
        onOpenChange={(open) => !open && setSelectedMoment(null)}
      >
        <DialogContent className="sm:max-w-[700px]">
          {selectedMoment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8">
                      <UserAvatar
                        src={selectedMoment.uploadedBy.avatarUrl || ""}
                        username={selectedMoment.uploadedBy.username}
                      />
                    </div>
                    <span>{selectedMoment.uploadedBy.username}</span>
                  </div>
                  {selectedMoment.uploadedBy.id === currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(selectedMoment.id)}
                      disabled={deleting}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {formatDate(selectedMoment.createdAt)}
                  {selectedMoment.round && ` • Round ${selectedMoment.round.round}`}
                </DialogDescription>
              </DialogHeader>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={selectedMoment.imageUrl}
                    alt={selectedMoment.description || "Key moment"}
                    className="w-full max-h-[500px] object-contain"
                  />
                </div>

                {selectedMoment.description && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedMoment.description}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
