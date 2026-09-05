"use client";

import { useParams } from "next/navigation";
import { RouteError, type RouteErrorProps } from "@/components/RouteError";

export default function GameDetailError(props: RouteErrorProps) {
  const { id } = useParams<{ id: string }>();
  return (
    <RouteError
      {...props}
      section="game-detail"
      gameId={id}
      description="We encountered an error while loading the game data"
    />
  );
}
