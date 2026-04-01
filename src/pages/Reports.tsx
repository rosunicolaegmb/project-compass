import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { DollarSign, TrendingUp, Users, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const marginData = [
  { project: "Cloud Migr.", margin: 42 },
  { project: "ERP Impl.", margin: 18 },
  { project: "Mobile App", margin: 38 },
  { project: "Data WH", margin: 45 },
  { project: "Sec. Audit", margin: 52 },
];

const tooltipStyle = { backgroundColor: "hsl(220, 25%, 11%)", border: "1px solid hsl(220, 20%, 18%)", borderRadius: 8, color: "hsl(220, 10%, 90%)" };

export default function Reports() {
  return (
    <div className="page-container">
      <PageHeader title="Reports" description="Financial summaries and operational insights" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="YTD Revenue" value="$1.84M" change="+12% vs last year" changeType="positive" />
        <StatCard icon={TrendingUp} title="Avg Margin" value="38.2%" change="+2.1pp vs target" changeType="positive" />
        <StatCard icon={Users} title="Avg Utilization" value="86%" change="-1% vs target" changeType="negative" />
        <StatCard icon={BarChart3} title="Projects Delivered" value="12" change="On time: 10/12" changeType="neutral" />
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Margin by Project (%)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={marginData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" vertical={false} />
            <XAxis dataKey="project" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`]} />
            <Bar dataKey="margin" fill="hsl(187, 72%, 40%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
