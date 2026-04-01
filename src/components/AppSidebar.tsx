import {
  LayoutDashboard, Users, FolderKanban, Layers, UserCog,
  BadgeDollarSign, Clock, Receipt, TrendingUp, BarChart3,
  ScrollText, Settings, Wrench, LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canViewModule, type ModuleKey } from "@/lib/auth-helpers";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  module: ModuleKey;
}

const mainNav: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
  { title: "Clients", url: "/clients", icon: Users, module: "clients" },
  { title: "Projects", url: "/projects", icon: FolderKanban, module: "projects" },
  { title: "Project Phases", url: "/phases", icon: Layers, module: "phases" },
];

const resourceNav: NavItem[] = [
  { title: "Resources", url: "/resources", icon: UserCog, module: "resources" },
  { title: "Roles & Rates", url: "/rates", icon: BadgeDollarSign, module: "rates" },
  { title: "Timesheets", url: "/timesheets", icon: Clock, module: "timesheets" },
  { title: "Expenses", url: "/expenses", icon: Receipt, module: "expenses" },
];

const analysisNav: NavItem[] = [
  { title: "Forecasting", url: "/forecasting", icon: TrendingUp, module: "forecasting" },
  { title: "Reports", url: "/reports", icon: BarChart3, module: "reports" },
  { title: "Audit Log", url: "/audit-log", icon: ScrollText, module: "auditLog" },
];

const systemNav: NavItem[] = [
  { title: "Settings", url: "/settings", icon: Settings, module: "settings" },
  { title: "Configure", url: "/configure", icon: Wrench, module: "configure" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, roles, signOut } = useAuth();
  const location = useLocation();

  const displayName = user?.user_metadata?.full_name || user?.email || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const roleName = roles.length > 0
    ? roles.map(r => r.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())).join(", ")
    : "No role assigned";

  const renderGroup = (label: string, items: NavItem[]) => {
    const visibleItems = items.filter((item) => canViewModule(roles, item.module));
    if (visibleItems.length === 0) return null;

    return (
      <SidebarGroup key={label}>
        {!collapsed && (
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            {label}
          </SidebarGroupLabel>
        )}
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end={item.url === "/"}
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="text-sm">{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-sidebar-accent-foreground">BudgetTrack</h2>
                <p className="text-[10px] text-sidebar-foreground/50">IT Project Finance</p>
              </div>
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {renderGroup("Overview", mainNav)}
        {renderGroup("Operations", resourceNav)}
        {renderGroup("Analysis", analysisNav)}
        {renderGroup("System", systemNav)}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-muted">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{displayName}</p>
                <p className="text-[10px] text-sidebar-foreground/50 truncate">{roleName}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent rounded-md transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
