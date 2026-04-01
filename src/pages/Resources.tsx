import { PageHeader } from "@/components/PageHeader";
import { DataTableShell } from "@/components/DataTableShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const data = [
  { name: "Alice Wang", role: "Senior PM", department: "Delivery", utilization: "94%", projects: "3", rate: "$185/hr", status: <StatusBadge status="active" /> },
  { name: "Bob Martin", role: "Tech Lead", department: "Engineering", utilization: "88%", projects: "2", rate: "$195/hr", status: <StatusBadge status="active" /> },
  { name: "Carol Lee", role: "UX Designer", department: "Design", utilization: "76%", projects: "2", rate: "$155/hr", status: <StatusBadge status="active" /> },
  { name: "Dave Kim", role: "DevOps Engineer", department: "Engineering", utilization: "82%", projects: "4", rate: "$175/hr", status: <StatusBadge status="active" /> },
  { name: "Eve Torres", role: "Business Analyst", department: "Delivery", utilization: "45%", projects: "1", rate: "$140/hr", status: <StatusBadge status="active" /> },
];

const columns = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "department", label: "Department" },
  { key: "utilization", label: "Utilization" },
  { key: "projects", label: "Projects", className: "text-center" },
  { key: "rate", label: "Bill Rate", className: "text-right" },
  { key: "status", label: "Status" },
];

export default function Resources() {
  return (
    <div className="page-container">
      <PageHeader title="Resources" description="Manage team members and allocation" actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Resource</Button>} />
      <DataTableShell columns={columns} data={data} />
    </div>
  );
}
