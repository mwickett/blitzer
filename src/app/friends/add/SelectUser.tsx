"use client";

import { User } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SelectValue,
  SelectTrigger,
  SelectLabel,
  SelectItem,
  SelectGroup,
  SelectContent,
  Select,
} from "@/components/ui/select";

import { createFriendRequest } from "@/server/mutations";

export default function SelectUser({ users }: { users: User[] }) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUser) return;
    await createFriendRequest(selectedUser);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 max-w-md mx-auto my-6"
    >
      <h2>Add a friend</h2>
      <Select
        onValueChange={(value) => setSelectedUser(value)}
        value={selectedUser ?? undefined}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a user" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Users</SelectLabel>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.username}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button type="submit" disabled={!selectedUser}>
        Send friend request
      </Button>
    </form>
  );
}
