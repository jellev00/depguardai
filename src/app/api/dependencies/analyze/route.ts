import { createClient } from "@/src/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dependencyId, name, currentVersion, latestVersion } =
      await request.json();

    // Roep de Mastra server aan via HTTP (geen import nodig)
    const mastraRes = await fetch("http://localhost:4111/api/agents/dependencyAgent/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Use the fetch-npm-info tool with packageName="${name}", fromVersion="${currentVersion}", toVersion="${latestVersion}".

            Then analyze the update for "${name}" from version ${currentVersion} to ${latestVersion} based on the actual release notes you retrieved.`,
          },
        ],
      }),
    });

    if (!mastraRes.ok) {
      const err = await mastraRes.text();
      throw new Error(`Mastra error: ${err}`);
    }

    const mastraData = await mastraRes.json();
    const summary = mastraData.text;

    await supabase
      .from("dependencies")
      .update({ ai_summary: summary })
      .eq("id", dependencyId);

    return NextResponse.json({ summary });
  } catch (error: unknown) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze dependency",
      },
      { status: 500 }
    );
  }
}