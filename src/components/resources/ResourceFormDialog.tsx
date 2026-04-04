import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencySelect } from "@/components/CurrencySelect";
import { CURRENCY_SYMBOLS, type Currency } from "@/lib/currency";
import { Plus, Trash2, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  display_name: z.string().min(1, "Full name is required"),
  email: z.string().min(1, "Email is required").email("Valid email required"),
  job_title: z.string().optional(),
  department: z.string().optional(),
  employee_id: z.string().optional(),
  employment_type: z.enum(["full_time", "part_time", "contractor", "vendor"]).default("full_time"),
  delivery_role_id: z.string().optional(),
  default_bill_rate: z.coerce.number().min(0).optional(),
  default_cost_rate: z.coerce.number().min(0).optional(),
  monthly_cost: z.coerce.number().min(0).optional(),
  overhead_cost_eur: z.coerce.number().min(0).optional(),
  cost_rate_currency: z.string().default("EUR"),
  bill_rate_currency: z.string().default("EUR"),
  hire_date: z.string().optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

interface Allocation {
  id?: string;
  project_id: string;
  allocation_percentage: number;
  start_date: string;
  end_date: string;
  is_primary: boolean;
  isNew?: boolean;
}

interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: any | null;
  deliveryRoles: any[];
}

export function ResourceFormDialog({ open, onOpenChange, resource, deliveryRoles }: ResourceFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!resource;
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allocErrors, setAllocErrors] = useState<Record<number, string>>({});

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: "", email: "", job_title: "", department: "", employee_id: "",
      employment_type: "full_time", delivery_role_id: "", default_bill_rate: 0,
      default_cost_rate: 0, monthly_cost: 0, overhead_cost_eur: 0,
      cost_rate_currency: "EUR", bill_rate_currency: "EUR",
      hire_date: "", is_active: true,
    },
  });

  // Fetch projects for allocation
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-allocation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, start_date, end_date, status")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch existing allocations when editing
  const { data: existingAllocations = [] } = useQuery({
    queryKey: ["resource-allocations", resource?.id],
    queryFn: async () => {
      if (!resource?.id) return [];
      const { data, error } = await supabase
        .from("project_members")
        .select("id, project_id, allocation_percentage, start_date, end_date, is_primary, projects(name, start_date, end_date)")
        .eq("resource_id", resource.id);
      if (error) throw error;
      return data;
    },
    enabled: open && isEditing,
  });

  useEffect(() => {
    if (resource) {
      form.reset({
        display_name: resource.display_name || "",
        email: resource.email || "",
        job_title: resource.job_title || "",
        department: resource.department || "",
        employee_id: resource.employee_id || "",
        employment_type: resource.employment_type || "full_time",
        delivery_role_id: resource.delivery_role_id || "",
        default_bill_rate: Number(resource.default_bill_rate || 0),
        default_cost_rate: Number(resource.default_cost_rate || 0),
        monthly_cost: Number(resource.monthly_cost || 0),
        overhead_cost_eur: Number(resource.overhead_cost_eur || 0),
        cost_rate_currency: resource.cost_rate_currency || resource.currency || "EUR",
        bill_rate_currency: resource.bill_rate_currency || resource.currency || "EUR",
        hire_date: resource.hire_date || "",
        is_active: resource.is_active ?? true,
      });
    } else {
      form.reset({
        display_name: "", email: "", job_title: "", department: "", employee_id: "",
        employment_type: "full_time", delivery_role_id: "", default_bill_rate: 0,
        default_cost_rate: 0, monthly_cost: 0, overhead_cost_eur: 0,
        cost_rate_currency: "EUR", bill_rate_currency: "EUR",
        hire_date: "", is_active: true,
      });
    }
    setAllocErrors({});
  }, [resource, form, open]);

  // Sync existing allocations
  useEffect(() => {
    if (isEditing && existingAllocations.length > 0) {
      setAllocations(prev => {
        const newAllocs = existingAllocations.map((a: any) => ({
          id: a.id,
          project_id: a.project_id,
          allocation_percentage: Number(a.allocation_percentage || 100),
          start_date: a.start_date || "",
          end_date: a.end_date || "",
          is_primary: a.is_primary ?? false,
        }));
        // Avoid unnecessary state updates
        if (JSON.stringify(prev) === JSON.stringify(newAllocs)) return prev;
        return newAllocs;
      });
    } else if (!isEditing) {
      setAllocations([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, open, existingAllocations.length]);

  const addAllocation = () => {
    setAllocations(prev => [...prev, {
      project_id: "", allocation_percentage: 100, start_date: "", end_date: "", is_primary: false, isNew: true,
    }]);
    setAllocOpen(true);
  };

  const removeAllocation = (index: number) => {
    setAllocations(prev => prev.filter((_, i) => i !== index));
    setAllocErrors(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const updateAllocation = (index: number, field: keyof Allocation, value: any) => {
    setAllocations(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
    // Clear error on change
    setAllocErrors(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const validateAllocations = (): boolean => {
    const errors: Record<number, string> = {};
    allocations.forEach((alloc, i) => {
      if (!alloc.project_id) {
        errors[i] = "Please select a project";
        return;
      }
      const project = projects.find((p: any) => p.id === alloc.project_id);
      if (!project) return;

      if (alloc.start_date && project.start_date && alloc.start_date < project.start_date) {
        errors[i] = `Start date is before project start (${project.start_date})`;
        return;
      }
      if (alloc.end_date && project.end_date && alloc.end_date > project.end_date) {
        errors[i] = `End date is after project end (${project.end_date})`;
        return;
      }
      if (alloc.start_date && alloc.end_date && alloc.start_date > alloc.end_date) {
        errors[i] = "Start date must be before end date";
        return;
      }
    });
    setAllocErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (!validateAllocations()) {
        throw new Error("Please fix allocation errors before saving");
      }

      // Check for duplicate email
      if (values.email) {
        const query = supabase
          .from("resources")
          .select("id")
          .eq("email", values.email.toLowerCase())
          .is("deleted_at", null);
        if (isEditing) {
          query.neq("id", resource.id);
        }
        const { data: dups } = await query;
        if (dups && dups.length > 0) {
          throw new Error(`A resource with email "${values.email}" already exists.`);
        }
      }

      const payload: any = {
        display_name: values.display_name,
        email: values.email || null,
        job_title: values.job_title || null,
        department: values.department || null,
        employee_id: values.employee_id || null,
        employment_type: values.employment_type,
        delivery_role_id: values.delivery_role_id || null,
        default_bill_rate: values.default_bill_rate || null,
        default_cost_rate: values.default_cost_rate || null,
        monthly_cost: values.monthly_cost || null,
        overhead_cost_eur: values.overhead_cost_eur || null,
        cost_rate_currency: values.cost_rate_currency,
        bill_rate_currency: values.bill_rate_currency,
        currency: values.bill_rate_currency,
        hire_date: values.hire_date || null,
        is_active: values.is_active,
      };

      let resourceId: string;

      if (isEditing) {
        const { error } = await supabase.from("resources").update(payload).eq("id", resource.id);
        if (error) throw error;
        resourceId = resource.id;
      } else {
        const { data, error } = await supabase.from("resources").insert(payload).select("id").single();
        if (error) throw error;
        resourceId = data.id;
      }

      // Sync allocations
      if (isEditing) {
        // Delete removed allocations
        const keepIds = allocations.filter(a => a.id).map(a => a.id!);
        const existingIds = existingAllocations.map((a: any) => a.id);
        const toDelete = existingIds.filter((id: string) => !keepIds.includes(id));
        if (toDelete.length > 0) {
          const { error } = await supabase.from("project_members").delete().in("id", toDelete);
          if (error) throw error;
        }

        // Update existing
        for (const alloc of allocations.filter(a => a.id)) {
          const { error } = await supabase.from("project_members").update({
            project_id: alloc.project_id,
            allocation_percentage: alloc.allocation_percentage,
            start_date: alloc.start_date || null,
            end_date: alloc.end_date || null,
          }).eq("id", alloc.id!);
          if (error) throw error;
        }
      }

      // Insert new allocations
      const newAllocs = allocations.filter(a => !a.id && a.project_id);
      if (newAllocs.length > 0) {
        const { error } = await supabase.from("project_members").insert(
          newAllocs.map(a => ({
            resource_id: resourceId,
            project_id: a.project_id,
            allocation_percentage: a.allocation_percentage,
            start_date: a.start_date || null,
            end_date: a.end_date || null,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["resource-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["project-members"] });
      toast.success(isEditing ? "Resource updated" : "Resource created");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const EMPLOYMENT_LABELS: Record<string, string> = {
    full_time: "Full Time", part_time: "Part Time", contractor: "Contractor", vendor: "Vendor",
  };

  const employmentType = form.watch("employment_type");
  const costCurrency = form.watch("cost_rate_currency");
  const billCurrency = form.watch("bill_rate_currency");
  const isFullTime = employmentType === "full_time";
  const costSym = CURRENCY_SYMBOLS[costCurrency as Currency] || "€";
  const billSym = CURRENCY_SYMBOLS[billCurrency as Currency] || "€";

  // Projects not yet allocated
  const allocatedProjectIds = new Set(allocations.map(a => a.project_id));
  const availableProjects = projects.filter((p: any) => !allocatedProjectIds.has(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Resource" : "New Resource"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="display_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="employee_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="job_title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="employment_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Employment Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="delivery_role_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {deliveryRoles.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Cost Rate with its own currency */}
            {isFullTime ? (
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="monthly_cost" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Monthly Cost ({costSym}/mo)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cost_rate_currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <CurrencySelect value={field.value} onValueChange={field.onChange} className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="default_cost_rate" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Default Cost Rate ({costSym}/hr)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cost_rate_currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <CurrencySelect value={field.value} onValueChange={field.onChange} className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {/* Bill Rate with its own currency */}
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="default_bill_rate" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Default Bill Rate ({billSym}/hr)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bill_rate_currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <CurrencySelect value={field.value} onValueChange={field.onChange} className="w-full" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="overhead_cost_eur" render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly Overhead (€/mo)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="hire_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Hire Date</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormLabel className="mb-0">Active</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} />

            {/* Project Allocations Section */}
            <Collapsible open={allocOpen} onOpenChange={setAllocOpen}>
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-muted/50 transition-colors rounded-t-lg">
                    <div className="flex items-center gap-2">
                      {allocOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      Project Allocations
                      {allocations.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{allocations.length}</Badge>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); addAllocation(); }}>
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {allocations.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No project allocations yet. Click "Add" to allocate this resource to a project.
                    </div>
                  ) : (
                    <div className="p-3 space-y-3">
                      {allocations.map((alloc, i) => {
                        const project = projects.find((p: any) => p.id === alloc.project_id);
                        return (
                          <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/30">
                            <div className="flex items-center gap-2">
                              <Select
                                value={alloc.project_id}
                                onValueChange={(v) => {
                                  updateAllocation(i, "project_id", v);
                                  // Auto-fill project dates
                                  const proj = projects.find((p: any) => p.id === v);
                                  if (proj) {
                                    if (proj.start_date) updateAllocation(i, "start_date", proj.start_date);
                                    if (proj.end_date) updateAllocation(i, "end_date", proj.end_date);
                                  }
                                }}
                              >
                                <SelectTrigger className="flex-1 h-8 text-sm">
                                  <SelectValue placeholder="Select project" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(alloc.project_id ? projects : availableProjects).map((p: any) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number" min="0" max="100" step="5"
                                value={alloc.allocation_percentage}
                                onChange={(e) => updateAllocation(i, "allocation_percentage", Number(e.target.value))}
                                className="w-20 h-8 text-sm text-right"
                                placeholder="%"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeAllocation(i)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">Start Date</label>
                                <Input
                                  type="date" value={alloc.start_date}
                                  onChange={(e) => updateAllocation(i, "start_date", e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">End Date</label>
                                <Input
                                  type="date" value={alloc.end_date}
                                  onChange={(e) => updateAllocation(i, "end_date", e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            {project && (
                              <p className="text-xs text-muted-foreground">
                                Project period: {project.start_date || "N/A"} → {project.end_date || "N/A"}
                              </p>
                            )}
                            {allocErrors[i] && (
                              <div className="flex items-center gap-1.5 text-xs text-destructive">
                                <AlertCircle className="h-3 w-3" />
                                {allocErrors[i]}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Create Resource"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
