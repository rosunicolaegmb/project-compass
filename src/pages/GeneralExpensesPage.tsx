import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { MissingRatesWarning } from "@/components/MissingRatesWarning";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { ArrowLeft, Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function GeneralExpensesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState("EUR");
  const [deleting, setDeleting] = useState<any>(null);
  const CURRENCIES = ["EUR", "RON", "GBP"] as const;
  const CURRENCY_SYMS: Record<string, string> = { EUR: "€", RON: "lei", GBP: "£" };
  const [copyConfirm, setCopyConfirm] = useState(false);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["general-expenses", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_expenses")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Fetch conversion rates for this month to convert totals to EUR
  const { data: conversionRates = [] } = useQuery({
    queryKey: ["conversion-rates", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currency_conversion_rates")
        .select("from_currency, to_currency, rate")
        .eq("year", year)
        .eq("month", month);
      if (error) throw error;
      return data;
    },
  });
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("general_expenses").insert({
        description: newDesc.trim(),
        amount: parseFloat(newAmount) || 0,
        currency: newCurrency,
        year,
        month,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-expenses", year, month] });
      setNewDesc("");
      setNewAmount("");
      toast.success("Expense added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from("general_expenses").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-expenses", year, month] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("general_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-expenses", year, month] });
      toast.success("Expense deleted");
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const copyMutation = useMutation({
    mutationFn: async () => {
      // Calculate previous month
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth < 1) { prevMonth = 12; prevYear -= 1; }

      const { data: prevExpenses, error: fetchErr } = await supabase
        .from("general_expenses")
        .select("description, amount, currency")
        .eq("year", prevYear)
        .eq("month", prevMonth);
      if (fetchErr) throw fetchErr;

      if (!prevExpenses || prevExpenses.length === 0) {
        throw new Error(`No expenses found for ${MONTHS[prevMonth - 1]} ${prevYear}`);
      }

      const { error } = await supabase.from("general_expenses").insert(
        prevExpenses.map((e: any) => ({
          description: e.description,
          amount: e.amount,
          currency: e.currency,
          year,
          month,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-expenses", year, month] });
      toast.success("Copied expenses from previous month");
      setCopyConfirm(false);
    },
    onError: (err: Error) => { toast.error(err.message); setCopyConfirm(false); },
  });

  const getEurRate = (currency: string): number => {
    if (currency === "EUR") return 1;
    const rate = conversionRates.find(
      (r: any) => r.from_currency === currency && r.to_currency === "EUR"
    );
    return rate ? Number(rate.rate) : 1;
  };

  const totalEur = expenses.reduce((s: number, e: any) => {
    return s + Number(e.amount) * getEurRate(e.currency);
  }, 0);

  // Detect missing conversion rates
  const usedCurrencies = [...new Set(expenses.map((e: any) => e.currency))].filter((c: string) => c !== "EUR");
  const missingCurrencies = usedCurrencies.filter((c: string) => {
    return !conversionRates.some((r: any) => r.from_currency === c && r.to_currency === "EUR");
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const prevMonthLabel = (() => {
    let pm = month - 1, py = year;
    if (pm < 1) { pm = 12; py -= 1; }
    return `${MONTHS[pm - 1]} ${py}`;
  })();

  return (
    <div className="page-container">
      <PageHeader
        title="General Expenses"
        description="Manually track monthly overhead and general expenses"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/configure")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        }
      />

      <MissingRatesWarning missingCurrencies={missingCurrencies} month={month} year={year} />

      {/* Month/Year selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setCopyConfirm(true)}>
          <Copy className="h-4 w-4 mr-1" /> Copy from {prevMonthLabel}
        </Button>
      </div>

      {/* Add new expense */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Description</label>
          <Input
            placeholder="e.g. Office rent, Utilities..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="w-36">
          <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            className="h-9 text-right"
          />
        </div>
        <div className="w-28">
          <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
          <Select value={newCurrency} onValueChange={setNewCurrency}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          disabled={!newDesc.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {/* Expenses table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-40">Amount</TableHead>
              <TableHead className="w-20">Currency</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={4} rows={4} />
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState
                    title="No expenses for this month"
                    description="Add expenses above or copy from the previous month."
                  />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {expenses.map((exp: any) => (
                  <TableRow key={exp.id} className="border-border">
                    <TableCell>
                      <Input
                        defaultValue={exp.description}
                        className="h-8 text-sm border-transparent hover:border-border focus:border-border bg-transparent"
                        onBlur={(e) => {
                          if (e.target.value !== exp.description) {
                            updateMutation.mutate({ id: exp.id, field: "description", value: e.target.value });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={exp.amount}
                        className="h-8 text-sm text-right border-transparent hover:border-border focus:border-border bg-transparent tabular-nums w-32 ml-auto"
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          if (val !== Number(exp.amount)) {
                            updateMutation.mutate({ id: exp.id, field: "amount", value: val });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={exp.currency}
                        onValueChange={(v) => updateMutation.mutate({ id: exp.id, field: "currency", value: v })}
                      >
                        <SelectTrigger className="h-8 w-20 text-sm border-transparent hover:border-border bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleting(exp)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-border bg-muted/30 font-medium">
                  <TableCell>Total (EUR)</TableCell>
                  <TableCell className="text-right tabular-nums">
                    €{totalEur.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">EUR</TableCell>
                  <TableCell />
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Delete Expense"
        description={`Delete "${deleting?.description}" (€${Number(deleting?.amount || 0).toLocaleString()})? This action cannot be undone.`}
        loading={deleteMutation.isPending}
      />

      {/* Copy confirmation */}
      <AlertDialog open={copyConfirm} onOpenChange={setCopyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copy from Previous Month</AlertDialogTitle>
            <AlertDialogDescription>
              This will copy all expenses from {prevMonthLabel} into {MONTHS[month - 1]} {year}. Existing entries will not be removed. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={copyMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending}>
              {copyMutation.isPending ? "Copying..." : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
