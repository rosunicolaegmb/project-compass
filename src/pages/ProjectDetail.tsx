import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canEditModule } from "@/lib/auth-helpers";
import { cn } from "@/lib/utils";
import { calculateBudgetMetrics, type HealthStatus } from "@/lib/budget-calculations";
import { loadConversionRates, fmtEur, toEur, fmtCurrency } from "@/lib/currency";
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
  AlertTriangle, CheckCircle2, BarChart3, Users, Receipt, Calendar, Target, Percent, Banknote,
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

function fmt(n: number | null | undefined, prefix = "€"): string {
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
  useEffect(() => { loadConversionRates(); }, []);
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

  // Fetch one-time revenues
  const { data: oneTimeRevenues = [] } = useQuery({
    queryKey: ["project-one-time-revenues", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("one_time_revenues")
        .select("*")
        .eq("project_id", id!)
        .order("revenue_month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const oneTimeRevenueTotal = oneTimeRevenues.reduce((s: number, r: any) =>
    s + toEur(Number(r.amount || 0), r.currency || "EUR", r.revenue_month), 0);

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

  // === Financial Calculations via Budget Engine ===
  const metrics = calculateBudgetMetrics({
    projectType: project.project_type as "time_and_materials" | "fixed_price",
    totalBudget: Number(project.total_budget || 0),
    plannedBudget: Number(project.planned_budget || project.total_budget || 0),
    revisedBudget: Number(project.planned_budget || project.total_budget || 0),
    plannedHours: phases.reduce((s: number, p: any) => s + Number(p.budget_hours || 0), 0),
    plannedCost: phases.reduce((s: number, p: any) => s + Number(p.budget_amount || 0), 0),
    timeEntries: timeEntries.map((t: any) => ({
      hours: Number(t.hours || 0),
      costRate: Number(t.cost_rate || 0),
      billRate: Number(t.bill_rate || 0),
      isBillable: t.is_billable,
      approvalStatus: t.approval_status,
    })),
    expenses: expenses.map((e: any) => ({
      amount: Number(e.amount || 0),
      isBillable: e.is_billable,
      approvalStatus: e.approval_status,
    })),
    forecastLaborCost: monthlyForecasts.reduce((s: number, f: any) => s + Number(f.forecast_labor_cost || 0), 0),
    forecastLaborRevenue: monthlyForecasts.reduce((s: number, f: any) => s + Number(f.forecast_labor_revenue || 0), 0),
    forecastExpenses: monthlyForecasts.reduce((s: number, f: any) => s + Number(f.forecast_expenses || 0), 0),
    forecastHours: monthlyForecasts.reduce((s: number, f: any) => s + Number(f.forecast_hours || 0), 0),
  });

  const isT_M = project.project_type === "time_and_materials";

  // Health indicators
  const healthIcon = (status: HealthStatus) => {
    if (status === "green") return <CheckCircle2 className="h-5 w-5 text-success shrink-0" />;
    if (status === "amber") return <AlertTriangle className="h-5 w-5 text-warning shrink-0" />;
    return <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />;
  };

  const healthItems = [
    { label: "Budget", status: metrics.budgetHealth, detail: `${fmtPct(metrics.budgetConsumedPct)} consumed` },
    { label: "Margin", status: metrics.marginHealth, detail: `${fmtPct(metrics.grossMargin)} gross margin` },
    { label: "Burn Rate", status: metrics.burnHealth, detail: `${fmtPct(metrics.burnRatePct)} of planned hours` },
    { label: "Forecast", status: metrics.forecastHealth, detail: `EAC: ${fmt(metrics.estimateAtCompletion)}` },
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

      {/* Financial KPI Cards — differentiated by project type */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard title="Budget" value={fmt(metrics.revisedBudget)} icon={DollarSign} iconColor="bg-primary/10" />
        <StatCard title="Actual Cost" value={fmt(metrics.actualCost)} icon={DollarSign} iconColor="bg-primary/10"
          change={fmtPct(metrics.budgetConsumedPct) + " consumed"} changeType={metrics.budgetConsumedPct > 90 ? "negative" : "neutral"} />
        <StatCard title="Remaining" value={fmt(metrics.remainingBudget)} icon={DollarSign} iconColor="bg-success/10"
          changeType={metrics.remainingBudget < 0 ? "negative" : "positive"} />
        <StatCard title={isT_M ? "T&M Revenue" : "Contract Value"} value={fmt(metrics.actualRevenue)} icon={TrendingUp} iconColor="bg-primary/10" />
        <StatCard title="Gross Margin" value={fmtPct(metrics.grossMargin)} icon={BarChart3} iconColor="bg-primary/10"
          changeType={metrics.grossMargin < 15 ? "negative" : "positive"} />
        <StatCard title="Burn Rate" value={fmtPct(metrics.burnRatePct)} icon={Clock} iconColor="bg-warning/10"
          change={fmtHrs(metrics.totalHours) + " logged"} changeType={metrics.burnRatePct > 100 ? "negative" : "neutral"} />
        <StatCard title="EAC" value={fmt(metrics.estimateAtCompletion)} icon={TrendingUp} iconColor="bg-primary/10"
          change={`CTC: ${fmt(metrics.costToComplete)}`} changeType={metrics.estimateAtCompletion > metrics.revisedBudget ? "negative" : "positive"} />
      </div>

      {/* T&M-specific metrics */}
      {isT_M && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Blended Bill Rate" value={fmt(metrics.blendedBillRate)} icon={DollarSign} iconColor="bg-primary/10" change="/hr" changeType="neutral" />
          <StatCard title="Blended Cost Rate" value={fmt(metrics.blendedCostRate)} icon={DollarSign} iconColor="bg-primary/10" change="/hr" changeType="neutral" />
          <StatCard title="Billable Realization" value={fmtPct(metrics.billableRealization)} icon={Percent} iconColor="bg-primary/10"
            change={`${metrics.billableHours.toLocaleString()} / ${metrics.totalHours.toLocaleString()} hrs`} changeType={metrics.billableRealization < 70 ? "negative" : "positive"} />
          <StatCard title="Approved Billable Hrs" value={fmtHrs(metrics.approvedBillableHours)} icon={Target} iconColor="bg-success/10" />
        </div>
      )}

      {/* FP-specific metrics */}
      {!isT_M && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Contract Value" value={fmt(Number(project.total_budget || 0))} icon={Target} iconColor="bg-primary/10" />
          <StatCard title="Profitability" value={fmt(metrics.actualRevenue - metrics.actualCost)} icon={TrendingUp} iconColor="bg-success/10"
            changeType={metrics.actualRevenue - metrics.actualCost < 0 ? "negative" : "positive"} />
          <StatCard title="Cost to Complete" value={fmt(metrics.costToComplete)} icon={DollarSign} iconColor="bg-warning/10" />
          <StatCard title="Margin at Completion" value={fmtPct(metrics.marginAtCompletion)} icon={BarChart3} iconColor="bg-primary/10"
            changeType={metrics.marginAtCompletion < 15 ? "negative" : "positive"} />
        </div>
      )}

      {/* Health Indicators with overall status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Health Indicators</CardTitle>
            <Badge variant="outline" className={cn(
              "text-xs font-medium capitalize",
              metrics.overallHealth === "green" && "bg-success/10 text-success border-success/20",
              metrics.overallHealth === "amber" && "bg-warning/10 text-warning border-warning/20",
              metrics.overallHealth === "red" && "bg-destructive/10 text-destructive border-destructive/20",
            )}>
              {metrics.overallHealth === "green" ? "Healthy" : metrics.overallHealth === "amber" ? "At Risk" : "Critical"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {healthItems.map((h) => (
              <div key={h.label} className="flex items-center gap-3">
                {healthIcon(h.status)}
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
                  <p className="text-lg font-semibold">{fmt(metrics.forecastRevenue)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Forecast Cost</p>
                  <p className="text-lg font-semibold">{fmt(metrics.forecastCost)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Forecast Hours</p>
                  <p className="text-lg font-semibold">{fmtHrs(metrics.forecastCost > 0 ? monthlyForecasts.reduce((s: number, f: any) => s + Number(f.forecast_hours || 0), 0) : 0)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Margin at Completion</p>
                  <p className="text-lg font-semibold">{fmtPct(metrics.marginAtCompletion)}</p>
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
