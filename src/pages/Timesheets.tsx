import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canEditModule } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeEntryFormDialog } from "@/components/timesheets/TimeEntryFormDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { saveFilters, loadFilters } from "@/lib/filters";
import { exportToCsv } from "@/lib/csv-export";
import { Plus, Search, Pencil, Trash2, X, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download } from "lucide-react";
import { toast } from "sonner";
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks, format, parseISO,
  eachDayOfInterval, startOfMonth, endOfMonth, addMonths, subMonths,
  isWithinInterval,
} from "date-fns";

const APPROVAL_OPTIONS = ["pending", "approved", "rejected"];

function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).slice(0, 5); // Mon-Fri
}

function fmt(n: number | null | undefined) {
  return n != null ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—";
}

export default function Timesheets() {
  const { roles, isAdmin, isOfficeAdmin } = useAuth();
  const canEdit = canEditModule(roles, "timesheets");
  const canBulkEdit = isAdmin || isOfficeAdmin;
  const queryClient = useQueryClient();

  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [search, setSearch] = useState("");
  const [filterResource, setFilterResource] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterPhase, setFilterPhase] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Month range for daily view
  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  // Week range
  const weekDays = getWeekDays(currentWeek);
  const weekStart = format(weekDays[0], "yyyy-MM-dd");
  const weekEnd = format(weekDays[4], "yyyy-MM-dd");

  const dateRangeStart = view === "weekly" ? weekStart : monthStart;
  const dateRangeEnd = view === "weekly" ? weekEnd : monthEnd;

  // Fetch time entries
  const { data: timeEntries = [], isLoading } = useQuery({
    queryKey: ["time-entries", dateRangeStart, dateRangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*, resources(display_name), projects(name), project_phases(name)")
        .is("deleted_at", null)
        .gte("entry_date", dateRangeStart)
        .lte("entry_date", dateRangeEnd)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch resources
  const { data: resources = [] } = useQuery({
    queryKey: ["resources-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("id, display_name, default_bill_rate, default_cost_rate").is("deleted_at", null).eq("is_active", true).order("display_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").is("deleted_at", null).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch phases
  const { data: phases = [] } = useQuery({
    queryKey: ["phases-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_phases").select("id, name, project_id").is("deleted_at", null).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Time entry deleted");
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Bulk approve
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("time_entries")
        .update({ approval_status: "approved" as any, approved_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success(`${selectedIds.size} entries approved`);
      setSelectedIds(new Set());
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Filter
  const filtered = useMemo(() => {
    return timeEntries.filter((t: any) => {
      const q = search.toLowerCase();
      const matchSearch = !q || [(t.resources as any)?.display_name, (t.projects as any)?.name, t.description]
        .filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
      const matchResource = filterResource === "all" || t.resource_id === filterResource;
      const matchProject = filterProject === "all" || t.project_id === filterProject;
      const matchPhase = filterPhase === "all" || t.phase_id === filterPhase;
      const matchStatus = filterStatus === "all" || t.approval_status === filterStatus;
      return matchSearch && matchResource && matchProject && matchPhase && matchStatus;
    });
  }, [timeEntries, search, filterResource, filterProject, filterPhase, filterStatus]);

  const hasFilters = filterResource !== "all" || filterProject !== "all" || filterPhase !== "all" || filterStatus !== "all";

  const clearFilters = () => {
    setFilterResource("all"); setFilterProject("all"); setFilterPhase("all"); setFilterStatus("all");
  };

  // Summary stats
  const totalHours = filtered.reduce((s: number, t: any) => s + Number(t.hours || 0), 0);
  const totalCost = filtered.reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.cost_rate || 0), 0);
  const totalRevenue = filtered.reduce((s: number, t: any) => s + (t.is_billable ? Number(t.hours || 0) * Number(t.bill_rate || 0) : 0), 0);
  const billableHours = filtered.filter((t: any) => t.is_billable).reduce((s: number, t: any) => s + Number(t.hours || 0), 0);

  // Toggle selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t: any) => t.id)));
    }
  };

  // Weekly grouping
  const weeklyGrouped = useMemo(() => {
    if (view !== "weekly") return [];
    const groups: Record<string, Record<string, { total: number; entries: any[] }>> = {};
    filtered.forEach((t: any) => {
      const key = `${t.resource_id}::${t.project_id}`;
      if (!groups[key]) groups[key] = {};
      const day = t.entry_date;
      if (!groups[key][day]) groups[key][day] = { total: 0, entries: [] };
      groups[key][day].total += Number(t.hours || 0);
      groups[key][day].entries.push(t);
    });
    return Object.entries(groups).map(([key, days]) => {
      const [resourceId, projectId] = key.split("::");
      const sample = filtered.find((t: any) => t.resource_id === resourceId && t.project_id === projectId);
      const weekTotal = Object.values(days).reduce((s, d) => s + d.total, 0);
      return {
        resourceId, projectId,
        resourceName: (sample?.resources as any)?.display_name || "—",
        projectName: (sample?.projects as any)?.name || "—",
        days, weekTotal,
      };
    });
  }, [filtered, view]);

  const approvalStatusMap: Record<string, any> = {
    pending: "pending", approved: "approved", rejected: "at-risk",
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Timesheets"
        description="Track and approve time entries"
        actions={canEdit ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Log Time
          </Button>
        ) : undefined}
      />

      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Total Hours</p>
          <p className="text-lg font-semibold">{totalHours.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Billable Hours</p>
          <p className="text-lg font-semibold">{billableHours.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{totalHours > 0 ? `${((billableHours / totalHours) * 100).toFixed(0)}% billable` : "—"}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Total Cost</p>
          <p className="text-lg font-semibold">{fmt(totalCost)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">T&M Revenue</p>
          <p className="text-lg font-semibold">{fmt(totalRevenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-48" />
        </div>
        <Select value={filterResource} onValueChange={setFilterResource}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Resource" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            {resources.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {APPROVAL_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Bulk actions */}
      {canBulkEdit && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))} disabled={bulkApproveMutation.isPending}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Deselect All
          </Button>
        </div>
      )}

      <Tabs value={view} onValueChange={(v) => setView(v as "daily" | "weekly")} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="daily">Daily View</TabsTrigger>
            <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          </TabsList>

          {view === "daily" ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-28 text-center">{format(currentMonth, "MMMM yyyy")}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-44 text-center">
                {format(weekDays[0], "MMM d")} – {format(weekDays[4], "MMM d, yyyy")}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* DAILY VIEW */}
        <TabsContent value="daily">
          <div className="data-table-container">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {canBulkEdit && (
                    <TableHead className="w-10">
                      <Checkbox checked={filtered.length > 0 && selectedIds.size === filtered.length} onCheckedChange={toggleAll} />
                    </TableHead>
                  )}
                  <TableHead>Date</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Billable</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={canBulkEdit ? 12 : (canEdit ? 11 : 10)} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={canBulkEdit ? 12 : (canEdit ? 11 : 10)} className="text-center py-8 text-muted-foreground">No time entries found.</TableCell></TableRow>
                ) : (
                  filtered.map((t: any) => {
                    const cost = Number(t.hours || 0) * Number(t.cost_rate || 0);
                    const rev = t.is_billable ? Number(t.hours || 0) * Number(t.bill_rate || 0) : 0;
                    return (
                      <TableRow key={t.id} className="border-border hover:bg-muted/50">
                        {canBulkEdit && (
                          <TableCell>
                            <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                          </TableCell>
                        )}
                        <TableCell className="text-sm">{t.entry_date}</TableCell>
                        <TableCell className="font-medium">{(t.resources as any)?.display_name || "—"}</TableCell>
                        <TableCell>{(t.projects as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{(t.project_phases as any)?.name || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{t.hours}</TableCell>
                        <TableCell className="text-right">{fmt(cost)}</TableCell>
                        <TableCell className="text-right">{fmt(rev)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{t.is_billable ? "Yes" : "No"}</Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={approvalStatusMap[t.approval_status] || "pending"} />
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(t)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(t)}>
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
          </div>
        </TabsContent>

        {/* WEEKLY VIEW */}
        <TabsContent value="weekly">
          <div className="data-table-container">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Resource</TableHead>
                  <TableHead>Project</TableHead>
                  {weekDays.map((d) => (
                    <TableHead key={d.toISOString()} className="text-center w-16">
                      <div className="text-xs">{format(d, "EEE")}</div>
                      <div className="text-xs text-muted-foreground">{format(d, "d")}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-medium">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyGrouped.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No time entries this week.</TableCell></TableRow>
                ) : (
                  weeklyGrouped.map((row) => (
                    <TableRow key={`${row.resourceId}::${row.projectId}`} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium">{row.resourceName}</TableCell>
                      <TableCell>{row.projectName}</TableCell>
                      {weekDays.map((d) => {
                        const dayStr = format(d, "yyyy-MM-dd");
                        const dayData = row.days[dayStr];
                        return (
                          <TableCell key={dayStr} className="text-center">
                            {dayData ? (
                              <span className="text-sm font-medium">{dayData.total}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-semibold">{row.weekTotal}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <TimeEntryFormDialog open={showCreate} onOpenChange={setShowCreate} entry={null} resources={resources} projects={projects} phases={phases} />
      <TimeEntryFormDialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} entry={editing} resources={resources} projects={projects} phases={phases} />
      <DeleteConfirmDialog
        open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Delete Time Entry" description="Are you sure you want to delete this time entry?"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
