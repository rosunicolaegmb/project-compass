import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Wallet, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEARS = Array.from({ length: 10 }, (_, i) => 2024 + i);

export default function SalariesPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Fetch active resources
  const { data: resources = [] } = useQuery({
    queryKey: ["resources-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, display_name, employment_type")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing costs for selected month/year
  const { data: existingCosts, isLoading } = useQuery({
    queryKey: ["resource-monthly-costs", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_monthly_costs")
        .select("resource_id, amount")
        .eq("year", Number(selectedYear))
        .eq("month", Number(selectedMonth));
      if (error) throw error;
      return data;
    },
  });

  // Populate amounts when data loads
  useEffect(() => {
    const map: Record<string, string> = {};
    resources.forEach((r) => {
      const existing = existingCosts?.find((c) => c.resource_id === r.id);
      map[r.id] = existing ? String(existing.amount) : "";
    });
    setAmounts(map);
  }, [existingCosts, resources]);

  const handleSave = async () => {
    setSaving(true);
    const year = Number(selectedYear);
    const month = Number(selectedMonth);

    const upserts = Object.entries(amounts)
      .filter(([_, val]) => val !== "" && !isNaN(Number(val)))
      .map(([resourceId, amount]) => ({
        resource_id: resourceId,
        year,
        month,
        amount: Number(amount),
      }));

    if (upserts.length === 0) {
      toast.info("No amounts to save");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("resource_monthly_costs")
      .upsert(upserts, { onConflict: "resource_id,year,month" });

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success(`Saved costs for ${MONTHS[month - 1]} ${year}`);
      queryClient.invalidateQueries({ queryKey: ["resource-monthly-costs", selectedYear, selectedMonth] });
    }
    setSaving(false);
  };

  const monthLabel = `${MONTHS[Number(selectedMonth) - 1]} ${selectedYear}`;

  return (
    <div className="page-container">
      <PageHeader title="Salaries & Contractors" description="Monthly cost amounts per resource" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Monthly Costs
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : resources.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No active resources found.</p>
          ) : (
            <>
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_200px] gap-4 pb-2 border-b">
                  <Label className="text-xs text-muted-foreground font-medium">Resource</Label>
                  <Label className="text-xs text-muted-foreground font-medium">Monthly Amount (EUR)</Label>
                </div>
                {resources.map((resource) => (
                  <div key={resource.id} className="grid grid-cols-[1fr_200px] gap-4 items-center">
                    <div>
                      <p className="text-sm font-medium text-foreground">{resource.display_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {resource.employment_type?.replace("_", " ") || "—"}
                      </p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amounts[resource.id] ?? ""}
                      onChange={(e) =>
                        setAmounts((prev) => ({ ...prev, [resource.id]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              <Separator className="my-6" />
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save for {monthLabel}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
