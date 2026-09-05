"use client";

import { RouteError, type RouteErrorProps } from "@/components/RouteError";

export default function DashboardError(props: RouteErrorProps) {
  return (
    <RouteError
      {...props}
      section="dashboard"
      title="Dashboard Error"
      description="We encountered an error while loading your dashboard"
    />
  );
}
