import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JoinByCodeForm } from "./JoinByCodeForm";

export default async function JoinPage() {
  const { userId } = await auth();
  return <main className="container mx-auto p-4"><Card className="mx-auto my-10 max-w-sm"><CardHeader><CardTitle>Join a pickup game</CardTitle></CardHeader><CardContent>{userId ? <JoinByCodeForm /> : <div className="space-y-4"><p className="text-sm text-muted-foreground">Sign in to Blitzer, then enter the host&apos;s lobby code.</p><SignInButton forceRedirectUrl="/join"><Button className="w-full">Sign in to join</Button></SignInButton></div>}</CardContent></Card></main>;
}
