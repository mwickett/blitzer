import Image from "next/image";
import { Section, SectionEyebrow } from "./Section";
import { DEMO_PLAYERS } from "./fixtures";
import { MAX_PICKUP_PLAYERS } from "@/lib/lobbies";

const OPEN_SEATS = MAX_PICKUP_PLAYERS - DEMO_PLAYERS.length;

export function GatherSection() {
  return (
    <Section ground="white">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <SectionEyebrow>1 · Gather</SectionEyebrow>
          <h2 className="font-display text-4xl font-bold leading-[1.08] text-brandAccent">
            Everyone&apos;s in before the deck is shuffled
          </h2>
          <p className="mt-4 text-base leading-relaxed text-textBody">
            Start a pickup game and show the code. They scan, they&apos;re in —
            up to {MAX_PICKUP_PLAYERS} players, and nobody needs an account
            first.
          </p>
          <p className="mt-3 text-base leading-relaxed text-textBody">
            Playing with someone who&apos;ll never sign up? Add them as a guest
            and they&apos;re scored like anyone else.
          </p>
        </div>

        <div className="rounded-xl border-[1.5px] border-borderWarm bg-surfaceSubtle p-4">
          <div className="flex items-center gap-5">
            <Image
              src="/img/demo-qr.png"
              width={112}
              height={112}
              alt=""
              aria-hidden="true"
              className="rounded-lg border-[1.5px] border-brandAccent bg-white p-1.5"
            />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-textMuted">
                or enter code
              </div>
              <div className="font-display text-3xl font-bold tracking-[0.16em] text-brandAccent">
                4KTQ
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {DEMO_PLAYERS.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-2.5 rounded-lg border-[1.5px] border-borderWarm bg-surfaceRaised px-3 py-2 text-sm font-semibold text-brandAccent"
              >
                <span
                  className="h-5 w-5 flex-none rounded-full"
                  style={{ backgroundColor: player.color }}
                />
                {player.name}
                {player.isGuest && (
                  <span className="ml-auto rounded-full border border-borderWarm bg-surfaceSubtle px-2 py-0.5 text-[10px] font-semibold text-textMuted">
                    guest
                  </span>
                )}
              </li>
            ))}
            <li className="flex items-center gap-2.5 rounded-lg border-[1.5px] border-dashed border-borderWarm px-3 py-2 text-sm font-medium text-textMuted">
              <span className="h-5 w-5 flex-none rounded-full border-[1.5px] border-dashed border-borderWarm" />
              {OPEN_SEATS} seats open
            </li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
