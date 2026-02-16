import { createClient } from "@/src/lib/supabase/server";
import { NextResponse } from "next/server";

async function fetchChangelog(
  packageName: string,
  fromVersion: string,
  toVersion: string
): Promise<string | null> {
  try {
    // Try npm registry for release info
    const res = await fetch(
      `https://registry.npmjs.org/${packageName}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const description = data.description || "";
    const homepage = data.homepage || "";
    const repository =
      typeof data.repository === "string"
        ? data.repository
        : data.repository?.url || "";

    return `Package: ${packageName}\nDescription: ${description}\nHomepage: ${homepage}\nRepository: ${repository}\nUpdate from ${fromVersion} to ${toVersion}`;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dependencyId, name, currentVersion, latestVersion } =
      await request.json();

    // Provide a fallback summary without AI
     const summary = `${name} has an update available from ${currentVersion} to ${latestVersion}. Visit https://www.npmjs.com/package/${name} for the full changelog and release notes.`;

    await supabase
      .from("dependencies")
      .update({ ai_summary: summary })
      .eq("id", dependencyId);

    return NextResponse.json({ summary });

  } catch (error: unknown) {
    console.error("AI analysis error:", error);
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
