import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
}

export function StatCard({ title, value, change, changeType = "neutral", icon: Icon, iconColor }: StatCardProps) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", iconColor || "bg-primary/10")}>
          <Icon className={cn("h-4 w-4", iconColor ? "text-primary-foreground" : "text-primary")} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {change && (
        <p className={cn(
          "text-xs font-medium",
          changeType === "positive" && "text-success",
          changeType === "negative" && "text-destructive",
          changeType === "neutral" && "text-muted-foreground"
        )}>
          {change}
        </p>
      )}
    </div>
  );
}
