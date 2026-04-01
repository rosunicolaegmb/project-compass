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

const schema = z.object({
  display_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email required").or(z.literal("")).optional(),
  job_title: z.string().optional(),
  department: z.string().optional(),
  employee_id: z.string().optional(),
  employment_type: z.enum(["full_time", "part_time", "contractor", "vendor"]).default("full_time"),
  delivery_role_id: z.string().optional(),
  default_bill_rate: z.coerce.number().min(0).optional(),
  default_cost_rate: z.coerce.number().min(0).optional(),
  monthly_cost: z.coerce.number().min(0).optional(),
  overhead_cost_eur: z.coerce.number().min(0).optional(),
  hire_date: z.string().optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: any | null;
  deliveryRoles: any[];
}

export function ResourceFormDialog({ open, onOpenChange, resource, deliveryRoles }: ResourceFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!resource;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: "", email: "", job_title: "", department: "", employee_id: "",
      employment_type: "full_time", delivery_role_id: "", default_bill_rate: 0,
      default_cost_rate: 0, monthly_cost: 0, overhead_cost_eur: 0, hire_date: "", is_active: true,
    },
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
        hire_date: resource.hire_date || "",
        is_active: resource.is_active ?? true,
      });
    } else {
      form.reset({
        display_name: "", email: "", job_title: "", department: "", employee_id: "",
        employment_type: "full_time", delivery_role_id: "", default_bill_rate: 0,
        default_cost_rate: 0, monthly_cost: 0, overhead_cost_eur: 0, hire_date: "", is_active: true,
      });
    }
  }, [resource, form, open]);

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
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
        hire_date: values.hire_date || null,
        is_active: values.is_active,
      };

      if (isEditing) {
        const { error } = await supabase.from("resources").update(payload).eq("id", resource.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resources").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success(isEditing ? "Resource updated" : "Resource created");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const EMPLOYMENT_LABELS: Record<string, string> = {
    full_time: "Full Time", part_time: "Part Time", contractor: "Contractor", vendor: "Vendor",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                  <FormLabel>Email</FormLabel>
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
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="default_cost_rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Cost Rate ($/hr)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="default_bill_rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Bill Rate ($/hr)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
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
