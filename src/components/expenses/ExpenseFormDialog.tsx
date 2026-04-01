import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  { value: "travel", label: "Travel" },
  { value: "software", label: "Software" },
  { value: "equipment", label: "Equipment" },
  { value: "cloud_services", label: "Cloud Services" },
  { value: "training", label: "Training" },
  { value: "meals", label: "Meals" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "operational", label: "Operational" },
  { value: "hardware", label: "Hardware" },
  { value: "other", label: "Other" },
] as const;

const schema = z.object({
  resource_id: z.string().min(1, "Resource is required"),
  project_id: z.string().min(1, "Project is required"),
  phase_id: z.string().optional(),
  expense_date: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Category is required"),
  amount: z.coerce.number().min(0.01, "Amount must be positive"),
  currency: z.string().default("USD"),
  is_billable: z.boolean().default(true),
  description: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any | null;
  resources: any[];
  projects: any[];
  phases: any[];
}

export function ExpenseFormDialog({ open, onOpenChange, entry, resources, projects, phases }: ExpenseFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!entry;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      resource_id: "", project_id: "", phase_id: "", expense_date: new Date().toISOString().split("T")[0],
      category: "other", amount: 0, currency: "USD", is_billable: true, description: "",
    },
  });

  const watchProjectId = form.watch("project_id");
  const filteredPhases = phases.filter((p: any) => p.project_id === watchProjectId);

  useEffect(() => {
    if (entry) {
      form.reset({
        resource_id: entry.resource_id || "",
        project_id: entry.project_id || "",
        phase_id: entry.phase_id || "",
        expense_date: entry.expense_date || "",
        category: entry.category || "other",
        amount: Number(entry.amount || 0),
        currency: entry.currency || "USD",
        is_billable: entry.is_billable ?? true,
        description: entry.description || "",
      });
    } else {
      form.reset({
        resource_id: "", project_id: "", phase_id: "",
        expense_date: new Date().toISOString().split("T")[0],
        category: "other", amount: 0, currency: "USD", is_billable: true, description: "",
      });
    }
  }, [entry, form, open]);

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      const payload: any = {
        resource_id: values.resource_id,
        project_id: values.project_id,
        phase_id: values.phase_id || null,
        expense_date: values.expense_date,
        category: values.category,
        amount: values.amount,
        currency: values.currency,
        is_billable: values.is_billable,
        description: values.description || null,
      };

      if (isEditing) {
        const { error } = await supabase.from("expense_entries").update(payload).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expense_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-entries"] });
      toast.success(isEditing ? "Expense updated" : "Expense created");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="resource_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Submitted By *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select resource" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {resources.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="project_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Project *</FormLabel>
                <Select onValueChange={(v) => { field.onChange(v); form.setValue("phase_id", ""); }} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {filteredPhases.length > 0 && (
              <FormField control={form.control} name="phase_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phase</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select phase (optional)" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {filteredPhases.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="expense_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="is_billable" render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormLabel className="mb-0">Billable</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea {...field} rows={2} placeholder="Expense description..." /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Add Expense"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
