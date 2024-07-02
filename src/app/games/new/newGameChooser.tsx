"use client";

import { User } from "@prisma/client";
import { useState, useEffect } from "react";
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
import { AvatarImage, AvatarFallback, Avatar } from "@/components/ui/avatar";
import { createGame } from "@/server/mutations";
import { useUser } from "@clerk/nextjs";

type userSubset = Pick<User, "id" | "username" | "clerk_user_id">;

export default function NewGameChooser({ users }: { users: userSubset[] }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inGameUsers, setInGameUsers] = useState<userSubset[]>([]);

  const { user: clerkUser } = useUser();

  useEffect(() => {
    if (users.length > 0 && inGameUsers.length === 0) {
      setInGameUsers([users[0]]);
    }
  }, [users]);

  const handleAddUser = () => {
    if (selectedUserId) {
      const userToAdd = users.find((user) => user.id === selectedUserId);
      if (
        userToAdd &&
        !inGameUsers.some((user) => user.id === selectedUserId)
      ) {
        setInGameUsers((prev) => [...prev, userToAdd]);
        setSelectedUserId(""); // Clear the selection after adding
      }
    }
  };

  const gameFull = inGameUsers.length >= 4;

  return (
    <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 max-w-md mx-auto my-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Select Players</h2>
      </div>
      <div className="space-y-4">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2">Available Players</h3>
          <Select
            onValueChange={(value) => setSelectedUserId(value)}
            value={selectedUserId ?? undefined}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select players..." />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Players</SelectLabel>
                {users.map((user) => (
                  <SelectItem
                    disabled={inGameUsers.some((u) => u.id === user.id)}
                    key={user.id}
                    value={user.id}
                  >
                    {user.username}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button disabled={gameFull} onClick={handleAddUser} className="mt-2">
            {gameFull ? `Click start to begin` : "Add player"}
          </Button>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2">Selected Players</h3>
          <div className="grid grid-cols-3 gap-4">
            {inGameUsers.map((user, i) => (
              <div
                key={user.id}
                className={`flex flex-col items-center p-2 h-full ${
                  user.clerk_user_id === clerkUser?.id ? "bg-blue-100" : ""
                }`}
              >
                {user.clerk_user_id === clerkUser?.id ? (
                  <div className="text-xs p-2">You</div>
                ) : null}
                <Avatar>
                  <AvatarImage src={clerkUser?.imageUrl} />
                  <AvatarFallback>
                    {user.username ? user.username.toUpperCase() : ""}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium mt-2">{user.username}</p>
                <div className="mt-auto">
                  <Button
                    className="mt-2 "
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setInGameUsers((prev) =>
                        prev.filter((prevUser) => prevUser.id !== user.id)
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Button
          className="m-4 bg-green-600"
          onClick={() => createGame(inGameUsers)}
          disabled={inGameUsers.length <= 1}
        >
          Start Game
        </Button>
      </div>
    </div>
  );
}
