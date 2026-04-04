import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface MissingRatesWarningProps {
  missingCurrencies: string[];
  month: number;
  year: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MissingRatesWarning({ missingCurrencies, month, year }: MissingRatesWarningProps) {
  const navigate = useNavigate();

  if (missingCurrencies.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
        <span>
          Missing conversion rates to EUR for <strong>{missingCurrencies.join(", ")}</strong> in {MONTHS[month - 1]} {year}. Totals may be inaccurate.
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={() => navigate("/configure/conversion-rates")}
        >
          Set Rates
        </Button>
      </AlertDescription>
    </Alert>
  );
}
