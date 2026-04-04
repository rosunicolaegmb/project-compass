export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          assigned_to: string
          created_at: string
          decided_at: string | null
          decision_note: string | null
          entity_id: string
          entity_type: string
          id: string
          requested_by: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          assigned_to: string
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          entity_id: string
          entity_type: string
          id?: string
          requested_by: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          code: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      currency_conversion_rates: {
        Row: {
          created_at: string
          from_currency: string
          id: string
          month: number
          rate: number
          to_currency: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          from_currency?: string
          id?: string
          month: number
          rate?: number
          to_currency?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          from_currency?: string
          id?: string
          month?: number
          rate?: number
          to_currency?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      delivery_roles: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          level: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          level?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          level?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_entries: {
        Row: {
          amount: number
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          expense_date: string
          id: string
          is_billable: boolean
          phase_id: string | null
          project_id: string
          receipt_url: string | null
          resource_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          expense_date: string
          id?: string
          is_billable?: boolean
          phase_id?: string | null
          project_id: string
          receipt_url?: string | null
          resource_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_billable?: boolean
          phase_id?: string | null
          project_id?: string
          receipt_url?: string | null
          resource_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      general_expenses: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string
          id: string
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          description: string
          id?: string
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string
          id?: string
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      monthly_forecasts: {
        Row: {
          created_at: string
          forecast_expenses: number | null
          forecast_hours: number | null
          forecast_labor_cost: number | null
          forecast_labor_revenue: number | null
          forecast_month: string
          id: string
          notes: string | null
          phase_id: string | null
          project_id: string
          scenario_type: Database["public"]["Enums"]["forecast_scenario"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          forecast_expenses?: number | null
          forecast_hours?: number | null
          forecast_labor_cost?: number | null
          forecast_labor_revenue?: number | null
          forecast_month: string
          id?: string
          notes?: string | null
          phase_id?: string | null
          project_id: string
          scenario_type?: Database["public"]["Enums"]["forecast_scenario"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          forecast_expenses?: number | null
          forecast_hours?: number | null
          forecast_labor_cost?: number | null
          forecast_labor_revenue?: number | null
          forecast_month?: string
          id?: string
          notes?: string | null
          phase_id?: string | null
          project_id?: string
          scenario_type?: Database["public"]["Enums"]["forecast_scenario"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_forecasts_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_forecasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_budget_baselines: {
        Row: {
          baseline_date: string
          created_at: string
          expense_budget: number | null
          id: string
          is_current: boolean
          labor_budget: number | null
          notes: string | null
          project_id: string
          total_budget: number
          updated_at: string
          version: number
        }
        Insert: {
          baseline_date?: string
          created_at?: string
          expense_budget?: number | null
          id?: string
          is_current?: boolean
          labor_budget?: number | null
          notes?: string | null
          project_id: string
          total_budget: number
          updated_at?: string
          version?: number
        }
        Update: {
          baseline_date?: string
          created_at?: string
          expense_budget?: number | null
          id?: string
          is_current?: boolean
          labor_budget?: number | null
          notes?: string | null
          project_id?: string
          total_budget?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_budget_baselines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budget_revisions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          baseline_id: string
          created_at: string
          id: string
          new_budget: number
          previous_budget: number
          project_id: string
          reason: string | null
          revision_date: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          baseline_id: string
          created_at?: string
          id?: string
          new_budget: number
          previous_budget: number
          project_id: string
          reason?: string | null
          revision_date?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          baseline_id?: string
          created_at?: string
          id?: string
          new_budget?: number
          previous_budget?: number
          project_id?: string
          reason?: string | null
          revision_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budget_revisions_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "project_budget_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budget_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          allocation_percentage: number | null
          bill_rate_override: number | null
          cost_rate_override: number | null
          created_at: string
          currency: string
          delivery_role_id: string | null
          end_date: string | null
          id: string
          is_primary: boolean
          project_id: string
          resource_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          allocation_percentage?: number | null
          bill_rate_override?: number | null
          cost_rate_override?: number | null
          created_at?: string
          currency?: string
          delivery_role_id?: string | null
          end_date?: string | null
          id?: string
          is_primary?: boolean
          project_id: string
          resource_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          allocation_percentage?: number | null
          bill_rate_override?: number | null
          cost_rate_override?: number | null
          created_at?: string
          currency?: string
          delivery_role_id?: string | null
          end_date?: string | null
          id?: string
          is_primary?: boolean
          project_id?: string
          resource_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_delivery_role_id_fkey"
            columns: ["delivery_role_id"]
            isOneToOne: false
            referencedRelation: "delivery_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          budget_amount: number | null
          budget_hours: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
          start_date: string | null
          status: Database["public"]["Enums"]["phase_status"]
          updated_at: string
        }
        Insert: {
          budget_amount?: number | null
          budget_hours?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
          updated_at?: string
        }
        Update: {
          budget_amount?: number | null
          budget_hours?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string
          code: string | null
          created_at: string
          currency: string
          default_bill_rate: number | null
          default_cost_rate: number | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          planned_budget: number | null
          pm_resource_id: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          revenue_model: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          total_budget: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          code?: string | null
          created_at?: string
          currency?: string
          default_bill_rate?: number | null
          default_cost_rate?: number | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          planned_budget?: number | null
          pm_resource_id?: string | null
          project_type?: Database["public"]["Enums"]["project_type"]
          revenue_model?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          total_budget?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          code?: string | null
          created_at?: string
          currency?: string
          default_bill_rate?: number | null
          default_cost_rate?: number | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          planned_budget?: number | null
          pm_resource_id?: string | null
          project_type?: Database["public"]["Enums"]["project_type"]
          revenue_model?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          total_budget?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_pm_resource_id_fkey"
            columns: ["pm_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      quarterly_forecasts: {
        Row: {
          created_at: string
          fiscal_quarter: number
          fiscal_year: number
          forecast_cost: number | null
          forecast_margin: number | null
          forecast_revenue: number | null
          id: string
          notes: string | null
          project_id: string
          scenario_type: Database["public"]["Enums"]["forecast_scenario"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          fiscal_quarter: number
          fiscal_year: number
          forecast_cost?: number | null
          forecast_margin?: number | null
          forecast_revenue?: number | null
          id?: string
          notes?: string | null
          project_id: string
          scenario_type?: Database["public"]["Enums"]["forecast_scenario"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          fiscal_quarter?: number
          fiscal_year?: number
          forecast_cost?: number | null
          forecast_margin?: number | null
          forecast_revenue?: number | null
          id?: string
          notes?: string | null
          project_id?: string
          scenario_type?: Database["public"]["Enums"]["forecast_scenario"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_forecasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_monthly_costs: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          month: number
          resource_id: string
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          month: number
          resource_id: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          month?: number
          resource_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_monthly_costs_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_rate_history: {
        Row: {
          bill_rate: number
          cost_rate: number
          created_at: string
          currency: string
          delivery_role_id: string | null
          effective_from: string
          effective_to: string | null
          id: string
          reason: string | null
          resource_id: string
          updated_at: string
        }
        Insert: {
          bill_rate: number
          cost_rate: number
          created_at?: string
          currency?: string
          delivery_role_id?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          reason?: string | null
          resource_id: string
          updated_at?: string
        }
        Update: {
          bill_rate?: number
          cost_rate?: number
          created_at?: string
          currency?: string
          delivery_role_id?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          reason?: string | null
          resource_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_rate_history_delivery_role_id_fkey"
            columns: ["delivery_role_id"]
            isOneToOne: false
            referencedRelation: "delivery_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_rate_history_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          bill_rate_currency: string
          cost_rate_currency: string
          created_at: string
          currency: string
          default_bill_rate: number | null
          default_cost_rate: number | null
          deleted_at: string | null
          delivery_role_id: string | null
          department: string | null
          display_name: string
          email: string | null
          employee_id: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          hire_date: string | null
          id: string
          invitation_status: string
          is_active: boolean
          job_title: string | null
          monthly_cost: number | null
          overhead_cost_eur: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bill_rate_currency?: string
          cost_rate_currency?: string
          created_at?: string
          currency?: string
          default_bill_rate?: number | null
          default_cost_rate?: number | null
          deleted_at?: string | null
          delivery_role_id?: string | null
          department?: string | null
          display_name: string
          email?: string | null
          employee_id?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          hire_date?: string | null
          id?: string
          invitation_status?: string
          is_active?: boolean
          job_title?: string | null
          monthly_cost?: number | null
          overhead_cost_eur?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bill_rate_currency?: string
          cost_rate_currency?: string
          created_at?: string
          currency?: string
          default_bill_rate?: number | null
          default_cost_rate?: number | null
          deleted_at?: string | null
          delivery_role_id?: string | null
          department?: string | null
          display_name?: string
          email?: string | null
          employee_id?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          hire_date?: string | null
          id?: string
          invitation_status?: string
          is_active?: boolean
          job_title?: string | null
          monthly_cost?: number | null
          overhead_cost_eur?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_delivery_role_id_fkey"
            columns: ["delivery_role_id"]
            isOneToOne: false
            referencedRelation: "delivery_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          bill_rate: number | null
          cost_rate: number | null
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          entry_date: string
          hours: number
          id: string
          is_billable: boolean
          phase_id: string | null
          project_id: string
          resource_id: string
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          bill_rate?: number | null
          cost_rate?: number | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          entry_date: string
          hours: number
          id?: string
          is_billable?: boolean
          phase_id?: string | null
          project_id: string
          resource_id: string
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          bill_rate?: number | null
          cost_rate?: number | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          entry_date?: string
          hours?: number
          id?: string
          is_billable?: boolean
          phase_id?: string | null
          project_id?: string
          resource_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      yearly_forecasts: {
        Row: {
          created_at: string
          fiscal_year: number
          forecast_cost: number | null
          forecast_margin: number | null
          forecast_revenue: number | null
          id: string
          notes: string | null
          project_id: string
          scenario_type: Database["public"]["Enums"]["forecast_scenario"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          fiscal_year: number
          forecast_cost?: number | null
          forecast_margin?: number | null
          forecast_revenue?: number | null
          id?: string
          notes?: string | null
          project_id: string
          scenario_type?: Database["public"]["Enums"]["forecast_scenario"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          fiscal_year?: number
          forecast_cost?: number | null
          forecast_margin?: number | null
          forecast_revenue?: number | null
          id?: string
          notes?: string | null
          project_id?: string
          scenario_type?: Database["public"]["Enums"]["forecast_scenario"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "yearly_forecasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_expire_sow_projects: { Args: never; Returns: undefined }
      get_resource_id_for_user: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      link_resource_by_email: {
        Args: { _email: string; _user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "office_admin"
        | "pm"
        | "executive_viewer"
        | "reporter"
      approval_status: "pending" | "approved" | "rejected"
      employment_type: "full_time" | "part_time" | "contractor" | "vendor"
      expense_category:
        | "travel"
        | "software"
        | "equipment"
        | "cloud_services"
        | "training"
        | "meals"
        | "other"
        | "subcontractor"
        | "operational"
        | "hardware"
      forecast_scenario: "best_case" | "expected" | "worst_case"
      phase_status: "planned" | "active" | "completed" | "on_hold"
      project_status:
        | "draft"
        | "active"
        | "on_hold"
        | "completed"
        | "archived"
        | "cancelled"
        | "sow_expired"
      project_type: "time_and_materials" | "fixed_price"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "office_admin", "pm", "executive_viewer", "reporter"],
      approval_status: ["pending", "approved", "rejected"],
      employment_type: ["full_time", "part_time", "contractor", "vendor"],
      expense_category: [
        "travel",
        "software",
        "equipment",
        "cloud_services",
        "training",
        "meals",
        "other",
        "subcontractor",
        "operational",
        "hardware",
      ],
      forecast_scenario: ["best_case", "expected", "worst_case"],
      phase_status: ["planned", "active", "completed", "on_hold"],
      project_status: [
        "draft",
        "active",
        "on_hold",
        "completed",
        "archived",
        "cancelled",
        "sow_expired",
      ],
      project_type: ["time_and_materials", "fixed_price"],
    },
  },
} as const
