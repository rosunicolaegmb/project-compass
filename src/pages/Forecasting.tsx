import { PageHeader } from "@/components/PageHeader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const forecastData = [
  { month: "Jul", forecast: 168000, optimistic: 185000, pessimistic: 145000 },
  { month: "Aug", forecast: 172000, optimistic: 192000, pessimistic: 150000 },
  { month: "Sep", forecast: 165000, optimistic: 180000, pessimistic: 142000 },
  { month: "Oct", forecast: 178000, optimistic: 198000, pessimistic: 155000 },
  { month: "Nov", forecast: 155000, optimistic: 170000, pessimistic: 135000 },
  { month: "Dec", forecast: 140000, optimistic: 155000, pessimistic: 120000 },
];

const projectForecast = [
  { project: "Cloud Migration", q3: 115000, q4: 95000 },
  { project: "ERP Impl.", q3: 22000, q4: 0 },
  { project: "Mobile App", q3: 84000, q4: 42000 },
  { project: "Security Audit", q3: 63000, q4: 12000 },
  { project: "New Pipeline", q3: 0, q4: 85000 },
];

const tooltipStyle = { backgroundColor: "hsl(220, 25%, 11%)", border: "1px solid hsl(220, 20%, 18%)", borderRadius: 8, color: "hsl(220, 10%, 90%)" };

export default function Forecasting() {
  return (
    <div className="page-container">
      <PageHeader title="Forecasting" description="Revenue projections and scenario planning" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Revenue Forecast (H2 2024)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`$${(value / 1000).toFixed(0)}k`]} />
              <Legend />
              <Line type="monotone" dataKey="optimistic" stroke="hsl(160, 60%, 40%)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="forecast" stroke="hsl(187, 72%, 40%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="pessimistic" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Project Revenue by Quarter</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projectForecast} layout="vertical" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" tickFormatter={(v) => `$${v / 1000}k`} />
              <YAxis type="category" dataKey="project" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" width={100} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`$${(value / 1000).toFixed(0)}k`]} />
              <Legend />
              <Bar dataKey="q3" fill="hsl(187, 72%, 40%)" radius={[0, 4, 4, 0]} name="Q3" />
              <Bar dataKey="q4" fill="hsl(262, 60%, 55%)" radius={[0, 4, 4, 0]} name="Q4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
