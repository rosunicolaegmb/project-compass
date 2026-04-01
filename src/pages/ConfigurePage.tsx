import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRightLeft, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEARS = Array.from({ length: 10 }, (_, i) => 2026 + i);

const CURRENCY_PAIRS = [
  { from: "GBP", to: "EUR", label: "GBP → EUR", symbol: "€/£", defaultRate: "1.15" },
  { from: "RON", to: "EUR", label: "RON → EUR", symbol: "€/lei", defaultRate: "0.20" },
];

export default function ConfigurePage() {
  const [selectedYear, setSelectedYear] = useState("2026");
  const [activePair, setActivePair] = useState("GBP");
  const [rates, setRates] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pair = CURRENCY_PAIRS.find((p) => p.from === activePair)!;

  useEffect(() => {
    loadRates(Number(selectedYear), pair.from);
  }, [selectedYear, activePair]);

  const loadRates = async (year: number, fromCurrency: string) => {
    setLoading(true);
    const defaultRate = CURRENCY_PAIRS.find((p) => p.from === fromCurrency)?.defaultRate || "1";
    const { data, error } = await supabase
      .from("currency_conversion_rates")
      .select("month, rate")
      .eq("year", year)
      .eq("from_currency", fromCurrency)
      .eq("to_currency", "EUR")
      .order("month");

    if (error) {
      toast.error("Failed to load conversion rates");
      setLoading(false);
      return;
    }

    const rateMap: Record<number, string> = {};
    for (let m = 1; m <= 12; m++) {
      const found = data?.find((r) => r.month === m);
      rateMap[m] = found ? String(found.rate) : defaultRate;
    }
    setRates(rateMap);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const year = Number(selectedYear);

    const upserts = Object.entries(rates).map(([month, rate]) => ({
      year,
      month: Number(month),
      from_currency: pair.from,
      to_currency: "EUR",
      rate: Number(rate) || Number(pair.defaultRate),
    }));

    const { error } = await supabase
      .from("currency_conversion_rates")
      .upsert(upserts, { onConflict: "year,month,from_currency,to_currency" });

    if (error) {
      toast.error("Failed to save rates: " + error.message);
    } else {
      toast.success(`${pair.label} rates saved for ${selectedYear}`);
    }
    setSaving(false);
  };

  return (
    <div className="page-container">
      <PageHeader title="Configure" description="System configuration and conversion settings" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="h-4 w-4" />
                Currency Conversion Rates
              </CardTitle>
              <CardDescription>Set monthly conversion rates to EUR (baseline currency)</CardDescription>
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activePair} onValueChange={setActivePair} className="mb-4">
            <TabsList>
              {CURRENCY_PAIRS.map((cp) => (
                <TabsTrigger key={cp.from} value={cp.from}>{cp.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {MONTHS.map((name, i) => {
                  const month = i + 1;
                  return (
                    <div key={month} className="space-y-1.5">
                      <Label htmlFor={`rate-${month}`} className="text-xs text-muted-foreground">
                        {name}
                      </Label>
                      <div className="relative">
                        <Input
                          id={`rate-${month}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={rates[month] ?? pair.defaultRate}
                          onChange={(e) => setRates((prev) => ({ ...prev, [month]: e.target.value }))}
                          className="pr-14"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {pair.symbol}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Separator className="my-6" />
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Rates
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
