"use client";

import React from "react";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Card, CardContent, BackButton } from "@/components/ui";
import {
  Mail,
  Building2,
  AlertCircle,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

type Step = "email" | "password" | "otp" | "set-password";

interface ManagerInfo {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  company_id: string;
  has_password: boolean;
}

export default function ManagerLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [managerInfo, setManagerInfo] = useState<ManagerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  const startCooldown = useCallback(() => {
    setCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Step 1: Check email — determine if manager has password or needs setup
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) return;
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/check-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const { managerData, error: managerError } = await response.json();

      if (managerError || !managerData) {
        throw new Error(
          "This email is not registered to any company! Please contact the person responsible for the Company profile!",
        );
      }

      setManagerInfo({
        id: managerData.id,
        first_name: managerData.first_name,
        last_name: managerData.last_name,
        company_name: (managerData as any).companies.name,
        company_id: managerData.company_id,
        has_password: managerData.has_password || false,
      });

      if (managerData.has_password) {
        // Manager already has a password — go to password login
        setStep("password");
      } else {
        // Manager needs to set up password — send OTP for verification
        const supabase = createClient();
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: false },
        });
        if (otpError) throw otpError;
        startCooldown();
        setStep("otp");
      }
    } catch (err) {
      console.error("Manager check email error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2a: Sign in with password
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        router.push("/manager");
      }
    } catch (err) {
      console.error("Password login error:", err);
      setError(err instanceof Error ? err.message : "Invalid password");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2b: Verify OTP (for first-time setup) — must use browser client
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: "email",
      });

      if (error) throw error;

      if (!data.session) {
        throw new Error("Verification failed. Please try again.");
      }

      // OTP verified — store the access token for the next step
      setAccessToken(data.session.access_token);
      setStep("set-password");
    } catch (err) {
      console.error("OTP verification error:", err);
      setError(err instanceof Error ? err.message : "Invalid verification code");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set password after OTP verification
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/manager-set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          accessToken,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to set password");
      }

      if (result.session) {
        // Auto sign-in on client side using the returned session
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInError) throw signInError;
        router.push("/manager");
      } else {
        // Fallback: password set but need manual sign-in
        setStep("password");
        setPassword("");
        setConfirmPassword("");
        setOtp("");
        setError("");
      }
    } catch (err) {
      console.error("Set password error:", err);
      setError(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP for first-time setup
  const handleResendOTP = async () => {
    setError("");
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      });
      if (otpError) throw otpError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setIsLoading(false);
    }
  };

  // Manager info banner (reusable)
  const managerInfoBanner = managerInfo && (
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
  );

  // Error banner (reusable)
  const errorBanner = error && (
    <div className="flex items-start gap-3 p-3 bg-danger-muted/20 rounded-lg">
      <AlertCircle className="w-5 h-5 text-danger mt-0.5 shrink-0" />
      <p className="text-sm text-danger">{error}</p>
    </div>
  );

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
              {/* Step 1: Email */}
              {step === "email" && (
                <form onSubmit={handleCheckEmail} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground mb-1">
                      Welcome back
                    </h2>
                    <p className="text-sm text-foreground-muted">
                      Enter your email to continue
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

                  {errorBanner}

                  <Button
                    type="submit"
                    className={`w-full ${!isValidEmail(email) ? "opacity-50 cursor-not-allowed" : ""}`}
                    isLoading={isLoading}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              )}

              {/* Step 2a: Password login (returning manager) */}
              {step === "password" && (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground mb-1">
                      Enter your password
                    </h2>
                    <p className="text-sm text-foreground-muted">
                      Signing in as{" "}
                      <span className="text-foreground">{email}</span>
                    </p>
                    {managerInfoBanner}
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
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {errorBanner}

                  <Button
                    type="submit"
                    className={`w-full ${!password ? "opacity-50 cursor-not-allowed" : ""}`}
                    isLoading={isLoading}
                  >
                    Sign In
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setPassword("");
                      setError("");
                      setManagerInfo(null);
                    }}
                    className="w-full text-sm text-foreground-muted hover:text-foreground transition-colors"
                  >
                    Use a different email
                  </button>
                </form>
              )}

              {/* Step 2b: OTP verification (first-time setup) */}
              {step === "otp" && (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground mb-1">
                      Verify your email
                    </h2>
                    <p className="text-sm text-foreground-muted">
                      We sent a verification code to{" "}
                      <span className="text-foreground">{email}</span>
                    </p>
                    <p className="text-xs text-foreground-muted mt-1">
                      This is a one-time verification to set up your password.
                    </p>
                    {managerInfoBanner}
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

                  {errorBanner}

                  <Button
                    type="submit"
                    className={`w-full ${otp.length < 6 ? "opacity-50 cursor-not-allowed" : ""}`}
                    isLoading={isLoading}
                  >
                    Verify Code
                  </Button>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => { handleResendOTP(); startCooldown(); }}
                      disabled={isLoading || cooldown > 0}
                      className="w-full text-sm text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
                    >
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
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

              {/* Step 3: Set password (first-time setup, after OTP verified) */}
              {step === "set-password" && (
                <form onSubmit={handleSetPassword} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground mb-1">
                      Create your password
                    </h2>
                    <p className="text-sm text-foreground-muted">
                      Set a password for your account. You will use this to sign in from now on.
                    </p>
                    {managerInfoBanner}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-11 pr-11"
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-11 pr-11"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {errorBanner}

                  <Button
                    type="submit"
                    className={`w-full ${!password || !confirmPassword ? "opacity-50 cursor-not-allowed" : ""}`}
                    isLoading={isLoading}
                  >
                    Sign Up
                  </Button>
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
