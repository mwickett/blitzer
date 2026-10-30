import { cn } from "@/lib/utils";
import { GAME_RULES } from "@/lib/validation/gameRules";

/**
 * Each fact must stay true of the product: the player cap comes from
 * GAME_RULES, guests are added by the host, recorded rounds stay editable
 * after a game ends, and every finished game has a public link.
 */
export const FACTS = [
  "Free",
  `Up to ${GAME_RULES.MAX_PLAYERS} players`,
  "Guests welcome",
  "Fix any score",
  "Share results with a link",
];

export function FactsRow({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {FACTS.map((fact) => (
        <li
          key={fact}
          className="rounded-full border-[1.5px] border-borderWarm bg-surfaceRaised px-3 py-1 text-[13px] font-semibold text-brandAccent"
        >
          {fact}
        </li>
      ))}
    </ul>
  );
}
