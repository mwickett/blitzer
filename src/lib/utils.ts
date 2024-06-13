import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Used in case we don't get a username from Clerk
export function generateRandomUsername(): string {
  const adjectives = [
    "Happy",
    "Sad",
    "Fast",
    "Slow",
    "Big",
    "Small",
    "Cool",
    "Hot",
    "Cold",
    "Warm",
    "Funny",
    "Serious",
    "Bright",
    "Dark",
    "Shiny",
    "Dull",
    "Quiet",
    "Loud",
    "Brave",
    "Cowardly",
    "Smart",
    "Dumb",
    "Strong",
    "Weak",
    "Friendly",
    "Mean",
    "Kind",
    "Rude",
    "Rich",
    "Poor",
    "Calm",
    "Wild",
    "Clean",
    "Dirty",
    "Sweet",
    "Bitter",
    "Fresh",
    "Stale",
    "Lucky",
    "Unlucky",
    "Bold",
    "Shy",
    "Gentle",
    "Rough",
    "Clever",
    "Clumsy",
    "Polite",
    "Silly",
    "Charming",
    "Grumpy",
  ];

  const nouns = [
    "Lion",
    "Tiger",
    "Bear",
    "Shark",
    "Eagle",
    "Wolf",
    "Fox",
    "Dog",
    "Cat",
    "Rabbit",
    "Mouse",
    "Horse",
    "Elephant",
    "Giraffe",
    "Dolphin",
    "Penguin",
    "Koala",
    "Panda",
    "Owl",
    "Hawk",
    "Frog",
    "Turtle",
    "Snake",
    "Dragon",
    "Phoenix",
    "Griffin",
    "Unicorn",
    "Goblin",
    "Elf",
    "Dwarf",
    "Wizard",
    "Knight",
    "Pirate",
    "Ninja",
    "Samurai",
    "Viking",
    "Warrior",
    "Archer",
    "Sorcerer",
    "Mage",
    "Jester",
    "King",
    "Queen",
    "Prince",
    "Princess",
    "Duke",
    "Duchess",
    "Baron",
    "Baroness",
    "Squire",
  ];

  const getRandomElement = (arr: string[]): string =>
    arr[Math.floor(Math.random() * arr.length)];

  const adjective = getRandomElement(adjectives);
  const noun = getRandomElement(nouns);
  const number = Math.floor(Math.random() * 1000); // Add a random number to ensure uniqueness

  return `${adjective}${noun}${number}`;
}
