import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, CURRENCY_SYMBOLS, type Currency } from "@/lib/currency";

interface CurrencySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function CurrencySelect({ value, onValueChange, className }: CurrencySelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className || "w-[90px]"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c} value={c}>
            {CURRENCY_SYMBOLS[c]} {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
