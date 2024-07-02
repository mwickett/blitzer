"use client";

import { AvatarImage, AvatarFallback, Avatar } from "@/components/ui/avatar";

export default function UserAvatar({
  src,
  username,
}: {
  src: string;
  username: string;
}) {
  return (
    <Avatar>
      <AvatarImage src={src ?? undefined} />
      <AvatarFallback className="bg-gray-300">
        {getFallBackAvatar(username)}
      </AvatarFallback>
    </Avatar>
  );
}

function getFallBackAvatar(username: string): string {
  return (
    username[0].toUpperCase() + username[username.length - 1].toUpperCase()
  );
}
