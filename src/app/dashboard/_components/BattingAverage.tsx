import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export default function BattingAverage({
  battingAverage,
}: {
  battingAverage: {
    totalHandsPlayed: number;
    totalHandsWon: number;
    battingAverage: string;
  };
}) {
  return (
    <Card className="w-full max-w-sm bg-gray-900 text-white">
      <CardHeader className="flex items-center justify-between p-4">
        <CardTitle className="text-lg font-semibold">Batting Average</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-6xl font-bold">
          {battingAverage.battingAverage}
        </div>
        <div className="hidden" />
      </CardContent>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger className="px-4 py-2 text-gray-400">
            Details
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 p-4">
              <div className="flex items-center justify-between">
                <div className="text-base text-gray-400">Rounds Won</div>
                <div className="text-base font-medium">
                  {battingAverage.totalHandsWon}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-base text-gray-400">Rounds Played</div>
                <div className="text-base font-medium">
                  {battingAverage.totalHandsPlayed}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
