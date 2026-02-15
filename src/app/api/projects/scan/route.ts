import { createClient } from "@/src/lib/supabase/server";
import { NextResponse } from "next/server";

function parseGithubUrl(url: string) {
  // Extract owner/repo from GitHub URL
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

async function fetchPackageJson(owner: string, repo: string) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`;
  const res = await fetch(url);
  if (!res.ok) {
    // Try master branch
    const res2 = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/master/package.json`
    );
    if (!res2.ok) return null;
    return res2.json();
  }
  return res.json();
}

async function getLatestVersion(packageName: string) {
  try {
    const res = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.version as string;
  } catch {
    return null;
  }
}

function classifyUpdate(current: string, latest: string): string | null {
  if (!current || !latest) return null;
  const cleanCurrent = current.replace(/^[\^~>=<]+/, "");
  const cleanLatest = latest.replace(/^[\^~>=<]+/, "");
  if (cleanCurrent === cleanLatest) return null;

  const [cMajor, cMinor] = cleanCurrent.split(".").map(Number);
  const [lMajor, lMinor] = cleanLatest.split(".").map(Number);

  if (Number.isNaN(cMajor) || Number.isNaN(lMajor)) return "unknown";
  if (lMajor > cMajor) return "major";
  if (lMinor > cMinor) return "minor";
  return "patch";
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

    const { projectId, githubUrl, packageJson: uploadedPkg } =
      await request.json();

    let deps: Record<string, string> = {};

    if (githubUrl) {
      const parsed = parseGithubUrl(githubUrl);
      if (!parsed) {
        return NextResponse.json(
          { error: "Invalid GitHub URL" },
          { status: 400 }
        );
      }
      const pkg = await fetchPackageJson(parsed.owner, parsed.repo);
      if (!pkg) {
        return NextResponse.json(
          { error: "Could not fetch package.json from repository" },
          { status: 404 }
        );
      }
      deps = { ...pkg.dependencies, ...pkg.devDependencies };
    } else if (uploadedPkg) {
      const parsed =
        typeof uploadedPkg === "string" ? JSON.parse(uploadedPkg) : uploadedPkg;
      deps = { ...parsed.dependencies, ...parsed.devDependencies };
    }

    const depNames = Object.keys(deps);
    if (depNames.length === 0) {
      return NextResponse.json({ scanned: 0 });
    }

    // Fetch latest versions in parallel (batched)
    const results = await Promise.allSettled(
      depNames.map(async (name) => {
        const latest = await getLatestVersion(name);
        const currentVersion = deps[name].replace(/^[\^~>=<]+/, "");
        const updateType = latest ? classifyUpdate(currentVersion, latest) : null;
        return {
          project_id: projectId,
          name,
          current_version: currentVersion,
          latest_version: latest || currentVersion,
          package_type: "npm",
          update_type: updateType,
          status: updateType === "major" ? "breaking" : updateType ? "outdated" : "current",
          last_checked_at: new Date().toISOString(),
        };
      })
    );

    const depsToInsert = results
      .filter(
        (r): r is PromiseFulfilledResult<{
          project_id: string;
          name: string;
          current_version: string;
          latest_version: string;
          package_type: string;
          update_type: string | null;
          status: string;
          last_checked_at: string;
        }> => r.status === "fulfilled"
      )
      .map((r) => r.value);

    // Upsert dependencies
    const { error } = await supabase.from("dependencies").upsert(
      depsToInsert,
      { onConflict: "project_id,name" }
    );

    if (error) throw error;

    return NextResponse.json({ scanned: depsToInsert.length });
  } catch (error: unknown) {
    console.error("Scan error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to scan project",
      },
      { status: 500 }
    );
  }
}
