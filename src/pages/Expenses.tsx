import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Plus, Pencil, Trash2, Search, DollarSign, Receipt, Clock, TrendingUp, Download } from "lucide-react";
import { saveFilters, loadFilters } from "@/lib/filters";
import { exportToCsv } from "@/lib/csv-export";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { toEur, fmtEur, loadConversionRates } from "@/lib/currency";

const CATEGORY_LABELS: Record<string, string> = {
  travel: "Travel", software: "Software", equipment: "Equipment",
  cloud_services: "Cloud Services", training: "Training", meals: "Meals",
  subcontractor: "Subcontractor", operational: "Operational", hardware: "Hardware", other: "Other",
};

export default function Expenses() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("office_admin");
  const queryClient = useQueryClient();

  const saved = loadFilters("expenses");
  const [search, setSearch] = useState(saved.search || "");
  const [filterProject, setFilterProject] = useState(saved.project || "all");
  const [filterCategory, setFilterCategory] = useState(saved.category || "all");
  const [filterStatus, setFilterStatus] = useState(saved.status || "all");
  const [filterMonth, setFilterMonth] = useState(saved.month || "");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  useEffect(() => { loadConversionRates(); }, []);

  useEffect(() => {
    saveFilters("expenses", { search, project: filterProject, category: filterCategory, status: filterStatus, month: filterMonth });
  }, [search, filterProject, filterCategory, filterStatus, filterMonth]);

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
    const total = filtered.reduce((s: number, e: any) => s + toEur(Number(e.amount || 0), e.currency || "EUR", e.expense_date), 0);
    const pending = filtered.filter((e: any) => e.approval_status === "pending");
    const pendingAmt = pending.reduce((s: number, e: any) => s + toEur(Number(e.amount || 0), e.currency || "EUR", e.expense_date), 0);
    const billable = filtered.filter((e: any) => e.is_billable)
      .reduce((s: number, e: any) => s + toEur(Number(e.amount || 0), e.currency || "EUR", e.expense_date), 0);
    return { total, pendingCount: pending.length, pendingAmt, billable };
  }, [filtered]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expense-entries"] }); toast.success("Expense deleted successfully"); setDeleteTarget(null); },
    onError: (err: Error) => toast.error(`Failed to delete expense: ${err.message}`),
  });

  const fmtRowAmount = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "EUR", maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${(currency || "EUR")} ${amount.toFixed(2)}`;
    }
  };

  const handleExport = () => {
    const rows = filtered.map((e: any) => [
      e.expense_date, e.resources?.display_name || "", e.projects?.name || "",
      CATEGORY_LABELS[e.category] || e.category, e.description || "", e.amount, e.approval_status,
    ]);
    exportToCsv("expenses.csv", ["Date", "Submitted By", "Project", "Category", "Description", "Amount", "Status"], rows);
    toast.success("Exported expenses to CSV");
  };

  const colCount = canEdit ? 8 : 7;

  return (
    <div className="page-container">
      <PageHeader title="Expenses" description="Track and approve project expenses"
        actions={
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />Export
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />Add Expense
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Expenses" value={fmtEur(stats.total)} icon={DollarSign} />
        <StatCard title="Pending Approval" value={`${stats.pendingCount} (${fmtEur(stats.pendingAmt)})`} icon={Clock} />
        <StatCard title="Billable Expenses" value={fmtEur(stats.billable)} icon={Receipt} />
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

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="hidden sm:table-cell">Submitted By</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden lg:table-cell">Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={colCount} rows={6} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount}>
                  <EmptyState
                    icon={Receipt}
                    title="No expenses found"
                    description="Add your first expense or adjust filters to see data."
                    action={canEdit ? (
                      <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
                        <Plus className="h-4 w-4 mr-1" />Add Expense
                      </Button>
                    ) : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : filtered.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">{format(new Date(e.expense_date), "MMM dd, yyyy")}</TableCell>
                <TableCell className="hidden sm:table-cell">{e.resources?.display_name || "—"}</TableCell>
                <TableCell>{e.projects?.name || "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{CATEGORY_LABELS[e.category] || e.category}</TableCell>
                <TableCell className="max-w-[200px] truncate hidden lg:table-cell">{e.description || "—"}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{fmtRowAmount(Number(e.amount), e.currency || "EUR")}</TableCell>
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
