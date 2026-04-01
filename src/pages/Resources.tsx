import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canEditModule } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResourceFormDialog } from "@/components/resources/ResourceFormDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full Time", part_time: "Part Time", contractor: "Contractor", vendor: "Vendor",
};

export default function Resources() {
  const { roles } = useAuth();
  const canEdit = canEditModule(roles, "resources");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*, delivery_roles(name)")
        .is("deleted_at", null)
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: deliveryRoles = [] } = useQuery({
    queryKey: ["delivery-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_roles")
        .select("*")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("resources")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Resource deleted");
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = resources.filter((r: any) => {
    const q = search.toLowerCase();
    return [r.display_name, r.email, r.department, r.job_title, (r.delivery_roles as any)?.name]
      .filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
  });

  const fmt = (n: number | null | undefined) => n != null ? `$${Number(n).toLocaleString()}/hr` : "—";

  return (
    <div className="page-container">
      <PageHeader
        title="Resources"
        description="Manage team members, roles, and allocation"
        actions={canEdit ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Resource
          </Button>
        ) : undefined}
      />

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search resources..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-56" />
        </div>
      </div>

      <div className="data-table-container">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Cost Rate</TableHead>
              <TableHead className="text-right">Bill Rate</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8 text-muted-foreground">No resources found.</TableCell></TableRow>
            ) : (
              filtered.map((r: any) => (
                <TableRow key={r.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium">{r.display_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email || "—"}</TableCell>
                  <TableCell>{(r.delivery_roles as any)?.name || "—"}</TableCell>
                  <TableCell>{r.department || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {EMPLOYMENT_LABELS[r.employment_type] || r.employment_type || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{fmt(r.default_cost_rate)}</TableCell>
                  <TableCell className="text-right">{fmt(r.default_bill_rate)}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.is_active ? "active" : "archived"} />
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(r)}>
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

      <ResourceFormDialog open={showCreate} onOpenChange={setShowCreate} resource={null} deliveryRoles={deliveryRoles} />
      <ResourceFormDialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} resource={editing} deliveryRoles={deliveryRoles} />
      <DeleteConfirmDialog
        open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Delete Resource" description={`Delete "${deleting?.display_name}"? This uses soft delete.`}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
