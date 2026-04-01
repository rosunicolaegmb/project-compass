import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Users, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { canEditModule } from "@/lib/auth-helpers";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { exportToCsv } from "@/lib/csv-export";
import { toast } from "sonner";

export default function Clients() {
  const { roles } = useAuth();
  const canEdit = canEditModule(roles, "clients");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingClient, setEditingClient] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingClient, setDeletingClient] = useState<any>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, projects(id, total_budget)")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client deleted successfully");
      setDeletingClient(null);
    },
    onError: (err: Error) => toast.error(`Failed to delete client: ${err.message}`),
  });

  const filtered = clients.filter((c: any) =>
    [c.name, c.code, c.contact_name, c.contact_email]
      .filter(Boolean)
      .some((v: string) => v.toLowerCase().includes(search.toLowerCase()))
  );

  const fmtCurrency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const handleExport = () => {
    const rows = filtered.map((c: any) => {
      const projectCount = c.projects?.length ?? 0;
      const portfolio = c.projects?.reduce((s: number, p: any) => s + (p.total_budget || 0), 0) ?? 0;
      return [c.name, c.code || "", c.contact_name || "", c.contact_email || "", projectCount, portfolio, c.is_active ? "Active" : "Inactive"];
    });
    exportToCsv("clients.csv", ["Name", "Code", "Contact", "Email", "Projects", "Portfolio Value", "Status"], rows);
    toast.success("Exported clients to CSV");
  };

  const colCount = canEdit ? 8 : 7;

  return (
    <div className="page-container">
      <PageHeader
        title="Clients"
        description="Manage client accounts and relationships"
        actions={
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />Export
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />Add Client
              </Button>
            )}
          </div>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Client Name</TableHead>
              <TableHead className="hidden sm:table-cell">Code</TableHead>
              <TableHead className="hidden md:table-cell">Primary Contact</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="text-center">Projects</TableHead>
              <TableHead className="text-right">Portfolio Value</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={colCount} rows={6} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount}>
                  <EmptyState
                    icon={Users}
                    title={search ? "No clients match your search" : "No clients yet"}
                    description={search ? "Try adjusting your search terms" : "Add your first client to get started tracking projects and revenue."}
                    action={canEdit && !search ? (
                      <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                        <Plus className="h-4 w-4 mr-1" />Add Client
                      </Button>
                    ) : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client: any) => {
                const projectCount = client.projects?.length ?? 0;
                const portfolioValue = client.projects?.reduce(
                  (sum: number, p: any) => sum + (p.total_budget || 0), 0
                ) ?? 0;
                return (
                  <TableRow key={client.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">{client.code || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{client.contact_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">{client.contact_email || "—"}</TableCell>
                    <TableCell className="text-center">{projectCount}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {fmtCurrency(portfolioValue)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={client.is_active ? "active" : "archived"} />
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingClient(client)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingClient(client)}>
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

      <ClientFormDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} client={null} />
      <ClientFormDialog open={!!editingClient} onOpenChange={(open) => { if (!open) setEditingClient(null); }} client={editingClient} />
      <DeleteConfirmDialog
        open={!!deletingClient}
        onOpenChange={(open) => { if (!open) setDeletingClient(null); }}
        onConfirm={() => deletingClient && deleteMutation.mutate(deletingClient.id)}
        title="Delete Client"
        description={`Are you sure you want to delete "${deletingClient?.name}"? This action uses soft delete and can be reversed.`}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
