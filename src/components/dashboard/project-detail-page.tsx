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
import { Badge } from "@/src/components/ui/badge";
import { Input } from "@/src/components/ui/input";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import {
  ArrowLeft,
  GitBranch,
  RefreshCw,
  Loader2,
  Sparkles,
  UserPlus,
  Upload,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

type Dependency = {
  id: string;
  name: string;
  currentVersion: string;
  latestVersion: string;
  updateType: string | null;
  status: string;
  aiSummary: string | null;
  lastCheckedAt: string | null;
};

type ProjectMember = {
  id: string;
  userId: string;
  role: string;
  email: string;
  fullName: string;
};

type CompanyMember = {
  userId: string;
  email: string;
  fullName: string;
};

type Props = {
  project: {
    id: string;
    name: string;
    description: string;
    githubUrl: string;
    createdAt: string;
  };
  dependencies: Dependency[];
  projectMembers: ProjectMember[];
  companyMembers: CompanyMember[];
  canManage: boolean;
  currentUserId: string;
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  current: {
    label: "CURRENT",
    className: "bg-success/10 text-success border-success/20",
  },
  outdated: {
    label: "OUTDATED",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  breaking: {
    label: "BREAKING",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  security: {
    label: "SECURITY",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  unknown: {
    label: "UNKNOWN",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const UPDATE_STYLES: Record<string, { label: string; className: string }> = {
  major: {
    label: "MAJOR",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  minor: {
    label: "MINOR",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  patch: {
    label: "PATCH",
    className: "bg-primary/10 text-primary border-primary/20",
  },
};

export function ProjectDetailPage({
  project,
  dependencies,
  projectMembers,
  companyMembers,
  canManage,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedDep, setExpandedDep] = useState<string | null>(null);
  const [analyzingDep, setAnalyzingDep] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedRole, setSelectedRole] = useState("developer");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleRescan = async () => {
    if (!project.githubUrl) {
      toast.error("No GitHub URL configured for this project");
      return;
    }
    setIsScanning(true);
    try {
      const res = await fetch("/api/projects/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          githubUrl: project.githubUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      toast.success(`Scanned ${data.scanned} dependencies`);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("packageFile") as File;
    if (!file) return;

    setIsScanning(true);
    try {
      const content = await file.text();
      const res = await fetch("/api/projects/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          packageJson: content,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      toast.success(`Scanned ${data.scanned} dependencies`);
      setUploadOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      const supabase = createClient();
      
      // First, check if the user has permission to delete this project
      const { data: projectCheck, error: checkError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", project.id)
        .single();
      
      if (checkError || !projectCheck) {
        throw new Error("Project not found or you don't have permission to delete it");
      }

      // Check if there are dependencies to delete
      const { count: dependenciesCount, error: countDepsError } = await supabase
        .from("dependencies")
        .select("*", { count: "exact", head: true })
        .eq("project_id", project.id);
      
      if (countDepsError) {
        console.error("Error counting dependencies:", countDepsError);
      }
      
      // Only delete dependencies if there are any
      if (dependenciesCount && dependenciesCount > 0) {
        console.log(`Deleting ${dependenciesCount} dependencies...`);
        const { error: depsError } = await supabase
          .from("dependencies")
          .delete()
          .eq("project_id", project.id);
        
        if (depsError) {
          console.error("Error deleting dependencies:", depsError);
          throw new Error(`Failed to delete dependencies: ${depsError.message}`);
        }
      } else {
        console.log("No dependencies to delete");
      }

      // Check if there are project members to delete
      const { count: membersCount, error: countMembersError } = await supabase
        .from("project_members")
        .select("*", { count: "exact", head: true })
        .eq("project_id", project.id);
      
      if (countMembersError) {
        console.error("Error counting project members:", countMembersError);
      }
      
      // Only delete project members if there are any
      if (membersCount && membersCount > 0) {
        console.log(`Deleting ${membersCount} project members...`);
        const { error: membersError } = await supabase
          .from("project_members")
          .delete()
          .eq("project_id", project.id);
        
        if (membersError) {
          console.error("Error deleting project members:", membersError);
          throw new Error(`Failed to delete project members: ${membersError.message}`);
        }
      } else {
        console.log("No project members to delete");
      }

      // Finally delete the project
      console.log("Deleting project...");
      const { error: projectError } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (projectError) {
        console.error("Error deleting project:", projectError);
        
        // Check for specific error types
        if (projectError.code === '42501') {
          throw new Error("You don't have permission to delete this project");
        } else if (projectError.code === '23503') {
          throw new Error("Cannot delete project because it has related records that couldn't be removed");
        } else {
          throw new Error(`Failed to delete project: ${projectError.message}`);
        }
      }

      toast.success("Project deleted successfully");
      
      // Close dialog and redirect
      setDeleteDialogOpen(false);
      router.push("/dashboard/projects");
      router.refresh(); // Refresh the router to update any cached data
      
    } catch (error: unknown) {
      console.error("Delete project error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete project"
      );
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleAIAnalysis = async (dep: Dependency) => {
    setAnalyzingDep(dep.id);
    try {
      const res = await fetch("/api/dependencies/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dependencyId: dep.id,
          name: dep.name,
          currentVersion: dep.currentVersion,
          latestVersion: dep.latestVersion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      toast.success("AI analysis complete");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setAnalyzingDep(null);
    }
  };

  const handleAddMember = async () => {
    if (!selectedMember) return;
    setIsAddingMember(true);
    try {
      const supabase = createClient();

      // 1. Check if the user is already a member
      const { data: existing, error: checkError } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", project.id)
        .eq("user_id", selectedMember)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking existing member:", checkError);
        throw new Error(`Error checking membership: ${checkError.message}`);
      }

      if (existing) {
        toast.error("User is already a member of this project");
        return;
      }

      // 2. Attempt the insert and capture the full error
      const { data, error: insertError } = await supabase
        .from("project_members")
        .insert({
          project_id: project.id,
          user_id: selectedMember,
          role: selectedRole,
        })
        .select();

      if (insertError) {
        // Log the complete error object to the console
        console.error("Full Supabase insert error:", JSON.stringify(insertError, null, 2));
        console.error("Error code:", insertError.code);
        console.error("Error message:", insertError.message);
        console.error("Error details:", insertError.details);
        console.error("Error hint:", insertError.hint);

        // Throw a detailed error for the toast
        throw new Error(`Insert failed (${insertError.code}): ${insertError.message}`);
      }

      console.log("Insert successful:", data);
      toast.success("Member added to project");
      setSelectedMember("");
      setAddMemberOpen(false);
      router.refresh();

    } catch (error: unknown) {
      console.error("Add member error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add member");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
      toast.success("Member removed from project");
      router.refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove member"
      );
    }
  };

  const existingMemberIds = projectMembers.map((m) => m.userId);
  const availableMembers = companyMembers.filter(
    (m) => !existingMemberIds.includes(m.userId)
  );

  const filteredDeps = dependencies.filter((dep) => {
    const matchesSearch = dep.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterStatus === "all" || dep.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const statusCounts = {
    all: dependencies.length,
    current: dependencies.filter((d) => d.status === "current").length,
    outdated: dependencies.filter((d) => d.status === "outdated").length,
    breaking: dependencies.filter((d) => d.status === "breaking").length,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-0.5">
            <Link href="/dashboard/projects">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to projects</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <GitBranch className="h-3 w-3" />
                {project.githubUrl.replace("https://github.com/", "")}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload package.json</DialogTitle>
                <DialogDescription>
                  Upload a package.json file to scan dependencies
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpload} className="flex flex-col gap-4">
                <Input
                  name="packageFile"
                  type="file"
                  accept=".json"
                  required
                  className="cursor-pointer"
                />
                <Button type="submit" disabled={isScanning}>
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    "Scan dependencies"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          {project.githubUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRescan}
              disabled={isScanning}
            >
              {isScanning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Re-scan
            </Button>
          )}
          
          {/* Delete Project Button */}
          {/* Delete Project Button - Only show if user can manage */}
          {canManage && (
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button className="border border-red-600 bg-transparent text-red-600 hover:bg-red-600 hover:text-white" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the
                    project "{project.name}" and all of its dependencies ({dependencies.length} packages) 
                    and member associations ({projectMembers.length} members).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteProject}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete Project"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Status summary */}
      <div className="flex flex-wrap gap-2">
        {(["all", "current", "outdated", "breaking"] as const).map((status) => (
          <Button
            key={status}
            variant={filterStatus === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(status)}
            className="text-xs"
          >
            {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}{" "}
            ({statusCounts[status]})
          </Button>
        ))}
      </div>

      {/* Dependencies */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Dependencies ({filteredDeps.length})</CardTitle>
            <CardDescription>
              Package versions and update status
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search dependencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredDeps.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {dependencies.length === 0
                  ? "No dependencies scanned yet. Upload a package.json or re-scan from GitHub."
                  : "No dependencies match your filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Latest</TableHead>
                    <TableHead>Update</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeps.map((dep) => {
                    const statusStyle = STATUS_STYLES[dep.status] || STATUS_STYLES.unknown;
                    const updateStyle = dep.updateType
                      ? UPDATE_STYLES[dep.updateType]
                      : null;
                    const isExpanded = expandedDep === dep.id;

                    return (
                      <React.Fragment key={dep.id}>
                        <TableRow
                          key={dep.id}
                          className="cursor-pointer hover:bg-muted/30"
                          onClick={() =>
                            setExpandedDep(isExpanded ? null : dep.id)
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className="font-mono text-sm font-medium text-foreground">
                                {dep.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs text-muted-foreground">
                              {dep.currentVersion}
                            </code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs text-foreground">
                              {dep.latestVersion}
                            </code>
                          </TableCell>
                          <TableCell>
                            {updateStyle && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold ${updateStyle.className}`}
                              >
                                {updateStyle.label}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold ${statusStyle.className}`}
                            >
                              {statusStyle.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAIAnalysis(dep);
                              }}
                              disabled={analyzingDep === dep.id}
                              className="text-xs"
                            >
                              {analyzingDep === dep.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="mr-1 h-3 w-3" />
                              )}
                              Analyze
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${dep.id}-detail`}>
                            <TableCell colSpan={6} className="bg-muted/20">
                              <div className="px-4 py-3">
                                {dep.aiSummary ? (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="h-4 w-4 text-primary" />
                                      <span className="text-sm font-medium text-foreground">
                                        AI Changelog Summary
                                      </span>
                                    </div>
                                    <div className="prose prose-sm dark:prose-invert max-w-non text-muted-foreground
                                      [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1
                                      [&_ul]:my-1 [&_li]:my-0.5
                                      [&_strong]:text-foreground [&_strong]:font-medium
                                      [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-xs [&_blockquote]:italic
                                      [&_a]:text-primary [&_a]:underline"
                                    >
                                      <ReactMarkdown>{dep.aiSummary}</ReactMarkdown>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <p className="text-sm text-muted-foreground">
                                      No AI analysis yet.
                                    </p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAIAnalysis(dep)}
                                      disabled={analyzingDep === dep.id}
                                    >
                                      {analyzingDep === dep.id ? (
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      ) : (
                                        <Sparkles className="mr-1 h-3 w-3" />
                                      )}
                                      Generate analysis
                                    </Button>
                                  </div>
                                )}
                                <div className="mt-3 flex gap-2">
                                  <a
                                    href={`https://www.npmjs.com/package/${dep.name}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    npm
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                  <a
                                    href={`https://github.com/search?q=${encodeURIComponent(dep.name)}&type=repositories`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    GitHub
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Project Members ({projectMembers.length})</CardTitle>
            <CardDescription>
              Team members assigned to this project
            </CardDescription>
          </div>
          {canManage && availableMembers.length > 0 && (
            <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add project member</DialogTitle>
                  <DialogDescription>
                    Assign a team member to this project
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <Select
                    value={selectedMember}
                    onValueChange={setSelectedMember}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMembers.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.fullName || m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project_lead">
                        Project Lead
                      </SelectItem>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="tester">Tester</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddMember}
                    disabled={!selectedMember || isAddingMember}
                  >
                    {isAddingMember ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add to project"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {projectMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members assigned yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {projectMembers.map((member) => {
                const initials = (member.fullName || member.email)
                  .split(/[\s@]/)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {member.fullName || member.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {member.role
                          .split("_")
                          .map(
                            (w) => w.charAt(0).toUpperCase() + w.slice(1)
                          )
                          .join(" ")}
                      </Badge>
                      {canManage && member.userId !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <X className="h-3 w-3" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}