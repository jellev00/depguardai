// import { createClient } from "@/src/lib/supabase/server";
// import { NextResponse } from "next/server";

// export async function POST(request: Request) {
//   try {
//     const { token, fullName, password } = await request.json();

//     // Add debug logging
//     console.log("Received token:", token);
//     console.log("Full token value:", JSON.stringify({ token, fullName }));

//     const supabase = await createClient();

//     // First, let's check if the token exists at all (including accepted invitations)
//     console.log("Checking all invitations with token:", token);
//     const { data: allInvitations, error: allError } = await supabase
//       .from("invitations")
//       .select("*")
//       .eq("token", token);

//     console.log("All invitations with this token:", { 
//       count: allInvitations?.length, 
//       data: allInvitations,
//       error: allError 
//     });

//     if (allError) {
//       console.error("Error querying invitations:", allError);
//     }

//     // Find the invitation
//     const { data: invitation, error: invError } = await supabase
//       .from("invitations")
//       .select("*")
//       .eq("token", token)
//       .eq("accepted", false)
//       .single();

//     if (invError || !invitation) {
//       return NextResponse.json(
//         { error: "Invalid or expired invitation" },
//         { status: 400 }
//       );
//     }

//     // Check expiry
//     if (new Date(invitation.expires_at) < new Date()) {
//       return NextResponse.json(
//         { error: "This invitation has expired" },
//         { status: 400 }
//       );
//     }

//     // Create user via Supabase Auth admin (using service role would be ideal,
//     // but we'll use signUp for the prototype)
//     const { data: authData, error: authError } = await supabase.auth.signUp({
//       email: invitation.email,
//       password,
//       options: {
//         data: {
//           full_name: fullName,
//           company_id: invitation.company_id,
//           is_owner: false,
//         },
//       },
//     });

//     if (authError) {
//       // If user already exists, try to sign them in
//       if (authError.message.includes("already registered")) {
//         return NextResponse.json(
//           { error: "This email is already registered. Please sign in and accept from your dashboard." },
//           { status: 400 }
//         );
//       }
//       throw authError;
//     }

//     if (authData.user) {
//       // Add as company member
//       await supabase.from("company_members").insert({
//         company_id: invitation.company_id,
//         user_id: authData.user.id,
//         roles: invitation.roles,
//         invited_by: invitation.invited_by,
//         accepted_at: new Date().toISOString(),
//       });

//       // Mark invitation as accepted
//       await supabase
//         .from("invitations")
//         .update({ accepted: true })
//         .eq("id", invitation.id);
//     }

//     return NextResponse.json({
//       success: true,
//       email: invitation.email,
//     });
//   } catch (error: unknown) {
//     console.error("Accept invitation error:", error);
//     return NextResponse.json(
//       {
//         error:
//           error instanceof Error
//             ? error.message
//             : "Failed to accept invitation",
//       },
//       { status: 500 }
//     );
//   }
// }


import { createClient } from "@/src/lib/supabase/server";
import { createServiceRoleClient } from "@/src/lib/supabase/service-role";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { token, fullName, password } = await request.json();

    console.log("Received token:", token);

    // Use regular client for public queries
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

    // Use service role client for admin operations
    const supabaseAdmin = createServiceRoleClient();

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users.some(u => u.email === invitation.email);

    let userId;

    if (userExists) {
      // Get the existing user's ID
      const existing = existingUser?.users.find(u => u.email === invitation.email);
      userId = existing?.id;
      
      // Update user metadata if needed
      await supabaseAdmin.auth.admin.updateUserById(userId!, {
        user_metadata: {
          full_name: fullName,
          company_id: invitation.company_id,
          is_owner: false,
        }
      });
    } else {
      // Create new user with email already confirmed
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true, // This bypasses email confirmation
        user_metadata: {
          full_name: fullName,
          company_id: invitation.company_id,
          is_owner: false,
        },
      });

      if (authError) {
        console.error("Auth error:", authError);
        return NextResponse.json(
          { error: authError.message },
          { status: 400 }
        );
      }

      userId = authData.user.id;
    }

    if (userId) {
      // Add as company member
      await supabaseAdmin.from("company_members").insert({
        company_id: invitation.company_id,
        user_id: userId,
        roles: invitation.roles,
        invited_by: invitation.invited_by,
        accepted_at: new Date().toISOString(),
      });

      // Mark invitation as accepted
      await supabaseAdmin
        .from("invitations")
        .update({ accepted: true })
        .eq("id", invitation.id);
    }

    // Return success - user can now sign in manually
    return NextResponse.json({
      success: true,
      email: invitation.email,
      message: userExists 
        ? "You have successfully joined the company. Please sign in with your existing account."
        : "Account created successfully. You can now sign in.",
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