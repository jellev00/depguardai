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

  // In your parent page.tsx, replace the project members section with:

  // Get project members with a direct join (not using the nested select)
  const { data: projectMembers, error: membersError } = await supabase
    .from("project_members")
    .select(`
      id,
      project_id,
      user_id,
      role,
      added_at
    `)
    .eq("project_id", id);

  console.log("Project members raw:", projectMembers);

  // Get profiles for these users
  let processedProjectMembers: any[] = [];

  if (projectMembers && projectMembers.length > 0) {
    const userIds = projectMembers.map(m => m.user_id);
    
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    
    console.log("Profiles:", profiles);
    
    // Create a map for easy lookup
    const profileMap = new Map();
    profiles?.forEach(p => {
      profileMap.set(p.id, p);
    });
    
    // Combine the data
    processedProjectMembers = projectMembers.map(member => {
      const profile = profileMap.get(member.user_id);
      return {
        id: member.id,
        userId: member.user_id,
        role: member.role,
        email: profile?.email || "",
        fullName: profile?.full_name || "",
      };
    });
    
    console.log("Processed project members:", processedProjectMembers);
  }

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
          aiSummaryTime: d.ai_summary_time || null,
          lastCheckedAt: d.last_checked_at,
        })) || []
      }
      projectMembers={
        processedProjectMembers?.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          email: (m.email as string) || "",
          fullName:
            (m.fullName as string) || "",
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
