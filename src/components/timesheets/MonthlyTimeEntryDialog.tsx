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
  startOfMonth, endOfMonth, eachDayOfInterval, format, getDay, parse,
} from "date-fns";

const HOURS_PER_DAY = 8;

const schema = z.object({
  resource_ids: z.array(z.string()).min(1, "Select at least one resource"),
  project_id: z.string().min(1, "Project is required"),
  phase_id: z.string().optional(),
  month: z.string().min(1, "Month is required"),
  hours: z.coerce.number().min(0.25, "Minimum 0.25 hours").max(24, "Maximum 24 hours"),
  is_billable: z.boolean().default(true),
  description: z.string().max(500).optional(),
  skip_weekends: z.boolean().default(true),
  skip_existing: z.boolean().default(true),
  override_rate: z.boolean().default(false),
  bill_rate: z.coerce.number().min(0).optional(),
  daily_rate: z.coerce.number().min(0).optional(),
  currency: z.string().default("EUR"),
});

type FormData = z.infer<typeof schema>;

interface MonthlyTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resources: any[];
  projects: any[];
  phases: any[];
  reporterResourceId?: string | null;
  projectMembers?: { project_id: string; resource_id: string }[];
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

export function MonthlyTimeEntryDialog({ open, onOpenChange, resources, projects, phases, reporterResourceId, projectMembers = [] }: MonthlyTimeEntryDialogProps) {
  const queryClient = useQueryClient();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      resource_ids: [], project_id: "", phase_id: "",
      month: format(new Date(), "yyyy-MM"),
      hours: 8, is_billable: true, description: "",
      skip_weekends: true, skip_existing: true,
      override_rate: false, bill_rate: 0, daily_rate: 0, currency: "EUR",
    },
  });

  useEffect(() => {
    if (open) {
      const defaultMonth = format(new Date(), "yyyy-MM");
      form.reset({
        resource_ids: reporterResourceId ? [reporterResourceId] : [],
        project_id: "", phase_id: "",
        month: defaultMonth,
        hours: 8, is_billable: true, description: "",
        skip_weekends: true, skip_existing: true,
        override_rate: false, bill_rate: 0, daily_rate: 0, currency: "EUR",
      });
      setSelectedDates(computeWorkingDays(defaultMonth, true));
    }
  }, [open, form, reporterResourceId]);

  const watchProjectId = form.watch("project_id");
  const watchMonth = form.watch("month");
  const watchSkipWeekends = form.watch("skip_weekends");
  const watchResourceIds = form.watch("resource_ids");
  const watchOverrideRate = form.watch("override_rate");
  const watchCurrency = form.watch("currency");
  const watchBillRate = form.watch("bill_rate");
  const watchDailyRate = form.watch("daily_rate");
  const sym = CURRENCY_SYMBOLS[watchCurrency as Currency] || "€";
  const filteredPhases = phases.filter((p: any) => p.project_id === watchProjectId);

  const [rateEditSource, setRateEditSource] = useState<"bill" | "daily" | null>(null);
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

  // Filter resources by project allocation
  const filteredResources = useMemo(() => {
    if (!watchProjectId) return resources;
    const allocatedIds = projectMembers.filter(m => m.project_id === watchProjectId).map(m => m.resource_id);
    if (allocatedIds.length === 0) return resources;
    return resources.filter((r: any) => allocatedIds.includes(r.id));
  }, [watchProjectId, projectMembers, resources]);

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

  const totalEntries = selectedDates.length * (watchResourceIds?.length || 0);
  const totalHours = totalEntries * (form.watch("hours") || 0);

  // Prune resource selection when project changes (keep only allocated ones)
  useEffect(() => {
    if (reporterResourceId) return;
    if (!watchProjectId) return;
    const allowed = new Set(filteredResources.map((r: any) => r.id));
    const current = form.getValues("resource_ids") || [];
    const pruned = current.filter(id => allowed.has(id));
    if (pruned.length !== current.length) {
      form.setValue("resource_ids", pruned);
    }
  }, [watchProjectId, filteredResources, form, reporterResourceId]);

  const handleSelectAll = () => {
    setSelectedDates(computeWorkingDays(watchMonth, watchSkipWeekends));
  };

  const handleDeselectAll = () => {
    setSelectedDates([]);
  };

  const toggleResource = (id: string, checked: boolean) => {
    const current = form.getValues("resource_ids") || [];
    if (checked) {
      if (!current.includes(id)) form.setValue("resource_ids", [...current, id], { shouldValidate: true });
    } else {
      form.setValue("resource_ids", current.filter(x => x !== id), { shouldValidate: true });
    }
  };

  const handleSelectAllResources = () => {
    form.setValue("resource_ids", filteredResources.map((r: any) => r.id), { shouldValidate: true });
  };
  const handleDeselectAllResources = () => {
    form.setValue("resource_ids", [], { shouldValidate: true });
  };

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (selectedDates.length === 0) throw new Error("No days selected for this month.");
      if (values.resource_ids.length === 0) throw new Error("Select at least one resource.");

      const dates = selectedDates.map(d => format(d, "yyyy-MM-dd"));

      // Fetch existing entries for all selected resources in one query
      let existingByResource: Record<string, Set<string>> = {};
      if (values.skip_existing) {
        const { data: existing, error: existErr } = await supabase
          .from("time_entries")
          .select("entry_date, resource_id")
          .in("resource_id", values.resource_ids)
          .eq("project_id", values.project_id)
          .is("deleted_at", null)
          .in("entry_date", dates);
        if (existErr) throw existErr;
        for (const e of existing || []) {
          const set = existingByResource[e.resource_id] ||= new Set<string>();
          set.add(e.entry_date as string);
        }
      }

      let totalCreated = 0;
      let totalSkipped = 0;
      let resourcesWithCreations = 0;
      const allRows: any[] = [];

      for (const rid of values.resource_ids) {
        const resource = resources.find((r: any) => r.id === rid);
        const useOverride = values.override_rate && values.bill_rate != null && values.bill_rate > 0;
        const billRate = useOverride
          ? Number(values.bill_rate)
          : (resource?.default_bill_rate != null ? Number(resource.default_bill_rate) : null);
        const currency = useOverride ? (values.currency || "EUR") : (resource?.currency || "EUR");

        const skipSet = existingByResource[rid] || new Set<string>();
        const newDates = dates.filter(d => !skipSet.has(d));
        const skipped = dates.length - newDates.length;
        totalSkipped += skipped;
        if (newDates.length > 0) {
          resourcesWithCreations += 1;
          totalCreated += newDates.length;
          for (const date of newDates) {
            allRows.push({
              resource_id: rid,
              project_id: values.project_id,
              phase_id: values.phase_id || null,
              entry_date: date,
              hours: values.hours,
              is_billable: values.is_billable,
              description: values.description || null,
              bill_rate: billRate,
              cost_rate: null,
              currency,
            });
          }
        }
      }

      if (allRows.length === 0) {
        throw new Error("All selected days already have time entries for the selected resources.");
      }

      const batchSize = 50;
      for (let i = 0; i < allRows.length; i += batchSize) {
        const batch = allRows.slice(i, i + batchSize);
        const { error } = await supabase.from("time_entries").insert(batch);
        if (error) throw error;
      }

      return { created: totalCreated, skipped: totalSkipped, resources: resourcesWithCreations };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      const msg = result.skipped > 0
        ? `Created ${result.created} entries across ${result.resources} resources (${result.skipped} skipped — already existed)`
        : `Created ${result.created} entries across ${result.resources} resources`;
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
            Create time entries for selected days in a month, for one or more resources.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
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

            <FormField control={form.control} name="resource_ids" render={() => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Resources *</FormLabel>
                  {!reporterResourceId && (
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleSelectAllResources} disabled={!watchProjectId || filteredResources.length === 0}>
                        Select All
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleDeselectAllResources}>
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
                <div className="rounded-md border p-2 max-h-48 overflow-y-auto space-y-1">
                  {!watchProjectId ? (
                    <p className="text-sm text-muted-foreground p-2">Select a project first to see resources.</p>
                  ) : filteredResources.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No resources available.</p>
                  ) : filteredResources.map((r: any) => {
                    const checked = watchResourceIds?.includes(r.id) || false;
                    const disabled = !!reporterResourceId && r.id !== reporterResourceId;
                    return (
                      <label key={r.id} className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(c) => toggleResource(r.id, !!c)}
                        />
                        <span className="text-sm">{r.display_name}</span>
                      </label>
                    );
                  })}
                </div>
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

            {/* Optional global bill rate override */}
            <div className="space-y-3 rounded-md border p-3">
              <FormField control={form.control} name="override_rate" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="mb-0">Override bill rate for all selected resources</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      If off, each resource uses its own default bill rate &amp; currency from profile.
                    </p>
                  </div>
                </FormItem>
              )} />

              {watchOverrideRate && (
                <>
                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Currency</FormLabel>
                      <FormControl>
                        <CurrencySelect value={field.value} onValueChange={field.onChange} className="w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="bill_rate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bill Rate ({sym}/hr)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field}
                            onFocus={() => setRateEditSource("bill")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="daily_rate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Daily Rate ({sym}/day)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field}
                            onFocus={() => setRateEditSource("daily")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </>
              )}
            </div>

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
                <span className="text-muted-foreground">Resources selected</span>
                <Badge variant="secondary">{watchResourceIds?.length || 0}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Days selected</span>
                <Badge variant="secondary">{selectedDates.length} days</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total entries</span>
                <span className="font-medium">{totalEntries.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total hours</span>
                <span className="font-medium">{totalHours.toLocaleString()} hrs</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending || selectedDates.length === 0 || (watchResourceIds?.length || 0) === 0}>
                {mutation.isPending ? "Creating entries..." : `Log ${totalEntries} Entries`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
