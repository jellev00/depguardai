import { createClient } from "@/src/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ProjectDetailPage } from "@/src/components/dashboard/project-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: dependencies } = await supabase
    .from("dependencies")
    .select("*")
    .eq("project_id", id)
    .order("name");

  const { data: projectMembers } = await supabase
    .from("project_members")
    .select("id, role, user_id, profiles(id, email, full_name)")
    .eq("project_id", id);

  // Get company members for assignment
  const { data: companyMembers } = await supabase
    .from("company_members")
    .select("user_id, profiles(id, email, full_name)")
    .eq("company_id", project.company_id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_owner")
    .eq("id", user.id)
    .single();

  const { data: myProjectMembership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .single();

  const canManage =
    profile?.is_owner || myProjectMembership?.role === "project_lead";

  return (
    <ProjectDetailPage
      project={{
        id: project.id,
        name: project.name,
        description: project.description || "",
        githubUrl: project.github_url || "",
        createdAt: project.created_at,
      }}
      dependencies={
        dependencies?.map((d) => ({
          id: d.id,
          name: d.name,
          currentVersion: d.current_version,
          latestVersion: d.latest_version || d.current_version,
          updateType: d.update_type || null,
          status: d.status || "unknown",
          aiSummary: d.ai_summary || null,
          lastCheckedAt: d.last_checked_at,
        })) || []
      }
      projectMembers={
        projectMembers?.map((m) => ({
          id: m.id,
          userId: m.user_id,
          role: m.role,
          email: (m.profiles as { email: string } | null)?.email || "",
          fullName:
            (m.profiles as { full_name: string } | null)?.full_name || "",
        })) || []
      }
      companyMembers={
        companyMembers?.map((m) => ({
          userId: m.user_id,
          email: (m.profiles as { email: string } | null)?.email || "",
          fullName:
            (m.profiles as { full_name: string } | null)?.full_name || "",
        })) || []
      }
      canManage={canManage}
      currentUserId={user.id}
    />
  );
}
