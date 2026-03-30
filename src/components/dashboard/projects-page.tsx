"use client";

import React from "react"

import { useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { Badge } from "@/src/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import {
  Plus,
  Loader2,
  FolderKanban,
  GitBranch,
  Package,
  ArrowRight,
  CalendarClock,
  AlertTriangle,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Project = {
  id: string;
  name: string;
  description: string;
  githubUrl: string;
  createdAt: string;
  depCount: number;
  outdatedCount: number;
  breakingCount: number;
};

type Member = {
  userId: string;
  email: string;
  fullName: string;
};

type SortKey = "createdAt" | "outdatedCount" | "breakingCount";

type Props = {
  companyId: string;
  currentUserId: string;
  canCreate: boolean;
  projects: Project[];
  members: Member[];
};

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "createdAt",
    label: "Recentste",
    icon: <CalendarClock className="h-3.5 w-3.5" />,
  },
  {
    key: "outdatedCount",
    label: "Outdated",
    icon: <TrendingDown className="h-3.5 w-3.5" />,
  },
  {
    key: "breakingCount",
    label: "Breaking",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
];

export function ProjectsPage({
  companyId,
  currentUserId,
  canCreate,
  projects,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortKey === "createdAt") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return b[sortKey] - a[sortKey];
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const supabase = createClient();
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          company_id: companyId,
          name,
          description: description || null,
          github_url: githubUrl || null,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as project member
      await supabase.from("project_members").insert({
        project_id: project.id,
        user_id: currentUserId,
        role: "project_lead",
      });

      toast.success("Project created");
      setName("");
      setDescription("");
      setGithubUrl("");
      setCreateOpen(false);
      router.refresh();

      // If GitHub URL provided, trigger dep scan
      if (githubUrl) {
        fetch("/api/projects/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, githubUrl }),
        }).catch(() => {
          // background scan
        });
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create project"
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your projects and track their dependencies
          </p>
        </div>
        {canCreate && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
                <DialogDescription>
                  Add a new project to track its dependencies
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="project-name">Project name</Label>
                  <Input
                    id="project-name"
                    required
                    placeholder="My App"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-desc">Description</Label>
                  <Textarea
                    id="project-desc"
                    placeholder="Brief description of the project..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="github-url">GitHub URL (optional)</Label>
                  <Input
                    id="github-url"
                    type="url"
                    placeholder="https://github.com/owner/repo"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    We will fetch package.json to auto-detect dependencies
                  </p>
                </div>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create project"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Sort controls */}
      {projects.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sorteer op:</span>
          <div className="flex items-center rounded-md border bg-muted p-0.5 gap-0.5">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setSortKey(option.key)}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortKey === option.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {sortedProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No projects yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first project to start tracking dependencies
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="group"
            >
              <Card className="h-full transition-colors hover:border-primary/30">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                      <FolderKanban className="h-4 w-4 text-primary" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardTitle className="mt-2">{project.name}</CardTitle>
                  {project.description && (
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">
                      <Package className="mr-1 h-3 w-3" />
                      {project.depCount} deps
                    </Badge>
                    {project.outdatedCount > 0 && (
                      <Badge variant="secondary" className="bg-warning/10 text-warning whitespace-nowrap">
                        <TrendingDown className="mr-1 h-3 w-3" />
                        {project.outdatedCount} outdated
                      </Badge>
                    )}
                    {project.breakingCount > 0 && (
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive whitespace-nowrap">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {project.breakingCount} breaking
                      </Badge>
                    )}
                    {project.githubUrl && (
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        <GitBranch className="mr-1 h-3 w-3" />
                        GitHub
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}