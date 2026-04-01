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

const schema = z.object({
  name: z.string().min(1, "Phase name is required"),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget_hours: z.coerce.number().min(0).optional(),
  budget_amount: z.coerce.number().min(0).optional(),
  sort_order: z.coerce.number().min(0).default(0),
  status: z.enum(["planned", "active", "completed", "on_hold"]).default("planned"),
});

type FormData = z.infer<typeof schema>;

interface PhaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: any | null;
  projectId: string;
}

export function PhaseFormDialog({ open, onOpenChange, phase, projectId }: PhaseFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!phase;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      start_date: "",
      end_date: "",
      budget_hours: 0,
      budget_amount: 0,
      sort_order: 0,
      status: "planned",
    },
  });

  useEffect(() => {
    if (phase) {
      form.reset({
        name: phase.name || "",
        description: phase.description || "",
        start_date: phase.start_date || "",
        end_date: phase.end_date || "",
        budget_hours: Number(phase.budget_hours || 0),
        budget_amount: Number(phase.budget_amount || 0),
        sort_order: phase.sort_order || 0,
        status: phase.status || "planned",
      });
    } else {
      form.reset({
        name: "", description: "", start_date: "", end_date: "",
        budget_hours: 0, budget_amount: 0, sort_order: 0, status: "planned",
      });
    }
  }, [phase, form, open]);

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      const payload = {
        name: values.name,
        description: values.description || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        budget_hours: values.budget_hours || null,
        budget_amount: values.budget_amount || null,
        sort_order: values.sort_order,
        status: values.status as any,
        project_id: projectId,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("project_phases")
          .update(payload)
          .eq("id", phase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_phases")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-phases", projectId] });
      toast.success(isEditing ? "Phase updated" : "Phase created");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Phase" : "New Phase"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Phase Name *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea {...field} rows={2} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="start_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="end_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="budget_hours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Planned Hours</FormLabel>
                  <FormControl><Input type="number" step="0.5" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="budget_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Planned Budget ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="sort_order" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort Order</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : isEditing ? "Update Phase" : "Create Phase"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
