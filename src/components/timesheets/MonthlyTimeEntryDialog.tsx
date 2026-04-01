import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { CurrencySelect } from "@/components/CurrencySelect";
import { CURRENCY_SYMBOLS, type Currency } from "@/lib/currency";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, getDay, parse, isSameDay,
} from "date-fns";

const schema = z.object({
  resource_id: z.string().min(1, "Resource is required"),
  project_id: z.string().min(1, "Project is required"),
  phase_id: z.string().optional(),
  month: z.string().min(1, "Month is required"),
  hours: z.coerce.number().min(0.25, "Minimum 0.25 hours").max(24, "Maximum 24 hours"),
  is_billable: z.boolean().default(true),
  description: z.string().max(500).optional(),
  bill_rate: z.coerce.number().min(0).optional(),
  cost_rate: z.coerce.number().min(0).optional(),
  currency: z.string().default("EUR"),
  skip_weekends: z.boolean().default(true),
  skip_existing: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

interface MonthlyTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resources: any[];
  projects: any[];
  phases: any[];
  reporterResourceId?: string | null;
}

function computeWorkingDays(month: string, skipWeekends: boolean): Date[] {
  if (!month) return [];
  try {
    const monthDate = parse(month, "yyyy-MM", new Date());
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const allDays = eachDayOfInterval({ start, end });
    if (skipWeekends) {
      return allDays.filter(d => { const day = getDay(d); return day !== 0 && day !== 6; });
    }
    return allDays;
  } catch {
    return [];
  }
}

export function MonthlyTimeEntryDialog({ open, onOpenChange, resources, projects, phases, reporterResourceId }: MonthlyTimeEntryDialogProps) {
  const queryClient = useQueryClient();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      resource_id: "", project_id: "", phase_id: "",
      month: format(new Date(), "yyyy-MM"),
      hours: 8, is_billable: true, description: "",
      bill_rate: 0, cost_rate: 0, currency: "EUR", skip_weekends: true, skip_existing: true,
    },
  });

  useEffect(() => {
    if (open) {
      const defaultMonth = format(new Date(), "yyyy-MM");
      form.reset({
        resource_id: reporterResourceId || "", project_id: "", phase_id: "",
        month: defaultMonth,
        hours: 8, is_billable: true, description: "",
        bill_rate: 0, cost_rate: 0, currency: "EUR", skip_weekends: true, skip_existing: true,
      });
      setSelectedDates(computeWorkingDays(defaultMonth, true));
    }
  }, [open, form, reporterResourceId]);

  const watchProjectId = form.watch("project_id");
  const watchMonth = form.watch("month");
  const watchSkipWeekends = form.watch("skip_weekends");
  const watchCurrency = form.watch("currency");
  const filteredPhases = phases.filter((p: any) => p.project_id === watchProjectId);
  const sym = CURRENCY_SYMBOLS[watchCurrency as Currency] || "€";

  // Recompute default selection when month or skip_weekends changes
  useEffect(() => {
    setSelectedDates(computeWorkingDays(watchMonth, watchSkipWeekends));
  }, [watchMonth, watchSkipWeekends]);

  // Month boundaries for calendar constraints
  const monthBounds = useMemo(() => {
    if (!watchMonth) return { start: new Date(), end: new Date() };
    try {
      const monthDate = parse(watchMonth, "yyyy-MM", new Date());
      return { start: startOfMonth(monthDate), end: endOfMonth(monthDate) };
    } catch {
      return { start: new Date(), end: new Date() };
    }
  }, [watchMonth]);

  const totalHours = selectedDates.length * (form.watch("hours") || 0);

  const watchResourceId = form.watch("resource_id");
  useEffect(() => {
    if (watchResourceId) {
      const resource = resources.find((r: any) => r.id === watchResourceId);
      if (resource) {
        form.setValue("bill_rate", Number(resource.default_bill_rate || 0));
        form.setValue("cost_rate", Number(resource.default_cost_rate || 0));
        form.setValue("currency", resource.currency || "EUR");
      }
    }
  }, [watchResourceId, resources, form]);

  const handleSelectAll = () => {
    setSelectedDates(computeWorkingDays(watchMonth, watchSkipWeekends));
  };

  const handleDeselectAll = () => {
    setSelectedDates([]);
  };

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (selectedDates.length === 0) throw new Error("No days selected for this month.");

      const dates = selectedDates.map(d => format(d, "yyyy-MM-dd"));

      let existingDates = new Set<string>();
      if (values.skip_existing) {
        const { data: existing } = await supabase
          .from("time_entries")
          .select("entry_date")
          .eq("resource_id", values.resource_id)
          .eq("project_id", values.project_id)
          .is("deleted_at", null)
          .in("entry_date", dates);

        if (existing) {
          existingDates = new Set(existing.map((e: any) => e.entry_date));
        }
      }

      const newDates = dates.filter(d => !existingDates.has(d));
      const skipCount = dates.length - newDates.length;

      if (newDates.length === 0) {
        throw new Error("All selected days already have time entries for this resource/project combination.");
      }

      const batchSize = 50;
      for (let i = 0; i < newDates.length; i += batchSize) {
        const batch = newDates.slice(i, i + batchSize).map(date => ({
          resource_id: values.resource_id,
          project_id: values.project_id,
          phase_id: values.phase_id || null,
          entry_date: date,
          hours: values.hours,
          is_billable: values.is_billable,
          description: values.description || null,
          bill_rate: values.bill_rate || null,
          cost_rate: values.cost_rate || null,
          currency: values.currency,
        }));

        const { error } = await supabase.from("time_entries").insert(batch);
        if (error) throw error;
      }

      return { created: newDates.length, skipped: skipCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      const msg = result.skipped > 0
        ? `Created ${result.created} entries (${result.skipped} days skipped — already existed)`
        : `Created ${result.created} time entries`;
      toast.success(msg);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Full Month</DialogTitle>
          <DialogDescription>
            Create time entries for selected days in a month. Click days to toggle them.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="resource_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Resource *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!!reporterResourceId}>
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

            <FormField control={form.control} name="month" render={({ field }) => (
              <FormItem>
                <FormLabel>Month *</FormLabel>
                <FormControl><Input type="month" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Interactive day picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel className="text-sm font-medium">Select Days</FormLabel>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
                    Select All
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleDeselectAll}>
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="rounded-md border p-2 flex justify-center">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={(dates) => setSelectedDates(dates || [])}
                  month={monthBounds.start}
                  disableNavigation
                  fromDate={monthBounds.start}
                  toDate={monthBounds.end}
                  className="pointer-events-auto"
                />
              </div>
            </div>

            <FormField control={form.control} name="hours" render={({ field }) => (
              <FormItem>
                <FormLabel>Hours per day *</FormLabel>
                <FormControl><Input type="number" step="0.25" min="0.25" max="24" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

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
              <FormField control={form.control} name="cost_rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost Rate ({sym}/hr)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bill_rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bill Rate ({sym}/hr)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="space-y-3">
              <FormField control={form.control} name="is_billable" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormLabel className="mb-0">Billable</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="skip_weekends" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="mb-0 text-sm">Skip weekends (Sat/Sun)</FormLabel>
                </FormItem>
              )} />

              <FormField control={form.control} name="skip_existing" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="mb-0 text-sm">Skip days with existing entries</FormLabel>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea {...field} rows={2} placeholder="Work description..." /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="rounded-md bg-muted p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Days selected</span>
                <Badge variant="secondary">{selectedDates.length} days</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total hours</span>
                <span className="font-medium">{totalHours.toLocaleString()} hrs</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending || selectedDates.length === 0}>
                {mutation.isPending ? "Creating entries..." : `Log ${selectedDates.length} Days`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}