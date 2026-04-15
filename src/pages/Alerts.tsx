import { PageHeader } from "@/components/PageHeader";
import { DataTableShell } from "@/components/DataTableShell";

const data = [
  { timestamp: "Jun 20, 2024 14:32", user: "Alice Wang", action: "Updated", entity: "Project", detail: "Cloud Migration – Acme: budget revised to $245,000" },
  { timestamp: "Jun 20, 2024 13:18", user: "Bob Martin", action: "Approved", entity: "Timesheet", detail: "Week Jun 17–21 for Carol Lee" },
  { timestamp: "Jun 20, 2024 11:45", user: "System", action: "Created", entity: "Expense", detail: "Auto-imported AWS invoice – $4,800" },
  { timestamp: "Jun 19, 2024 16:22", user: "Dave Kim", action: "Completed", entity: "Phase", detail: "Data Warehouse Setup – QA phase marked complete" },
  { timestamp: "Jun 19, 2024 10:05", user: "Alice Wang", action: "Created", entity: "Project", detail: "Security Audit Phase 2 – draft created" },
  { timestamp: "Jun 18, 2024 09:30", user: "Admin", action: "Updated", entity: "Rate", detail: "Senior PM rate updated: $180 → $185/hr" },
];

const columns = [
  { key: "timestamp", label: "Timestamp" },
  { key: "user", label: "User" },
  { key: "action", label: "Action" },
  { key: "entity", label: "Entity" },
  { key: "detail", label: "Details" },
];

export default function AuditLog() {
  return (
    <div className="page-container">
      <PageHeader title="Audit Log" description="Track all system changes and user actions" />
      <DataTableShell columns={columns} data={data} />
    </div>
  );
}
