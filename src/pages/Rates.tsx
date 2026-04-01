import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canEditModule } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RateHistoryFormDialog } from "@/components/rates/RateHistoryFormDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Rates() {
  const { roles } = useAuth();
  const canEdit = canEditModule(roles, "rates");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreateRate, setShowCreateRate] = useState(false);
  const [editingRate, setEditingRate] = useState<any>(null);
  const [deletingRate, setDeletingRate] = useState<any>(null);

  // Delivery roles
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

  // Resources list
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

  // Rate history
  const { data: rateHistory = [], isLoading: ratesLoading } = useQuery({
    queryKey: ["rate-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_rate_history")
        .select("*, resources(display_name), delivery_roles(name)")
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Resource count per delivery role
  const { data: allResources = [] } = useQuery({
    queryKey: ["resources-for-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("delivery_role_id")
        .is("deleted_at", null)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const deleteRateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resource_rate_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rate-history"] });
      toast.success("Rate entry deleted");
      setDeletingRate(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredRates = rateHistory.filter((r: any) => {
    const q = search.toLowerCase();
    return [(r.resources as any)?.display_name, (r.delivery_roles as any)?.name, r.reason]
      .filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
  });

  const fmt = (n: number | null | undefined) => n != null ? `$${Number(n).toLocaleString()}` : "—";

  const roleHeadcount = (roleId: string) =>
    allResources.filter((r: any) => r.delivery_role_id === roleId).length;

  return (
    <div className="page-container">
      <PageHeader
        title="Delivery Roles & Rates"
        description="Manage billing rates, internal costs, and rate history"
        actions={canEdit ? (
          <Button size="sm" onClick={() => setShowCreateRate(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Rate Entry
          </Button>
        ) : undefined}
      />

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">Delivery Roles ({deliveryRoles.length})</TabsTrigger>
          <TabsTrigger value="history">Rate History ({rateHistory.length})</TabsTrigger>
        </TabsList>

        {/* DELIVERY ROLES TAB */}
        <TabsContent value="roles">
          <div className="data-table-container">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Role</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Headcount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryRoles.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No delivery roles.</TableCell></TableRow>
                ) : (
                  deliveryRoles.map((role: any) => (
                    <TableRow key={role.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>
                        {role.level ? (
                          <Badge variant="outline" className="text-xs capitalize">{role.level}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{role.description || "—"}</TableCell>
                      <TableCell className="text-center">{roleHeadcount(role.id)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* RATE HISTORY TAB */}
        <TabsContent value="history">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search rate history..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-56" />
            </div>
          </div>
          <div className="data-table-container">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Resource</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Cost Rate</TableHead>
                  <TableHead className="text-right">Bill Rate</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>Reason</TableHead>
                  {canEdit && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratesLoading ? (
                  <TableRow><TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredRates.length === 0 ? (
                  <TableRow><TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8 text-muted-foreground">No rate history found.</TableCell></TableRow>
                ) : (
                  filteredRates.map((r: any) => {
                    const cost = Number(r.cost_rate || 0);
                    const bill = Number(r.bill_rate || 0);
                    const margin = bill > 0 ? ((bill - cost) / bill * 100).toFixed(1) + "%" : "—";
                    return (
                      <TableRow key={r.id} className="border-border hover:bg-muted/50">
                        <TableCell className="font-medium">{(r.resources as any)?.display_name || "—"}</TableCell>
                        <TableCell>{(r.delivery_roles as any)?.name || "—"}</TableCell>
                        <TableCell className="text-right">{fmt(cost)}/hr</TableCell>
                        <TableCell className="text-right">{fmt(bill)}/hr</TableCell>
                        <TableCell className="text-right">{margin}</TableCell>
                        <TableCell>{r.effective_from}</TableCell>
                        <TableCell>{r.effective_to || <span className="text-muted-foreground">Current</span>}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">{r.reason || "—"}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRate(r)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingRate(r)}>
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
      </Tabs>

      <RateHistoryFormDialog open={showCreateRate} onOpenChange={setShowCreateRate} rateEntry={null} resources={resources} deliveryRoles={deliveryRoles} />
      <RateHistoryFormDialog open={!!editingRate} onOpenChange={(o) => { if (!o) setEditingRate(null); }} rateEntry={editingRate} resources={resources} deliveryRoles={deliveryRoles} />
      <DeleteConfirmDialog
        open={!!deletingRate} onOpenChange={(o) => { if (!o) setDeletingRate(null); }}
        onConfirm={() => deletingRate && deleteRateMutation.mutate(deletingRate.id)}
        title="Delete Rate Entry" description="Are you sure? This permanently removes the historical rate record."
        loading={deleteRateMutation.isPending}
      />
    </div>
  );
}
