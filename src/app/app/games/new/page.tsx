/**
 * v0 by Vercel.
 * @see https://v0.dev/t/Kll93nmcoZ2
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
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
import prisma from "@/db";
import { auth } from "@clerk/nextjs/server";

export default async function NewGame() {
  const { userId } = auth();

  if (!userId) {
    return (
      <div>
        <h2>You must be logged in to view this page.</h2>
      </div>
    );
  }

  const users = await prisma.user.findMany();

  if (!users) {
    return (
      <div>
        <h2>No users found.</h2>
      </div>
    );
  }

  console.log(users);

  return (
    <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Select Players</h2>
        <Button size="sm" variant="outline">
          Start Game
        </Button>
      </div>
      <div className="space-y-4">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2">Available Players</h3>
          <Select>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select players..." />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Players</SelectLabel>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.email}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2">Selected Players</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center">
              <Avatar>
                <AvatarImage alt="John Doe" src="/avatars/01.png" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <p className="text-sm font-medium mt-2">John Doe</p>
              <Button className="mt-2" size="sm" variant="outline">
                Remove
              </Button>
            </div>
            <div className="flex flex-col items-center">
              <Avatar>
                <AvatarImage alt="Jane Smith" src="/avatars/02.png" />
                <AvatarFallback>JS</AvatarFallback>
              </Avatar>
              <p className="text-sm font-medium mt-2">Jane Smith</p>
              <Button className="mt-2" size="sm" variant="outline">
                Remove
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
