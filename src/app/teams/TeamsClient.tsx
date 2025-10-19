"use client";

import {
  OrganizationProfile,
  CreateOrganization,
  useOrganization,
} from "@clerk/nextjs";

export default function TeamsClient() {
  const { organization } = useOrganization();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {!organization ? (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Create a Team</h1>
          <p className="text-muted-foreground">
            You don&apos;t have an active team. Create one to get started.
          </p>
          <div className="bg-white rounded-md p-4 border">
            <CreateOrganization
              appearance={{
                elements: {
                  rootBox: "w-full",
                  cardBox: "shadow-none",
                },
              }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Team Settings</h1>
          <div className="bg-white rounded-md p-4 border">
            <OrganizationProfile
              appearance={{
                elements: {
                  rootBox: "w-full",
                  cardBox: "shadow-none",
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
