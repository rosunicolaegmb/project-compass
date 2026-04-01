import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Users, BarChart3, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtPct(n: number): string { return `${n.toFixed(1)}%`; }

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
  borderRadius: 8, color: "hsl(var(--foreground))",
};

const CHART_COLORS = [
  "hsl(187, 72%, 40%)", "hsl(262, 60%, 55%)", "hsl(160, 60%, 40%)",
  "hsl(38, 92%, 50%)", "hsl(340, 65%, 50%)", "hsl(210, 70%, 50%)",
  "hsl(30, 80%, 50%)", "hsl(280, 50%, 60%)",
];

export default function Reports() {
  // --- Filters ---
  const [filterClient, setFilterClient] = useState("all");
  const [filterPM, setFilterPM] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // --- Data queries ---
  const { data: projects = [] } = useQuery({
    queryKey: ["rpt-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects")
        .select("*, clients(name), resources!projects_pm_resource_id_fkey(display_name)")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["rpt-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").is("deleted_at", null).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["rpt-resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("id, display_name, department, delivery_role_id, delivery_roles(name)").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["rpt-time"],
    queryFn: async () => {
      const { data, error } = await supabase.from("time_entries")
        .select("hours, cost_rate, bill_rate, is_billable, project_id, resource_id, phase_id, entry_date, approval_status")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["rpt-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_entries")
        .select("amount, project_id, phase_id, expense_date, resource_id")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["rpt-phases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_phases")
        .select("id, name, project_id, budget_hours, budget_amount")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: monthlyForecasts = [] } = useQuery({
    queryKey: ["rpt-monthly-forecasts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_forecasts")
        .select("project_id, forecast_labor_cost, forecast_labor_revenue, forecast_expenses, scenario_type")
        .eq("scenario_type", "expected");
      if (error) throw error;
      return data;
    },
  });

  const pmResources = useMemo(() => {
    const pmIds = new Set(projects.map((p: any) => p.pm_resource_id).filter(Boolean));
    return resources.filter((r: any) => pmIds.has(r.id));
  }, [projects, resources]);

  // --- Filter projects ---
  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      if (filterClient !== "all" && p.client_id !== filterClient) return false;
      if (filterPM !== "all" && p.pm_resource_id !== filterPM) return false;
      if (filterType !== "all" && p.project_type !== filterType) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    });
  }, [projects, filterClient, filterPM, filterType, filterStatus]);

  const projectIds = useMemo(() => new Set(filteredProjects.map((p: any) => p.id)), [filteredProjects]);

  // Filter time/expense entries by project + date range
  const filteredTime = useMemo(() => {
    return timeEntries.filter((t: any) => {
      if (!projectIds.has(t.project_id)) return false;
      if (filterDateFrom && t.entry_date < filterDateFrom) return false;
      if (filterDateTo && t.entry_date > filterDateTo) return false;
      return true;
    });
  }, [timeEntries, projectIds, filterDateFrom, filterDateTo]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e: any) => {
      if (!projectIds.has(e.project_id)) return false;
      if (filterDateFrom && e.expense_date < filterDateFrom) return false;
      if (filterDateTo && e.expense_date > filterDateTo) return false;
      return true;
    });
  }, [expenses, projectIds, filterDateFrom, filterDateTo]);

  // ===== REPORT DATA =====

  // 1. Budget vs Actual by Project
  const budgetVsActualProject = useMemo(() => {
    return filteredProjects.map((p: any) => {
      const pTime = filteredTime.filter((t: any) => t.project_id === p.id);
      const pExp = filteredExpenses.filter((e: any) => e.project_id === p.id);
      const actualCost = pTime.reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.cost_rate || 0), 0) + pExp.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const actualRevenue = pTime.filter((t: any) => t.is_billable).reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.bill_rate || 0), 0);
      const budget = Number(p.planned_budget || p.total_budget || 0);
      const variance = budget - actualCost;
      return { name: p.name, budget, actualCost, actualRevenue, variance, type: p.project_type };
    }).sort((a, b) => a.variance - b.variance);
  }, [filteredProjects, filteredTime, filteredExpenses]);

  // 2. Budget vs Actual by Phase
  const budgetVsActualPhase = useMemo(() => {
    const projectPhases = phases.filter((ph: any) => projectIds.has(ph.project_id));
    return projectPhases.map((ph: any) => {
      const proj = filteredProjects.find((p: any) => p.id === ph.project_id);
      const pTime = filteredTime.filter((t: any) => t.phase_id === ph.id);
      const pExp = filteredExpenses.filter((e: any) => e.phase_id === ph.id);
      const actualCost = pTime.reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.cost_rate || 0), 0) + pExp.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const budget = Number(ph.budget_amount || 0);
      return { phase: ph.name, project: proj?.name || "—", budget, actualCost, variance: budget - actualCost };
    });
  }, [phases, filteredProjects, filteredTime, filteredExpenses, projectIds]);

  // 3/4/5. Monthly trends
  const monthlyTrends = useMemo(() => {
    const months: Record<string, { cost: number; revenue: number }> = {};
    filteredTime.forEach((t: any) => {
      const m = t.entry_date?.substring(0, 7);
      if (!m) return;
      if (!months[m]) months[m] = { cost: 0, revenue: 0 };
      months[m].cost += Number(t.hours || 0) * Number(t.cost_rate || 0);
      if (t.is_billable) months[m].revenue += Number(t.hours || 0) * Number(t.bill_rate || 0);
    });
    filteredExpenses.forEach((e: any) => {
      const m = e.expense_date?.substring(0, 7);
      if (!m) return;
      if (!months[m]) months[m] = { cost: 0, revenue: 0 };
      months[m].cost += Number(e.amount || 0);
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({ month, ...d, margin: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0 }));
  }, [filteredTime, filteredExpenses]);

  // 6. Projects over budget
  const overBudget = useMemo(() => budgetVsActualProject.filter((p) => p.variance < 0), [budgetVsActualProject]);

  // 7. Projects with missing timesheets (projects with 0 time entries in the filter window)
  const missingTimesheets = useMemo(() => {
    return filteredProjects.filter((p: any) => {
      if (p.status === "draft" || p.status === "archived" || p.status === "cancelled") return false;
      return !filteredTime.some((t: any) => t.project_id === p.id);
    });
  }, [filteredProjects, filteredTime]);

  // 8. Projects with negative forecast margin
  const negForecastMargin = useMemo(() => {
    return filteredProjects.map((p: any) => {
      const fcs = monthlyForecasts.filter((f: any) => f.project_id === p.id);
      const fRev = fcs.reduce((s: number, f: any) => s + Number(f.forecast_labor_revenue || 0), 0);
      const fCost = fcs.reduce((s: number, f: any) => s + Number(f.forecast_labor_cost || 0) + Number(f.forecast_expenses || 0), 0);
      const margin = fRev > 0 ? ((fRev - fCost) / fRev) * 100 : fCost > 0 ? -100 : 0;
      return { name: p.name, forecastRevenue: fRev, forecastCost: fCost, margin };
    }).filter((p) => p.margin < 0);
  }, [filteredProjects, monthlyForecasts]);

  // 9. Utilization by role
  const utilizationByRole = useMemo(() => {
    const roleHours: Record<string, { total: number; billable: number; name: string }> = {};
    filteredTime.forEach((t: any) => {
      const res = resources.find((r: any) => r.id === t.resource_id);
      const roleName = (res?.delivery_roles as any)?.name || "Unassigned";
      if (!roleHours[roleName]) roleHours[roleName] = { total: 0, billable: 0, name: roleName };
      roleHours[roleName].total += Number(t.hours || 0);
      if (t.is_billable) roleHours[roleName].billable += Number(t.hours || 0);
    });
    return Object.values(roleHours).map((r) => ({ ...r, utilization: r.total > 0 ? (r.billable / r.total) * 100 : 0 }));
  }, [filteredTime, resources]);

  // 10. Revenue by client
  const revenueByClient = useMemo(() => {
    const clientRev: Record<string, { name: string; revenue: number; cost: number }> = {};
    filteredProjects.forEach((p: any) => {
      const cName = (p.clients as any)?.name || "Unknown";
      if (!clientRev[cName]) clientRev[cName] = { name: cName, revenue: 0, cost: 0 };
      const pTime = filteredTime.filter((t: any) => t.project_id === p.id);
      const pExp = filteredExpenses.filter((e: any) => e.project_id === p.id);
      clientRev[cName].revenue += pTime.filter((t: any) => t.is_billable).reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.bill_rate || 0), 0);
      clientRev[cName].cost += pTime.reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.cost_rate || 0), 0) + pExp.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    });
    return Object.values(clientRev).sort((a, b) => b.revenue - a.revenue);
  }, [filteredProjects, filteredTime, filteredExpenses]);

  // 11. Cost by department
  const costByDept = useMemo(() => {
    const depts: Record<string, number> = {};
    filteredTime.forEach((t: any) => {
      const res = resources.find((r: any) => r.id === t.resource_id);
      const dept = res?.department || "Unassigned";
      depts[dept] = (depts[dept] || 0) + Number(t.hours || 0) * Number(t.cost_rate || 0);
    });
    return Object.entries(depts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTime, resources]);

  // 12. FP vs T&M split
  const portfolioSplit = useMemo(() => {
    const fp = filteredProjects.filter((p: any) => p.project_type === "fixed_price");
    const tm = filteredProjects.filter((p: any) => p.project_type === "time_and_materials");
    return [
      { name: "Fixed Price", value: fp.length, budget: fp.reduce((s: number, p: any) => s + Number(p.total_budget || 0), 0) },
      { name: "T&M", value: tm.length, budget: tm.reduce((s: number, p: any) => s + Number(p.total_budget || 0), 0) },
    ];
  }, [filteredProjects]);

  // --- Summary stats ---
  const totalRevenue = budgetVsActualProject.reduce((s, p) => s + p.actualRevenue, 0);
  const totalCost = budgetVsActualProject.reduce((s, p) => s + p.actualCost, 0);
  const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
  const avgUtil = utilizationByRole.length > 0
    ? utilizationByRole.reduce((s, r) => s + r.utilization, 0) / utilizationByRole.length : 0;

  return (
    <div className="page-container">
      <PageHeader title="Reports" description="Financial summaries and operational insights" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-2">
        <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[150px]" placeholder="From" />
        <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[150px]" placeholder="To" />
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPM} onValueChange={setFilterPM}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="PM" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All PMs</SelectItem>
            {pmResources.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="time_and_materials">T&M</SelectItem>
            <SelectItem value="fixed_price">Fixed Price</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Total Revenue" value={fmt(totalRevenue)} />
        <StatCard icon={TrendingUp} title="Avg Margin" value={fmtPct(avgMargin)} changeType={avgMargin > 20 ? "positive" : "negative"} />
        <StatCard icon={Users} title="Avg Utilization" value={fmtPct(avgUtil)} changeType={avgUtil > 75 ? "positive" : "negative"} />
        <StatCard icon={AlertTriangle} title="Over Budget" value={String(overBudget.length)} changeType={overBudget.length > 0 ? "negative" : "positive"}
          change={overBudget.length > 0 ? `${overBudget.length} project(s)` : "All on track"} />
      </div>

      <Tabs defaultValue="budget-project" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="budget-project">Budget vs Actual</TabsTrigger>
          <TabsTrigger value="budget-phase">By Phase</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
          <TabsTrigger value="revenue-client">By Client</TabsTrigger>
          <TabsTrigger value="cost-dept">By Dept</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
        </TabsList>

        {/* BUDGET VS ACTUAL BY PROJECT */}
        <TabsContent value="budget-project" className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Budget vs Actual by Project</CardTitle></CardHeader>
            <CardContent>
              {budgetVsActualProject.length > 0 && (
                <ResponsiveContainer width="100%" height={Math.max(250, budgetVsActualProject.length * 40)}>
                  <BarChart data={budgetVsActualProject} layout="vertical" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v / 1000}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={120} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v)]} />
                    <Legend />
                    <Bar dataKey="budget" fill="hsl(var(--muted-foreground))" name="Budget" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="actualCost" fill="hsl(187, 72%, 40%)" name="Actual Cost" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <Table className="mt-4">
                <TableHeader>
                  <TableRow><TableHead>Project</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Actual Cost</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Variance</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {budgetVsActualProject.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{p.type === "fixed_price" ? "FP" : "T&M"}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(p.budget)}</TableCell>
                      <TableCell className="text-right">{fmt(p.actualCost)}</TableCell>
                      <TableCell className="text-right">{fmt(p.actualRevenue)}</TableCell>
                      <TableCell className={`text-right font-medium ${p.variance < 0 ? "text-destructive" : "text-success"}`}>{fmt(p.variance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BUDGET VS ACTUAL BY PHASE */}
        <TabsContent value="budget-phase">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Budget vs Actual by Phase</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Phase</TableHead><TableHead>Project</TableHead><TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Actual Cost</TableHead><TableHead className="text-right">Variance</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {budgetVsActualPhase.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No phase data</TableCell></TableRow>
                  ) : budgetVsActualPhase.map((ph, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{ph.phase}</TableCell>
                      <TableCell className="text-muted-foreground">{ph.project}</TableCell>
                      <TableCell className="text-right">{fmt(ph.budget)}</TableCell>
                      <TableCell className="text-right">{fmt(ph.actualCost)}</TableCell>
                      <TableCell className={`text-right font-medium ${ph.variance < 0 ? "text-destructive" : "text-success"}`}>{fmt(ph.variance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MONTHLY TRENDS */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Monthly Cost & Revenue</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v)]} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(160, 60%, 40%)" strokeWidth={2} name="Revenue" />
                    <Line type="monotone" dataKey="cost" stroke="hsl(38, 92%, 50%)" strokeWidth={2} name="Cost" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Margin Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${Number(v).toFixed(1)}%`]} />
                    <Line type="monotone" dataKey="margin" stroke="hsl(187, 72%, 40%)" strokeWidth={2} name="Margin %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ALERTS */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Projects Over Budget ({overBudget.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Project</TableHead><TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Actual Cost</TableHead><TableHead className="text-right">Overrun</TableHead></TableRow></TableHeader>
                <TableBody>
                  {overBudget.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No projects over budget</TableCell></TableRow>
                  ) : overBudget.map((p) => (
                    <TableRow key={p.name}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="text-right">{fmt(p.budget)}</TableCell><TableCell className="text-right">{fmt(p.actualCost)}</TableCell><TableCell className="text-right text-destructive font-medium">{fmt(Math.abs(p.variance))}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Missing Timesheets ({missingTimesheets.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Status</TableHead><TableHead>PM</TableHead></TableRow></TableHeader>
                <TableBody>
                  {missingTimesheets.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">All projects have timesheet entries</TableCell></TableRow>
                  ) : missingTimesheets.map((p: any) => (
                    <TableRow key={p.id}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="capitalize">{p.status}</TableCell><TableCell>{(p.resources as any)?.display_name || "—"}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Negative Forecast Margin ({negForecastMargin.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Project</TableHead><TableHead className="text-right">Forecast Revenue</TableHead><TableHead className="text-right">Forecast Cost</TableHead><TableHead className="text-right">Margin</TableHead></TableRow></TableHeader>
                <TableBody>
                  {negForecastMargin.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No projects with negative forecast margin</TableCell></TableRow>
                  ) : negForecastMargin.map((p) => (
                    <TableRow key={p.name}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="text-right">{fmt(p.forecastRevenue)}</TableCell><TableCell className="text-right">{fmt(p.forecastCost)}</TableCell><TableCell className="text-right text-destructive font-medium">{fmtPct(p.margin)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* UTILIZATION BY ROLE */}
        <TabsContent value="utilization">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Utilization by Delivery Role</CardTitle></CardHeader>
            <CardContent>
              {utilizationByRole.length > 0 && (
                <ResponsiveContainer width="100%" height={Math.max(200, utilizationByRole.length * 45)}>
                  <BarChart data={utilizationByRole} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${Number(v).toFixed(1)}%`]} />
                    <Bar dataKey="utilization" fill="hsl(187, 72%, 40%)" name="Billable %" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <Table className="mt-4">
                <TableHeader><TableRow><TableHead>Role</TableHead><TableHead className="text-right">Total Hrs</TableHead><TableHead className="text-right">Billable Hrs</TableHead><TableHead className="text-right">Utilization</TableHead></TableRow></TableHeader>
                <TableBody>
                  {utilizationByRole.map((r) => (
                    <TableRow key={r.name}><TableCell className="font-medium">{r.name}</TableCell><TableCell className="text-right">{r.total.toLocaleString()}</TableCell><TableCell className="text-right">{r.billable.toLocaleString()}</TableCell><TableCell className="text-right">{fmtPct(r.utilization)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REVENUE BY CLIENT */}
        <TabsContent value="revenue-client">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Revenue by Client</CardTitle></CardHeader>
            <CardContent>
              {revenueByClient.length > 0 && (
                <ResponsiveContainer width="100%" height={Math.max(200, revenueByClient.length * 45)}>
                  <BarChart data={revenueByClient} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v / 1000}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={120} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v)]} />
                    <Legend />
                    <Bar dataKey="revenue" fill="hsl(160, 60%, 40%)" name="Revenue" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="cost" fill="hsl(38, 92%, 50%)" name="Cost" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* COST BY DEPARTMENT */}
        <TabsContent value="cost-dept">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Cost by Department</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {costByDept.length > 0 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={costByDept} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {costByDept.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v)]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <Table>
                  <TableHeader><TableRow><TableHead>Department</TableHead><TableHead className="text-right">Labor Cost</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {costByDept.map((d) => (
                      <TableRow key={d.name}><TableCell className="font-medium">{d.name}</TableCell><TableCell className="text-right">{fmt(d.value)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PORTFOLIO SPLIT */}
        <TabsContent value="portfolio">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Fixed Price vs T&M Portfolio</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={portfolioSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                      label={({ name, value }) => `${name}: ${value}`}>
                      <Cell fill="hsl(187, 72%, 40%)" />
                      <Cell fill="hsl(262, 60%, 55%)" />
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-4">
                  {portfolioSplit.map((s, i) => (
                    <div key={s.name} className="p-4 rounded-lg border bg-muted/30">
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-2xl font-semibold">{s.value} projects</p>
                      <p className="text-sm text-muted-foreground">Total budget: {fmt(s.budget)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
