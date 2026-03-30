import { createClient } from "@/src/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectsPage } from "@/src/components/dashboard/projects-page";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_owner")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) redirect("/onboarding");

  const { data: membership } = await supabase
    .from("company_members")
    .select("roles")
    .eq("company_id", profile.company_id)
    .eq("user_id", user.id)
    .single();

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, description, github_url, created_at, created_by, dependencies(id, current_version, latest_version, status, update_type)"
    )
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  // Get members for assignment
  const { data: members } = await supabase
    .from("company_members")
    .select("user_id, profiles(id, email, full_name)")
    .eq("company_id", profile.company_id);

  const canCreateProject =
    profile.is_owner ||
    (membership?.roles || []).includes("project_lead");

  return (
    <ProjectsPage
      companyId={profile.company_id}
      currentUserId={user.id}
      canCreate={canCreateProject}
      projects={
        projects?.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || "",
          githubUrl: p.github_url || "",
          createdAt: p.created_at,
          depCount: p.dependencies?.length || 0,
          outdatedCount:
            p.dependencies?.filter(
              (d) => d.current_version !== d.latest_version && d.latest_version
            ).length || 0,
          breakingCount: p.dependencies.filter((d) => d.status === "breaking").length,
        })) || []
      }
      members={
        members?.map((m) => ({
          userId: m.user_id,
          email: (m.profiles as { email: string } | null)?.email || "",
          fullName:
            (m.profiles as { full_name: string } | null)?.full_name || "",
        })) || []
      }
    />
  );
}
