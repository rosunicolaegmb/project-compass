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
import { CurrencySelect } from "@/components/CurrencySelect";
import { CURRENCY_SYMBOLS, type Currency } from "@/lib/currency";

const schema = z.object({
  resource_id: z.string().min(1, "Resource is required"),
  delivery_role_id: z.string().optional(),
  cost_rate: z.coerce.number().min(0, "Cost rate must be positive"),
  bill_rate: z.coerce.number().min(0, "Bill rate must be positive"),
  currency: z.string().default("EUR"),
  effective_from: z.string().min(1, "Effective from date is required"),
  effective_to: z.string().optional(),
  reason: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface RateHistoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rateEntry: any | null;
  resources: any[];
  deliveryRoles: any[];
}

export function RateHistoryFormDialog({ open, onOpenChange, rateEntry, resources, deliveryRoles }: RateHistoryFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!rateEntry;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      resource_id: "", delivery_role_id: "", cost_rate: 0, bill_rate: 0,
      currency: "EUR", effective_from: "", effective_to: "", reason: "",
    },
  });

  const watchCurrency = form.watch("currency");
  const sym = CURRENCY_SYMBOLS[watchCurrency as Currency] || "€";

  useEffect(() => {
    if (rateEntry) {
      form.reset({
        resource_id: rateEntry.resource_id || "",
        delivery_role_id: rateEntry.delivery_role_id || "",
        cost_rate: Number(rateEntry.cost_rate || 0),
        bill_rate: Number(rateEntry.bill_rate || 0),
        currency: rateEntry.currency || "EUR",
        effective_from: rateEntry.effective_from || "",
        effective_to: rateEntry.effective_to || "",
        reason: rateEntry.reason || "",
      });
    } else {
      form.reset({
        resource_id: "", delivery_role_id: "", cost_rate: 0, bill_rate: 0,
        currency: "EUR", effective_from: new Date().toISOString().split("T")[0], effective_to: "", reason: "",
      });
    }
  }, [rateEntry, form, open]);

  // Auto-fill currency from resource
  const watchResourceId = form.watch("resource_id");
  useEffect(() => {
    if (watchResourceId && !isEditing) {
      const resource = resources.find((r: any) => r.id === watchResourceId);
      if (resource) {
        form.setValue("currency", resource.currency || "EUR");
      }
    }
  }, [watchResourceId, resources, form, isEditing]);

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      const payload: any = {
        resource_id: values.resource_id,
        delivery_role_id: values.delivery_role_id || null,
        cost_rate: values.cost_rate,
        bill_rate: values.bill_rate,
        currency: values.currency,
        effective_from: values.effective_from,
        effective_to: values.effective_to || null,
        reason: values.reason || null,
      };

      if (isEditing) {
        const { error } = await supabase.from("resource_rate_history").update(payload).eq("id", rateEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resource_rate_history").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rate-history"] });
      toast.success(isEditing ? "Rate updated" : "Rate entry created");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Rate Entry" : "New Rate Entry"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="resource_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Resource *</FormLabel>
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
                  <FormLabel>Cost Rate ({sym}/hr) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bill_rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bill Rate ({sym}/hr) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="effective_from" render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective From *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="effective_to" render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective To</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Reason for Change</FormLabel>
                <FormControl><Textarea {...field} rows={2} placeholder="e.g. Annual rate increase" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Create Rate Entry"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
