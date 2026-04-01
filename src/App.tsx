import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Projects from "./pages/Projects";
import Phases from "./pages/Phases";
import Resources from "./pages/Resources";
import Rates from "./pages/Rates";
import Timesheets from "./pages/Timesheets";
import Expenses from "./pages/Expenses";
import Forecasting from "./pages/Forecasting";
import Reports from "./pages/Reports";
import AuditLog from "./pages/AuditLog";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/phases" element={<Phases />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/rates" element={<Rates />} />
            <Route path="/timesheets" element={<Timesheets />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/forecasting" element={<Forecasting />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/audit-log" element={<AuditLog />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
