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
  CircleCheck,
  Building2,
  Users,
  FileCode,
  UserPen,
  UserPlus,
  Link2,
  Scan,
  MessageCircle,
  File,
  TrendingUp,
  TriangleAlert,
  Zap,
  Clock,
  Layers,
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
      <header className="fixed w-full flex h-14 items-center justify-between border-b px-6 bg-white">
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
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="text-pretty text-lg text-muted-foreground scroll-smooth">
              Home
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="#what-is" className="text-pretty text-lg text-muted-foreground scroll-smooth">
              What Is DepGuard AI
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="#how-it-works" className="text-pretty text-lg text-muted-foreground scroll-smooth">
              How It Works
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="#ai-powered" className="text-pretty text-lg text-muted-foreground scroll-smooth">
              AI-Powered Analysis
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="#why" className="text-pretty text-lg text-muted-foreground scroll-smooth">
              Why DepGuard AI
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="#get-started" className="text-pretty text-lg text-muted-foreground scroll-smooth">
              Get Started Today
            </Link>
          </Button>
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

      <main className="flex flex-1 flex-col items-center justify-center">

        <section className="w-full h-screen bg-slate-50 flex flex-col justify-center">
          {/* Content - relative positioning is nu optioneel, maar blijft werken */}
          <div className="mx-auto w-fit flex items-center justify-between gap-4 rounded-full bg-primary/10 px-4 py-2 mb-6">
            <div className="bg-emerald-400 h-2 w-2 rounded-full"></div>
            <p className="text-primary">AI-Powerd Dependency Intelligence</p>
          </div>
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Stay Ahead of Dependency Risks with{" "}
              <span className="text-primary">AI-Powerd Insights</span>
            </h1>
            <p className="mt-4 text-pretty text-lg text-muted-foreground">
              DepGuard AI monitors your project dependencies, summarizes updates with AI, and highlights security risks before they become problems.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/auth/sign-up">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button variant="outline" size="lg" asChild>
                <Link href="/auth/sign-up">
                  How It Works
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-20 grid max-w-3xl gap-8 sm:grid-cols-3">
            {[
              {
                icon: CircleCheck,
                title: "No credit card required",
              },
              {
                icon: CircleCheck,
                title: "Free tier available",
              },
              {
                icon: CircleCheck,
                title: "Set up in minutes",
              },
            ].map((feature) => (
              <div key={feature.title} className="flex items-center gap-2">
                <feature.icon className="h-5 w-5 text-emerald-400" />
                <p className="text-sm text-muted-foreground">{feature.title}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="what-is" className="w-full h-screen bg-white flex flex-col justify-center">
          <div className="mt-20 mx-auto max-w-4xl text-center">
            <p className="text-pretty text-lg text-primary">WHAT IS DEPGUARD AI</p>
            <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Centralized Dependency Management for Your Entire Organization
            </h1>
            <p className="mt-4 text-pretty text-lg text-foreground">DepGuard AI is a web application where softwate companies can create an organization, add their team members, and manage dependencies across all projects from a single dashboard.</p>
          </div>

          <div className="mx-auto mt-20 grid max-w-6xl gap-8 sm:grid-cols-4">
            {[
              {
                icon: Building2,
                title: "Create Organization",
                desc: "Set up your company account and manage all your projects in one central location.",
              },
              {
                icon: Users,
                title: "Add Team Members",
                desc: "Invite developers, testers and project managers to collaborate on dependency management.",
              },
              {
                icon: GitBranch,
                title: "Connect via GitHub",
                desc: "Link your repositories directly for automatic dependency detection and monitoring.",
              },
              {
                icon: FileCode,
                title: "Upload Dependency Files",
                desc: "Or simply upload your package.json file",
              },
            ].map((feature) => (
              <div key={feature.title} className="text-center border border-accent shadow-sm px-2 py-4 rounded-lg">
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
          <div className="mt-20 mx-auto max-w-4xl text-center">
            <p className="mt-4 text-pretty text-lg text-foreground">Supports major package ecosystems</p>
            <p className="mt-4 w-fit mx-auto text-pretty text-lg font-semibold text-foreground bg-accent px-4 py-1 rounded-full">npm</p>
          </div>
        </section>

        <section id="how-it-works" className="w-full h-screen bg-slate-50 flex flex-col justify-center">
          <div className="mt-20 mx-auto max-w-4xl text-center">
            <p className="text-pretty text-lg text-primary">HOW IT WORKS</p>
            <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Get Started in Five Simple Steps
            </h1>
            <p className="mt-4 text-pretty text-lg text-foreground">DepGuard AI is a web application where softwate companies can create an organization, add their team members, and manage dependencies across all projects from a single dashboard.</p>
          </div>

          <div className="mx-auto mt-20 grid max-w-6xl gap-8 sm:grid-cols-5">
            {[
              {
                icon: UserPen,
                step: "STEP 1",
                title: "Create Your Account",
                desc: "Sign up and create your company organization in seconds.",
              },
              {
                icon: UserPlus,
                step: "STEP 2",
                title: "Add Team Members",
                desc: "Invite developers, testers and project managers to your workspace.",
              },
              {
                icon: Link2,
                step: "STEP 3",
                title: "Connect Your Projects",
                desc: "Link GitHub repositories or upload dependency files directly.",
              },
              {
                icon: Scan,
                step: "STEP 4",
                title: "AI Scans Dependencies",
                desc: "Our AI agent analyzes official sources and changelogs",
              },
              {
                icon: MessageCircle,
                step: "STEP 5",
                title: "Receive Insights",
                desc: "Get AI-generated summaries, update advice, and security.",
              },
            ].map((works) => (
              <div key={works.title} className="text-center border border-accent shadow-sm px-2 py-4 rounded-lg">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <works.icon className="h-5 w-5 text-white" />
                </div>
                <p className="mt-1 text-sm text-primary">
                  {works.step}
                </p>
                <h3 className="font-medium text-foreground">{works.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {works.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="ai-powered" className="w-full h-screen bg-white flex flex-col justify-center">
          <div className="mt-20 mx-auto max-w-4xl text-center">
            <p className="text-pretty text-lg text-primary">AI-POWERED ANALYSIS</p>
            <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Smart Insights, <span className="text-primary">Not Noise</span>
            </h1>
            <p className="mt-4 text-pretty text-lg text-foreground">
              Our AI agent checks official dependency websites and changelogs to generate human-readable summaries. No more wading through endless release notes.
            </p>
          </div>

          <div className="mx-auto mt-20 grid max-w-6xl gap-8 sm:grid-cols-4">
            {[
              {
                icon: File,
                title: "Human-Readable Summaries",
                desc: "Complex changelogs translated into clear, actionable insights.",
              },
              {
                icon: TrendingUp,
                title: "Update Importance Scoring",
                desc: "Know instantly if an update is optional, recommended or critical.",
              },
              {
                icon: TriangleAlert,
                title: "Security Risk Detection",
                desc: "Alerts for known vulnerabilities and security patches.",
              },
              {
                icon: Zap,
                title: "Impact Analysis",
                desc: "Understand how updates affect your project before upgrading.",
              },
            ].map((powered) => (
              <div key={powered.title} className="text-center border border-accent shadow-sm px-2 py-4 rounded-lg">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <powered.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium text-foreground">{powered.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {powered.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="why" className="w-full h-screen bg-slate-50 flex justify-center items-center gap-10">
          <div>
            <div className="mt-20 max-w-xl">
              <p className="text-pretty text-lg text-primary">WHY DEPGUARD AI</p>
              <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                BUILT for Teams Who <span className="text-primary">Ship Fast</span>
              </h1>
              <p className="mt-4 text-pretty text-lg text-foreground">
                Stop wasting hours on dependency research. Let AI handle the heavy lifting while your team focuses on building great software
              </p>
            </div>

            <div className="mt-20 grid max-w-xl gap-8 sm:grid-rows-5">
              {[
                {
                  icon: Clock,
                  title: "Save developer time on changelog research",
                },
                {
                  icon: Shield,
                  title: "Reduce security risks proactively",
                },
                {
                  icon: File,
                  title: "No need to read endless changelogs",
                },
                {
                  icon: Layers,
                  title: "One source of truth for all dependencies",
                },
                {
                  icon: Users,
                  title: "Designed for teams, not just individuals",
                },
              ].map((why) => (
                <div key={why.title} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                    <why.icon className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {why.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
              <div className="bg-white p-8 text-center border border-accent shadow-sm rounded-lg">
                <h2 className="font-bold text-foreground mb-4">Average time saved per team</h2>
                <div className="grid gap-8 sm:grid-rows-2 sm:grid-cols-2">
                  <div className="bg-slate-50 flex flex-col justify-center items-center p-4 rounded-xl">
                    <h1 className="font-bold text-primary text-4xl">10+</h1>
                    <p className="text-sm text-foreground">Hours per week</p>
                  </div>
                  <div className="bg-slate-50 flex flex-col justify-center items-center p-4 rounded-xl">
                    <h1 className="font-bold text-primary text-4xl">90%</h1>
                    <p className="text-sm text-foreground">Faster CVE response</p>
                  </div>
                  <div className="bg-slate-50 flex flex-col justify-center items-center p-4 rounded-xl">
                    <h1 className="font-bold text-primary text-4xl">100%</h1>
                    <p className="text-sm text-foreground">Dep visibility</p>
                  </div>
                  <div className="bg-slate-50 flex flex-col justify-center items-center p-4 rounded-xl">
                    <h1 className="font-bold text-primary text-4xl">1</h1>
                    <p className="text-sm text-foreground">Source of truth</p>
                  </div>
                </div>
              </div>
          </div>
        </section>

        <section id="get-started" className="w-full h-screen bg-white flex justify-center items-center gap-10">
              <div className="bg-white p-8 text-center border border-accent shadow-sm rounded-lg">
                <div className="mx-auto w-fit flex items-center justify-between gap-4 rounded-full bg-primary/10 px-4 py-2 mb-6">
                  <p className="text-primary">Get Started Today</p>
                </div>
                <div className="mx-auto max-w-2xl text-center">
                  <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                    Start Monitoring Your Dependencies <span className="text-primary">the Smart Way</span>
                  </h1>
                  <p className="mt-4 text-pretty text-lg text-muted-foreground">
                    Join development teams who trust DepGuard AI to keep their project secure and up-to-date. No credit card required.
                  </p>
                  <div className="mt-8 flex items-center justify-center gap-3">
                    <Button size="lg" asChild>
                      <Link href="/auth/sign-up">
                        Request Access
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
        </section>

      </main>

      <footer className="w-full bg-foreground flex justify-between items-center px-8 py-4">
        <div className="flex items-center gap-2">
          <div className="flex w-12 items-center justify-center rounded-lg">
                <Image
                  src="/DepGuardAI_Logo.png"
                  width={1000}
                  height={1000}
                  alt="DepGuard AI Logo"
                />
          </div>
          <span className="font-semibold text-accent">DepGuard AI</span>
        </div>

        <p className="text-sm text-accent">© 2026 DepGuard AI, All rights reserved.</p>
        
        <p className="text-sm text-accent">Made with care for development teams, worldwide.</p>
      </footer>
    </div>
  );
}
