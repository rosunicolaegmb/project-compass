import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "active" | "completed" | "on-hold" | "at-risk" | "draft" | "archived" | "approved" | "pending" | "sow_expired" | "cancelled" | "not_invited" | "invitation_sent";

const statusStyles: Record<Status, string> = {
  active: "bg-success/10 text-success border-success/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  "on-hold": "bg-warning/10 text-warning border-warning/20",
  "at-risk": "bg-destructive/10 text-destructive border-destructive/20",
  draft: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted text-muted-foreground border-border",
  approved: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  sow_expired: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
  not_invited: "bg-muted text-muted-foreground border-border",
  invitation_sent: "bg-warning/10 text-warning border-warning/20",
};

const statusLabels: Partial<Record<Status, string>> = {
  sow_expired: "SOW Expired",
  "on-hold": "On Hold",
  "at-risk": "At Risk",
  not_invited: "Not Invited",
  invitation_sent: "Invitation Sent",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium capitalize", statusStyles[status])}>
      {statusLabels[status] || status}
    </Badge>
  );
}
