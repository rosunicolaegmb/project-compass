import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canEditModule } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PhaseFormDialog } from "@/components/phases/PhaseFormDialog";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, DollarSign, TrendingUp, Clock,
  AlertTriangle, CheckCircle2, BarChart3, Users, Receipt, Calendar,
} from "lucide-react";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  time_and_materials: "Time & Materials",
  fixed_price: "Fixed Price",
};

const statusMap: Record<string, any> = {
  draft: "draft", active: "active", on_hold: "on-hold",
  completed: "completed", archived: "archived", cancelled: "at-risk",
};

const phaseStatusMap: Record<string, any> = {
  planned: "draft", active: "active", completed: "completed", on_hold: "on-hold",
};

function fmt(n: number | null | undefined, prefix = "$"): string {
  if (n == null) return "—";
  return `${prefix}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Number(n).toFixed(1)}%`;
}

function fmtHrs(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Number(n).toLocaleString()} hrs`;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const canEdit = canEditModule(roles, "projects");
  const queryClient = useQueryClient();

  const [showPhaseDialog, setShowPhaseDialog] = useState(false);
  const [editingPhase, setEditingPhase] = useState<any>(null);
  const [deletingPhase, setDeletingPhase] = useState<any>(null);

  // Fetch project
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(name), resources!projects_pm_resource_id_fkey(display_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch phases
  const { data: phases = [] } = useQuery({
    queryKey: ["project-phases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("*")
        .eq("project_id", id!)
        .is("deleted_at", null)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch time entries
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["project-time-entries", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*, resources(display_name), project_phases(name)")
        .eq("project_id", id!)
        .is("deleted_at", null)
        .order("entry_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ["project-expenses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_entries")
        .select("*, resources(display_name), project_phases(name)")
        .eq("project_id", id!)
        .is("deleted_at", null)
        .order("expense_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch team members
  const { data: members = [] } = useQuery({
    queryKey: ["project-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("*, resources(display_name, job_title, department), delivery_roles(name)")
        .eq("project_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch budget baselines
  const { data: baselines = [] } = useQuery({
    queryKey: ["project-baselines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_budget_baselines")
        .select("*")
        .eq("project_id", id!)
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch monthly forecasts
  const { data: monthlyForecasts = [] } = useQuery({
    queryKey: ["project-monthly-forecasts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_forecasts")
        .select("*")
        .eq("project_id", id!)
        .order("forecast_month");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch audit logs
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["project-audit-logs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .or(`entity_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const deletePhase = useMutation({
    mutationFn: async (phaseId: string) => {
      const { error } = await supabase
        .from("project_phases")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", phaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-phases", id] });
      toast.success("Phase deleted");
      setDeletingPhase(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (projectLoading) {
    return (
      <div className="page-container">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-container">
        <div className="text-muted-foreground">Project not found.</div>
        <Button variant="outline" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Projects
        </Button>
      </div>
    );
  }

  // === Financial Calculations ===
  const totalBudget = Number(project.total_budget || 0);
  const plannedBudget = Number(project.planned_budget || totalBudget);
  const revisedBudget = Number(project.revised_budget || plannedBudget);

  // Phase-level planned
  const plannedCostFromPhases = phases.reduce((sum: number, p: any) => sum + Number(p.budget_amount || 0), 0);
  const plannedHoursFromPhases = phases.reduce((sum: number, p: any) => sum + Number(p.budget_hours || 0), 0);

  // Actual from time entries
  const actualHours = timeEntries.reduce((sum: number, t: any) => sum + Number(t.hours || 0), 0);
  const actualLaborCost = timeEntries.reduce((sum: number, t: any) => sum + Number(t.hours || 0) * Number(t.cost_rate || 0), 0);
  const actualLaborRevenue = timeEntries.reduce((sum: number, t: any) => sum + Number(t.hours || 0) * Number(t.bill_rate || 0), 0);

  // Actual from expenses
  const actualExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

  // Totals
  const actualCost = actualLaborCost + actualExpenses;
  const actualRevenue = actualLaborRevenue;

  // Forecast from monthly forecasts
  const forecastLaborCost = monthlyForecasts.reduce((sum: number, f: any) => sum + Number(f.forecast_labor_cost || 0), 0);
  const forecastExpenses = monthlyForecasts.reduce((sum: number, f: any) => sum + Number(f.forecast_expenses || 0), 0);
  const forecastLaborRevenue = monthlyForecasts.reduce((sum: number, f: any) => sum + Number(f.forecast_labor_revenue || 0), 0);
  const forecastHours = monthlyForecasts.reduce((sum: number, f: any) => sum + Number(f.forecast_hours || 0), 0);
  const forecastCost = forecastLaborCost + forecastExpenses || actualCost;
  const forecastRevenue = forecastLaborRevenue || actualRevenue;

  // KPIs
  const remainingBudget = revisedBudget - actualCost;
  const burnRate = actualHours > 0 && plannedHoursFromPhases > 0
    ? (actualHours / plannedHoursFromPhases) * 100
    : 0;
  const costToComplete = forecastCost > actualCost ? forecastCost - actualCost : 0;
  const estimateAtCompletion = actualCost + costToComplete;
  const grossMargin = actualRevenue > 0
    ? ((actualRevenue - actualCost) / actualRevenue) * 100
    : 0;
  const marginAtCompletion = forecastRevenue > 0
    ? ((forecastRevenue - forecastCost) / forecastRevenue) * 100
    : 0;
  const budgetConsumed = revisedBudget > 0 ? (actualCost / revisedBudget) * 100 : 0;
  const forecastConsumed = revisedBudget > 0 ? (forecastCost / revisedBudget) * 100 : 0;

  // Health indicators
  const healthItems = [
    {
      label: "Budget Health",
      status: budgetConsumed > 90 ? "critical" : budgetConsumed > 75 ? "warning" : "good",
      detail: `${fmtPct(budgetConsumed)} consumed`,
    },
    {
      label: "Margin Health",
      status: grossMargin < 10 ? "critical" : grossMargin < 20 ? "warning" : "good",
      detail: `${fmtPct(grossMargin)} gross margin`,
    },
    {
      label: "Burn Rate",
      status: burnRate > 100 ? "critical" : burnRate > 85 ? "warning" : "good",
      detail: `${fmtPct(burnRate)} of planned hours`,
    },
    {
      label: "Forecast Variance",
      status: forecastConsumed > 100 ? "critical" : forecastConsumed > 90 ? "warning" : "good",
      detail: `EAC: ${fmt(estimateAtCompletion)}`,
    },
  ];

  const clientName = (project.clients as any)?.name || "—";
  const pmName = (project.resources as any)?.display_name || "Unassigned";

  return (
    <div className="page-container">
      <PageHeader
        title={project.name}
        description={`${clientName} · ${PROJECT_TYPE_LABELS[project.project_type]} · ${pmName}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        }
      />

      {/* Project Summary Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={statusMap[project.status] || "draft"} />
        <Badge variant="outline" className="text-xs">
          {PROJECT_TYPE_LABELS[project.project_type]}
        </Badge>
        {project.code && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {project.code}
          </Badge>
        )}
        {project.start_date && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {project.start_date} → {project.end_date || "Ongoing"}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {project.currency || "USD"}
        </span>
      </div>

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard title="Budget" value={fmt(revisedBudget)} icon={DollarSign} iconColor="bg-primary/10" />
        <StatCard title="Actual Cost" value={fmt(actualCost)} icon={DollarSign} iconColor="bg-primary/10"
          change={fmtPct(budgetConsumed) + " consumed"} changeType={budgetConsumed > 90 ? "negative" : "neutral"} />
        <StatCard title="Remaining" value={fmt(remainingBudget)} icon={DollarSign} iconColor="bg-success/10"
          changeType={remainingBudget < 0 ? "negative" : "positive"} />
        <StatCard title="Actual Revenue" value={fmt(actualRevenue)} icon={TrendingUp} iconColor="bg-primary/10" />
        <StatCard title="Gross Margin" value={fmtPct(grossMargin)} icon={BarChart3} iconColor="bg-primary/10"
          changeType={grossMargin < 15 ? "negative" : "positive"} />
        <StatCard title="Burn Rate" value={fmtPct(burnRate)} icon={Clock} iconColor="bg-warning/10"
          change={fmtHrs(actualHours) + " logged"} changeType={burnRate > 100 ? "negative" : "neutral"} />
        <StatCard title="EAC" value={fmt(estimateAtCompletion)} icon={TrendingUp} iconColor="bg-primary/10"
          change={`CTC: ${fmt(costToComplete)}`} changeType={estimateAtCompletion > revisedBudget ? "negative" : "positive"} />
      </div>

      {/* Health Indicators */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Health Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {healthItems.map((h) => (
              <div key={h.label} className="flex items-center gap-3">
                {h.status === "good" && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                {h.status === "warning" && <AlertTriangle className="h-5 w-5 text-warning shrink-0" />}
                {h.status === "critical" && <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
                <div>
                  <p className="text-sm font-medium">{h.label}</p>
                  <p className="text-xs text-muted-foreground">{h.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Sections */}
      <Tabs defaultValue="phases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="phases">Phases ({phases.length})</TabsTrigger>
          <TabsTrigger value="team">Team ({members.length})</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets ({timeEntries.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
          <TabsTrigger value="budget">Budget History</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* PHASES TAB */}
        <TabsContent value="phases">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Project Phases</CardTitle>
              {canEdit && (
                <Button size="sm" onClick={() => setShowPhaseDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Phase
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Phase</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Plan Hrs</TableHead>
                    <TableHead className="text-right">Actual Hrs</TableHead>
                    <TableHead className="text-right">Plan Cost</TableHead>
                    <TableHead className="text-right">Actual Cost</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="w-20">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8 text-muted-foreground">
                        No phases defined yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    phases.map((phase: any) => {
                      const phaseTimeEntries = timeEntries.filter((t: any) => t.phase_id === phase.id);
                      const phaseActualHours = phaseTimeEntries.reduce((s: number, t: any) => s + Number(t.hours || 0), 0);
                      const phaseActualCost = phaseTimeEntries.reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.cost_rate || 0), 0);
                      const phaseExpenses = expenses.filter((e: any) => e.phase_id === phase.id);
                      const phaseActualExpCost = phaseExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
                      const totalActualCost = phaseActualCost + phaseActualExpCost;
                      const plannedHours = Number(phase.budget_hours || 0);
                      const progress = plannedHours > 0 ? Math.min((phaseActualHours / plannedHours) * 100, 100) : 0;
                      const dates = [phase.start_date, phase.end_date].filter(Boolean).join(" → ") || "—";
                      return (
                        <TableRow key={phase.id} className="border-border hover:bg-muted/50">
                          <TableCell className="font-medium">{phase.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{dates}</TableCell>
                          <TableCell className="text-right">{fmtHrs(plannedHours)}</TableCell>
                          <TableCell className="text-right">{fmtHrs(phaseActualHours)}</TableCell>
                          <TableCell className="text-right">{fmt(phase.budget_amount)}</TableCell>
                          <TableCell className="text-right">{fmt(totalActualCost)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <Progress value={progress} className="w-16 h-2" />
                              <span className="text-xs text-muted-foreground w-10 text-right">{fmtPct(progress)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={phaseStatusMap[phase.status] || "draft"} />
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPhase(phase)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingPhase(phase)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEAM TAB */}
        <TabsContent value="team">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Team Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Resource</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead className="text-right">Allocation</TableHead>
                    <TableHead className="text-right">Bill Rate</TableHead>
                    <TableHead className="text-right">Cost Rate</TableHead>
                    <TableHead>Dates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No team members assigned.
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m: any) => (
                      <TableRow key={m.id} className="border-border hover:bg-muted/50">
                        <TableCell className="font-medium">{(m.resources as any)?.display_name || "—"}</TableCell>
                        <TableCell>{(m.delivery_roles as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{(m.resources as any)?.job_title || "—"}</TableCell>
                        <TableCell className="text-right">{m.allocation_percentage != null ? `${m.allocation_percentage}%` : "—"}</TableCell>
                        <TableCell className="text-right">{m.bill_rate_override != null ? fmt(m.bill_rate_override) : "Default"}</TableCell>
                        <TableCell className="text-right">{m.cost_rate_override != null ? fmt(m.cost_rate_override) : "Default"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[m.start_date, m.end_date].filter(Boolean).join(" → ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIMESHEETS TAB */}
        <TabsContent value="timesheets">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Recent Time Entries
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead>Billable</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No time entries recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    timeEntries.map((t: any) => (
                      <TableRow key={t.id} className="border-border hover:bg-muted/50">
                        <TableCell>{t.entry_date}</TableCell>
                        <TableCell className="font-medium">{(t.resources as any)?.display_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{(t.project_phases as any)?.name || "—"}</TableCell>
                        <TableCell className="text-right">{t.hours}</TableCell>
                        <TableCell className="text-right">{fmt(Number(t.hours) * Number(t.cost_rate || 0))}</TableCell>
                        <TableCell className="text-right">{fmt(Number(t.hours) * Number(t.bill_rate || 0))}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {t.is_billable ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={t.approval_status === "approved" ? "approved" : t.approval_status === "rejected" ? "at-risk" : "pending"} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Recent Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Billable</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No expenses recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses.map((e: any) => (
                      <TableRow key={e.id} className="border-border hover:bg-muted/50">
                        <TableCell>{e.expense_date}</TableCell>
                        <TableCell className="font-medium">{(e.resources as any)?.display_name || "—"}</TableCell>
                        <TableCell className="capitalize">{e.category?.replace("_", " ")}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{e.description || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(e.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{e.is_billable ? "Yes" : "No"}</Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={e.approval_status === "approved" ? "approved" : e.approval_status === "rejected" ? "at-risk" : "pending"} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BUDGET HISTORY TAB */}
        <TabsContent value="budget">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Budget Baselines</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Version</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total Budget</TableHead>
                    <TableHead className="text-right">Labor Budget</TableHead>
                    <TableHead className="text-right">Expense Budget</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baselines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No budget baselines recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    baselines.map((b: any) => (
                      <TableRow key={b.id} className="border-border hover:bg-muted/50">
                        <TableCell className="font-medium">v{b.version}</TableCell>
                        <TableCell>{b.baseline_date}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(b.total_budget)}</TableCell>
                        <TableCell className="text-right">{fmt(b.labor_budget)}</TableCell>
                        <TableCell className="text-right">{fmt(b.expense_budget)}</TableCell>
                        <TableCell>
                          {b.is_current && <Badge className="bg-success/10 text-success text-xs">Current</Badge>}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{b.notes || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FORECASTS TAB */}
        <TabsContent value="forecasts">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Forecast Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Forecast Revenue</p>
                  <p className="text-lg font-semibold">{fmt(forecastRevenue)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Forecast Cost</p>
                  <p className="text-lg font-semibold">{fmt(forecastCost)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Forecast Hours</p>
                  <p className="text-lg font-semibold">{fmtHrs(forecastHours)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Margin at Completion</p>
                  <p className="text-lg font-semibold">{fmtPct(marginAtCompletion)}</p>
                </div>
              </div>
              {monthlyForecasts.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Labor Revenue</TableHead>
                      <TableHead className="text-right">Labor Cost</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyForecasts.map((f: any) => (
                      <TableRow key={f.id} className="border-border hover:bg-muted/50">
                        <TableCell>{f.forecast_month}</TableCell>
                        <TableCell className="text-right">{fmtHrs(f.forecast_hours)}</TableCell>
                        <TableCell className="text-right">{fmt(f.forecast_labor_revenue)}</TableCell>
                        <TableCell className="text-right">{fmt(f.forecast_labor_cost)}</TableCell>
                        <TableCell className="text-right">{fmt(f.forecast_expenses)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT LOG TAB */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Audit Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No audit entries.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log: any) => (
                      <TableRow key={log.id} className="border-border hover:bg-muted/50">
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="capitalize">{log.action?.toLowerCase()}</TableCell>
                        <TableCell>{log.entity_type}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Phase Dialogs */}
      <PhaseFormDialog
        open={showPhaseDialog}
        onOpenChange={setShowPhaseDialog}
        phase={null}
        projectId={id!}
      />
      <PhaseFormDialog
        open={!!editingPhase}
        onOpenChange={(open) => { if (!open) setEditingPhase(null); }}
        phase={editingPhase}
        projectId={id!}
      />
      <DeleteConfirmDialog
        open={!!deletingPhase}
        onOpenChange={(open) => { if (!open) setDeletingPhase(null); }}
        onConfirm={() => deletingPhase && deletePhase.mutate(deletingPhase.id)}
        title="Delete Phase"
        description={`Are you sure you want to delete "${deletingPhase?.name}"?`}
        loading={deletePhase.isPending}
      />
    </div>
  );
}
