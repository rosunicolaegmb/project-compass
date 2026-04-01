import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTableShell } from "@/components/DataTableShell";
import { DollarSign, FolderKanban, TrendingUp, AlertTriangle, Users, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const revenueData = [
  { month: "Jan", budget: 120000, actual: 115000 },
  { month: "Feb", budget: 135000, actual: 128000 },
  { month: "Mar", budget: 142000, actual: 139000 },
  { month: "Apr", budget: 128000, actual: 131000 },
  { month: "May", budget: 155000, actual: 148000 },
  { month: "Jun", budget: 162000, actual: 157000 },
];

const projectTypeData = [
  { name: "T&M", value: 12, color: "hsl(187, 72%, 40%)" },
  { name: "Fixed Price", value: 8, color: "hsl(160, 60%, 40%)" },
  { name: "Retainer", value: 4, color: "hsl(38, 92%, 50%)" },
];

const recentProjects = [
  { project: "Cloud Migration – Acme Corp", client: "Acme Corp", type: "T&M", budget: "$245,000", spent: "$182,400", status: <StatusBadge status="active" /> },
  { project: "ERP Implementation", client: "TechFlow Inc", type: "Fixed Price", budget: "$520,000", spent: "$498,000", status: <StatusBadge status="at-risk" /> },
  { project: "Mobile App Redesign", client: "RetailMax", type: "T&M", budget: "$180,000", spent: "$95,200", status: <StatusBadge status="active" /> },
  { project: "Data Warehouse Setup", client: "FinServe Ltd", type: "Fixed Price", budget: "$340,000", spent: "$340,000", status: <StatusBadge status="completed" /> },
  { project: "Security Audit Phase 2", client: "Acme Corp", type: "T&M", budget: "$75,000", spent: "$12,000", status: <StatusBadge status="draft" /> },
];

const projectColumns = [
  { key: "project", label: "Project" },
  { key: "client", label: "Client" },
  { key: "type", label: "Type" },
  { key: "budget", label: "Budget", className: "text-right" },
  { key: "spent", label: "Spent", className: "text-right" },
  { key: "status", label: "Status" },
];

export default function Dashboard() {
  return (
    <div className="page-container">
      <PageHeader title="Dashboard" description="Overview of project finances and key metrics" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={FolderKanban} title="Active Projects" value="24" change="+3 this month" changeType="positive" />
        <StatCard icon={DollarSign} title="Total Budget" value="$2.4M" change="Across all active" changeType="neutral" />
        <StatCard icon={TrendingUp} title="Revenue MTD" value="$157K" change="+8.2% vs forecast" changeType="positive" />
        <StatCard icon={AlertTriangle} title="At Risk" value="3" change="2 budget, 1 timeline" changeType="negative" iconColor="bg-destructive/10" />
        <StatCard icon={Users} title="Active Resources" value="48" change="92% utilization" changeType="positive" />
        <StatCard icon={Clock} title="Hours This Week" value="1,842" change="-2.1% vs target" changeType="negative" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Budget vs Actual (2024)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(220, 25%, 11%)", border: "1px solid hsl(220, 20%, 18%)", borderRadius: 8, color: "hsl(220, 10%, 90%)" }}
                formatter={(value: number) => [`$${(value / 1000).toFixed(0)}k`, ""]}
              />
              <Bar dataKey="budget" fill="hsl(187, 72%, 40%)" radius={[4, 4, 0, 0]} name="Budget" />
              <Bar dataKey="actual" fill="hsl(160, 60%, 40%)" radius={[4, 4, 0, 0]} name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Projects by Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={projectTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {projectTypeData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "hsl(220, 25%, 11%)", border: "1px solid hsl(220, 20%, 18%)", borderRadius: 8, color: "hsl(220, 10%, 90%)" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {projectTypeData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Recent Projects</h3>
        <DataTableShell columns={projectColumns} data={recentProjects} />
      </div>
    </div>
  );
}
