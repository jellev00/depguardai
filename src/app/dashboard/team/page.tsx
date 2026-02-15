import { createClient } from "@/src/lib/supabase/server";
import { redirect } from "next/navigation";
import { TeamPage } from "@/src/components/dashboard/team-page";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_owner, companies(name)")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) redirect("/onboarding");

  // Get members with profiles
  const { data: members } = await supabase
    .from("company_members")
    .select("id, roles, accepted_at, user_id, profiles(id, email, full_name)")
    .eq("company_id", profile.company_id);

  // Get pending invitations
  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, roles, created_at, accepted, expires_at")
    .eq("company_id", profile.company_id)
    .eq("accepted", false)
    .order("created_at", { ascending: false });

  return (
    <TeamPage
      companyId={profile.company_id}
      companyName={profile.companies?.name || ""}
      isOwner={profile.is_owner || false}
      currentUserId={user.id}
      members={
        members?.map((m) => ({
          id: m.id,
          userId: m.user_id,
          email: (m.profiles as { email: string } | null)?.email || "",
          fullName: (m.profiles as { full_name: string } | null)?.full_name || "",
          roles: m.roles || [],
          acceptedAt: m.accepted_at,
        })) || []
      }
      invitations={
        invitations?.map((inv) => ({
          id: inv.id,
          email: inv.email,
          roles: inv.roles || [],
          createdAt: inv.created_at,
          expiresAt: inv.expires_at,
        })) || []
      }
    />
  );
}
