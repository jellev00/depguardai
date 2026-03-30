import { createClient } from "@/src/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardOverview } from "@/src/components/dashboard/dashboard-overview";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) redirect("/onboarding");

  // Fetch stats
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("company_id", profile.company_id);

  const { count: memberCount } = await supabase
    .from("company_members")
    .select("*", { count: "exact", head: true })
    .eq("company_id", profile.company_id);

  // Get all dependencies across projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, dependencies(id, name, current_version, latest_version, status, update_type)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const allDeps = projects?.flatMap((p) => p.dependencies || []) || [];
  const outdatedCount = allDeps.filter((d) => d.status === "outdated").length
  const breakingCount = allDeps.filter((d) => d.status === "breaking").length;

  return (
    <DashboardOverview
      stats={{
        projects: projectCount || 0,
        members: memberCount || 0,
        outdated: outdatedCount,
        breaking: breakingCount,
        totalDeps: allDeps.length,
      }}
      recentProjects={
        projects?.map((p) => ({
          id: p.id,
          name: p.name,
          depCount: p.dependencies?.length || 0,
          outdatedCount: p.dependencies.filter((d) => d.status === "outdated").length,
          breakingCount: p.dependencies.filter((d) => d.status === "breaking").length,
        })) || []
      }
    />
  );
}
