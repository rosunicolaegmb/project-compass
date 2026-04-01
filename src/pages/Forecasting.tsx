import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { ForecastFormDialog } from "@/components/forecasting/ForecastFormDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, DollarSign, TrendingUp, BarChart3, Target } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

const SCENARIO_LABELS: Record<string, string> = {
  best_case: "Best Case", expected: "Expected", worst_case: "Worst Case",
};
const SCENARIO_COLORS: Record<string, string> = {
  best_case: "hsl(160, 60%, 40%)", expected: "hsl(187, 72%, 40%)", worst_case: "hsl(38, 92%, 50%)",
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Forecasting() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("pm");
  const queryClient = useQueryClient();

  const [filterProject, setFilterProject] = useState("all");
  const [filterScenario, setFilterScenario] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; table: string } | null>(null);

  // --- Queries ---
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, total_budget, planned_budget, revised_budget, project_type, start_date, end_date").eq("is_active", true).is("deleted_at", null).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["phases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_phases").select("id, name, project_id, budget_hours, budget_amount").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: monthlyForecasts = [] } = useQuery({
    queryKey: ["monthly_forecasts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_forecasts").select("*, projects(name)").order("forecast_month");
      if (error) throw error;
      return data;
    },
  });

  const { data: quarterlyForecasts = [] } = useQuery({
    queryKey: ["quarterly_forecasts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quarterly_forecasts").select("*, projects(name)").order("fiscal_year").order("fiscal_quarter");
      if (error) throw error;
      return data;
    },
  });

  const { data: yearlyForecasts = [] } = useQuery({
    queryKey: ["yearly_forecasts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("yearly_forecasts").select("*, projects(name)").order("fiscal_year");
      if (error) throw error;
      return data;
    },
  });

  // Actuals for comparison
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["all-time-entries-forecast"],
    queryFn: async () => {
      const { data, error } = await supabase.from("time_entries").select("hours, cost_rate, bill_rate, is_billable, project_id, entry_date").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: expenseEntries = [] } = useQuery({
    queryKey: ["all-expenses-forecast"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_entries").select("amount, project_id, expense_date").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  // --- Filters ---
  const filterFn = (item: any) => {
    const matchProject = filterProject === "all" || item.project_id === filterProject;
    const matchScenario = filterScenario === "all" || item.scenario_type === filterScenario;
    return matchProject && matchScenario;
  };

  const filteredMonthly = useMemo(() => monthlyForecasts.filter(filterFn), [monthlyForecasts, filterProject, filterScenario]);
  const filteredQuarterly = useMemo(() => quarterlyForecasts.filter(filterFn), [quarterlyForecasts, filterProject, filterScenario]);
  const filteredYearly = useMemo(() => yearlyForecasts.filter(filterFn), [yearlyForecasts, filterProject, filterScenario]);

  // --- Auto-populate suggestion for a new forecast ---
  const getSuggestions = (projectId: string) => {
    if (!projectId || projectId === "all") return {};
    const project = projects.find((p: any) => p.id === projectId);
    if (!project) return {};

    const projectPhases = phases.filter((p: any) => p.project_id === projectId);
    const totalPlannedHours = projectPhases.reduce((s: number, p: any) => s + Number(p.budget_hours || 0), 0);
    const totalPlannedCost = projectPhases.reduce((s: number, p: any) => s + Number(p.budget_amount || 0), 0);

    const projectTime = timeEntries.filter((t: any) => t.project_id === projectId);
    const actualHours = projectTime.reduce((s: number, t: any) => s + Number(t.hours || 0), 0);
    const actualCost = projectTime.reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.cost_rate || 0), 0);
    const actualRevenue = projectTime.filter((t: any) => t.is_billable).reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.bill_rate || 0), 0);
    const actualExpenses = expenseEntries.filter((e: any) => e.project_id === projectId).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    const remainingHours = Math.max(0, totalPlannedHours - actualHours);
    const remainingCost = Math.max(0, totalPlannedCost - actualCost);

    // Estimate months remaining
    const endDate = project.end_date ? new Date(project.end_date) : null;
    const now = new Date();
    const monthsRemaining = endDate ? Math.max(1, (endDate.getFullYear() - now.getFullYear()) * 12 + endDate.getMonth() - now.getMonth()) : 3;

    const monthlyHours = Math.round(remainingHours / monthsRemaining * 10) / 10;
    const monthlyCost = Math.round(remainingCost / monthsRemaining);
    const avgBillRate = actualHours > 0 ? actualRevenue / actualHours : 0;
    const monthlyRevenue = Math.round(monthlyHours * avgBillRate);
    const monthlyExpenses = Math.round((actualExpenses / Math.max(1, actualHours)) * monthlyHours);

    return {
      forecast_hours: monthlyHours,
      forecast_labor_cost: monthlyCost,
      forecast_labor_revenue: monthlyRevenue,
      forecast_expenses: monthlyExpenses,
      forecast_revenue: monthlyRevenue,
      forecast_cost: monthlyCost + monthlyExpenses,
    };
  };

  // --- Delete ---
  const deleteMutation = useMutation({
    mutationFn: async ({ id, table }: { id: string; table: string }) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { table }) => {
      queryClient.invalidateQueries({ queryKey: [table] });
      toast.success("Forecast deleted");
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // --- Chart data ---
  const monthlyChartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    filteredMonthly.forEach((f: any) => {
      const month = f.forecast_month?.substring(0, 7) || "Unknown";
      if (!grouped[month]) grouped[month] = { month };
      const scenario = f.scenario_type || "expected";
      const totalCost = Number(f.forecast_labor_cost || 0) + Number(f.forecast_expenses || 0);
      const revenue = Number(f.forecast_labor_revenue || 0);
      grouped[month][`cost_${scenario}`] = (grouped[month][`cost_${scenario}`] || 0) + totalCost;
      grouped[month][`revenue_${scenario}`] = (grouped[month][`revenue_${scenario}`] || 0) + revenue;
    });
    return Object.values(grouped).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [filteredMonthly]);

  const quarterlyChartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    filteredQuarterly.forEach((f: any) => {
      const key = `${f.fiscal_year} Q${f.fiscal_quarter}`;
      if (!grouped[key]) grouped[key] = { quarter: key };
      const scenario = f.scenario_type || "expected";
      grouped[key][`revenue_${scenario}`] = (grouped[key][`revenue_${scenario}`] || 0) + Number(f.forecast_revenue || 0);
      grouped[key][`cost_${scenario}`] = (grouped[key][`cost_${scenario}`] || 0) + Number(f.forecast_cost || 0);
    });
    return Object.values(grouped).sort((a: any, b: any) => a.quarter.localeCompare(b.quarter));
  }, [filteredQuarterly]);

  // --- Stats ---
  const monthlyStats = useMemo(() => {
    const expected = filteredMonthly.filter((f: any) => f.scenario_type === "expected");
    return {
      totalRevenue: expected.reduce((s: number, f: any) => s + Number(f.forecast_labor_revenue || 0), 0),
      totalCost: expected.reduce((s: number, f: any) => s + Number(f.forecast_labor_cost || 0) + Number(f.forecast_expenses || 0), 0),
      totalHours: expected.reduce((s: number, f: any) => s + Number(f.forecast_hours || 0), 0),
      count: expected.length,
    };
  }, [filteredMonthly]);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
    borderRadius: 8, color: "hsl(var(--foreground))",
  };

  const openForm = (type: "monthly" | "quarterly" | "yearly", entry?: any) => {
    setFormType(type);
    setEditing(entry || null);
    setFormOpen(true);
  };

  return (
    <div className="page-container">
      <PageHeader title="Forecasting" description="Revenue projections and scenario planning" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-2">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterScenario} onValueChange={setFilterScenario}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Scenario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scenarios</SelectItem>
            {Object.entries(SCENARIO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Forecast Revenue" value={fmt(monthlyStats.totalRevenue)} icon={TrendingUp} />
        <StatCard title="Forecast Cost" value={fmt(monthlyStats.totalCost)} icon={DollarSign} />
        <StatCard title="Forecast Margin" value={monthlyStats.totalRevenue > 0 ? `${(((monthlyStats.totalRevenue - monthlyStats.totalCost) / monthlyStats.totalRevenue) * 100).toFixed(1)}%` : "—"} icon={BarChart3}
          changeType={monthlyStats.totalRevenue - monthlyStats.totalCost > 0 ? "positive" : "negative"} />
        <StatCard title="Forecast Entries" value={`${filteredMonthly.length + filteredQuarterly.length + filteredYearly.length}`} icon={Target} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly">Monthly ({filteredMonthly.length})</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly ({filteredQuarterly.length})</TabsTrigger>
          <TabsTrigger value="yearly">Yearly ({filteredYearly.length})</TabsTrigger>
        </TabsList>

        {/* MONTHLY */}
        <TabsContent value="monthly" className="space-y-4">
          {/* Chart */}
          {monthlyChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Monthly Revenue Forecast by Scenario</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [fmt(value)]} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue_best_case" stroke={SCENARIO_COLORS.best_case} strokeWidth={2} dot={false} strokeDasharray="5 5" name="Best Case" />
                    <Line type="monotone" dataKey="revenue_expected" stroke={SCENARIO_COLORS.expected} strokeWidth={2} dot={{ r: 3 }} name="Expected" />
                    <Line type="monotone" dataKey="revenue_worst_case" stroke={SCENARIO_COLORS.worst_case} strokeWidth={2} dot={false} strokeDasharray="5 5" name="Worst Case" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Monthly Forecasts</CardTitle>
              {canEdit && <Button size="sm" onClick={() => openForm("monthly")}><Plus className="h-4 w-4 mr-1" />Add Monthly</Button>}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Scenario</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Labor Cost</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    {canEdit && <TableHead className="w-[80px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMonthly.length === 0 ? (
                    <TableRow><TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8 text-muted-foreground">No monthly forecasts</TableCell></TableRow>
                  ) : filteredMonthly.map((f: any) => (
                    <TableRow key={f.id}>
                      <TableCell className="whitespace-nowrap">{f.forecast_month?.substring(0, 7)}</TableCell>
                      <TableCell>{(f.projects as any)?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{SCENARIO_LABELS[f.scenario_type] || f.scenario_type}</Badge></TableCell>
                      <TableCell className="text-right">{Number(f.forecast_hours || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{fmt(f.forecast_labor_revenue)}</TableCell>
                      <TableCell className="text-right">{fmt(f.forecast_labor_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(f.forecast_expenses)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(f.forecast_labor_cost || 0) + Number(f.forecast_expenses || 0))}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openForm("monthly", f)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget({ id: f.id, table: "monthly_forecasts" })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QUARTERLY */}
        <TabsContent value="quarterly" className="space-y-4">
          {quarterlyChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Quarterly Revenue vs Cost</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={quarterlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="quarter" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [fmt(value)]} />
                    <Legend />
                    <Bar dataKey="revenue_expected" fill={SCENARIO_COLORS.expected} name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cost_expected" fill="hsl(var(--muted-foreground))" name="Cost" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Quarterly Forecasts</CardTitle>
              {canEdit && <Button size="sm" onClick={() => openForm("quarterly")}><Plus className="h-4 w-4 mr-1" />Add Quarterly</Button>}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Scenario</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    {canEdit && <TableHead className="w-[80px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuarterly.length === 0 ? (
                    <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center py-8 text-muted-foreground">No quarterly forecasts</TableCell></TableRow>
                  ) : filteredQuarterly.map((f: any) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.fiscal_year} Q{f.fiscal_quarter}</TableCell>
                      <TableCell>{(f.projects as any)?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{SCENARIO_LABELS[f.scenario_type] || f.scenario_type}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(f.forecast_revenue)}</TableCell>
                      <TableCell className="text-right">{fmt(f.forecast_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(f.forecast_margin)}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openForm("quarterly", f)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget({ id: f.id, table: "quarterly_forecasts" })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* YEARLY */}
        <TabsContent value="yearly" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Yearly Forecasts</CardTitle>
              {canEdit && <Button size="sm" onClick={() => openForm("yearly")}><Plus className="h-4 w-4 mr-1" />Add Yearly</Button>}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Scenario</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Notes</TableHead>
                    {canEdit && <TableHead className="w-[80px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredYearly.length === 0 ? (
                    <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">No yearly forecasts</TableCell></TableRow>
                  ) : filteredYearly.map((f: any) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.fiscal_year}</TableCell>
                      <TableCell>{(f.projects as any)?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{SCENARIO_LABELS[f.scenario_type] || f.scenario_type}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(f.forecast_revenue)}</TableCell>
                      <TableCell className="text-right">{fmt(f.forecast_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(f.forecast_margin)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">{f.notes || "—"}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openForm("yearly", f)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget({ id: f.id, table: "yearly_forecasts" })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ForecastFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        type={formType}
        entry={editing}
        projects={projects}
        phases={phases}
        suggestions={filterProject !== "all" ? getSuggestions(filterProject) : undefined}
      />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        title="Delete Forecast"
        description="This will permanently delete this forecast entry."
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
