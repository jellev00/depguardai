import { createClient } from "@/src/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import {
  Package,
  ArrowRight,
  Shield,
  GitBranch,
  Sparkles,
} from "lucide-react";
import Image from 'next/image';

export default async function HomePage() {
  let isLoggedIn = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isLoggedIn = !!user;
  } catch {
    // Supabase not available, continue to show landing page
  }

  if (isLoggedIn) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <div className="flex w-12 items-center justify-center rounded-lg">
                <Image
                  src="/DepGuardAI_Logo.png"
                  width={1000}
                  height={1000}
                  alt="DepGuard AI Logo"
                />
          </div>
          <span className="font-semibold text-foreground">DepGuard AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/auth/sign-up">Get started</Link>
          </Button>
        </div>
      </header>

      <main 
        className="flex flex-1 flex-col items-center justify-center px-6 py-16 relative"
        style={{
          backgroundImage: 'url("/DepGuardAI_Logo.gif")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay voor blur effect */}
        <div className="absolute inset-0 backdrop-blur-sm bg-white/95" />
        
        {/* Content met relative positioning om boven overlay te komen */}
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Dependency intelligence for modern teams
          </h1>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Track, manage, and analyze your project dependencies with AI-powered
            changelog summaries. Know exactly what changed before you update.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/auth/sign-up">
                Start tracking
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-20 grid max-w-3xl gap-8 sm:grid-cols-3">
          {[
            {
              icon: GitBranch,
              title: "Version tracking",
              desc: "Automatically detect and monitor every dependency across your projects.",
            },
            {
              icon: Sparkles,
              title: "AI analysis",
              desc: "Get AI-generated summaries of what changed between versions.",
            },
            {
              icon: Shield,
              title: "Security alerts",
              desc: "Instant notifications when security vulnerabilities are found.",
            },
          ].map((feature) => (
            <div key={feature.title} className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
