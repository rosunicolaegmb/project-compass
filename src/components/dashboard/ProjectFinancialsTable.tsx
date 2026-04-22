import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toEur, fmtEur } from "@/lib/currency";
import { calculateLaborCostAllocation } from "@/lib/labor-cost-allocation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchAllRows as fetchAllRowsPft } from "@/lib/supabase-pagination";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type View = "yearly" | "monthly";
type SortKey = "name" | "revenue" | "cost" | "profit" | "margin";
type SortDir = "asc" | "desc";

function fmtPct(n: number): string {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export function ProjectFinancialsTable() {
  const now = new Date();
  const [view, setView] = useState<View>("yearly");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based

  // Range
  const { from, to } = useMemo(() => {
    if (view === "yearly") {
      return {
        from: `${year}-01-01`,
        to: `${year}-12-31`,
      };
    }
    const last = new Date(year, month + 1, 0).getDate();
    const mm = String(month + 1).padStart(2, "0");
    return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
  }, [view, year, month]);

  // ── data ──
  const { data: projects = [] } = useQuery({
    queryKey: ["pft-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects")
        .select("id, name, status, project_type, total_budget, planned_budget, currency, start_date, clients(name)")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["pft-time", from, to],
    queryFn: () => fetchAllRowsPft<any>(() =>
      supabase.from("time_entries")
        .select("hours, bill_rate, is_billable, project_id, entry_date, currency")
        .is("deleted_at", null)
        .gte("entry_date", from).lte("entry_date", to)
    ),
  });

  const { data: expenseEntries = [] } = useQuery({
    queryKey: ["pft-expenses", from, to],
    queryFn: () => fetchAllRowsPft<any>(() =>
      supabase.from("expense_entries")
        .select("amount, project_id, expense_date, currency, description")
        .is("deleted_at", null)
        .gte("expense_date", from).lte("expense_date", to)
    ),
  });

  const { data: monthlyCosts = [] } = useQuery({
    queryKey: ["pft-mc", year, view, month],
    queryFn: () => fetchAllRowsPft<any>(() => {
      let q = supabase.from("resource_monthly_costs")
        .select("resource_id, year, month, amount, overhead, currency")
        .eq("year", year);
      if (view === "monthly") q = q.eq("month", month + 1);
      return q;
    }),
  });

  const { data: generalExpenses = [] } = useQuery({
    queryKey: ["pft-ge", year, view, month],
    queryFn: async () => {
      let q = supabase.from("general_expenses")
        .select("amount, currency, year, month")
        .eq("year", year);
      if (view === "monthly") q = q.eq("month", month + 1);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: projectMembers = [] } = useQuery({
    queryKey: ["pft-pm"],
    queryFn: () => fetchAllRowsPft<any>(() =>
      supabase.from("project_members")
        .select("resource_id, project_id, allocation_percentage, is_primary, start_date, end_date")
    ),
  });

  const { data: oneTimeRevenues = [] } = useQuery({
    queryKey: ["pft-otr", from, to],
    queryFn: () => fetchAllRowsPft<any>(() =>
      supabase.from("one_time_revenues")
        .select("project_id, revenue_month, amount, currency")
        .gte("revenue_month", from).lte("revenue_month", to)
    ),
  });
  // ── compute per-project metrics (shared allocation engine) ──
  const rows = useMemo(() => {
    // Pool-based overhead: general_expenses split across resources with salary>0
    const allocation = calculateLaborCostAllocation({
      monthlyCosts: monthlyCosts as any,
      projectMembers: projectMembers as any,
      generalExpenses: generalExpenses as any,
    });
    const laborCostByProject = allocation.laborCostByProject;

    // exclude archived/cancelled
    const visible = projects.filter((p: any) => !["archived", "cancelled"].includes(p.status));

    // OTR per project
    const otrByProject: Record<string, number> = {};
    oneTimeRevenues.forEach((r: any) => {
      otrByProject[r.project_id] = (otrByProject[r.project_id] || 0)
        + toEur(Number(r.amount || 0), r.currency || "EUR", r.revenue_month);
    });

    return visible.map((p: any) => {
      const pTime = timeEntries.filter((t: any) => t.project_id === p.id);
      const pExp = expenseEntries.filter((e: any) =>
        e.project_id === p.id && !(e.description && String(e.description).startsWith("Salary allocation"))
      );
      const labor = laborCostByProject[p.id] || 0;
      const expense = pExp.reduce((s: number, e: any) =>
        s + toEur(Number(e.amount || 0), e.currency || "EUR", e.expense_date), 0);
      const cost = labor + expense;
      const timeRev = pTime.filter((t: any) => t.is_billable)
        .reduce((s: number, t: any) =>
          s + toEur(Number(t.hours || 0) * Number(t.bill_rate || 0), t.currency || "EUR", t.entry_date), 0);
      const revenue = timeRev + (otrByProject[p.id] || 0);
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return {
        id: p.id, name: p.name,
        client: (p.clients as any)?.name || "—",
        revenue, cost, profit, margin,
      };
    });
  }, [projects, timeEntries, expenseEntries, monthlyCosts, projectMembers, oneTimeRevenues, generalExpenses]);

  // ── sorting ──
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  }

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now]);

  // totals
  const totals = useMemo(() => {
    return sorted.reduce((acc, r) => {
      acc.revenue += r.revenue; acc.cost += r.cost; acc.profit += r.profit;
      return acc;
    }, { revenue: 0, cost: 0, profit: 0 });
  }, [sorted]);
  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-semibold">Project Financials</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList className="h-8">
                <TabsTrigger value="yearly" className="text-xs px-3">Yearly</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs px-3">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {view === "monthly" && (
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">
                <Button variant="ghost" size="sm" className="h-7 -ml-3 px-2 text-xs" onClick={() => toggleSort("name")}>
                  Project <SortIcon k="name" />
                </Button>
              </TableHead>
              <TableHead className="text-xs">Client</TableHead>
              <TableHead className="text-xs text-right">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs ml-auto" onClick={() => toggleSort("revenue")}>
                  Projected Revenue <SortIcon k="revenue" />
                </Button>
              </TableHead>
              <TableHead className="text-xs text-right">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs ml-auto" onClick={() => toggleSort("cost")}>
                  Actual Cost <SortIcon k="cost" />
                </Button>
              </TableHead>
              <TableHead className="text-xs text-right">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs ml-auto" onClick={() => toggleSort("profit")}>
                  Gross Profit <SortIcon k="profit" />
                </Button>
              </TableHead>
              <TableHead className="text-xs text-right">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs ml-auto" onClick={() => toggleSort("margin")}>
                  Gross Margin <SortIcon k="margin" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  No projects in this period.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sorted.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.client}</TableCell>
                    <TableCell className="text-right text-sm">{fmtEur(p.revenue)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtEur(p.cost)}</TableCell>
                    <TableCell className={cn("text-right text-sm font-medium", p.profit < 0 ? "text-destructive" : "text-success")}>
                      {fmtEur(p.profit)}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm font-medium",
                      p.margin < 10 ? "text-destructive" : p.margin < 20 ? "text-warning" : "text-success")}>
                      {fmtPct(p.margin)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell className="text-sm">Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-sm">{fmtEur(totals.revenue)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtEur(totals.cost)}</TableCell>
                  <TableCell className={cn("text-right text-sm", totals.profit < 0 ? "text-destructive" : "text-success")}>
                    {fmtEur(totals.profit)}
                  </TableCell>
                  <TableCell className={cn("text-right text-sm",
                    totalMargin < 10 ? "text-destructive" : totalMargin < 20 ? "text-warning" : "text-success")}>
                    {fmtPct(totalMargin)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
