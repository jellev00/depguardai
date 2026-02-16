"use client";

import React from "react"

import { useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Package, Loader2, CheckCircle2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Image from 'next/image';

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept invitation");

      // Sign in with the new credentials
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
      });

      if (signInError) throw signInError;
      setAccepted(true);

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (accepted) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {"You're in!"}
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="flex w-12 items-center justify-center rounded-lg">
                  <Image
                    src="/DepGuardAI_Logo.png"
                    width={1000}
                    height={1000}
                    alt="DepGuard AI Logo"
                  />
            </div>
            <span className="text-xl font-semibold text-foreground">
              DepGuard AI
            </span>
          </div>
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-2xl">Accept invitation</CardTitle>
              <CardDescription>
                Set up your account to join the team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAccept}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      "Accept & join team"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
