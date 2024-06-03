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
import { AvatarImage, AvatarFallback, Avatar } from "@/components/ui/avatar";
import { createNewGame } from "./newGameAction";

type userSubset = Pick<User, "id" | "email">;

export default function NewGameChooser({ users }: { users: userSubset[] }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inGameUsers, setInGameUsers] = useState<userSubset[]>([]);

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
    <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Select Players</h2>
        <Button
          onClick={() => createNewGame(inGameUsers)}
          size="sm"
          variant="outline"
        >
          Start Game
        </Button>
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
                    {user.email}
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
            {inGameUsers.map((user) => (
              <div key={user.id} className="flex flex-col items-center">
                <Avatar>
                  <AvatarFallback>
                    {user.email ? user.email.toUpperCase() : ""}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium mt-2">{user.email}</p>
                <Button
                  className="mt-2"
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
