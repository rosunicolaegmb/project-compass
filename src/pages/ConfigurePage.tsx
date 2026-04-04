import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRightLeft, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

const configItems = [
  {
    title: "Conversion Rates",
    description: "Manage monthly currency conversion rates to EUR",
    icon: ArrowRightLeft,
    path: "/configure/conversion-rates",
  },
  {
    title: "Salaries & Contractors",
    description: "Monthly cost amounts per resource",
    icon: Wallet,
    path: "/configure/salaries",
  },
];

export default function ConfigurePage() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <PageHeader title="Configure" description="System configuration and data management" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {configItems.map((item) => (
          <Card
            key={item.path}
            className="cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => navigate(item.path)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <item.icon className="h-4 w-4" />
                {item.title}
              </CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
