import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function DebugPage() {
  const { userId } = await auth();
  const cookieStore = await cookies();

  if (!userId) {
    redirect("/sign-in");
  }

  // Pass along the cookie header to maintain auth context
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/dev`, {
    headers: {
      Cookie: cookieStore.toString(),
    },
  });

  const userInfo = await response.json();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">Debug Page</h1>
      <pre>{JSON.stringify(userInfo, null, 2)}</pre>
    </div>
  );
}
