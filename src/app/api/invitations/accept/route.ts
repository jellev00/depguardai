import { createClient } from "@/src/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { token, fullName, password } = await request.json();
    const supabase = await createClient();

    // Find the invitation
    const { data: invitation, error: invError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("accepted", false)
      .single();

    if (invError || !invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Create user via Supabase Auth admin (using service role would be ideal,
    // but we'll use signUp for the prototype)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_id: invitation.company_id,
          is_owner: false,
        },
      },
    });

    if (authError) {
      // If user already exists, try to sign them in
      if (authError.message.includes("already registered")) {
        return NextResponse.json(
          { error: "This email is already registered. Please sign in and accept from your dashboard." },
          { status: 400 }
        );
      }
      throw authError;
    }

    if (authData.user) {
      // Add as company member
      await supabase.from("company_members").insert({
        company_id: invitation.company_id,
        user_id: authData.user.id,
        roles: invitation.roles,
        invited_by: invitation.invited_by,
        accepted_at: new Date().toISOString(),
      });

      // Mark invitation as accepted
      await supabase
        .from("invitations")
        .update({ accepted: true })
        .eq("id", invitation.id);
    }

    return NextResponse.json({
      success: true,
      email: invitation.email,
    });
  } catch (error: unknown) {
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to accept invitation",
      },
      { status: 500 }
    );
  }
}
