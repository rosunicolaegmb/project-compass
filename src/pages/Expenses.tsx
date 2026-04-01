import { PageHeader } from "@/components/PageHeader";
import { DataTableShell } from "@/components/DataTableShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const data = [
  { date: "Jun 18, 2024", resource: "Alice Wang", project: "Cloud Migration – Acme", category: "Travel", description: "Client site visit – flights", amount: "$480.00", status: <StatusBadge status="approved" /> },
  { date: "Jun 15, 2024", resource: "Bob Martin", project: "ERP Implementation", category: "Software", description: "Jira license – annual", amount: "$1,200.00", status: <StatusBadge status="approved" /> },
  { date: "Jun 14, 2024", resource: "Carol Lee", project: "Mobile App Redesign", category: "Equipment", description: "Testing devices", amount: "$2,350.00", status: <StatusBadge status="pending" /> },
  { date: "Jun 12, 2024", resource: "Dave Kim", project: "Data Warehouse Setup", category: "Cloud Services", description: "AWS infrastructure – June", amount: "$4,800.00", status: <StatusBadge status="approved" /> },
  { date: "Jun 10, 2024", resource: "Alice Wang", project: "Cloud Migration – Acme", category: "Training", description: "Azure certification", amount: "$650.00", status: <StatusBadge status="pending" /> },
];

const columns = [
  { key: "date", label: "Date" },
  { key: "resource", label: "Submitted By" },
  { key: "project", label: "Project" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount", className: "text-right" },
  { key: "status", label: "Status" },
];

export default function Expenses() {
  return (
    <div className="page-container">
      <PageHeader title="Expenses" description="Track and approve project expenses" actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Expense</Button>} />
      <DataTableShell columns={columns} data={data} />
    </div>
  );
}
