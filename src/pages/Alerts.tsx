import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/TableSkeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  severity: "critical" | "warning" | "info";
  type: string;
  message: string;
  date: string;
}

const severityOrder: Record<Alert["severity"], number> = { critical: 0, warning: 1, info: 2 };

const severityConfig: Record<Alert["severity"], { icon: typeof AlertCircle; badgeClass: string }> = {
  critical: { icon: AlertCircle, badgeClass: "bg-destructive/10 text-destructive border-destructive/20" },
  warning: { icon: AlertTriangle, badgeClass: "bg-warning/10 text-warning border-warning/20" },
  info: { icon: Info, badgeClass: "bg-primary/10 text-primary border-primary/20" },
};

function generateAlerts(
  resources: any[], members: any[], projects: any[], monthlyCosts: any[],
  timeEntries: any[], expenseEntries: any[], conversionRates: any[],
): Alert[] {
  const alerts: Alert[] = [];
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const activeResources = resources.filter(r => r.is_active && !r.deleted_at);
  const activeProjects = projects.filter(p => p.is_active && !p.deleted_at);

  // 1. Unallocated resource
  for (const res of activeResources) {
    const hasActive = members.some(m =>
      m.resource_id === res.id &&
      (!m.start_date || m.start_date <= todayStr) &&
      (!m.end_date || m.end_date >= todayStr)
    );
    if (!hasActive) {
      alerts.push({ severity: "warning", type: "Unallocated Resource", message: `${res.display_name} has no active project allocation`, date: todayStr });
    }
  }

  // 2. Project ending soon (within 30 days)
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  const in30Str = in30Days.toISOString().slice(0, 10);
  for (const p of activeProjects) {
    if (p.end_date && p.end_date >= todayStr && p.end_date <= in30Str && !["completed", "archived", "cancelled"].includes(p.status)) {
      alerts.push({ severity: "warning", type: "Project Ending Soon", message: `"${p.name}" ends on ${p.end_date}`, date: todayStr });
    }
  }

  // 3. Late timesheet submission
  const lateTimesheetSeen = new Set<string>();
  for (const te of timeEntries) {
    if (!te.created_at || !te.entry_date) continue;
    const entryDate = new Date(te.entry_date);
    const entryMonth = entryDate.getMonth();
    const entryYear = entryDate.getFullYear();
    const lastDay = new Date(entryYear, entryMonth + 1, 0).getDate();
    const created = new Date(te.created_at);
    const createdDay = created.getDate();
    if (created.getMonth() === entryMonth && created.getFullYear() === entryYear && createdDay >= lastDay - 1) {
      const resName = activeResources.find(r => r.id === te.resource_id)?.display_name || "Unknown";
      const key = `${te.resource_id}-${entryYear}-${entryMonth}`;
      if (!lateTimesheetSeen.has(key)) {
        lateTimesheetSeen.add(key);
        alerts.push({ severity: "info", type: "Late Timesheet", message: `${resName} submitted timesheet on day ${createdDay} of ${entryYear}-${String(entryMonth + 1).padStart(2, "0")}`, date: te.created_at.slice(0, 10) });
      }
    }
  }

  // 4. SOW expired
  for (const p of projects) {
    if (p.status === "sow_expired") {
      alerts.push({ severity: "critical", type: "SOW Expired", message: `"${p.name}" has an expired SOW`, date: p.updated_at?.slice(0, 10) || todayStr });
    }
  }

  // 5. Over-allocated resource
  for (const res of activeResources) {
    const am = members.filter(m => m.resource_id === res.id && (!m.start_date || m.start_date <= todayStr) && (!m.end_date || m.end_date >= todayStr));
    const total = am.reduce((s, m) => s + Number(m.allocation_percentage || 0), 0);
    if (total > 100) {
      alerts.push({ severity: "warning", type: "Over-Allocated", message: `${res.display_name} is allocated at ${total}% (across ${am.length} projects)`, date: todayStr });
    }
  }

  // 6. No salary data for current month
  for (const res of activeResources) {
    const hasCost = monthlyCosts.some(c => c.resource_id === res.id && c.month === currentMonth && c.year === currentYear);
    if (!hasCost) {
      alerts.push({ severity: "warning", type: "No Salary Data", message: `${res.display_name} has no salary entry for ${currentYear}-${String(currentMonth).padStart(2, "0")}`, date: todayStr });
    }
  }

  // 7. Missing conversion rates
  const currenciesInUse = new Set<string>();
  activeProjects.forEach(p => { if (p.currency && p.currency !== "EUR") currenciesInUse.add(p.currency); });
  activeResources.forEach(r => { if (r.currency && r.currency !== "EUR") currenciesInUse.add(r.currency); });
  for (const cur of currenciesInUse) {
    const hasRate = conversionRates.some(cr => cr.from_currency === cur && cr.month === currentMonth && cr.year === currentYear);
    if (!hasRate) {
      alerts.push({ severity: "warning", type: "Missing Conversion Rate", message: `No ${cur} → EUR rate for ${currentYear}-${String(currentMonth).padStart(2, "0")}`, date: todayStr });
    }
  }

  // 8. Pending approvals > 7 days
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysStr = sevenDaysAgo.toISOString();
  const pendingTs = timeEntries.filter(te => te.approval_status === "pending" && te.created_at < sevenDaysStr);
  if (pendingTs.length > 0) {
    alerts.push({ severity: "info", type: "Pending Timesheets", message: `${pendingTs.length} timesheet entries pending approval for over 7 days`, date: todayStr });
  }
  const pendingEx = expenseEntries.filter(e => e.approval_status === "pending" && e.created_at < sevenDaysStr);
  if (pendingEx.length > 0) {
    alerts.push({ severity: "info", type: "Pending Expenses", message: `${pendingEx.length} expense entries pending approval for over 7 days`, date: todayStr });
  }

  // 9. Budget overrun
  for (const p of activeProjects) {
    if (!p.total_budget || p.total_budget <= 0) continue;
    const total = expenseEntries.filter(e => e.project_id === p.id && !e.deleted_at).reduce((s, e) => s + Number(e.amount || 0), 0);
    if (total > Number(p.total_budget)) {
      alerts.push({ severity: "critical", type: "Budget Overrun", message: `"${p.name}" expenses (${total.toLocaleString()}) exceed budget (${Number(p.total_budget).toLocaleString()})`, date: todayStr });
    }
  }

  // 10. Resource without primary project
  for (const res of activeResources) {
    const am = members.filter(m => m.resource_id === res.id && (!m.start_date || m.start_date <= todayStr) && (!m.end_date || m.end_date >= todayStr));
    if (am.length > 0 && !am.some(m => m.is_primary)) {
      alerts.push({ severity: "warning", type: "No Primary Project", message: `${res.display_name} has ${am.length} allocation(s) but none marked as primary`, date: todayStr });
    }
  }

  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.date.localeCompare(a.date));
}

export default function Alerts() {
  const { data: resources = [], isLoading: lr } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => { const { data } = await supabase.from("resources").select("*"); return data || []; },
  });
  const { data: members = [], isLoading: lm } = useQuery({
    queryKey: ["project_members"],
    queryFn: async () => { const { data } = await supabase.from("project_members").select("*"); return data || []; },
  });
  const { data: projects = [], isLoading: lp } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => { const { data } = await supabase.from("projects").select("*"); return data || []; },
  });
  const { data: monthlyCosts = [] } = useQuery({
    queryKey: ["resource_monthly_costs"],
    queryFn: async () => { const { data } = await supabase.from("resource_monthly_costs").select("*"); return data || []; },
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["time_entries_alerts"],
    queryFn: async () => { const { data } = await supabase.from("time_entries").select("*").is("deleted_at", null); return data || []; },
  });
  const { data: expenseEntries = [] } = useQuery({
    queryKey: ["expense_entries_alerts"],
    queryFn: async () => { const { data } = await supabase.from("expense_entries").select("*").is("deleted_at", null); return data || []; },
  });
  const { data: conversionRates = [] } = useQuery({
    queryKey: ["currency_conversion_rates"],
    queryFn: async () => { const { data } = await supabase.from("currency_conversion_rates").select("*"); return data || []; },
  });

  const isLoading = lr || lm || lp;
  const alerts = isLoading ? [] : generateAlerts(resources, members, projects, monthlyCosts, timeEntries, expenseEntries, conversionRates);

  return (
    <div className="page-container">
      <PageHeader title="Alerts" description="Actionable warnings and issues detected across the system" />
      {isLoading ? (
        <TableSkeleton columns={4} />
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No alerts</p>
          <p className="text-sm">Everything looks good — no issues detected.</p>
        </div>
      ) : (
        <div className="data-table-container">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[100px]">Severity</TableHead>
                <TableHead className="w-[200px]">Alert Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[120px]">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert, i) => {
                const config = severityConfig[alert.severity];
                const Icon = config.icon;
                return (
                  <TableRow key={i} className="border-border hover:bg-muted/50">
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs font-medium capitalize", config.badgeClass)}>
                        <Icon className="h-3 w-3 mr-1" />
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{alert.type}</TableCell>
                    <TableCell className="text-muted-foreground">{alert.message}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{alert.date}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
