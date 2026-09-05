"use client";

import { RouteError, type RouteErrorProps } from "@/components/RouteError";

export default function GamesListError(props: RouteErrorProps) {
  return (
    <RouteError
      {...props}
      section="games-list"
      description="We encountered an error while loading your games"
    />
  );
}
