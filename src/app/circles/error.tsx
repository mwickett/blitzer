"use client";

import { RouteError, type RouteErrorProps } from "@/components/RouteError";

export default function CircleStandingsError(props: RouteErrorProps) {
  return (
    <RouteError
      {...props}
      section="circle-standings"
      title="Circle standings unavailable"
      description="We encountered an error while loading your Circle standings"
    />
  );
}
