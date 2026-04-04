import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
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

  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
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
          <label className="text-xs text-muted-foreground mb-1 block">Amount (€)</label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            className="h-9 text-right"
          />
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
              <TableHead className="text-right w-40">Amount (€)</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={3} rows={4} />
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
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
                    <TableCell>{exp.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      €{Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    €{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
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
      <DeleteConfirmDialog
        open={copyConfirm}
        onOpenChange={setCopyConfirm}
        onConfirm={() => copyMutation.mutate()}
        title="Copy from Previous Month"
        description={`This will copy all expenses from ${prevMonthLabel} into ${MONTHS[month - 1]} ${year}. Existing entries will not be removed. Continue?`}
        loading={copyMutation.isPending}
      />
    </div>
  );
}
