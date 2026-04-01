import { PageHeader } from "@/components/PageHeader";
import { DataTableShell } from "@/components/DataTableShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const data = [
  { name: "Acme Corporation", contact: "Jane Smith", email: "jane@acme.com", projects: "5", revenue: "$1.2M", status: <StatusBadge status="active" /> },
  { name: "TechFlow Inc", contact: "Mike Johnson", email: "mike@techflow.com", projects: "3", revenue: "$840K", status: <StatusBadge status="active" /> },
  { name: "RetailMax", contact: "Sarah Chen", email: "sarah@retailmax.com", projects: "2", revenue: "$320K", status: <StatusBadge status="active" /> },
  { name: "FinServe Ltd", contact: "Robert Davis", email: "robert@finserve.com", projects: "4", revenue: "$960K", status: <StatusBadge status="active" /> },
  { name: "GreenTech Solutions", contact: "Lisa Park", email: "lisa@greentech.com", projects: "1", revenue: "$150K", status: <StatusBadge status="draft" /> },
];

const columns = [
  { key: "name", label: "Client Name" },
  { key: "contact", label: "Primary Contact" },
  { key: "email", label: "Email" },
  { key: "projects", label: "Projects", className: "text-center" },
  { key: "revenue", label: "Total Revenue", className: "text-right" },
  { key: "status", label: "Status" },
];

export default function Clients() {
  return (
    <div className="page-container">
      <PageHeader title="Clients" description="Manage client accounts and relationships" actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Client</Button>} />
      <DataTableShell columns={columns} data={data} />
    </div>
  );
}
