import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getPickupLobbyForParticipant } from "@/server/queries/lobbies";
import { auth } from "@clerk/nextjs/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LobbyControls } from "./LobbyControls";

export default async function PickupLobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [game, session, requestHeaders] = await Promise.all([getPickupLobbyForParticipant(id), auth(), headers()]);
  if (!game) redirect("/games");
  if (game.startedAt) redirect(`/games/${game.id}`);
  if (!game.joinToken) redirect(`/games/${game.id}`);
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const joinUrl = `${protocol}://${host}/join/${game.joinToken}`;
  const qrCode = await QRCode.toDataURL(joinUrl, { width: 560, margin: 2, color: { dark: "#2a0e02", light: "#ffffff" } });
  const isHost = game.hostUserId === game.players.find((player) => player.user?.clerk_user_id === session.userId)?.userId;

  return <main className="container mx-auto p-4"><Card className="mx-auto my-6 max-w-lg border-[#e6d7c3] shadow-md"><CardHeader className="text-center"><Badge className="mx-auto mb-2 w-fit" variant="secondary">Pickup game</Badge><CardTitle>Players, scan to join</CardTitle><p className="text-sm text-muted-foreground">Lobby code <span className="font-mono font-bold tracking-widest text-foreground">{game.joinCode}</span></p></CardHeader><CardContent className="space-y-6">
    <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-xl border bg-white p-3"><Image src={qrCode} alt="QR code to join this pickup game" width={560} height={560} unoptimized className="h-auto w-full" /></div>
    <div><h2 className="mb-3 font-medium">At the table ({game.players.length})</h2><ul className="grid gap-2 sm:grid-cols-2">{game.players.map((player) => { const name = player.user?.username ?? player.guestUser?.name ?? "Player"; return <li key={player.id} className="flex items-center gap-3 rounded-lg border p-2"><Avatar className="h-8 w-8"><AvatarImage src={player.user?.avatarUrl ?? undefined} /><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>{player.userId === game.hostUserId && <Badge variant="outline">Host</Badge>}{player.guestId && <Badge variant="secondary">Guest</Badge>}</li>; })}</ul></div>
    <LobbyControls gameId={game.id} joinUrl={joinUrl} isHost={isHost} canStart={game.players.length >= 2} />
  </CardContent></Card></main>;
}
