import { createClient } from "@/src/lib/supabase/server";
import { NextResponse } from "next/server";

const MASTRA_BASE_URL = "http://localhost:4111";
const N8N_BASE_URL = "http://localhost:5678";

/** 
 * Checks if a service is reachable by sending a quick HEAD/GET request.
 * Returns true if the service responds withi the timeout, false otherwise.
*/

async function isServiceAvailable(url: string, timeoutMs = 3000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(url, {method: "HEAD", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dependencyId, name, currentVersion, latestVersion } = await request.json();

    const [mastraAvailable, n8nAvailable] = await Promise.all([
      isServiceAvailable(MASTRA_BASE_URL),
      isServiceAvailable(N8N_BASE_URL),
    ]);

    console.log(`Service availability - Mastra: ${mastraAvailable}, n8n: ${n8nAvailable}`);

    let summary: string;

    if (mastraAvailable) {
      // --- Mastra ---
      const mastraRes = await fetch(
        `${MASTRA_BASE_URL}/api/agents/dependencyAgent/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `Use the fetch-npm-info tool with packageName="${name}", fromVersion="${currentVersion}", toVersion="${latestVersion}".
                Then analyze the update for "${name}" from version ${currentVersion} to ${latestVersion} based on the actual release notes you retrieved.`
              },
            ],
          }),
        }
      );

      if (!mastraRes.ok) {
        const err = await mastraRes.text();
        throw new Error(`Mastra error: ${err}`);
      }

      const mastraData = await mastraRes.json();
      summary = mastraData.text;

    } else if (n8nAvailable) {
      // --- n8n ---
      const n8nRes = await fetch(
        `${N8N_BASE_URL}/webhook-test/analyze-dependency`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageName: name,
            fromVersion: currentVersion,
            toVersion: latestVersion,
          }),
        }
      );

      if (!n8nRes.ok) {
        const err = await n8nRes.text();
        throw new Error(`n8n error: ${err}`);
      }

      const n8nData = await n8nRes.json();
      summary = n8nData.summary;

    } else {
      // Niether service is available
      throw new Error("No analysis service is currently available. Both Mastra and n8n are offline.");
    }

    await supabase
      .from("dependencies")
      .update({ 
        ai_summary: summary,
        ai_summary_time: new Date().toISOString(),
      })
      .eq("id", dependencyId);
    
    return NextResponse.json({ summary });

  } catch (error: unknown) {
    console.error("Analysis error: ", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze dependency",
      },
      { status: 500 }
    );
  }
}