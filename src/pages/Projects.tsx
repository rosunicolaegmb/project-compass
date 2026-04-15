import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, X, FolderKanban, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { canEditModule } from "@/lib/auth-helpers";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { saveFilters, loadFilters } from "@/lib/filters";
import { exportToCsv } from "@/lib/csv-export";
import { toast } from "sonner";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  time_and_materials: "T&M",
  fixed_price: "Fixed Price",
  support: "Support",
};
const STATUS_OPTIONS = ["draft", "active", "on_hold", "completed", "archived", "cancelled"];
const PAGE_KEY = "projects";

export default function Projects() {
  const { roles } = useAuth();
  const canEdit = canEditModule(roles, "projects");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const saved = loadFilters(PAGE_KEY);
  const [search, setSearch] = useState(saved.search || "");
  const [filterClient, setFilterClient] = useState(saved.client || "all");
  const [filterType, setFilterType] = useState(saved.type || "all");
  const [filterStatus, setFilterStatus] = useState(saved.status || "all");
  const [filterPM, setFilterPM] = useState(saved.pm || "all");
  const [editingProject, setEditingProject] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingProject, setDeletingProject] = useState<any>(null);

  useEffect(() => {
    saveFilters(PAGE_KEY, { search, client: filterClient, type: filterType, status: filterStatus, pm: filterPM });
  }, [search, filterClient, filterType, filterStatus, filterPM]);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(name), resources!projects_pm_resource_id_fkey(display_name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").is("deleted_at", null).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["resources-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("id, display_name").is("deleted_at", null).eq("is_active", true).order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").update({ deleted_at: new Date().toISOString(), is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted successfully");
      setDeletingProject(null);
    },
    onError: (err: Error) => toast.error(`Failed to delete project: ${err.message}`),
  });

  const filtered = projects.filter((p: any) => {
    const matchesSearch = [p.name, p.code, (p.clients as any)?.name]
      .filter(Boolean).some((v: string) => v.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch
      && (filterClient === "all" || p.client_id === filterClient)
      && (filterType === "all" || p.project_type === filterType)
      && (filterStatus === "all" || p.status === filterStatus)
      && (filterPM === "all" || p.pm_resource_id === filterPM);
  });

  const hasFilters = filterClient !== "all" || filterType !== "all" || filterStatus !== "all" || filterPM !== "all";
  const clearFilters = () => { setFilterClient("all"); setFilterType("all"); setFilterStatus("all"); setFilterPM("all"); };

  const fmtCurrency = (n: number | null) => n != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n) : "—";

  const handleExport = () => {
    const rows = filtered.map((p: any) => [
      p.name, (p.clients as any)?.name || "", p.code || "",
      PROJECT_TYPE_LABELS[p.project_type] || p.project_type,
      (p.resources as any)?.display_name || "", p.start_date || "", p.end_date || "",
      p.total_budget || 0, p.status,
    ]);
    exportToCsv("projects.csv", ["Project", "Client", "Code", "Type", "PM", "Start", "End", "Budget", "Status"], rows);
    toast.success("Exported projects to CSV");
  };

  const colCount = canEdit ? 9 : 8;
  const statusMap: Record<string, any> = {
    draft: "draft", active: "active", on_hold: "on-hold",
    completed: "completed", archived: "archived", cancelled: "at-risk",
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Projects"
        description="Manage project budgets, scope, and delivery"
        actions={
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />Export
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />New Project
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-56" />
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="time_and_materials">T&M</SelectItem>
            <SelectItem value="fixed_price">Fixed Price</SelectItem>
            <SelectItem value="support">Support</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPM} onValueChange={setFilterPM}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="PM" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All PMs</SelectItem>
            {resources.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
            <X className="h-3 w-3 mr-1" />Clear
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Project</TableHead>
              <TableHead className="hidden sm:table-cell">Client</TableHead>
              <TableHead className="hidden lg:table-cell">Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden md:table-cell">PM</TableHead>
              <TableHead className="hidden lg:table-cell">Dates</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={colCount} rows={8} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount}>
                  <EmptyState
                    icon={FolderKanban}
                    title={search || hasFilters ? "No projects match your filters" : "No projects yet"}
                    description={search || hasFilters ? "Try adjusting your search or filter criteria" : "Create your first project to begin tracking budgets and timelines."}
                    action={canEdit && !search && !hasFilters ? (
                      <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                        <Plus className="h-4 w-4 mr-1" />New Project
                      </Button>
                    ) : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((project: any) => {
                const clientName = (project.clients as any)?.name || "—";
                const pmName = (project.resources as any)?.display_name || "—";
                const dates = [project.start_date, project.end_date].filter(Boolean).join(" → ") || "—";
                return (
                  <TableRow key={project.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <button onClick={() => navigate(`/projects/${project.id}`)} className="text-left hover:text-primary hover:underline transition-colors">
                        {project.name}
                      </button>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{clientName}</TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">{project.code || "—"}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">
                        {PROJECT_TYPE_LABELS[project.project_type] || project.project_type}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{pmName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden lg:table-cell whitespace-nowrap">{dates}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{fmtCurrency(project.total_budget)}</TableCell>
                    <TableCell><StatusBadge status={statusMap[project.status] || "draft"} /></TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingProject(project)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingProject(project)}>
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

      <ProjectFormDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} project={null} clients={clients} resources={resources} />
      <ProjectFormDialog open={!!editingProject} onOpenChange={(open) => { if (!open) setEditingProject(null); }} project={editingProject} clients={clients} resources={resources} />
      <DeleteConfirmDialog
        open={!!deletingProject}
        onOpenChange={(open) => { if (!open) setDeletingProject(null); }}
        onConfirm={() => deletingProject && deleteMutation.mutate(deletingProject.id)}
        title="Delete Project"
        description={`Are you sure you want to delete "${deletingProject?.name}"? This uses soft delete.`}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
