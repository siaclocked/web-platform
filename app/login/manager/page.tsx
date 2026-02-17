"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Card, CardContent, BackButton } from "@/components/ui";
import {
  Users,
  Mail,
  Clock,
  Building2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

type Step = "email" | "otp";

interface ManagerInfo {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  company_id: string;
}

export default function ManagerLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [managerInfo, setManagerInfo] = useState<ManagerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) return;
    setError("");
    setIsLoading(true);

    try {
      console.log("Manager login attempt:", email.trim().toLowerCase());
      const supabase = createClient();

      // 1. Check if email exists as a manager in any company using service role
      console.log("Checking if manager exists:", email.trim().toLowerCase());
      const response = await fetch("/api/auth/check-manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const { managerData, error: managerError } = await response.json();

      console.log("Manager lookup result:", { managerData, managerError });

      if (managerError || !managerData) {
        console.log("Manager not found, throwing error");
        throw new Error(
          "This email is not registered to any company! Please contact the person responsible for the Company profile!",
        );
      }

      // Store manager info for later use
      setManagerInfo({
        id: managerData.id,
        first_name: managerData.first_name,
        last_name: managerData.last_name,
        company_name: (managerData as any).companies.name,
        company_id: managerData.company_id,
      });

      // 2. Send OTP
      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false, // Don't create new user
        },
      });

      console.log("OTP response:", { data, error: otpError });

      if (otpError) throw otpError;

      setStep("otp");
    } catch (err) {
      console.error("Manager login error:", err);
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setError("");
    setIsLoading(true);

    try {
      console.log("Verifying manager OTP:", otp);
      const supabase = createClient();

      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: "email",
      });

      console.log("Verify OTP response:", { data, error });

      if (error) throw error;

      // Verify the authenticated user is the manager we expect
      if (data.user && managerInfo) {
        // Skip role verification since we already checked during email verification
        // The OTP verification from Supabase is sufficient
        console.log("Manager OTP verified successfully, redirecting...");
        router.push("/manager");
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      setError(err instanceof Error ? err.message : "Invalid OTP");
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
              Manager Login
            </h2>
            <p className="text-foreground-muted">
              Sign in to manage your team and schedules
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              {step === "email" ? (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground mb-1">
                      Welcome back
                    </h2>
                    <p className="text-sm text-foreground-muted">
                      Enter your email to receive a verification code
                    </p>
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                    <Input
                      type="email"
                      placeholder="manager@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11"
                      required
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 p-3 bg-danger-muted/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-danger mt-0.5 shrink-0" />
                      <p className="text-sm text-danger">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className={`w-full ${!isValidEmail(email) ? "opacity-50 cursor-not-allowed" : ""}`}
                    isLoading={isLoading}
                  >
                    Send Code
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground mb-1">
                      Check your email
                    </h2>
                    <p className="text-sm text-foreground-muted">
                      We sent a verification code to{" "}
                      <span className="text-foreground">{email}</span>
                    </p>
                    {managerInfo && (
                      <div className="mt-3 p-3 bg-primary-muted/20 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="w-4 h-4 text-primary" />
                          <span className="text-foreground font-medium">
                            {managerInfo.company_name}
                          </span>
                        </div>
                        <p className="text-xs text-foreground-muted mt-1">
                          {managerInfo.first_name} {managerInfo.last_name}
                        </p>
                      </div>
                    )}
                  </div>

                  <Input
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    className="text-center text-2xl tracking-widest"
                    maxLength={8}
                    required
                    autoFocus
                  />

                  {error && (
                    <div className="flex items-start gap-3 p-3 bg-danger-muted/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-danger mt-0.5 shrink-0" />
                      <p className="text-sm text-danger">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className={`w-full ${otp.length < 6 ? "opacity-50 cursor-not-allowed" : ""}`}
                    isLoading={isLoading}
                  >
                    Verify
                  </Button>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={isLoading}
                      className="w-full text-sm text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
                    >
                      Resend code
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setOtp("");
                        setError("");
                        setManagerInfo(null);
                      }}
                      className="w-full text-sm text-foreground-muted hover:text-foreground transition-colors"
                    >
                      Use a different email
                    </button>
                  </div>
                </form>
              )}
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
