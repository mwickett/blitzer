import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Presentational: the number-bearing content is produced server-side; this only
// renders the stored prose or a status placeholder.
export function GameSummaryCard({
  status,
  content,
}: {
  status: string;
  content: string | null;
}) {
  if (status === "failed") return null;

  return (
    <Card className="max-w-2xl mx-auto mt-4">
      <CardHeader>
        <CardTitle>Game Recap</CardTitle>
      </CardHeader>
      <CardContent>
        {status === "ready" && content ? (
          <p>{content}</p>
        ) : status === "insufficient_data" ? (
          <p className="text-muted-foreground">Not enough rounds for a recap.</p>
        ) : (
          <p className="text-muted-foreground">Your recap is being written…</p>
        )}
      </CardContent>
    </Card>
  );
}
