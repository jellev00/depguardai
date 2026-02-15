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

    if (!process.env.OPENAI_API_KEY) {
      // Provide a fallback summary without AI
      const summary = `${name} has an update available from ${currentVersion} to ${latestVersion}. Visit https://www.npmjs.com/package/${name} for the full changelog and release notes.`;

      await supabase
        .from("dependencies")
        .update({ ai_summary: summary })
        .eq("id", dependencyId);

      return NextResponse.json({ summary });
    }

    const changelogContext = await fetchChangelog(
      name,
      currentVersion,
      latestVersion
    );

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a dependency analysis assistant. Provide concise, useful summaries of package updates for developers. Focus on: breaking changes, new features, deprecations, and security fixes. Keep responses under 200 words. Use markdown-like formatting with bullet points.",
        },
        {
          role: "user",
          content: `Analyze the update for the npm package "${name}" from version ${currentVersion} to ${latestVersion}.

${changelogContext ? `Context:\n${changelogContext}` : ""}

Provide a summary covering:
1. What type of update this is (major/minor/patch)
2. Key changes and new features (if known)
3. Potential breaking changes (if major)
4. Whether it's safe to update
5. Any migration notes

If you don't have specific changelog data, provide general guidance based on semantic versioning and the package's purpose.`,
        },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    const summary =
      completion.choices[0]?.message?.content || "Unable to generate summary.";

    // Update the dependency with the AI summary
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
