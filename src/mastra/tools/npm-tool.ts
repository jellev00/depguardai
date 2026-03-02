import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const fetchNpmInfoTool = createTool({
  id: "fetch-npm-info",
  description:
    "Fetches package metadata from npm registry AND release notes from GitHub to provide accurate changelog information.",
  inputSchema: z.object({
    packageName: z.string().describe("The npm package name to look up"),
    fromVersion: z.string().describe("The current version the user has"),
    toVersion: z.string().describe("The latest version to update to"),
  }),
  outputSchema: z.object({
    description: z.string(),
    homepage: z.string(),
    repository: z.string(),
    releaseNotes: z.string(),
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

    if (!packageName) {
      return { description: "", homepage: "", repository: "", releaseNotes: "" };
    }

    try {
      // 1. Haal npm info op
      const npmRes = await fetch(`https://registry.npmjs.org/${packageName}`);
      if (!npmRes.ok) {
        return { description: "", homepage: "", repository: "", releaseNotes: "" };
      }
      const npmData = await npmRes.json();

      const description = npmData.description || "";
      const homepage = npmData.homepage || "";
      const rawRepo =
        typeof npmData.repository === "string"
          ? npmData.repository
          : npmData.repository?.url || "";

      // 2. Extraheer GitHub owner/repo uit de repository URL
      const repoMatch = rawRepo.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
      let releaseNotes = "";

      if (repoMatch) {
        const repoPath = repoMatch[1];

        // 3. Haal GitHub release notes op voor de nieuwe versie
        const tagVariants = [
          `v${toVersion}`,
          toVersion,
          `${packageName}@${toVersion}`,
          `${packageName}%40${toVersion}`,
        ];

        for (const tag of tagVariants) {
          try {
            const releaseRes = await fetch(
              `https://api.github.com/repos/${repoPath}/releases/tags/${tag}`,
              {
                headers: {
                  Accept: "application/vnd.github+json",
                  "User-Agent": "DepGuardAI",
                },
              }
            );

            if (releaseRes.ok) {
              const releaseData = await releaseRes.json();
              releaseNotes = releaseData.body || "";
              break;
            }
          } catch {
            continue;
          }
        }

        // 4. Als geen specifieke release gevonden, haal de laatste 5 releases op
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
              const releases = await releasesRes.json();
              releaseNotes = releases
                .map((r: any) => `### ${r.tag_name}\n${r.body || "No notes"}`)
                .join("\n\n");
            }
          } catch {
            releaseNotes = "";
          }
        }
      }

      return {
        description,
        homepage,
        repository: rawRepo,
        releaseNotes: releaseNotes || "No release notes found on GitHub.",
      };
    } catch {
      return { description: "", homepage: "", repository: "", releaseNotes: "" };
    }
  },
});