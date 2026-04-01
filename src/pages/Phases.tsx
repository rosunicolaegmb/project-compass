import { PageHeader } from "@/components/PageHeader";
import { DataTableShell } from "@/components/DataTableShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const data = [
  { name: "Discovery & Planning", project: "Cloud Migration – Acme", start: "Jan 15, 2024", end: "Feb 28, 2024", budget: "$35,000", actual: "$32,400", status: <StatusBadge status="completed" /> },
  { name: "Infrastructure Setup", project: "Cloud Migration – Acme", start: "Mar 1, 2024", end: "May 15, 2024", budget: "$95,000", actual: "$78,200", status: <StatusBadge status="active" /> },
  { name: "Data Migration", project: "Cloud Migration – Acme", start: "May 16, 2024", end: "Jul 31, 2024", budget: "$115,000", actual: "$71,800", status: <StatusBadge status="active" /> },
  { name: "Requirements Phase", project: "ERP Implementation", start: "Oct 1, 2023", end: "Dec 15, 2023", budget: "$80,000", actual: "$82,500", status: <StatusBadge status="completed" /> },
  { name: "Development Sprint 1-4", project: "ERP Implementation", start: "Jan 2, 2024", end: "Jun 30, 2024", budget: "$320,000", actual: "$345,000", status: <StatusBadge status="at-risk" /> },
];

const columns = [
  { key: "name", label: "Phase" },
  { key: "project", label: "Project" },
  { key: "start", label: "Start Date" },
  { key: "end", label: "End Date" },
  { key: "budget", label: "Budget", className: "text-right" },
  { key: "actual", label: "Actual", className: "text-right" },
  { key: "status", label: "Status" },
];

export default function Phases() {
  return (
    <div className="page-container">
      <PageHeader title="Project Phases" description="Track milestones and phase-level budgets" actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Phase</Button>} />
      <DataTableShell columns={columns} data={data} />
    </div>
  );
}
