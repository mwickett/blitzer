"use client";

import {
  OrganizationProfile,
  CreateOrganization,
  useOrganization,
  OrganizationSwitcher,
} from "@clerk/nextjs";

export default function OrganizationsClient() {
  const { organization } = useOrganization();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Organizations</h1>
        <OrganizationSwitcher />
      </div>

      {!organization ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            You don&apos;t have an active organization. Create one to get
            started.
          </p>
          <div className="bg-white rounded-md p-4 border">
            <CreateOrganization />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-md p-4 border">
          <OrganizationProfile />
        </div>
      )}
    </div>
  );
}
