
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.project_type AS ENUM ('time_and_materials', 'fixed_price');
CREATE TYPE public.project_status AS ENUM ('draft', 'active', 'on_hold', 'completed', 'archived', 'cancelled');
CREATE TYPE public.phase_status AS ENUM ('planned', 'active', 'completed', 'on_hold');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.app_role AS ENUM ('admin', 'office_admin', 'pm', 'executive_viewer');
CREATE TYPE public.expense_category AS ENUM ('travel', 'software', 'equipment', 'cloud_services', 'training', 'meals', 'other');

-- ============================================================
-- UTILITY FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. USER ROLES
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. CLIENTS
-- ============================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clients_is_active ON public.clients(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_name ON public.clients(name);
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. DELIVERY ROLES
-- ============================================================
CREATE TABLE public.delivery_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  level TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_roles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_delivery_roles_updated_at BEFORE UPDATE ON public.delivery_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. RESOURCES
-- ============================================================
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id TEXT UNIQUE,
  display_name TEXT NOT NULL,
  department TEXT,
  job_title TEXT,
  delivery_role_id UUID REFERENCES public.delivery_roles(id),
  default_bill_rate NUMERIC(12,2),
  default_cost_rate NUMERIC(12,2),
  hire_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_resources_user_id ON public.resources(user_id);
CREATE INDEX idx_resources_delivery_role ON public.resources(delivery_role_id);
CREATE INDEX idx_resources_is_active ON public.resources(is_active) WHERE deleted_at IS NULL;
CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. RESOURCE RATE HISTORY
-- ============================================================
CREATE TABLE public.resource_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  delivery_role_id UUID REFERENCES public.delivery_roles(id),
  bill_rate NUMERIC(12,2) NOT NULL,
  cost_rate NUMERIC(12,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.resource_rate_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rate_history_resource ON public.resource_rate_history(resource_id);
CREATE INDEX idx_rate_history_effective ON public.resource_rate_history(resource_id, effective_from, effective_to);
CREATE TRIGGER update_rate_history_updated_at BEFORE UPDATE ON public.resource_rate_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. PROJECTS
-- ============================================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  project_type public.project_type NOT NULL DEFAULT 'time_and_materials',
  status public.project_status NOT NULL DEFAULT 'draft',
  description TEXT,
  start_date DATE,
  end_date DATE,
  total_budget NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  pm_resource_id UUID REFERENCES public.resources(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_projects_client ON public.projects(client_id);
CREATE INDEX idx_projects_status ON public.projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_pm ON public.projects(pm_resource_id);
CREATE INDEX idx_projects_type ON public.projects(project_type);
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. PROJECT MEMBERS
-- ============================================================
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  delivery_role_id UUID REFERENCES public.delivery_roles(id),
  allocation_percentage NUMERIC(5,2) DEFAULT 100,
  start_date DATE,
  end_date DATE,
  bill_rate_override NUMERIC(12,2),
  cost_rate_override NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, resource_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_resource ON public.project_members(resource_id);
CREATE TRIGGER update_project_members_updated_at BEFORE UPDATE ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 9. PROJECT PHASES
-- ============================================================
CREATE TABLE public.project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status public.phase_status NOT NULL DEFAULT 'planned',
  sort_order INT NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  budget_hours NUMERIC(10,2),
  budget_amount NUMERIC(14,2),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_phases_project ON public.project_phases(project_id);
CREATE INDEX idx_phases_status ON public.project_phases(status) WHERE deleted_at IS NULL;
CREATE TRIGGER update_phases_updated_at BEFORE UPDATE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 10. TIME ENTRIES
-- ============================================================
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.resources(id),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  phase_id UUID REFERENCES public.project_phases(id),
  entry_date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  description TEXT,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  bill_rate NUMERIC(12,2),
  cost_rate NUMERIC(12,2),
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_time_entries_resource ON public.time_entries(resource_id);
CREATE INDEX idx_time_entries_project ON public.time_entries(project_id);
CREATE INDEX idx_time_entries_date ON public.time_entries(entry_date);
CREATE INDEX idx_time_entries_approval ON public.time_entries(approval_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_time_entries_resource_date ON public.time_entries(resource_id, entry_date) WHERE deleted_at IS NULL;
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 11. EXPENSE ENTRIES
-- ============================================================
CREATE TABLE public.expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.resources(id),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  phase_id UUID REFERENCES public.project_phases(id),
  expense_date DATE NOT NULL,
  category public.expense_category NOT NULL DEFAULT 'other',
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  receipt_url TEXT,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_expense_entries_resource ON public.expense_entries(resource_id);
CREATE INDEX idx_expense_entries_project ON public.expense_entries(project_id);
CREATE INDEX idx_expense_entries_date ON public.expense_entries(expense_date);
CREATE INDEX idx_expense_entries_approval ON public.expense_entries(approval_status) WHERE deleted_at IS NULL;
CREATE TRIGGER update_expense_entries_updated_at BEFORE UPDATE ON public.expense_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 12. PROJECT BUDGET BASELINES
-- ============================================================
CREATE TABLE public.project_budget_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  baseline_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_budget NUMERIC(14,2) NOT NULL,
  labor_budget NUMERIC(14,2),
  expense_budget NUMERIC(14,2),
  notes TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version)
);
ALTER TABLE public.project_budget_baselines ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_baselines_project ON public.project_budget_baselines(project_id);
CREATE INDEX idx_baselines_current ON public.project_budget_baselines(project_id) WHERE is_current = true;
CREATE TRIGGER update_baselines_updated_at BEFORE UPDATE ON public.project_budget_baselines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 13. PROJECT BUDGET REVISIONS
-- ============================================================
CREATE TABLE public.project_budget_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id UUID NOT NULL REFERENCES public.project_budget_baselines(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  revision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_budget NUMERIC(14,2) NOT NULL,
  new_budget NUMERIC(14,2) NOT NULL,
  reason TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_budget_revisions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_revisions_project ON public.project_budget_revisions(project_id);
CREATE INDEX idx_revisions_baseline ON public.project_budget_revisions(baseline_id);
CREATE TRIGGER update_revisions_updated_at BEFORE UPDATE ON public.project_budget_revisions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 14. MONTHLY FORECASTS
-- ============================================================
CREATE TABLE public.monthly_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id),
  forecast_month DATE NOT NULL,
  forecast_hours NUMERIC(10,2),
  forecast_labor_cost NUMERIC(14,2),
  forecast_labor_revenue NUMERIC(14,2),
  forecast_expenses NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, phase_id, forecast_month)
);
ALTER TABLE public.monthly_forecasts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_monthly_forecasts_project ON public.monthly_forecasts(project_id);
CREATE INDEX idx_monthly_forecasts_month ON public.monthly_forecasts(forecast_month);
CREATE TRIGGER update_monthly_forecasts_updated_at BEFORE UPDATE ON public.monthly_forecasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 15. QUARTERLY FORECASTS
-- ============================================================
CREATE TABLE public.quarterly_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  fiscal_quarter INT NOT NULL CHECK (fiscal_quarter BETWEEN 1 AND 4),
  forecast_revenue NUMERIC(14,2),
  forecast_cost NUMERIC(14,2),
  forecast_margin NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, fiscal_year, fiscal_quarter)
);
ALTER TABLE public.quarterly_forecasts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_quarterly_forecasts_project ON public.quarterly_forecasts(project_id);
CREATE TRIGGER update_quarterly_forecasts_updated_at BEFORE UPDATE ON public.quarterly_forecasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 16. YEARLY FORECASTS
-- ============================================================
CREATE TABLE public.yearly_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  forecast_revenue NUMERIC(14,2),
  forecast_cost NUMERIC(14,2),
  forecast_margin NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, fiscal_year)
);
ALTER TABLE public.yearly_forecasts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_yearly_forecasts_project ON public.yearly_forecasts(project_id);
CREATE TRIGGER update_yearly_forecasts_updated_at BEFORE UPDATE ON public.yearly_forecasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 17. APPROVALS
-- ============================================================
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  status public.approval_status NOT NULL DEFAULT 'pending',
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_approvals_assigned ON public.approvals(assigned_to, status);
CREATE INDEX idx_approvals_entity ON public.approvals(entity_type, entity_id);
CREATE INDEX idx_approvals_requested ON public.approvals(requested_by);
CREATE TRIGGER update_approvals_updated_at BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 18. AUDIT LOGS
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ============================================================
-- 19. SYSTEM SETTINGS
-- ============================================================
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- SECURITY DEFINER FUNCTIONS (after all tables exist)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;

CREATE OR REPLACE FUNCTION public.get_resource_id_for_user(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.resources WHERE user_id = _user_id LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.project_members pm JOIN public.resources r ON r.id = pm.resource_id WHERE r.user_id = _user_id AND pm.project_id = _project_id); $$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System creates profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- USER ROLES
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- CLIENTS
CREATE POLICY "Authenticated can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and office admins can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins and office admins can update clients" ON public.clients FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins can delete clients" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- DELIVERY ROLES
CREATE POLICY "Authenticated can view delivery roles" ON public.delivery_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage delivery roles" ON public.delivery_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins can update delivery roles" ON public.delivery_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins can delete delivery roles" ON public.delivery_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RESOURCES
CREATE POLICY "Authenticated can view resources" ON public.resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and office admins can insert resources" ON public.resources FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins and office admins can update resources" ON public.resources FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins can delete resources" ON public.resources FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RESOURCE RATE HISTORY
CREATE POLICY "Authenticated can view rate history" ON public.resource_rate_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert rate history" ON public.resource_rate_history FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins can update rate history" ON public.resource_rate_history FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins can delete rate history" ON public.resource_rate_history FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PROJECTS
CREATE POLICY "Authenticated can view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage all projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "PMs can update assigned projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), id));
CREATE POLICY "PMs can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'pm'));

-- PROJECT MEMBERS
CREATE POLICY "Authenticated can view project members" ON public.project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert project members" ON public.project_members FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update project members" ON public.project_members FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete project members" ON public.project_members FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "PMs can insert members on their projects" ON public.project_members FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));
CREATE POLICY "PMs can update members on their projects" ON public.project_members FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));
CREATE POLICY "PMs can delete members on their projects" ON public.project_members FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));

-- PROJECT PHASES
CREATE POLICY "Authenticated can view phases" ON public.project_phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert phases" ON public.project_phases FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update phases" ON public.project_phases FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete phases" ON public.project_phases FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "PMs can insert phases on their projects" ON public.project_phases FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));
CREATE POLICY "PMs can update phases on their projects" ON public.project_phases FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));
CREATE POLICY "PMs can delete phases on their projects" ON public.project_phases FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));

-- TIME ENTRIES
CREATE POLICY "Admins and office admins can select time entries" ON public.time_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins and office admins can insert time entries" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins and office admins can update time entries" ON public.time_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins and office admins can delete time entries" ON public.time_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Resources can view own time entries" ON public.time_entries FOR SELECT TO authenticated USING (resource_id = public.get_resource_id_for_user(auth.uid()));
CREATE POLICY "Resources can insert own time entries" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (resource_id = public.get_resource_id_for_user(auth.uid()));
CREATE POLICY "Resources can update own time entries" ON public.time_entries FOR UPDATE TO authenticated USING (resource_id = public.get_resource_id_for_user(auth.uid()));
CREATE POLICY "Resources can delete own time entries" ON public.time_entries FOR DELETE TO authenticated USING (resource_id = public.get_resource_id_for_user(auth.uid()));
CREATE POLICY "PMs can view time entries on their projects" ON public.time_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));

-- EXPENSE ENTRIES
CREATE POLICY "Admins and office admins can select expenses" ON public.expense_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins and office admins can insert expenses" ON public.expense_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins and office admins can update expenses" ON public.expense_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Admins and office admins can delete expenses" ON public.expense_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Resources can view own expenses" ON public.expense_entries FOR SELECT TO authenticated USING (resource_id = public.get_resource_id_for_user(auth.uid()));
CREATE POLICY "Resources can insert own expenses" ON public.expense_entries FOR INSERT TO authenticated WITH CHECK (resource_id = public.get_resource_id_for_user(auth.uid()));
CREATE POLICY "Resources can update own expenses" ON public.expense_entries FOR UPDATE TO authenticated USING (resource_id = public.get_resource_id_for_user(auth.uid()));
CREATE POLICY "Resources can delete own expenses" ON public.expense_entries FOR DELETE TO authenticated USING (resource_id = public.get_resource_id_for_user(auth.uid()));
CREATE POLICY "PMs can view expenses on their projects" ON public.expense_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));

-- BUDGET BASELINES
CREATE POLICY "Authenticated can view baselines" ON public.project_budget_baselines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert baselines" ON public.project_budget_baselines FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update baselines" ON public.project_budget_baselines FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete baselines" ON public.project_budget_baselines FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "PMs can insert baselines on their projects" ON public.project_budget_baselines FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));
CREATE POLICY "PMs can update baselines on their projects" ON public.project_budget_baselines FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));

-- BUDGET REVISIONS
CREATE POLICY "Authenticated can view revisions" ON public.project_budget_revisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert revisions" ON public.project_budget_revisions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update revisions" ON public.project_budget_revisions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "PMs can insert revisions on their projects" ON public.project_budget_revisions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));
CREATE POLICY "PMs can update revisions on their projects" ON public.project_budget_revisions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));

-- MONTHLY FORECASTS
CREATE POLICY "Authenticated can view monthly forecasts" ON public.monthly_forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert monthly forecasts" ON public.monthly_forecasts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update monthly forecasts" ON public.monthly_forecasts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete monthly forecasts" ON public.monthly_forecasts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "PMs can insert monthly forecasts on their projects" ON public.monthly_forecasts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));
CREATE POLICY "PMs can update monthly forecasts on their projects" ON public.monthly_forecasts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));

-- QUARTERLY FORECASTS
CREATE POLICY "Authenticated can view quarterly forecasts" ON public.quarterly_forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert quarterly forecasts" ON public.quarterly_forecasts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update quarterly forecasts" ON public.quarterly_forecasts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete quarterly forecasts" ON public.quarterly_forecasts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "PMs can insert quarterly forecasts on their projects" ON public.quarterly_forecasts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));
CREATE POLICY "PMs can update quarterly forecasts on their projects" ON public.quarterly_forecasts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));

-- YEARLY FORECASTS
CREATE POLICY "Authenticated can view yearly forecasts" ON public.yearly_forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert yearly forecasts" ON public.yearly_forecasts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update yearly forecasts" ON public.yearly_forecasts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete yearly forecasts" ON public.yearly_forecasts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "PMs can insert yearly forecasts on their projects" ON public.yearly_forecasts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));
CREATE POLICY "PMs can update yearly forecasts on their projects" ON public.yearly_forecasts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'pm') AND public.is_project_member(auth.uid(), project_id));

-- APPROVALS
CREATE POLICY "Admins can manage all approvals" ON public.approvals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Assigned users can view approvals" ON public.approvals FOR SELECT TO authenticated USING (auth.uid() = assigned_to OR auth.uid() = requested_by);
CREATE POLICY "Assigned users can update approvals" ON public.approvals FOR UPDATE TO authenticated USING (auth.uid() = assigned_to);
CREATE POLICY "Authenticated can create approvals" ON public.approvals FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);

-- AUDIT LOGS (read-only for admins)
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- SYSTEM SETTINGS
CREATE POLICY "Authenticated can view system settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage system settings" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- AUDIT LOG TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_values)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_project_phases AFTER INSERT OR UPDATE OR DELETE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_time_entries AFTER INSERT OR UPDATE OR DELETE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_expense_entries AFTER INSERT OR UPDATE OR DELETE ON public.expense_entries FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_project_budget_baselines AFTER INSERT OR UPDATE OR DELETE ON public.project_budget_baselines FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ============================================================
-- DEFAULT SYSTEM SETTINGS
-- ============================================================
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
  ('default_currency', '"USD"', 'Default currency for new projects'),
  ('fiscal_year_start_month', '1', 'Month number when fiscal year starts (1=January)'),
  ('timesheet_approval_required', 'true', 'Whether timesheets require approval'),
  ('expense_approval_required', 'true', 'Whether expenses require approval'),
  ('max_daily_hours', '24', 'Maximum hours allowed per day per resource');
