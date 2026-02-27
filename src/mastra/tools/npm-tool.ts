import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { de } from "zod/v4/locales";

// simpele fetch met timeout en error handeling
async function fetchWithTimout(url: string, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DependencyAnalyzer/1.0)'
      }
    });
    clearTimeout(id);
    return response;
  }catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Simpele HTML parser voor changelog
function extraChangelogFromHtml(html: string, packageName: string, version: string): string {
  // Zoek naar secties die de versie bevatten
  const versionPatterns = [
    new RegExp(`[Vv]ersion\\s+${version.replace(/\./g, '\\.')}[^<]*`, 'i'),
    new RegExp(`${version.replace(/\./g, '\\.')}\\s*[-–]`, 'i'),
    new RegExp(`##+\\s*${version.replace(/\./g, '\\.')}`, 'i'),
    new RegExp(`<h[1-3][^>]*>.*${version.replace(/\./g, '\\.')}.*</h[1-3]>`, 'i'),
  ];

  // Zoek naar changelog secties
  const changelogStart = html.search(/<h[1-3][^>]*>[^<]*(changelog|release notes|history|changes)[^<]*</i);

  if (changelogStart > -1) {
    // Pak ongeveer 5000 karakters vanaf de changelog start
    const start = Math.max(0, changelogStart - 200);
    const end = Math.min(html.length, changelogStart + 5000);
    let section = html.substring(start, end);

    // Strip HTML tags simpelweg
    section = section.replace(/<[^>]+>/g, ' ');
    section = section.replace(/\s+/g, ' ').trim();

    return section;
  }

  return "";
}

export const fetchNpmInfoTool = createTool({
  id: "fetch-npm-info", 
  description: "Fetches package metadata from npm registry AND release notes from GitHub or web changelogs.",
  inputSchema: z.object({
    packageName: z.string().describe("The npm package name to look up"),
    fromVersion: z.string().describe("The current version the user has"),
    toVersion: z.string().describe("The latest version to update to"),
  }),
  outputSchema: z.object({
    description: z.string(),
    homepage: z.string(),
    repository: z.string(),
    releqseNotes: z.string(),
  }),

  execute: async (params: any) => {
    const packageName =
      params?.context?.packageName ??
      params?.input?.packageName ??
      params?.packageName;

    const toVersion =
      params?.context?.toVersion ??
      params?.input?.toVersion ??
      params?.toVersion ??
      "";

    const fromVersion =
      params?.context?.fromVersion ??
      params?.input?.fromVersion ??
      params?.fromVersion ??
      "";

    if (!packageName) {
      return { description: "", homepage: "", repository: "", releaseNotes: "" };
    }

    try {
      // 1. Haal npm info op
      const npmRes = await fetch(`https://registry.npmjs.org/${packageName}`);
      if (!npmRes.ok) {
        return  {description: "", homepage: "", repository: "", releaseNotes: "" };
      }
      const npmData = await npmRes.json();

      const description = npmData.description || "";
      const homepage = npmData.homepage || "";
      const rawRepo = typeof npmData.repository === "string"
        ? npmData.repository
        : npmData.repository?.url || "";
      
      // 2. Probeer eerstr Github release
      const repoMatch = rawRepo.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
      let releaseNotes = "";

      if (repoMatch) {
        const repoPath = repoMatch[1];

        // 3. Haal Github realease notes op voor de nieuwe versie
        const tagVariants = [
          `v${toVersion}`,
          toVersion,
          `${packageName}@${toVersion}`,
        ];

        for (const tag of tagVariants) {
          try {
            const releasesRes = await fetch(
              `https://api.github.com/repos/${repoPath}/releases/tags/${tag}`,
              {
                headers: {
                  Accept: "application/vnd.github+json",
                  "User-Agent": "DepGuardAI",
                },
              }
            );

            if (releasesRes.ok) {
              const releaseData = await releasesRes.json();
              releaseNotes = releaseData.body || "";
              console.log(`Found Github release for ${tag}`);
              break;
            }
          } catch {
            continue;
          }
        }

        // Als geen specifieke release gevonden, haal de laatste 5 releases op
        if (!releaseNotes) {
          try {
            const releasesRes = await fetch(
              `https://api.github.com/repos/${repoPath}/releases?per_page=5`,
              {
                headers: {
                  Accept: "application/vnd.github+json",
                  "User-Agent": "DepGuardAI",
                },
              }
            );

            if (releasesRes.ok) {
              conste releases = await release
            }
          }
        }

      }
    }
  }

})