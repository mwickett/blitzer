import { Card, CardContent } from "@/components/ui/card";

export default function HighLowScore({
  highest,
  lowest,
}: {
  highest: number | null;
  lowest: number | null;
}) {
  if (!highest && !lowest) return null;

  return (
    <Card className="w-full max-w-md pt-4">
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-2 items-center gap-4">
          <div className="bg-muted rounded-md p-4 text-center">
            <div className="text-4xl font-bold text-primary">{highest}</div>
            <div className="text-sm text-muted-foreground">Highest Score</div>
          </div>
          <div className="bg-muted rounded-md p-4 text-center">
            <div className="text-4xl font-bold text-primary">{lowest}</div>
            <div className="text-sm text-muted-foreground">Lowest Score</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
