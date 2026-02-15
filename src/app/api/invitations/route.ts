import { createClient } from "@/src/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, roles, companyId } = await request.json();

    // Verify user is company owner
    const { data: company } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .eq("owner_id", user.id)
      .single();

    if (!company) {
      return NextResponse.json(
        { error: "Only company owners can invite members" },
        { status: 403 }
      );
    }

    // Generate token
    const token = crypto.randomUUID();

    // Create invitation record
    const { error: invError } = await supabase.from("invitations").insert({
      company_id: companyId,
      email,
      roles,
      token,
      invited_by: user.id,
    });

    if (invError) throw invError;

    // Try to send email via Resend (if configured)
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${token}`;

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          // from: "DepGuard AI <onboarding@resend.dev>",
          from: 'onboarding@resend.dev',
          to: [email],
          subject: `You're invited to join ${company.name} on DepGuard AI`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2>You're invited to ${company.name}</h2>
              <p>You've been invited to join <strong>${company.name}</strong> on DepGuard AI as a ${roles.map((r: string) => r.replace("_", " ")).join(", ")}.</p>
              <p><a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a></p>
              <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Email send failed:", emailError);
        // Continue even if email fails - invitation is in DB
      }
    }

    return NextResponse.json({ success: true, inviteUrl });
  } catch (error: unknown) {
    console.error("Invitation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create invitation" },
      { status: 500 }
    );
  }
}
