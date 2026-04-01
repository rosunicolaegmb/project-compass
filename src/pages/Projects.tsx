import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { canEditModule } from "@/lib/auth-helpers";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { toast } from "sonner";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  time_and_materials: "T&M",
  fixed_price: "Fixed Price",
};

const STATUS_OPTIONS = ["draft", "active", "on_hold", "completed", "archived", "cancelled"];

export default function Projects() {
  const { roles } = useAuth();
  const canEdit = canEditModule(roles, "projects");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPM, setFilterPM] = useState<string>("all");
  const [editingProject, setEditingProject] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingProject, setDeletingProject] = useState<any>(null);

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
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["resources-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, display_name")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      setDeletingProject(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = projects.filter((p: any) => {
    const matchesSearch = [p.name, p.code, (p.clients as any)?.name]
      .filter(Boolean)
      .some((v: string) => v.toLowerCase().includes(search.toLowerCase()));
    const matchesClient = filterClient === "all" || p.client_id === filterClient;
    const matchesType = filterType === "all" || p.project_type === filterType;
    const matchesStatus = filterStatus === "all" || p.status === filterStatus;
    const matchesPM = filterPM === "all" || p.pm_resource_id === filterPM;
    return matchesSearch && matchesClient && matchesType && matchesStatus && matchesPM;
  });

  const hasFilters = filterClient !== "all" || filterType !== "all" || filterStatus !== "all" || filterPM !== "all";

  const clearFilters = () => {
    setFilterClient("all");
    setFilterType("all");
    setFilterStatus("all");
    setFilterPM("all");
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Projects"
        description="Manage project budgets, scope, and delivery"
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />New Project
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 w-56"
          />
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

      <div className="data-table-container">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>PM</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8 text-muted-foreground">
                  {search || hasFilters ? "No projects match your filters." : "No projects yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((project: any) => {
                const clientName = (project.clients as any)?.name || "—";
                const pmName = (project.resources as any)?.display_name || "—";
                const dates = [project.start_date, project.end_date].filter(Boolean).join(" → ") || "—";
                const budget = project.total_budget != null ? `$${Number(project.total_budget).toLocaleString()}` : "—";
                const statusMap: Record<string, any> = {
                  draft: "draft", active: "active", on_hold: "on-hold",
                  completed: "completed", archived: "archived", cancelled: "at-risk",
                };
                return (
                  <TableRow key={project.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{clientName}</TableCell>
                    <TableCell className="text-muted-foreground">{project.code || "—"}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {PROJECT_TYPE_LABELS[project.project_type] || project.project_type}
                      </span>
                    </TableCell>
                    <TableCell>{pmName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{dates}</TableCell>
                    <TableCell className="text-right font-medium">{budget}</TableCell>
                    <TableCell>
                      <StatusBadge status={statusMap[project.status] || "draft"} />
                    </TableCell>
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

      <ProjectFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        project={null}
        clients={clients}
        resources={resources}
      />

      <ProjectFormDialog
        open={!!editingProject}
        onOpenChange={(open) => { if (!open) setEditingProject(null); }}
        project={editingProject}
        clients={clients}
        resources={resources}
      />

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
