"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Card, CardContent, BackButton } from "@/components/ui";
import {
  Mail,
  Lock,
  Clock,
  CheckCircle,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";

export default function CompanyPasswordLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const msg = searchParams.get("message");
    if (msg) {
      setMessage(msg);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email) || !password) return;
    setError("");
    setIsLoading(true);

    try {
      console.log("Attempting login with:", email);
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      console.log("Login response:", { data, error });

      if (error) throw error;

      console.log("Login successful, checking user role...");

      // Check if user is a company admin
      // Use service role for admin check to avoid RLS issues
      const response = await fetch("/api/auth/check-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: data.user?.id }),
      });

      const { userData, userError } = await response.json();
      console.log("User data check:", { userData, userError });

      if (userError || !userData) {
        // User not found in database, sign them out and redirect to signup
        console.log("User not found in database, signing out");
        await supabase.auth.signOut();
        setError("Account not found. Please sign up for a company account.");
        setTimeout(() => {
          router.push("/signup/company");
        }, 2000);
      } else if (userData.role === "admin") {
        console.log("User is admin, redirecting to company dashboard...");
        // Redirect immediately
        router.push("/company");
      } else {
        setError("This login is for company administrators only");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <button
            onClick={() => router.push("/")}
            className="hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl font-black tracking-tight text-foreground" style={{ fontFamily: "'Georgia', serif" }}>
              CLOCKED
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Company Administrator Login
            </h2>
            <p className="text-foreground-muted">
              Enter your credentials to access your company dashboard
            </p>
          </div>

          {message && (
            <div className="mb-4 p-3 bg-success-muted/20 border border-success/30 rounded-lg">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">{message}</span>
              </div>
            </div>
          )}

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Welcome back
                  </h2>
                  <p className="text-sm text-foreground-muted">
                    Enter your credentials to access your company dashboard
                  </p>
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {error && (
                  <p className="text-sm text-danger bg-danger-muted/20 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className={`w-full ${!isValidEmail(email) || !password ? "opacity-50 cursor-not-allowed" : ""}`}
                  isLoading={isLoading}
                >
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <BackButton href="/login" label="Back to login options" />
          </div>

          <p className="text-center text-xs text-foreground-muted mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
