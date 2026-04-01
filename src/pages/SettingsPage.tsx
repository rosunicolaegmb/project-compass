import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building, Bell } from "lucide-react";

const users = [
  { name: "John Doe", email: "john@company.com", role: "Admin" },
  { name: "Alice Wang", email: "alice@company.com", role: "PM" },
  { name: "Bob Martin", email: "bob@company.com", role: "PM" },
  { name: "Sarah Chen", email: "sarah@company.com", role: "Office Admin" },
  { name: "James Wilson", email: "james@company.com", role: "Executive Viewer" },
];

const roleColors: Record<string, string> = {
  Admin: "bg-primary/10 text-primary border-primary/20",
  PM: "bg-success/10 text-success border-success/20",
  "Office Admin": "bg-warning/10 text-warning border-warning/20",
  "Executive Viewer": "bg-muted text-muted-foreground border-border",
};

export default function SettingsPage() {
  return (
    <div className="page-container">
      <PageHeader title="Settings" description="Application configuration and user management" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Building className="h-4 w-4" />Company Settings</CardTitle>
              <CardDescription>Configure organization-level settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input id="company" defaultValue="TechServ Solutions" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Input id="currency" defaultValue="USD" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fiscal">Fiscal Year Start</Label>
                  <Input id="fiscal" defaultValue="January" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input id="timezone" defaultValue="America/New_York" />
                </div>
              </div>
              <Button size="sm">Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />User Management</CardTitle>
              <CardDescription>Manage users and their roles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.email} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant="outline" className={roleColors[user.role]}>{user.role}</Badge>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <Button size="sm" variant="outline">Invite User</Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" />Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="font-medium text-foreground">Admin</p><p className="text-muted-foreground text-xs">Full system access</p></div>
              <div><p className="font-medium text-foreground">Office Admin</p><p className="text-muted-foreground text-xs">Timesheets, expenses, resources, ops data</p></div>
              <div><p className="font-medium text-foreground">PM</p><p className="text-muted-foreground text-xs">Assigned project budgets, phases, forecasts</p></div>
              <div><p className="font-medium text-foreground">Executive Viewer</p><p className="text-muted-foreground text-xs">Read-only dashboards and reports</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" />Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Budget threshold alerts, timesheet reminders, and expense approval notifications will be configurable here.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
