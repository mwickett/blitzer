"use client";

import { useEffect, useState } from "react";

type RecapState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string; speaking: boolean }
  | { status: "error"; message: string };

function speechAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/**
 * Between rounds, asks the server for a short announcer-style recap and reads
 * it aloud with the browser's speech synthesis, showing the text as well.
 * The server page decides who sees it (llm-features, players at the table).
 */
export function RoundRecap({ gameId, roundsPlayed }: { gameId: string; roundsPlayed: number }) {
  const [state, setState] = useState<RecapState>({ status: "idle" });

  // Callers key this by round, so a new round remounts it; stop talking on the way out.
  useEffect(() => () => {
    if (speechAvailable()) window.speechSynthesis.cancel();
  }, []);

  if (roundsPlayed === 0) return null;

  const speak = (text: string) => {
    if (!speechAvailable()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setState((current) =>
      current.status === "ready" ? { ...current, speaking: false } : current);
    setState({ status: "ready", text, speaking: true });
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if (speechAvailable()) window.speechSynthesis.cancel();
    setState((current) => (current.status === "ready" ? { ...current, speaking: false } : current));
  };

  const fetchRecap = async () => {
    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/games/${gameId}/recap`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!response.ok || !body.text) {
        setState({ status: "error", message: body.error ?? "Couldn't write a recap. Please try again." });
        return;
      }
      setState({ status: "ready", text: body.text, speaking: false });
      speak(body.text);
    } catch {
      setState({ status: "error", message: "Couldn't reach the announcer. Please try again." });
    }
  };

  return (
    <section aria-label="Round recap" className="mx-4 mb-3 rounded-lg border-[1.5px] border-[#e6d7c3] bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-[#290806]">
          <span aria-hidden="true" className="mr-1">🎙️</span>
          Round {roundsPlayed} recap
        </div>
        {state.status === "ready" && state.speaking ? (
          <button type="button" onClick={stop} className="text-sm font-semibold text-[#8b5e3c] underline-offset-2 hover:underline">
            Stop
          </button>
        ) : state.status === "ready" ? (
          speechAvailable() ? (
            <button type="button" onClick={() => speak(state.text)} className="text-sm font-semibold text-[#8b5e3c] underline-offset-2 hover:underline">
              Play again
            </button>
          ) : null
        ) : (
          <button
            type="button"
            onClick={fetchRecap}
            disabled={state.status === "loading"}
            className="rounded-md bg-[#290806] px-3 py-1 text-sm font-semibold text-white disabled:opacity-60"
          >
            {state.status === "loading" ? "Writing…" : "Play recap"}
          </button>
        )}
      </div>
      {state.status === "ready" ? (
        <p className="mt-1.5 text-[13px] text-[#8b5e3c]" aria-live="polite">{state.text}</p>
      ) : null}
      {state.status === "error" ? (
        <p className="mt-1.5 text-[13px] text-red-700" role="alert">{state.message}</p>
      ) : null}
    </section>
  );
}
