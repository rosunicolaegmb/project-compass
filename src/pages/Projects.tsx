import { PageHeader } from "@/components/PageHeader";
import { DataTableShell } from "@/components/DataTableShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const data = [
  { name: "Cloud Migration – Acme Corp", client: "Acme Corp", type: "T&M", pm: "Alice Wang", budget: "$245,000", consumed: <Progress value={74} className="w-20 h-2" />, status: <StatusBadge status="active" /> },
  { name: "ERP Implementation", client: "TechFlow Inc", type: "Fixed Price", pm: "Bob Martin", budget: "$520,000", consumed: <Progress value={96} className="w-20 h-2" />, status: <StatusBadge status="at-risk" /> },
  { name: "Mobile App Redesign", client: "RetailMax", type: "T&M", pm: "Carol Lee", budget: "$180,000", consumed: <Progress value={53} className="w-20 h-2" />, status: <StatusBadge status="active" /> },
  { name: "Data Warehouse Setup", client: "FinServe Ltd", type: "Fixed Price", pm: "Dave Kim", budget: "$340,000", consumed: <Progress value={100} className="w-20 h-2" />, status: <StatusBadge status="completed" /> },
  { name: "Security Audit Phase 2", client: "Acme Corp", type: "T&M", pm: "Alice Wang", budget: "$75,000", consumed: <Progress value={16} className="w-20 h-2" />, status: <StatusBadge status="draft" /> },
];

const columns = [
  { key: "name", label: "Project" },
  { key: "client", label: "Client" },
  { key: "type", label: "Type" },
  { key: "pm", label: "PM" },
  { key: "budget", label: "Budget", className: "text-right" },
  { key: "consumed", label: "Consumed" },
  { key: "status", label: "Status" },
];

export default function Projects() {
  return (
    <div className="page-container">
      <PageHeader title="Projects" description="Manage project budgets, scope, and delivery" actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />New Project</Button>} />
      <DataTableShell columns={columns} data={data} />
    </div>
  );
}
