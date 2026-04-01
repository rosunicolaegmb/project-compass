import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, AlertCircle, CheckCircle2 } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const prefilledEmail = searchParams.get("email") || "";
  const prefilledName = searchParams.get("name") || "";
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "login";

  // Redirect if already logged in
  if (user) {
    navigate("/", { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const values = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const result = loginSchema.safeParse(values);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signIn(result.data.email, result.data.password);
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    const values = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const result = signupSchema.safeParse(values);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signUp(result.data.email, result.data.password, result.data.fullName);
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Account created! Check your email to confirm, then sign in.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">BudgetTrack</h1>
          <p className="text-sm text-muted-foreground">IT Project Finance Management</p>
        </div>

        <Card>
          <Tabs defaultValue={defaultTab} onValueChange={() => { setError(null); setSuccess(null); }}>
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              {error && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-success/10 text-success text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {success}
                </div>
              )}

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" name="email" type="email" placeholder="you@company.com" required autoComplete="email" defaultValue={prefilledEmail} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input id="signup-name" name="fullName" placeholder="John Doe" required autoComplete="name" defaultValue={prefilledName} readOnly={!!prefilledName} className={prefilledName ? "bg-muted" : ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" name="email" type="email" placeholder="you@company.com" required autoComplete="email" defaultValue={prefilledEmail} readOnly={!!prefilledEmail} className={prefilledEmail ? "bg-muted" : ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" name="password" type="password" placeholder="Min 6 characters" required autoComplete="new-password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <Input id="signup-confirm" name="confirmPassword" type="password" placeholder="••••••••" required autoComplete="new-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Contact your administrator to get access and role assignment.
        </p>
      </div>
    </div>
  );
}
