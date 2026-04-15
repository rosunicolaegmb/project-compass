import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencySelect } from "@/components/CurrencySelect";
import { toast } from "sonner";

interface EditData {
  id: string;
  project_id: string;
  revenue_month: string;
  amount: number;
  currency: string;
  reason: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: EditData | null;
}

export function OneTimeRevenueDialog({ open, onOpenChange, editData }: Props) {
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [reason, setReason] = useState("");

  // Pre-fill when editing
  useEffect(() => {
    if (editData) {
      setProjectId(editData.project_id);
      // revenue_month is "YYYY-MM-DD", extract "YYYY-MM"
      setMonth(editData.revenue_month.substring(0, 7));
      setAmount(String(editData.amount));
      setCurrency(editData.currency);
      setReason(editData.reason || "");
    } else {
      resetForm();
    }
  }, [editData, open]);

  const { data: projects = [] } = useQuery({
    queryKey: ["otr-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const revenueMonth = `${month}-01`;
      if (editData) {
        const { error } = await supabase.from("one_time_revenues").update({
          project_id: projectId,
          revenue_month: revenueMonth,
          amount: Number(amount),
          currency,
          reason: reason || null,
        }).eq("id", editData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("one_time_revenues").insert({
          project_id: projectId,
          revenue_month: revenueMonth,
          amount: Number(amount),
          currency,
          reason: reason || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-one-time-revenues"] });
      queryClient.invalidateQueries({ queryKey: ["project-one-time-revenues"] });
      queryClient.invalidateQueries({ queryKey: ["otr-list"] });
      toast.success(editData ? "Revenue updated" : "One-time revenue recorded");
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function resetForm() {
    setProjectId("");
    setAmount("");
    setCurrency("EUR");
    setReason("");
    const now = new Date();
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }

  const canSave = projectId && amount && Number(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editData ? "Edit One-Time Revenue" : "Record One-Time Revenue"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Amount</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1"
              />
              <CurrencySelect value={currency} onValueChange={setCurrency} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              placeholder="e.g. License sale, milestone payment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSave || mutation.isPending}>
            {mutation.isPending ? "Saving..." : editData ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
