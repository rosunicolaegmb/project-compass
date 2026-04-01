import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResourceFormDialog } from "@/components/resources/ResourceFormDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, UserCircle, Download, Mail, Copy, Check } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
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
  const [inviting, setInviting] = useState<any>(null);
  const [signupLink, setSignupLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("*, delivery_roles(name)").is("deleted_at", null).order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: deliveryRoles = [] } = useQuery({
    queryKey: ["delivery-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_roles").select("*").is("deleted_at", null).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resources").update({ deleted_at: new Date().toISOString(), is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Resource deleted successfully");
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(`Failed to delete resource: ${err.message}`),
  });

  const inviteMutation = useMutation({
    mutationFn: async (resource: any) => {
      const { data, error } = await supabase.functions.invoke("invite-resource", {
        body: {
          resource_id: resource.id,
          redirect_url: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      setInviting(null);
      setSignupLink(data.signup_link);
      setCopied(false);
    },
    onError: (err: Error) => {
      toast.error(`Failed to generate invite link: ${err.message}`);
      setInviting(null);
    },
  });

  const handleCopyLink = async () => {
    if (!signupLink) return;
    await navigator.clipboard.writeText(signupLink);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = resources.filter((r: any) => {
    const q = search.toLowerCase();
    return [r.display_name, r.email, r.department, r.job_title, (r.delivery_roles as any)?.name]
      .filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
  });

  const fmtRate = (n: number | null | undefined) => n != null ? `$${Number(n).toLocaleString()}/hr` : "—";
  const fmtMonthly = (n: number | null | undefined, currency = "$") => n != null ? `${currency}${Number(n).toLocaleString()}/mo` : "—";

  const getInvitationStatus = (r: any): "active" | "not_invited" | "invitation_sent" | "archived" => {
    if (!r.is_active) return "archived";
    if (r.invitation_status === "active") return "active";
    if (r.invitation_status === "invitation_sent") return "invitation_sent";
    return "not_invited";
  };

  const canInvite = (r: any) => {
    return canEdit && r.email && r.invitation_status !== "active" && r.is_active;
  };

  const handleExport = () => {
    const rows = filtered.map((r: any) => [
      r.display_name, r.email || "", (r.delivery_roles as any)?.name || "",
      r.department || "", EMPLOYMENT_LABELS[r.employment_type] || "",
      r.employment_type === "full_time" ? (r.monthly_cost || "") : (r.default_cost_rate || ""),
      r.default_bill_rate || "",
      r.overhead_cost_eur || "",
      getInvitationStatus(r),
    ]);
    exportToCsv("resources.csv", ["Name", "Email", "Role", "Department", "Type", "Cost", "Bill Rate", "Overhead (EUR)", "Status"], rows);
    toast.success("Exported resources to CSV");
  };

  const colCount = canEdit ? 10 : 9;

  return (
    <div className="page-container">
      <PageHeader
        title="Resources"
        description="Manage team members, roles, and allocation"
        actions={
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />Export
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Resource
              </Button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search resources..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-56" />
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden lg:table-cell">Department</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Bill Rate</TableHead>
              <TableHead className="text-right hidden lg:table-cell">Overhead (€)</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-28">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={colCount} rows={6} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount}>
                  <EmptyState
                    icon={UserCircle}
                    title={search ? "No resources match your search" : "No resources yet"}
                    description={search ? "Try different search terms" : "Add team members to start assigning them to projects."}
                    action={canEdit && !search ? (
                      <Button size="sm" onClick={() => setShowCreate(true)}>
                        <Plus className="h-4 w-4 mr-1" />Add Resource
                      </Button>
                    ) : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r: any) => (
                <TableRow key={r.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium">{r.display_name}</TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">{r.email || "—"}</TableCell>
                  <TableCell>{(r.delivery_roles as any)?.name || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{r.department || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {EMPLOYMENT_LABELS[r.employment_type] || r.employment_type || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.employment_type === "full_time" ? fmtMonthly(r.monthly_cost) : fmtRate(r.default_cost_rate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtRate(r.default_bill_rate)}</TableCell>
                  <TableCell className="text-right tabular-nums hidden lg:table-cell">{fmtMonthly(r.overhead_cost_eur, "€")}</TableCell>
                  <TableCell><StatusBadge status={getInvitationStatus(r)} /></TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canInvite(r) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary"
                            title="Send invitation"
                            onClick={() => setInviting(r)}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                        )}
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

      {/* Invite Confirmation Dialog */}
      <AlertDialog open={!!inviting} onOpenChange={(o) => { if (!o) setInviting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invite {inviting?.display_name}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                A signup link will be generated for <strong>{inviting?.email}</strong> so they can
                join BudgetTrack and enter timesheets on their allocated projects.
              </p>
              <p className="text-xs text-muted-foreground">
                Copy the link and share it with the resource. Once they complete registration,
                they will automatically receive the Reporter role with access to Timesheets.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inviteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => inviting && inviteMutation.mutate(inviting)}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? "Generating..." : "Generate Invite Link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Signup Link Dialog */}
      <Dialog open={!!signupLink} onOpenChange={(o) => { if (!o) { setSignupLink(null); setCopied(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Link Ready</DialogTitle>
            <DialogDescription>
              Copy this link and send it to the resource. They'll be directed to the signup page with their details pre-filled.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input value={signupLink || ""} readOnly className="bg-muted text-xs font-mono" />
            <Button size="icon" variant="outline" onClick={handleCopyLink} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSignupLink(null); setCopied(false); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
