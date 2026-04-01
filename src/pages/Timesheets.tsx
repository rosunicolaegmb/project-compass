import { PageHeader } from "@/components/PageHeader";
import { DataTableShell } from "@/components/DataTableShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const data = [
  { resource: "Alice Wang", project: "Cloud Migration – Acme", week: "Jun 17–21", mon: "8", tue: "8", wed: "7", thu: "8", fri: "6", total: "37", status: <StatusBadge status="approved" /> },
  { resource: "Bob Martin", project: "ERP Implementation", week: "Jun 17–21", mon: "8", tue: "8", wed: "8", thu: "8", fri: "8", total: "40", status: <StatusBadge status="approved" /> },
  { resource: "Carol Lee", project: "Mobile App Redesign", week: "Jun 17–21", mon: "6", tue: "8", wed: "8", thu: "7", fri: "4", total: "33", status: <StatusBadge status="pending" /> },
  { resource: "Dave Kim", project: "Data Warehouse Setup", week: "Jun 17–21", mon: "8", tue: "8", wed: "8", thu: "8", fri: "8", total: "40", status: <StatusBadge status="approved" /> },
  { resource: "Eve Torres", project: "Security Audit Phase 2", week: "Jun 17–21", mon: "4", tue: "6", wed: "4", thu: "6", fri: "0", total: "20", status: <StatusBadge status="pending" /> },
];

const columns = [
  { key: "resource", label: "Resource" },
  { key: "project", label: "Project" },
  { key: "week", label: "Week" },
  { key: "mon", label: "Mon", className: "text-center" },
  { key: "tue", label: "Tue", className: "text-center" },
  { key: "wed", label: "Wed", className: "text-center" },
  { key: "thu", label: "Thu", className: "text-center" },
  { key: "fri", label: "Fri", className: "text-center" },
  { key: "total", label: "Total", className: "text-center font-medium" },
  { key: "status", label: "Status" },
];

export default function Timesheets() {
  return (
    <div className="page-container">
      <PageHeader title="Timesheets" description="Track and approve time entries" actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Log Time</Button>} />
      <DataTableShell columns={columns} data={data} />
    </div>
  );
}
