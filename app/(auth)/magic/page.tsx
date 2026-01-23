"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface TokenInfo {
  valid: boolean;
  email: string;
  name: string;
  organizationName: string | null;
  purpose: "provisioning" | "login";
}

function MagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "verifying" | "success" | "error">("loading");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setError("No token provided");
      return;
    }

    const validateToken = async () => {
      try {
        const response = await fetch(`/api/auth/magic?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
          setStatus("invalid");
          setError(data.error || "Invalid token");
          return;
        }

        setTokenInfo(data);
        setStatus("valid");
      } catch {
        setStatus("invalid");
        setError("Failed to validate token");
      }
    };

    validateToken();
  }, [token]);

  const handleVerify = async () => {
    if (!token) return;

    setStatus("verifying");
    try {
      const response = await fetch("/api/auth/magic/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setError(data.error || "Verification failed");
        return;
      }

      setStatus("success");

      // Redirect after short delay
      setTimeout(() => {
        router.push(data.redirectTo || "/");
        router.refresh();
      }, 1500);
    } catch {
      setStatus("error");
      setError("Failed to verify token");
    }
  };

  if (status === "loading") {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <CardTitle className="text-2xl font-bold">Validating...</CardTitle>
          <CardDescription>Please wait while we validate your link</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "invalid" || status === "error") {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <XCircle className="h-12 w-12 mx-auto text-destructive" />
          <CardTitle className="text-2xl font-bold">
            {status === "invalid" ? "Invalid Link" : "Error"}
          </CardTitle>
          <CardDescription className="text-destructive">
            {error || "This link is invalid or has expired"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Please request a new link or contact support if you continue to have issues.
          </p>
          <Button variant="outline" onClick={() => router.push("/login")}>
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
          <CardTitle className="text-2xl font-bold">Welcome!</CardTitle>
          <CardDescription>
            Redirecting you to your dashboard...
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // status === "valid" or "verifying"
  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
        <CardTitle className="text-2xl font-bold">
          {tokenInfo?.purpose === "provisioning"
            ? `Welcome to Probefish, ${tokenInfo?.name}!`
            : `Welcome back, ${tokenInfo?.name}!`}
        </CardTitle>
        <CardDescription>
          {tokenInfo?.purpose === "provisioning" ? (
            <>
              Your Pro subscription is active.
              {tokenInfo?.organizationName && (
                <span className="block mt-1">
                  Workspace: <strong>{tokenInfo.organizationName}</strong>
                </span>
              )}
            </>
          ) : (
            "Click below to access your account"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Signing in as <strong>{tokenInfo?.email}</strong>
          </p>
        </div>
        <Button
          className="w-full"
          onClick={handleVerify}
          disabled={status === "verifying"}
        >
          {status === "verifying" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Access My Account"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <CardTitle className="text-2xl font-bold">Loading...</CardTitle>
          </CardHeader>
        </Card>
      }
    >
      <MagicLinkContent />
    </Suspense>
  );
}
