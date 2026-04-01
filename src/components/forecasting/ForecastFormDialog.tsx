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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const SCENARIOS = [
  { value: "best_case", label: "Best Case" },
  { value: "expected", label: "Expected" },
  { value: "worst_case", label: "Worst Case" },
];

// --- Monthly schema ---
const monthlySchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  phase_id: z.string().optional(),
  forecast_month: z.string().min(1, "Month is required"),
  forecast_hours: z.coerce.number().min(0).optional(),
  forecast_labor_revenue: z.coerce.number().min(0).optional(),
  forecast_labor_cost: z.coerce.number().min(0).optional(),
  forecast_expenses: z.coerce.number().min(0).optional(),
  scenario_type: z.string().default("expected"),
  notes: z.string().max(500).optional(),
});

// --- Quarterly schema ---
const quarterlySchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  fiscal_year: z.coerce.number().min(2020).max(2040),
  fiscal_quarter: z.coerce.number().min(1).max(4),
  forecast_revenue: z.coerce.number().min(0).optional(),
  forecast_cost: z.coerce.number().min(0).optional(),
  forecast_margin: z.coerce.number().optional(),
  scenario_type: z.string().default("expected"),
  notes: z.string().max(500).optional(),
});

// --- Yearly schema ---
const yearlySchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  fiscal_year: z.coerce.number().min(2020).max(2040),
  forecast_revenue: z.coerce.number().min(0).optional(),
  forecast_cost: z.coerce.number().min(0).optional(),
  forecast_margin: z.coerce.number().optional(),
  scenario_type: z.string().default("expected"),
  notes: z.string().max(500).optional(),
});

type ForecastType = "monthly" | "quarterly" | "yearly";

interface ForecastFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ForecastType;
  entry: any | null;
  projects: any[];
  phases: any[];
  suggestions?: {
    forecast_hours?: number;
    forecast_labor_cost?: number;
    forecast_labor_revenue?: number;
    forecast_expenses?: number;
    forecast_revenue?: number;
    forecast_cost?: number;
  };
}

export function ForecastFormDialog({
  open, onOpenChange, type, entry, projects, phases, suggestions,
}: ForecastFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!entry;

  const schema = type === "monthly" ? monthlySchema : type === "quarterly" ? quarterlySchema : yearlySchema;
  const form = useForm({ resolver: zodResolver(schema) });

  const watchProjectId = form.watch("project_id");
  const filteredPhases = phases.filter((p: any) => p.project_id === watchProjectId);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      form.reset(entry);
    } else {
      const now = new Date();
      const defaults: any = {
        project_id: "", scenario_type: "expected", notes: "",
        ...(suggestions || {}),
      };
      if (type === "monthly") {
        defaults.forecast_month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        defaults.phase_id = "";
        defaults.forecast_hours = suggestions?.forecast_hours ?? 0;
        defaults.forecast_labor_revenue = suggestions?.forecast_labor_revenue ?? 0;
        defaults.forecast_labor_cost = suggestions?.forecast_labor_cost ?? 0;
        defaults.forecast_expenses = suggestions?.forecast_expenses ?? 0;
      } else if (type === "quarterly") {
        defaults.fiscal_year = now.getFullYear();
        defaults.fiscal_quarter = Math.ceil((now.getMonth() + 1) / 3);
        defaults.forecast_revenue = suggestions?.forecast_revenue ?? 0;
        defaults.forecast_cost = suggestions?.forecast_cost ?? 0;
        defaults.forecast_margin = 0;
      } else {
        defaults.fiscal_year = now.getFullYear();
        defaults.forecast_revenue = suggestions?.forecast_revenue ?? 0;
        defaults.forecast_cost = suggestions?.forecast_cost ?? 0;
        defaults.forecast_margin = 0;
      }
      form.reset(defaults);
    }
  }, [entry, open, type, form, suggestions]);

  const tableName = type === "monthly" ? "monthly_forecasts" : type === "quarterly" ? "quarterly_forecasts" : "yearly_forecasts";

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values };
      if (type === "monthly") {
        payload.phase_id = payload.phase_id || null;
      }
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;

      if (isEditing) {
        const { error } = await supabase.from(tableName).update(payload).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableName).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
      toast.success(isEditing ? "Forecast updated" : "Forecast created");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const title = `${isEditing ? "Edit" : "Add"} ${type.charAt(0).toUpperCase() + type.slice(1)} Forecast`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            {/* Project */}
            <FormField control={form.control} name="project_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Project *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Scenario */}
            <FormField control={form.control} name="scenario_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Scenario</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "expected"}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {SCENARIOS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Monthly-specific fields */}
            {type === "monthly" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="forecast_month" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {filteredPhases.length > 0 && (
                    <FormField control={form.control} name="phase_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phase</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl><SelectTrigger><SelectValue placeholder="All phases" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {filteredPhases.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="forecast_hours" render={({ field }) => (
                    <FormItem><FormLabel>Forecast Hours</FormLabel><FormControl><Input type="number" step="0.5" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="forecast_labor_revenue" render={({ field }) => (
                    <FormItem><FormLabel>Labor Revenue ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="forecast_labor_cost" render={({ field }) => (
                    <FormItem><FormLabel>Labor Cost ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="forecast_expenses" render={({ field }) => (
                    <FormItem><FormLabel>Expenses ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </>
            )}

            {/* Quarterly-specific fields */}
            {type === "quarterly" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="fiscal_year" render={({ field }) => (
                    <FormItem><FormLabel>Fiscal Year *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="fiscal_quarter" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quarter *</FormLabel>
                      <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value || 1)}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="1">Q1</SelectItem><SelectItem value="2">Q2</SelectItem>
                          <SelectItem value="3">Q3</SelectItem><SelectItem value="4">Q4</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="forecast_revenue" render={({ field }) => (
                    <FormItem><FormLabel>Revenue ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="forecast_cost" render={({ field }) => (
                    <FormItem><FormLabel>Cost ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="forecast_margin" render={({ field }) => (
                    <FormItem><FormLabel>Margin ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </>
            )}

            {/* Yearly-specific fields */}
            {type === "yearly" && (
              <>
                <FormField control={form.control} name="fiscal_year" render={({ field }) => (
                  <FormItem><FormLabel>Fiscal Year *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="forecast_revenue" render={({ field }) => (
                    <FormItem><FormLabel>Revenue ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="forecast_cost" render={({ field }) => (
                    <FormItem><FormLabel>Cost ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="forecast_margin" render={({ field }) => (
                    <FormItem><FormLabel>Margin ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </>
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} rows={2} placeholder="Forecast notes..." /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Add Forecast"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
