import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canEditModule } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PhaseFormDialog } from "@/components/phases/PhaseFormDialog";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const phaseStatusMap: Record<string, any> = {
  planned: "draft", active: "active", completed: "completed", on_hold: "on-hold",
};

export default function Phases() {
  const { roles } = useAuth();
  const canEdit = canEditModule(roles, "phases");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingPhase, setEditingPhase] = useState<any>(null);
  const [deletingPhase, setDeletingPhase] = useState<any>(null);

  const { data: phases = [], isLoading } = useQuery({
    queryKey: ["all-phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("*, projects(name, id)")
        .is("deleted_at", null)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_phases")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-phases"] });
      toast.success("Phase deleted");
      setDeletingPhase(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = phases.filter((p: any) => {
    const q = search.toLowerCase();
    return [p.name, (p.projects as any)?.name].filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
  });

  const fmt = (n: number | null | undefined) => n != null ? `$${Number(n).toLocaleString()}` : "—";

  return (
    <div className="page-container">
      <PageHeader title="Project Phases" description="Track milestones and phase-level budgets" />
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search phases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-56" />
        </div>
      </div>
      <div className="data-table-container">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Phase</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead className="text-right">Plan Hrs</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">No phases found.</TableCell></TableRow>
            ) : (
              filtered.map((phase: any) => (
                <TableRow key={phase.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium">{phase.name}</TableCell>
                  <TableCell>
                    <button onClick={() => navigate(`/projects/${(phase.projects as any)?.id}`)} className="hover:text-primary hover:underline transition-colors">
                      {(phase.projects as any)?.name || "—"}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{phase.start_date || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{phase.end_date || "—"}</TableCell>
                  <TableCell className="text-right">{phase.budget_hours != null ? `${phase.budget_hours} hrs` : "—"}</TableCell>
                  <TableCell className="text-right">{fmt(phase.budget_amount)}</TableCell>
                  <TableCell><StatusBadge status={phaseStatusMap[phase.status] || "draft"} /></TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingPhase && (
        <PhaseFormDialog
          open={!!editingPhase}
          onOpenChange={(open) => { if (!open) setEditingPhase(null); }}
          phase={editingPhase}
          projectId={editingPhase.project_id}
        />
      )}

      <DeleteConfirmDialog
        open={!!deletingPhase}
        onOpenChange={(open) => { if (!open) setDeletingPhase(null); }}
        onConfirm={() => deletingPhase && deleteMutation.mutate(deletingPhase.id)}
        title="Delete Phase"
        description={`Are you sure you want to delete "${deletingPhase?.name}"?`}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
