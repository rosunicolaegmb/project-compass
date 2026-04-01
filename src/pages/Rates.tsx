import { PageHeader } from "@/components/PageHeader";
import { DataTableShell } from "@/components/DataTableShell";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const data = [
  { role: "Senior Project Manager", level: "Senior", internal: "$95/hr", billable: "$185/hr", margin: "49%", headcount: "4" },
  { role: "Technical Lead", level: "Senior", internal: "$105/hr", billable: "$195/hr", margin: "46%", headcount: "3" },
  { role: "Software Engineer", level: "Mid", internal: "$72/hr", billable: "$155/hr", margin: "54%", headcount: "12" },
  { role: "UX/UI Designer", level: "Mid", internal: "$68/hr", billable: "$145/hr", margin: "53%", headcount: "4" },
  { role: "Business Analyst", level: "Mid", internal: "$65/hr", billable: "$140/hr", margin: "54%", headcount: "3" },
  { role: "QA Engineer", level: "Mid", internal: "$60/hr", billable: "$130/hr", margin: "54%", headcount: "5" },
  { role: "DevOps Engineer", level: "Senior", internal: "$90/hr", billable: "$175/hr", margin: "49%", headcount: "3" },
  { role: "Junior Developer", level: "Junior", internal: "$42/hr", billable: "$95/hr", margin: "56%", headcount: "6" },
];

const columns = [
  { key: "role", label: "Delivery Role" },
  { key: "level", label: "Level" },
  { key: "internal", label: "Internal Cost", className: "text-right" },
  { key: "billable", label: "Bill Rate", className: "text-right" },
  { key: "margin", label: "Margin", className: "text-right" },
  { key: "headcount", label: "Headcount", className: "text-center" },
];

export default function Rates() {
  return (
    <div className="page-container">
      <PageHeader title="Delivery Roles & Rates" description="Manage billing rates, internal costs, and margins" actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Role</Button>} />
      <DataTableShell columns={columns} data={data} />
    </div>
  );
}
