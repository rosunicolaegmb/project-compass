/**
 * Budget calculation engine for T&M and Fixed Price projects.
 *
 * T&M revenue  = approved billable hours × billing rate
 * FP  revenue  = contract value (total_budget)
 * Cost         = labor cost + expenses (both types)
 */

// ---------- types ----------
export type ProjectType = "time_and_materials" | "fixed_price" | "support";
export type HealthStatus = "green" | "amber" | "red";

export interface BudgetInputs {
  projectType: ProjectType;
  // Contract / budget
  totalBudget: number;        // contract value (FP) or budget cap (T&M)
  plannedBudget: number;      // original planned budget
  revisedBudget: number;      // latest revised budget
  // Phase-level planned
  plannedHours: number;
  plannedCost: number;
  // Time entries (actuals)
  timeEntries: {
    hours: number;
    costRate: number;
    billRate: number;
    isBillable: boolean;
    approvalStatus: string;
  }[];
  // Expense entries (actuals)
  expenses: {
    amount: number;
    isBillable: boolean;
    approvalStatus: string;
  }[];
  // Forecast aggregates
  forecastLaborCost: number;
  forecastLaborRevenue: number;
  forecastExpenses: number;
  forecastHours: number;
}

export interface BudgetMetrics {
  // Hours
  totalHours: number;
  billableHours: number;
  approvedHours: number;
  approvedBillableHours: number;
  // Cost
  actualLaborCost: number;
  actualExpenses: number;
  actualCost: number;
  // Revenue
  actualRevenue: number;
  // T&M specific
  blendedBillRate: number;
  blendedCostRate: number;
  billableRealization: number; // billable hrs / total hrs
  // Budget tracking
  plannedBudget: number;
  revisedBudget: number;
  remainingBudget: number;
  budgetConsumedPct: number;
  // Forecast
  forecastCost: number;
  forecastRevenue: number;
  forecastConsumedPct: number;
  // EVM-style
  costToComplete: number;
  estimateAtCompletion: number;
  // Margins
  grossMargin: number;        // (revenue - cost) / revenue
  marginAtCompletion: number; // forecast-based
  // Burn
  burnRatePct: number;        // actual hrs / planned hrs
  // Health
  budgetHealth: HealthStatus;
  marginHealth: HealthStatus;
  burnHealth: HealthStatus;
  forecastHealth: HealthStatus;
  overallHealth: HealthStatus;
}

// ---------- helpers ----------
function pct(num: number, den: number): number {
  return den > 0 ? (num / den) * 100 : 0;
}

function margin(revenue: number, cost: number): number {
  return revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
}

function healthFromPct(consumed: number, warnAt: number, critAt: number): HealthStatus {
  if (consumed >= critAt) return "red";
  if (consumed >= warnAt) return "amber";
  return "green";
}

function worstHealth(...statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("red")) return "red";
  if (statuses.includes("amber")) return "amber";
  return "green";
}

/**
 * Resolve the effective rate using the hierarchy:
 *   1. Member override (project_members.bill_rate_override / cost_rate_override)
 *   2. Project default (projects.default_bill_rate / default_cost_rate)
 *   3. Resource default (resources.default_bill_rate / default_cost_rate)
 */
export function resolveRate(
  memberOverride: number | null | undefined,
  projectDefault: number | null | undefined,
  resourceDefault: number | null | undefined,
): number {
  if (memberOverride != null && memberOverride > 0) return memberOverride;
  if (projectDefault != null && projectDefault > 0) return projectDefault;
  return resourceDefault ?? 0;
}

// ---------- main ----------
export function calculateBudgetMetrics(input: BudgetInputs): BudgetMetrics {
  const {
    projectType, totalBudget, plannedBudget, revisedBudget,
    plannedHours, timeEntries, expenses,
    forecastLaborCost, forecastLaborRevenue, forecastExpenses, forecastHours,
  } = input;

  // --- Hours ---
  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  const billableHours = timeEntries.filter(t => t.isBillable).reduce((s, t) => s + t.hours, 0);
  const approvedEntries = timeEntries.filter(t => t.approvalStatus === "approved");
  const approvedHours = approvedEntries.reduce((s, t) => s + t.hours, 0);
  const approvedBillableHours = approvedEntries.filter(t => t.isBillable).reduce((s, t) => s + t.hours, 0);

  // --- Labor cost (all entries, not just approved, for tracking) ---
  const actualLaborCost = timeEntries.reduce((s, t) => s + t.hours * t.costRate, 0);

  // --- Expenses ---
  const actualExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // --- Total cost ---
  const actualCost = actualLaborCost + actualExpenses;

  // --- Revenue ---
  let actualRevenue: number;
  if (projectType === "time_and_materials") {
    // T&M: revenue = approved billable hours × billing rate
    actualRevenue = approvedEntries
      .filter(t => t.isBillable)
      .reduce((s, t) => s + t.hours * t.billRate, 0);
  } else {
    // Fixed Price: revenue = contract value (recognized proportionally to cost consumed)
    // For now use contract value as total recognized revenue
    actualRevenue = totalBudget;
  }

  // --- Blended rates (T&M) ---
  const blendedBillRate = approvedBillableHours > 0
    ? approvedEntries.filter(t => t.isBillable).reduce((s, t) => s + t.hours * t.billRate, 0) / approvedBillableHours
    : 0;
  const blendedCostRate = totalHours > 0 ? actualLaborCost / totalHours : 0;

  // --- Billable realization ---
  const billableRealization = pct(billableHours, totalHours);

  // --- Budget ---
  const effectiveBudget = revisedBudget || plannedBudget || totalBudget;
  const remainingBudget = effectiveBudget - actualCost;
  const budgetConsumedPct = pct(actualCost, effectiveBudget);

  // --- Forecast ---
  const hasForecast = forecastLaborCost > 0 || forecastExpenses > 0;
  const forecastCost = hasForecast ? forecastLaborCost + forecastExpenses : actualCost;
  const forecastRevenue = projectType === "time_and_materials"
    ? (forecastLaborRevenue > 0 ? forecastLaborRevenue : actualRevenue)
    : totalBudget;
  const forecastConsumedPct = pct(forecastCost, effectiveBudget);

  // --- EVM ---
  const costToComplete = forecastCost > actualCost ? forecastCost - actualCost : 0;
  const estimateAtCompletion = actualCost + costToComplete;

  // --- Margins ---
  const grossMargin = projectType === "time_and_materials"
    ? margin(actualRevenue, actualCost)
    : margin(totalBudget, actualCost);
  const marginAtCompletion = margin(forecastRevenue, forecastCost);

  // --- Burn rate ---
  const burnRatePct = pct(totalHours, plannedHours);

  // --- Health ---
  const budgetHealth = healthFromPct(budgetConsumedPct, 75, 90);
  const marginHealth: HealthStatus = grossMargin < 10 ? "red" : grossMargin < 20 ? "amber" : "green";
  const burnHealth = healthFromPct(burnRatePct, 85, 100);
  const forecastHealth = healthFromPct(forecastConsumedPct, 90, 100);
  const overallHealth = worstHealth(budgetHealth, marginHealth, burnHealth, forecastHealth);

  return {
    totalHours, billableHours, approvedHours, approvedBillableHours,
    actualLaborCost, actualExpenses, actualCost,
    actualRevenue,
    blendedBillRate, blendedCostRate, billableRealization,
    plannedBudget: effectiveBudget, revisedBudget: effectiveBudget,
    remainingBudget, budgetConsumedPct,
    forecastCost, forecastRevenue, forecastConsumedPct,
    costToComplete, estimateAtCompletion,
    grossMargin, marginAtCompletion,
    burnRatePct,
    budgetHealth, marginHealth, burnHealth, forecastHealth, overallHealth,
  };
}
