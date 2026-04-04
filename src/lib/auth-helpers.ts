import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * Check if a user has a specific role (client-side check).
 * RLS on the server is the real enforcement layer.
 */
export async function checkUserRole(userId: string, role: AppRole): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  return !error && !!data;
}

/**
 * Get all roles for a user.
 */
export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error || !data) return [];
  return data.map((r) => r.role);
}

/**
 * Check if the current user is a member of a project (client-side).
 */
export async function isUserProjectMember(projectId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Get the resource for this user
  const { data: resource } = await supabase
    .from("resources")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!resource) return false;

  const { data: membership } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("resource_id", resource.id)
    .maybeSingle();

  return !!membership;
}

/**
 * Assign a role to a user (admin only — enforced by RLS).
 */
export async function assignRole(userId: string, role: AppRole) {
  return supabase
    .from("user_roles")
    .insert({ user_id: userId, role });
}

/**
 * Remove a role from a user (admin only — enforced by RLS).
 */
export async function removeRole(userId: string, role: AppRole) {
  return supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", role);
}

/**
 * Role-based permission matrix.
 * Maps modules to which roles can view/edit them.
 */
export const PERMISSIONS = {
  dashboard: { view: ["admin", "office_admin", "pm", "executive_viewer"] as AppRole[], edit: [] as AppRole[] },
  clients: { view: ["admin", "office_admin", "pm", "executive_viewer"] as AppRole[], edit: ["admin", "office_admin"] as AppRole[] },
  projects: { view: ["admin", "office_admin", "pm", "executive_viewer"] as AppRole[], edit: ["admin", "pm"] as AppRole[] },
  phases: { view: ["admin", "office_admin", "pm", "executive_viewer"] as AppRole[], edit: ["admin", "pm"] as AppRole[] },
  resources: { view: ["admin", "office_admin", "pm", "executive_viewer"] as AppRole[], edit: ["admin", "office_admin"] as AppRole[] },
  rates: { view: ["admin", "office_admin", "pm", "executive_viewer"] as AppRole[], edit: ["admin", "office_admin"] as AppRole[] },
  timesheets: { view: ["admin", "office_admin", "pm", "reporter"] as AppRole[], edit: ["admin", "office_admin", "pm", "reporter"] as AppRole[] },
  expenses: { view: ["admin", "office_admin", "pm"] as AppRole[], edit: ["admin", "office_admin", "pm"] as AppRole[] },
  forecasting: { view: ["admin", "pm", "executive_viewer"] as AppRole[], edit: ["admin", "pm"] as AppRole[] },
  reports: { view: ["admin", "office_admin", "pm", "executive_viewer"] as AppRole[], edit: [] as AppRole[] },
  auditLog: { view: ["admin"] as AppRole[], edit: [] as AppRole[] },
  settings: { view: ["admin"] as AppRole[], edit: ["admin"] as AppRole[] },
  configure: { view: ["admin"] as AppRole[], edit: ["admin"] as AppRole[] },
  conversionRates: { view: ["admin"] as AppRole[], edit: ["admin"] as AppRole[] },
  salaries: { view: ["admin"] as AppRole[], edit: ["admin"] as AppRole[] },
} as const;

export type ModuleKey = keyof typeof PERMISSIONS;

/**
 * Check if a role can view a module.
 */
export function canViewModule(roles: AppRole[], module: ModuleKey): boolean {
  return roles.some((r) => PERMISSIONS[module].view.includes(r));
}

/**
 * Check if a role can edit in a module.
 */
export function canEditModule(roles: AppRole[], module: ModuleKey): boolean {
  return roles.some((r) => PERMISSIONS[module].edit.includes(r));
}
