import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Plus, Pencil, Trash2, Search, DollarSign, Receipt, Clock, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORY_LABELS: Record<string, string> = {
  travel: "Travel", software: "Software", equipment: "Equipment",
  cloud_services: "Cloud Services", training: "Training", meals: "Meals",
  subcontractor: "Subcontractor", operational: "Operational", hardware: "Hardware", other: "Other",
};

export default function Expenses() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("office_admin");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expense-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_entries")
        .select("*, resources(display_name), projects(name), project_phases(name)")
        .is("deleted_at", null)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("id, display_name").eq("is_active", true).is("deleted_at", null).order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").eq("is_active", true).is("deleted_at", null).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["phases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_phases").select("id, name, project_id").is("deleted_at", null).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return expenses.filter((e: any) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (e.resources?.display_name || "").toLowerCase().includes(q)
        || (e.projects?.name || "").toLowerCase().includes(q)
        || (e.description || "").toLowerCase().includes(q);
      const matchProject = filterProject === "all" || e.project_id === filterProject;
      const matchCategory = filterCategory === "all" || e.category === filterCategory;
      const matchStatus = filterStatus === "all" || e.approval_status === filterStatus;
      const matchMonth = !filterMonth || e.expense_date?.startsWith(filterMonth);
      return matchSearch && matchProject && matchCategory && matchStatus && matchMonth;
    });
  }, [expenses, search, filterProject, filterCategory, filterStatus, filterMonth]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const pending = filtered.filter((e: any) => e.approval_status === "pending");
    const pendingAmt = pending.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const billable = filtered.filter((e: any) => e.is_billable).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    return { total, pendingCount: pending.length, pendingAmt, billable };
  }, [filtered]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expense-entries"] }); toast.success("Expense deleted"); setDeleteTarget(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="page-container">
      <PageHeader title="Expenses" description="Track and approve project expenses"
        actions={canEdit ? <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add Expense</Button> : undefined} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Expenses" value={fmt(stats.total)} icon={DollarSign} />
        <StatCard title="Pending Approval" value={`${stats.pendingCount} (${fmt(stats.pendingAmt)})`} icon={Clock} />
        <StatCard title="Billable Expenses" value={fmt(stats.billable)} icon={Receipt} />
        <StatCard title="Entries" value={String(filtered.length)} icon={TrendingUp} />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-[160px]" />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">No expenses found</TableCell></TableRow>
            ) : filtered.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">{format(new Date(e.expense_date), "MMM dd, yyyy")}</TableCell>
                <TableCell>{e.resources?.display_name || "—"}</TableCell>
                <TableCell>{e.projects?.name || "—"}</TableCell>
                <TableCell>{CATEGORY_LABELS[e.category] || e.category}</TableCell>
                <TableCell className="max-w-[200px] truncate">{e.description || "—"}</TableCell>
                <TableCell className="text-right font-medium">{fmt(Number(e.amount))}</TableCell>
                <TableCell><StatusBadge status={e.approval_status === "rejected" ? "at-risk" : e.approval_status} /></TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(e); setFormOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(e)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} entry={editing} resources={resources} projects={projects} phases={phases} />
      <DeleteConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Expense" description="This will soft-delete the expense entry." loading={deleteMutation.isPending} />
    </div>
  );
}
