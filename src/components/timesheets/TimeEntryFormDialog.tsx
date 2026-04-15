import { useEffect, useMemo, useState } from "react";
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
import { CurrencySelect } from "@/components/CurrencySelect";
import { CURRENCY_SYMBOLS, type Currency } from "@/lib/currency";

const HOURS_PER_DAY = 8;

const schema = z.object({
  resource_id: z.string().min(1, "Resource is required"),
  project_id: z.string().min(1, "Project is required"),
  phase_id: z.string().optional(),
  entry_date: z.string().min(1, "Date is required"),
  hours: z.coerce.number().min(0.25, "Minimum 0.25 hours").max(24, "Maximum 24 hours"),
  is_billable: z.boolean().default(true),
  description: z.string().max(500).optional(),
  bill_rate: z.coerce.number().min(0).optional(),
  daily_rate: z.coerce.number().min(0).optional(),
  currency: z.string().default("EUR"),
});

type FormData = z.infer<typeof schema>;

interface TimeEntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any | null;
  resources: any[];
  projects: any[];
  phases: any[];
  reporterResourceId?: string | null;
  projectMembers?: { project_id: string; resource_id: string }[];
}

export function TimeEntryFormDialog({ open, onOpenChange, entry, resources, projects, phases, reporterResourceId, projectMembers = [] }: TimeEntryFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!entry;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      resource_id: "", project_id: "", phase_id: "", entry_date: new Date().toISOString().split("T")[0],
      hours: 8, is_billable: true, description: "", bill_rate: 0, daily_rate: 0, currency: "EUR",
    },
  });

  const watchProjectId = form.watch("project_id");
  const watchCurrency = form.watch("currency");
  const filteredPhases = phases.filter((p: any) => p.project_id === watchProjectId);
  const sym = CURRENCY_SYMBOLS[watchCurrency as Currency] || "€";

  // Filter resources by project allocation
  const filteredResources = useMemo(() => {
    if (!watchProjectId) return resources;
    const allocatedIds = projectMembers.filter(m => m.project_id === watchProjectId).map(m => m.resource_id);
    if (allocatedIds.length === 0) return resources;
    return resources.filter((r: any) => allocatedIds.includes(r.id));
  }, [watchProjectId, projectMembers, resources]);

  useEffect(() => {
    if (entry) {
      const billRate = Number(entry.bill_rate || 0);
      form.reset({
        resource_id: entry.resource_id || "",
        project_id: entry.project_id || "",
        phase_id: entry.phase_id || "",
        entry_date: entry.entry_date || "",
        hours: Number(entry.hours || 8),
        is_billable: entry.is_billable ?? true,
        description: entry.description || "",
        bill_rate: billRate,
        daily_rate: billRate * HOURS_PER_DAY,
        currency: entry.currency || "EUR",
      });
    } else {
      form.reset({
        resource_id: reporterResourceId || "", project_id: "", phase_id: "",
        entry_date: new Date().toISOString().split("T")[0],
        hours: 8, is_billable: true, description: "", bill_rate: 0, daily_rate: 0, currency: "EUR",
      });
    }
  }, [entry, form, open, reporterResourceId]);

  // Auto-fill rates and currency when resource changes
  const watchResourceId = form.watch("resource_id");
  useEffect(() => {
    if (watchResourceId && !isEditing) {
      const resource = resources.find((r: any) => r.id === watchResourceId);
      if (resource) {
        const br = Number(resource.default_bill_rate || 0);
        form.setValue("bill_rate", br);
        form.setValue("daily_rate", br * HOURS_PER_DAY);
        form.setValue("currency", resource.currency || "EUR");
      }
    }
  }, [watchResourceId, resources, form, isEditing]);

  const [rateEditSource, setRateEditSource] = useState<"bill" | "daily" | null>(null);
  const watchBillRate = form.watch("bill_rate");
  const watchDailyRate = form.watch("daily_rate");

  useEffect(() => {
    if (rateEditSource === "bill" && watchBillRate != null) {
      form.setValue("daily_rate", Number((watchBillRate * HOURS_PER_DAY).toFixed(2)));
    }
  }, [watchBillRate, rateEditSource, form]);

  useEffect(() => {
    if (rateEditSource === "daily" && watchDailyRate != null) {
      form.setValue("bill_rate", Number((watchDailyRate / HOURS_PER_DAY).toFixed(2)));
    }
  }, [watchDailyRate, rateEditSource, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      // Duplicate check
      if (!isEditing) {
        const dupQuery = supabase
          .from("time_entries")
          .select("id")
          .eq("resource_id", values.resource_id)
          .eq("project_id", values.project_id)
          .eq("entry_date", values.entry_date)
          .is("deleted_at", null);

        if (values.phase_id) {
          dupQuery.eq("phase_id", values.phase_id);
        } else {
          dupQuery.is("phase_id", null);
        }

        const { data: dups } = await dupQuery;
        if (dups && dups.length > 0) {
          throw new Error("A time entry already exists for this resource/project/phase/date combination.");
        }
      }

      const payload: any = {
        resource_id: values.resource_id,
        project_id: values.project_id,
        phase_id: values.phase_id || null,
        entry_date: values.entry_date,
        hours: values.hours,
        is_billable: values.is_billable,
        description: values.description || null,
        bill_rate: values.bill_rate || null,
        cost_rate: null,
        currency: values.currency,
      };

      if (isEditing) {
        const { error } = await supabase.from("time_entries").update(payload).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("time_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success(isEditing ? "Time entry updated" : "Time entry created");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Time Entry" : "Log Time"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="project_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Project *</FormLabel>
                <Select onValueChange={(v) => { field.onChange(v); form.setValue("phase_id", ""); form.setValue("resource_id", reporterResourceId || ""); }} value={field.value}>
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
            <FormField control={form.control} name="resource_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Resource *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!!reporterResourceId}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select resource" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {filteredResources.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
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
              <FormField control={form.control} name="entry_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hours *</FormLabel>
                  <FormControl><Input type="number" step="0.25" min="0.25" max="24" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="currency" render={({ field }) => (
              <FormItem>
                <FormLabel>Rate Currency</FormLabel>
                <FormControl>
                  <CurrencySelect value={field.value} onValueChange={field.onChange} className="w-full" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="bill_rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bill Rate ({sym}/hr)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field}
                      onFocus={() => setRateEditSource("bill")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="daily_rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily Rate ({sym}/day)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field}
                      onFocus={() => setRateEditSource("daily")}
                    />
                  </FormControl>
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
                <FormControl><Textarea {...field} rows={2} placeholder="Work description..." /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Log Time"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
