import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, Save, Loader2, Info, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CurrencySelect } from "@/components/CurrencySelect";
import { MissingRatesWarning } from "@/components/MissingRatesWarning";
import { getToEurRate, loadConversionRates, CURRENCY_SYMBOLS, type Currency, getMissingRates } from "@/lib/currency";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEARS = Array.from({ length: 10 }, (_, i) => 2024 + i);

// Only EUR and RON for salary costs
const SALARY_CURRENCIES = ["EUR", "RON"] as const;

export default function SalariesPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [currencies, setCurrencies] = useState<Record<string, string>>({});
  const [overheads, setOverheads] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [allocationResult, setAllocationResult] = useState<string | null>(null);

  // Load conversion rates
  const { data: ratesLoaded } = useQuery({
    queryKey: ["conversion-rates-cache"],
    queryFn: () => loadConversionRates(),
    staleTime: 5 * 60_000,
  });

  // Fetch active resources
  const { data: resources = [] } = useQuery({
    queryKey: ["resources-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, display_name, employment_type")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing costs for selected month/year
  const { data: existingCosts, isLoading } = useQuery({
    queryKey: ["resource-monthly-costs", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_monthly_costs")
        .select("resource_id, amount, overhead, currency")
        .eq("year", Number(selectedYear))
        .eq("month", Number(selectedMonth));
      if (error) throw error;
      return data;
    },
  });

  // Fetch general expenses total (EUR) for this month
  const { data: generalExpenses = [] } = useQuery({
    queryKey: ["general-expenses", Number(selectedYear), Number(selectedMonth)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_expenses")
        .select("amount, currency")
        .eq("year", Number(selectedYear))
        .eq("month", Number(selectedMonth));
      if (error) throw error;
      return data;
    },
  });

  // Fetch conversion rates for this month (for general expenses conversion)
  const { data: conversionRates = [] } = useQuery({
    queryKey: ["conversion-rates", Number(selectedYear), Number(selectedMonth)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currency_conversion_rates")
        .select("from_currency, to_currency, rate")
        .eq("year", Number(selectedYear))
        .eq("month", Number(selectedMonth));
      if (error) throw error;
      return data;
    },
  });

  // Check for missing rates
  const usedCurrencies = useMemo(() => {
    const set = new Set<string>();
    Object.values(currencies).forEach((c) => { if (c && c !== "EUR") set.add(c); });
    generalExpenses.forEach((e: any) => { if (e.currency && e.currency !== "EUR") set.add(e.currency); });
    return Array.from(set);
  }, [currencies, generalExpenses]);

  const missingRates = useMemo(
    () => getMissingRates(usedCurrencies, Number(selectedYear), Number(selectedMonth)),
    [usedCurrencies, selectedYear, selectedMonth, ratesLoaded]
  );

  // Calculate total general expenses in EUR
  const getEurRate = (currency: string): number => {
    if (currency === "EUR") return 1;
    const rate = conversionRates.find(
      (r: any) => r.from_currency === currency && r.to_currency === "EUR"
    );
    return rate ? Number(rate.rate) : 1;
  };

  const totalGeneralExpensesEur = useMemo(() => {
    return generalExpenses.reduce((sum: number, e: any) => {
      return sum + Number(e.amount) * getEurRate(e.currency);
    }, 0);
  }, [generalExpenses, conversionRates]);

  // Count resources with amount > 0 (dynamically from current state)
  const activeResourceCount = useMemo(() => {
    return resources.filter((r) => {
      const amt = Number(amounts[r.id] || 0);
      return amt > 0;
    }).length;
  }, [resources, amounts]);

  // Calculated overhead per resource
  const calculatedOverhead = useMemo(() => {
    if (activeResourceCount === 0 || totalGeneralExpensesEur === 0) return 0;
    return totalGeneralExpensesEur / activeResourceCount;
  }, [totalGeneralExpensesEur, activeResourceCount]);

  // Total salary cost in EUR (for info display)
  const totalSalaryCostEur = useMemo(() => {
    return resources.reduce((sum, r) => {
      const amt = Number(amounts[r.id] || 0);
      if (amt <= 0) return sum;
      const cur = currencies[r.id] || "EUR";
      const date = new Date(Number(selectedYear), Number(selectedMonth) - 1, 15);
      const eurAmt = cur === "EUR" ? amt : amt * getToEurRate(cur, date);
      return sum + eurAmt;
    }, 0);
  }, [resources, amounts, currencies, selectedYear, selectedMonth, ratesLoaded]);

  // Populate amounts, currencies and overheads when data loads
  useEffect(() => {
    const amtMap: Record<string, string> = {};
    const curMap: Record<string, string> = {};
    const ohMap: Record<string, string> = {};
    resources.forEach((r) => {
      const existing = existingCosts?.find((c) => c.resource_id === r.id);
      amtMap[r.id] = existing ? String(existing.amount) : "";
      curMap[r.id] = existing?.currency || "EUR";
      ohMap[r.id] = existing && Number(existing.overhead) > 0 ? String(existing.overhead) : "";
    });
    setAmounts(amtMap);
    setCurrencies(curMap);
    setOverheads(ohMap);
  }, [existingCosts, resources]);

  // Force-recalculate overhead for ALL resources with amount > 0.
  // Pool-based model: every eligible resource gets exactly pool/N.
  // Any stale value in DB is overwritten on next Save.
  useEffect(() => {
    setOverheads((prev) => {
      const next = { ...prev };
      const ohValue = calculatedOverhead > 0 ? calculatedOverhead.toFixed(2) : "";
      resources.forEach((r) => {
        const amt = Number(amounts[r.id] || 0);
        next[r.id] = amt > 0 ? ohValue : "";
      });
      return next;
    });
  }, [calculatedOverhead, resources, amounts]);

  const handleSave = async () => {
    setSaving(true);
    const year = Number(selectedYear);
    const month = Number(selectedMonth);

    const upserts = resources
      .filter((r) => {
        const amt = amounts[r.id];
        const oh = overheads[r.id];
        return (amt !== "" && !isNaN(Number(amt))) || (oh !== "" && !isNaN(Number(oh)));
      })
      .map((r) => ({
        resource_id: r.id,
        year,
        month,
        amount: Number(amounts[r.id] || 0),
        currency: currencies[r.id] || "EUR",
        overhead: Number(overheads[r.id] || 0),
      }));

    if (upserts.length === 0) {
      toast.info("No amounts to save");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("resource_monthly_costs")
      .upsert(upserts, { onConflict: "resource_id,year,month" });

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success(`Saved costs for ${MONTHS[month - 1]} ${year}`);
      queryClient.invalidateQueries({ queryKey: ["resource-monthly-costs", selectedYear, selectedMonth] });
    }
    setSaving(false);
  };

  const handleAllocate = async () => {
    setAllocating(true);
    setAllocationResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("allocate-monthly-costs", {
        body: { year: Number(selectedYear), month: Number(selectedMonth) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const msg = data?.message || `Allocated ${data?.allocated || 0} entries`;
      setAllocationResult(msg);
      toast.success(msg);
    } catch (err: any) {
      toast.error("Allocation failed: " + (err.message || "Unknown error"));
    }
    setAllocating(false);
  };

  const monthLabel = `${MONTHS[Number(selectedMonth) - 1]} ${selectedYear}`;

  return (
    <div className="page-container">
      <PageHeader title="Salaries & Contractors" description="Monthly cost amounts per resource" />

      <MissingRatesWarning missingCurrencies={missingRates} month={Number(selectedMonth)} year={Number(selectedYear)} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Monthly Costs
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : resources.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No active resources found.</p>
          ) : (
            <>
              {/* Summary info */}
              <div className="flex items-center gap-4 mb-4 p-3 rounded-md bg-muted/50 text-sm flex-wrap">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Info className="h-3.5 w-3.5" />
                        <span>General Expenses: <strong className="text-foreground">€{totalGeneralExpensesEur.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Total general expenses for {monthLabel} converted to EUR
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-muted-foreground">÷</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{activeResourceCount}</strong> active resources
                </span>
                <span className="text-muted-foreground">=</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">€{calculatedOverhead.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> / resource
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground">
                  Total Salary Cost: <strong className="text-foreground">€{totalSalaryCostEur.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                </span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_90px_140px_160px] gap-4 pb-2 border-b">
                  <Label className="text-xs text-muted-foreground font-medium">Resource</Label>
                  <Label className="text-xs text-muted-foreground font-medium">Currency</Label>
                  <Label className="text-xs text-muted-foreground font-medium">Monthly Amount</Label>
                  <Label className="text-xs text-muted-foreground font-medium">Overhead (EUR)</Label>
                </div>
                {resources.map((resource) => {
                  const hasAmount = Number(amounts[resource.id] || 0) > 0;
                  const cur = currencies[resource.id] || "EUR";
                  const sym = CURRENCY_SYMBOLS[cur as Currency] || "€";
                  // Show EUR equivalent if not EUR
                  const amt = Number(amounts[resource.id] || 0);
                  const date = new Date(Number(selectedYear), Number(selectedMonth) - 1, 15);
                  const eurEquiv = cur !== "EUR" && amt > 0
                    ? amt * getToEurRate(cur, date)
                    : null;

                  return (
                    <div key={resource.id} className="grid grid-cols-[1fr_90px_140px_160px] gap-4 items-center">
                      <div>
                        <p className="text-sm font-medium text-foreground">{resource.display_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {resource.employment_type?.replace("_", " ") || "—"}
                        </p>
                      </div>
                      <Select
                        value={cur}
                        onValueChange={(val) =>
                          setCurrencies((prev) => ({ ...prev, [resource.id]: val }))
                        }
                      >
                        <SelectTrigger className="w-[85px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SALARY_CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {CURRENCY_SYMBOLS[c]} {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={amounts[resource.id] ?? ""}
                          onChange={(e) =>
                            setAmounts((prev) => ({ ...prev, [resource.id]: e.target.value }))
                          }
                        />
                        {eurEquiv != null && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            ≈ €{eurEquiv.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={hasAmount ? calculatedOverhead.toFixed(2) : "—"}
                        value={overheads[resource.id] ?? ""}
                        disabled={!hasAmount}
                        className={!hasAmount ? "opacity-50" : ""}
                        onChange={(e) =>
                          setOverheads((prev) => ({ ...prev, [resource.id]: e.target.value }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <Separator className="my-6" />
              {allocationResult && (
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>{allocationResult}</AlertDescription>
                </Alert>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleAllocate} disabled={allocating || saving}>
                  {allocating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Run Allocation for {monthLabel}
                </Button>
                <Button onClick={handleSave} disabled={saving || allocating}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save for {monthLabel}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
