import React from "react"
import { createClient } from "@/src/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/src/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get profile with company
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, companies(*)")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) {
    redirect("/onboarding");
  }

  // Get company members for context
  const { data: membership } = await supabase
    .from("company_members")
    .select("roles")
    .eq("company_id", profile.company_id)
    .eq("user_id", user.id)
    .single();

  const userContext = {
    id: user.id,
    email: user.email || "",
    fullName: profile.full_name || user.email || "",
    companyId: profile.company_id,
    companyName: profile.companies?.name || "",
    isOwner: profile.is_owner || false,
    roles: membership?.roles || [],
  };

  return <DashboardShell user={userContext}>{children}</DashboardShell>;
}
