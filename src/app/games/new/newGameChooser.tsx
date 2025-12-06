"use client";

import { useState, useEffect } from "react";
import { User } from "@prisma/client";
import { useUser } from "@clerk/nextjs";
import { createGame } from "@/server/mutations";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { CardColourSelector } from "@/components/CardColourSelector";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  ChevronsUpDown,
  Plus,
  X,
  Users,
  PlayCircle,
  UserPlus,
  User as UserIcon,
} from "lucide-react";

type UserSubset = Pick<User, "id" | "username" | "clerk_user_id" | "avatarUrl">;

type GamePlayer = (UserSubset | { id: string; username: string; isGuest: true }) & { cardColour?: string | null };

interface NewGameChooserProps {
  users: UserSubset[];
}

export default function NewGameChooser({
  users,
}: NewGameChooserProps) {
  const [inGamePlayers, setInGamePlayers] = useState<GamePlayer[]>([]);
  const [open, setOpen] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [activeTab, setActiveTab] = useState("existing");
  const [guestName, setGuestName] = useState("");
  const [guestError, setGuestError] = useState("");
  const [isInitialUserSet, setIsInitialUserSet] = useState(false);

  const { user: clerkUser } = useUser();
  const router = useRouter();

  // Initialize with current user when clerkUser is loaded
  useEffect(() => {
    // Only set initial player if clerk user is loaded, users exist, and initial player hasn't been set
    if (clerkUser && users.length > 0 && !isInitialUserSet) {
      const currentUser = users.find(
        (user) => user.clerk_user_id === clerkUser.id // clerkUser is guaranteed to exist here
      );
      if (currentUser) {
        setInGamePlayers([{ ...currentUser, cardColour: null }]);
      }
      // We removed the potentially incorrect fallback here.
      // If the logged-in user isn't in the `users` list for some reason, they won't be added automatically.
      setIsInitialUserSet(true); // Mark initial user as set
    }
  }, [clerkUser, users, isInitialUserSet]); // Depend on clerkUser, users, and the flag

  const handleAddUser = (user: UserSubset) => {
    if (!inGamePlayers.some((p) => p.id === user.id)) {
      setInGamePlayers([...inGamePlayers, { ...user, cardColour: null }]);
    }
    setOpen(false);
    resetAddPlayerState();
  };

  const handleAddGuest = () => {
    if (!guestName.trim()) {
      setGuestError("Please enter a name");
      return;
    }

    let guestId: string;
    try {
      guestId = `guest-${crypto.randomUUID()}`;
    } catch (error) {
      guestId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Create a temporary guest object with a client-side ID
    const tempGuestUser = {
      id: guestId, // Temporary ID, will be replaced by real UUID on server
      username: guestName.trim(),
      isGuest: true as const, // Flag to identify guest users in the UI
      cardColour: null as string | null,
    };

    setInGamePlayers((prev) => [...prev, tempGuestUser]);
    resetAddPlayerState();
  };

  const handleColourChange = (playerId: string, colour: string | null) => {
    setInGamePlayers((prev) =>
      prev.map((player) =>
        player.id === playerId ? { ...player, cardColour: colour } : player
      )
    );
  };

  const resetAddPlayerState = () => {
    setAddingPlayer(false);
    setGuestName("");
    setGuestError("");
    setActiveTab("existing");
  };

  const startAddingPlayer = () => {
    setAddingPlayer(true);
  };

  const removePlayer = (playerId: string) => {
    // Allow removing any player including yourself
    setInGamePlayers(inGamePlayers.filter((player) => player.id !== playerId));
  };

  // Helper to determine if a player is the current user
  const isCurrentUser = (player: GamePlayer) => {
    return "clerk_user_id" in player && player.clerk_user_id === clerkUser?.id;
  };

  // Helper to get player initials
  const getPlayerInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  // Helper to check if the player is a guest
  const isGuestPlayer = (
    player: GamePlayer
  ): player is { id: string; username: string; isGuest: true } => {
    return "isGuest" in player && player.isGuest === true;
  };

  // Handle game creation and redirect
  const handleCreateGame = async () => {
    try {
      const result = await createGame(inGamePlayers);
      if (result && result.gameId) {
        router.push(`/games/${result.gameId}`);
      }
    } catch (error) {
      console.error("Error creating game:", error);
    }
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
              Select Players
            </h2>
          </div>

          <div>
            <h3 className="font-medium text-[#5a341f] text-sm mb-3">
              Selected Players ({inGamePlayers.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {inGamePlayers.map((player) => (
                <div
                  key={player.id}
                  className={cn(
                    "relative flex flex-col p-3 rounded-lg border border-[#e6d7c3] bg-white",
                    isCurrentUser(player) && "ring-1 ring-[#8b5e3c]"
                  )}
                >
                  <div className="absolute top-1 right-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-[#8b5e3c] hover:text-[#5a341f] hover:bg-[#f7f2e9]"
                      onClick={() => removePlayer(player.id)}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>
                  <div className="flex items-center mb-2">
                    <Avatar className="h-12 w-12 mr-3 flex-shrink-0">
                      {"avatarUrl" in player && player.avatarUrl ? (
                        <AvatarImage
                          src={player.avatarUrl}
                          alt={player.username}
                        />
                      ) : (
                        <AvatarFallback className="bg-[#f0e6d2] text-[#2a0e02]">
                          {getPlayerInitials(player.username)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#2a0e02] text-sm">
                        {player.username}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {isCurrentUser(player) && (
                          <span className="text-xs bg-[#f0e6d2] text-[#5a341f] px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                        {isGuestPlayer(player) && (
                          <span className="text-xs bg-[#e6d7c3] text-[#5a341f] px-2 py-0.5 rounded-full">
                            Guest
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1">
                    <label className="text-xs text-[#5a341f] mb-1 block">
                      Card Colour (optional)
                    </label>
                    <CardColourSelector
                      value={player.cardColour}
                      onChange={(colour) => handleColourChange(player.id, colour)}
                    />
                  </div>
                </div>
              ))}

              {!addingPlayer && (
                <button
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-[#d1bfa8] bg-[#f7f2e9] hover:bg-[#f0e6d2] transition-colors min-h-[130px]"
                  onClick={startAddingPlayer}
                >
                  <div className="h-12 w-12 rounded-full bg-[#f0e6d2] flex items-center justify-center mb-2 flex-shrink-0">
                    <Plus className="h-6 w-6 text-[#8b5e3c]" />
                  </div>
                  <span className="font-medium text-[#5a341f] text-sm">
                    Add Player
                  </span>
                </button>
              )}

              {addingPlayer && (
                <div className="flex flex-col p-3 rounded-lg border border-[#e6d7c3] bg-white min-h-[130px]">
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full"
                  >
                    <TabsList className="grid grid-cols-2 mb-2 bg-[#f7f2e9]">
                      <TabsTrigger value="existing" className="text-xs">
                        <UserIcon className="h-3 w-3 mr-1" />
                        Existing
                      </TabsTrigger>
                      <TabsTrigger value="guest" className="text-xs">
                        <UserPlus className="h-3 w-3 mr-1" />
                        Guest
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="existing" className="mt-0">
                      <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between border-[#e6d7c3] text-[#2a0e02] h-8 text-xs"
                          >
                            Select player...
                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                          <Command>
                            <CommandInput placeholder="Search..." />
                            <CommandList>
                              <CommandEmpty>No player found.</CommandEmpty>
                              <CommandGroup>
                                {users
                                  .filter(
                                    (user) =>
                                      !inGamePlayers.some(
                                        (p) => p.id === user.id
                                      )
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
                                            {getPlayerInitials(user.username)}
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
                    </TabsContent>
                    <TabsContent value="guest" className="mt-0 space-y-1">
                      <div className="relative">
                        <Input
                          value={guestName}
                          onChange={(e) => {
                            setGuestName(e.target.value);
                            if (e.target.value.trim()) setGuestError("");
                          }}
                          placeholder="Enter guest name"
                          className="border-[#e6d7c3] h-8 text-xs pr-16"
                        />
                        <Button
                          size="sm"
                          className="absolute right-0 top-0 h-8 text-xs bg-[#5a341f] hover:bg-[#3d1a0a]"
                          onClick={handleAddGuest}
                        >
                          Add
                        </Button>
                      </div>
                      {guestError && (
                        <p className="text-red-500 text-xs">{guestError}</p>
                      )}
                    </TabsContent>
                  </Tabs>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-auto self-center text-xs text-[#5a341f]"
                    onClick={resetAddPlayerState}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-[#f7f2e9] border-t border-[#e6d7c3] p-4 flex justify-end">
        <Button
          className="bg-[#2a6517] hover:bg-[#1d4a10] text-white font-medium px-6 h-10"
          onClick={handleCreateGame}
          disabled={inGamePlayers.length < 2}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          Start Game
        </Button>
      </CardFooter>
    </Card>
  );
}
