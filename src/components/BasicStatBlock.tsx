import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export default function BattingAverage({
  label,
  value,
  details,
}: {
  label: string;
  value: string;
  details?: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-sm bg-brandAccent text-white">
      <CardHeader className="flex items-center justify-between p-4">
        <CardTitle className="text-lg font-semibold">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-6xl font-bold">{value}</div>
        <div className="hidden" />
      </CardContent>
      {details && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className="px-4 py-2 text-gray-400">
              Details
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 p-4">{details}</div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </Card>
  );
}
