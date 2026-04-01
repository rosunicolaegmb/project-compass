import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";

const projectSchema = z.object({
  client_id: z.string().uuid("Select a client"),
  name: z.string().trim().min(1, "Project name is required").max(200),
  code: z.string().trim().max(20).optional().or(z.literal("")),
  project_type: z.enum(["time_and_materials", "fixed_price"]),
  status: z.enum(["draft", "active", "on_hold", "completed", "archived", "cancelled", "sow_expired"]),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  end_date: z.string().optional().or(z.literal("")),
  total_budget: z.string().optional().or(z.literal("")),
  planned_budget: z.string().optional().or(z.literal("")),
  currency: z.string().min(1).max(5),
  pm_resource_id: z.string().optional().or(z.literal("")),
  revenue_model: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  default_bill_rate: z.string().optional().or(z.literal("")),
  default_cost_rate: z.string().optional().or(z.literal("")),
});

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any | null;
  clients: any[];
  resources: any[];
}

const EMPTY_FORM = {
  client_id: "", name: "", code: "", project_type: "time_and_materials" as const,
  status: "draft" as const, description: "", start_date: "", end_date: "",
  total_budget: "", planned_budget: "", currency: "USD",
  pm_resource_id: "", revenue_model: "", notes: "",
  default_bill_rate: "", default_cost_rate: "",
};

export function ProjectFormDialog({ open, onOpenChange, project, clients, resources }: ProjectFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!project;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (project) {
      setForm({
        client_id: project.client_id || "",
        name: project.name || "",
        code: project.code || "",
        project_type: project.project_type || "time_and_materials",
        status: project.status || "draft",
        description: project.description || "",
        start_date: project.start_date || "",
        end_date: project.end_date || "",
        total_budget: project.total_budget != null ? String(project.total_budget) : "",
        planned_budget: project.planned_budget != null ? String(project.planned_budget) : "",
        revised_budget: project.revised_budget != null ? String(project.revised_budget) : "",
        currency: project.currency || "USD",
        pm_resource_id: project.pm_resource_id || "",
        revenue_model: project.revenue_model || "",
        notes: project.notes || "",
        default_bill_rate: project.default_bill_rate != null ? String(project.default_bill_rate) : "",
        default_cost_rate: project.default_cost_rate != null ? String(project.default_cost_rate) : "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [project, open]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof projectSchema>) => {
      const payload: any = {
        client_id: values.client_id,
        name: values.name,
        code: values.code || null,
        project_type: values.project_type,
        status: values.status,
        description: values.description || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        total_budget: values.total_budget ? parseFloat(values.total_budget) : null,
        planned_budget: values.planned_budget ? parseFloat(values.planned_budget) : null,
        revised_budget: values.revised_budget ? parseFloat(values.revised_budget) : null,
        currency: values.currency,
        pm_resource_id: values.pm_resource_id || null,
        revenue_model: values.revenue_model || null,
        notes: values.notes || null,
        default_bill_rate: values.default_bill_rate ? parseFloat(values.default_bill_rate) : null,
        default_cost_rate: values.default_cost_rate ? parseFloat(values.default_cost_rate) : null,
      };

      if (isEditing) {
        const { error } = await supabase.from("projects").update(payload).eq("id", project.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(isEditing ? "Project updated" : "Project created");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = projectSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    mutation.mutate(result.data);
  };

  const update = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Client + Project Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={form.client_id} onValueChange={(v) => update("client_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.client_id && <p className="text-xs text-destructive">{errors.client_id}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Project Name *</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
          </div>

          {/* Row 2: Code + Type + Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Project Code</Label>
              <Input value={form.code} onChange={(e) => update("code", e.target.value)} placeholder="e.g., PRJ-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Project Type *</Label>
              <Select value={form.project_type} onValueChange={(v) => update("project_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_and_materials">T&M</SelectItem>
                  <SelectItem value="fixed_price">Fixed Price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: PM + Currency + Revenue Model */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>PM Owner</Label>
              <Select value={form.pm_resource_id || "__none__"} onValueChange={(v) => update("pm_resource_id", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select PM" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {resources.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => update("currency", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Revenue Model</Label>
              <Input value={form.revenue_model} onChange={(e) => update("revenue_model", e.target.value)} placeholder="e.g., Hourly, Milestone" />
            </div>
          </div>

          {/* Row 4: Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
            </div>
          </div>

          {/* Row 5: Budgets */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Total Contract Value</Label>
              <Input type="number" step="0.01" value={form.total_budget} onChange={(e) => update("total_budget", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Planned Budget</Label>
              <Input type="number" step="0.01" value={form.planned_budget} onChange={(e) => update("planned_budget", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Revised Budget</Label>
              <Input type="number" step="0.01" value={form.revised_budget} onChange={(e) => update("revised_budget", e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {/* Row 6: Default Rates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Default Bill Rate ($/hr)</Label>
              <Input type="number" step="0.01" value={form.default_bill_rate} onChange={(e) => update("default_bill_rate", e.target.value)} placeholder="Inherit from resource" />
              <p className="text-xs text-muted-foreground">Applies to all members unless individually overridden</p>
            </div>
            <div className="space-y-1.5">
              <Label>Default Cost Rate ($/hr)</Label>
              <Input type="number" step="0.01" value={form.default_cost_rate} onChange={(e) => update("default_cost_rate", e.target.value)} placeholder="Inherit from resource" />
              <p className="text-xs text-muted-foreground">Rate hierarchy: Member → Project → Resource</p>
            </div>
          </div>
          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
