// import { createClient } from "@/src/lib/supabase/server";
// import { NextResponse } from "next/server";

// export async function POST(request: Request) {
//   try {
//     const supabase = await createClient();
//     const { data: { user } } = await supabase.auth.getUser();

//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { dependencyId, name, currentVersion, latestVersion } =
//       await request.json();

//     // Roep de Mastra server aan via HTTP (geen import nodig)
//     const mastraRes = await fetch("http://localhost:4111/api/agents/dependencyAgent/generate", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         messages: [
//           {
//             role: "user",
//             content: `Use the fetch-npm-info tool with packageName="${name}", fromVersion="${currentVersion}", toVersion="${latestVersion}".

//             Then analyze the update for "${name}" from version ${currentVersion} to ${latestVersion} based on the actual release notes you retrieved.`,
//           },
//         ],
//       }),
//     });

//     if (!mastraRes.ok) {
//       const err = await mastraRes.text();
//       throw new Error(`Mastra error: ${err}`);
//     }

//     const mastraData = await mastraRes.json();
//     const summary = mastraData.text;

//     await supabase
//       .from("dependencies")
//       .update({ ai_summary: summary })
//       .eq("id", dependencyId);

//     return NextResponse.json({ summary });
//   } catch (error: unknown) {
//     console.error("Analysis error:", error);
//     return NextResponse.json(
//       {
//         error: error instanceof Error ? error.message : "Failed to analyze dependency",
//       },
//       { status: 500 }
//     );
//   }
// }




import { createClient } from "@/src/lib/supabase/server";
import { NextResponse } from "next/server";

// De n8n webhook URL — gebruik de test URL tijdens development,
// de production URL als de workflow actief is in n8n
// const N8N_WEBHOOK_URL =
//   process.env.NODE_ENV === "production"
//     ? "http://localhost:5678/webhook/dependency-analyze"
//     : "http://localhost:5678/webhook-test/dependency-analyze";

const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/dependency-analyze";

export async function POST(request: Request) {
  try {
    // 1. Authenticatie check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Request body uitlezen
    const { dependencyId, name, currentVersion, latestVersion } = await request.json();

    // 3. n8n workflow aanroepen via de webhook URL
    // n8n verwerkt de volledige workflow: npm -> Github -> OpenAI -> Supabase
    const n8nRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dependencyId,
        name,
        currentVersion,
        latestVersion,
      }),
    });

    if (!n8nRes.ok) {
      const errText = await n8nRes.text();
      throw new Error(`n8n workflow error: ${errText}`);
    }

    // 4. n8n geeft { summary: "..." } terug
    const data = await n8nRes.json();
    const summary = data.summary;

    // Opmerking: n8n heeft de Supabase update al gedaan in de workflow.
    // We hoeven hier dus niets meer op te slaan.

    return NextResponse.json({ summary });
  } catch (error: unknown) {
    console.error("n8n workflow error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze dependency",
      },
      { status: 500 }
    );
  }
}