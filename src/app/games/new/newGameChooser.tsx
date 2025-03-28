"use client";

import { useState, useEffect } from "react";
import { User } from "@prisma/client";
import { useUser } from "@clerk/nextjs";
import { createGame } from "@/server/mutations";
import { cn } from "@/lib/utils";

// UI Components
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronsUpDown, Plus, X, Users, PlayCircle } from "lucide-react";

type UserSubset = Pick<User, "id" | "username" | "clerk_user_id" | "avatarUrl">;

export default function NewGameChooser({ users }: { users: UserSubset[] }) {
  // No longer need selectedUserId state as we use direct user selection via CommandItem
  const [inGameUsers, setInGameUsers] = useState<UserSubset[]>([]);
  const [open, setOpen] = useState(false);

  const { user: clerkUser } = useUser();

  // Initialize with current user - only on initial load
  useEffect(() => {
    if (users.length > 0 && inGameUsers.length === 0) {
      const currentUser = users.find(
        (user) => user.clerk_user_id === clerkUser?.id
      );
      if (currentUser) {
        setInGameUsers([currentUser]);
      } else if (users.length > 0) {
        setInGameUsers([users[0]]);
      }
    }
    // Only run this effect once on component mount with the empty dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddUser = (user: UserSubset) => {
    if (!inGameUsers.some((p) => p.id === user.id) && inGameUsers.length < 4) {
      setInGameUsers([...inGameUsers, user]);
    }
    setOpen(false);
  };

  const removePlayer = (playerId: string) => {
    // Allow removing any player including yourself
    setInGameUsers(inGameUsers.filter((player) => player.id !== playerId));
  };

  return (
    <Card className="mx-auto shadow-md border-[#e6d7c3] max-w-md my-6">
      <CardHeader className="bg-gradient-to-r from-[#5a341f] to-[#8b5e3c] text-white rounded-t-lg">
        <CardTitle className="text-xl flex items-center gap-2">
          <PlayCircle className="h-5 w-5" />
          Create New Game
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-medium text-[#2a0e02] mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Select Players (Max 4)
            </h2>
            <div className="bg-[#f7f2e9] p-3 rounded-lg border border-[#e6d7c3]">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#5a341f] text-sm">
                  Available Players
                </h3>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-[240px] justify-between border-[#e6d7c3] text-[#2a0e02] h-9 text-sm"
                      disabled={inGameUsers.length >= 4}
                    >
                      {inGameUsers.length >= 4
                        ? "Max players"
                        : "Select players..."}
                      <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0">
                    <Command>
                      <CommandInput placeholder="Search players..." />
                      <CommandList>
                        <CommandEmpty>No player found.</CommandEmpty>
                        <CommandGroup>
                          {users
                            .filter(
                              (user) =>
                                !inGameUsers.some((p) => p.id === user.id)
                            )
                            .map((user) => (
                              <CommandItem
                                key={user.id}
                                onSelect={() => handleAddUser(user)}
                                className="flex items-center gap-2"
                              >
                                <Avatar className="h-6 w-6">
                                  {user.avatarUrl ? (
                                    <AvatarImage
                                      src={user.avatarUrl}
                                      alt={user.username}
                                    />
                                  ) : (
                                    <AvatarFallback className="bg-[#f0e6d2] text-[#2a0e02] text-xs">
                                      {user.username
                                        .substring(0, 2)
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                {user.username}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-[#5a341f] text-sm mb-3">
              Selected Players ({inGameUsers.length}/4)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {inGameUsers.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "relative flex flex-col items-center p-3 rounded-lg border border-[#e6d7c3] bg-white h-[110px]",
                    user.clerk_user_id === clerkUser?.id &&
                      "ring-1 ring-[#8b5e3c]"
                  )}
                >
                  <div className="absolute top-1 right-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-[#8b5e3c] hover:text-[#5a341f] hover:bg-[#f7f2e9]"
                      onClick={() => removePlayer(user.id)}
                      disabled={false}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>
                  <Avatar className="h-12 w-12 mb-2">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.username} />
                    ) : (
                      <AvatarFallback className="bg-[#f0e6d2] text-[#2a0e02]">
                        {user.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex flex-col items-center h-[36px] justify-between">
                    <span className="font-medium text-[#2a0e02] text-sm">
                      {user.username}
                    </span>
                    {user.clerk_user_id === clerkUser?.id && (
                      <span className="text-xs bg-[#f0e6d2] text-[#5a341f] px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {inGameUsers.length < 4 && (
                <button
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-[#d1bfa8] bg-[#f7f2e9] hover:bg-[#f0e6d2] transition-colors h-[110px]"
                  onClick={() => setOpen(true)}
                >
                  <div className="h-12 w-12 rounded-full bg-[#f0e6d2] flex items-center justify-center mb-2">
                    <Plus className="h-6 w-6 text-[#8b5e3c]" />
                  </div>
                  <span className="font-medium text-[#5a341f] text-sm">
                    Add Player
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-[#f7f2e9] border-t border-[#e6d7c3] p-4 flex justify-end">
        <Button
          className="bg-[#2a6517] hover:bg-[#1d4a10] text-white font-medium px-6 h-10"
          onClick={() => createGame(inGameUsers)}
          disabled={inGameUsers.length < 2}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          Start Game
        </Button>
      </CardFooter>
    </Card>
  );
}
