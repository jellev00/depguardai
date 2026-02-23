import { createClient } from "@/src/lib/supabase/server";
import { NextResponse } from "next/server";
import { mastra } from "@/src/mastra";

export async function POST(request: Request) {
  try {
    // 1. Authenticatie check (zelfde als voor)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Request body uitlezen
    const { dependencyId, name, currentVersion, latestVersion } = await request.json();

    // 3. Mastra agent ophalen
    const agent = mastra.getAgent("dependencyAgent");

    // 4. Agent aanroepen met - hij haalt zelf de npm info op via de tool
    const result = await agent.generate([
      {
      role: "user",
      content: `Analyze the npm package update for "${name}" from version ${currentVersion} to ${latestVersion}.
        
        First use the fetch-npm-info tool to get package details, then provide your analysis covering:
        - Type of update (major/minor/patch) based on semver
        - Key changes and new features (if inferable)
        - Potential breaking changes (especially for major updates)
        - Whether it's safe to update
        - Migration notes if applicable`,
      },
    ]);

    const summary = result.text;

    // 5. Opslaan in Supabase
    await supabase
      .from("dependencies")
      .update({ ai_summary: summary })
      .eq("id", dependencyId);
    
    return NextResponse.json({ summary });
  } catch (error: unknown) {
    console.error("Mastra agent error:", error);
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