import type OpenAI from "openai";

export const fetchNpmInfoToolDefinition: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
        name: "fetch-npm-info",
        description: "Fetches package metadata from the npm registry, release notes form GitHub releases, " +
            "AND parses CHANGELOG.md files for packages that don't use GitHub releases.",
        parameters: {
            type: "object",
            properties: {
                packageName: { type: "string", description: "The npm package name to look up" },
                fromVersion: { type: "string", description: "The current version the user has" },
                toVersion: { type: "string", description: "The latest version to update to" },
            },
            required: ["packageName", "fromVersion", "toVersion"],

        },
    },
};

export async function executeFetchNpmInfo(args: {
    packageName: string;
    fromVersion: string;
    toVersion: string;
}) {
    const { packageName, fromVersion, toVersion } = args;

    const empty = {
        description: "",
        homepage: "",
        repository: "",
        releaseNotes: "",
        changelogUrl: "",
        source: ""
    };

    try {
        // 1. NPM registry
        const npmRes = await fetch(`https://registry.npmjs.org/${packageName}`);

        if (!npmRes.ok) return empty;

        const npmData = await npmRes.json();

        const description = npmData.description || "";
        const homepage = npmData.homepage || "";
        const rawRepo = 
            typeof npmData.repository === "string"
                ? npmData.repository
                : npmData.repository?.url || "";
        
        // 2. GitHub releases
        const repoMatch = rawRepo.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/);

        let releaseNotes = "";
        let changelogUrl = "";
        let source = "";

        if (repoMatch) {
            const repoPath = repoMatch[1];
            const ghHeaders: Record<string, string> = {
                Accept: "application/vnd.github+json",
                "User-Agent" : "DepGuardAI",
                ...(process.env.GITHUB_TOKEN
                    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                    : {}),
            };

            // 2a. Exact tag for toVersion
            const tagVariants = [
                `v${toVersion}`,
                toVersion,
                `${packageName}@${toVersion}`,
                `${packageName}%40${toVersion}`,
            ];

            for (const tag of tagVariants) {
                try {
                    const res = await fetch(`https://api.github.com/repos/${repoPath}/releases/tags/${tag}`,
                        { headers: ghHeaders }
                    );
                    if (res.ok) {
                        const data = await res.json();
                        if (data.body) {
                            releaseNotes = data.body;
                            changelogUrl = data.html_url || "";
                            source = "GitHub Releases";
                            break;
                        }
                    }
                } catch {
                    continue;
                }
            }

            // 2b. Fallback: last 5 releases
            if (!releaseNotes) {
                try {
                    const res = await fetch(`https://api.github.com/repos/${repoPath}/releases?per_page=5`,
                        { headers: ghHeaders }
                    );
                    if (res.ok) {
                        const releases = await res.json();
                        if (Array.isArray(releases) && releases.length > 0) {
                            releaseNotes = releases
                                .map((r: any) => `### ${r.tag_name}\n${r.body || "No notes"}`)
                                .join("\n\n");
                            changelogUrl = releases[0]?.html_url || "";
                            source = "GitHub Releases (recent)";
                        }
                    }
                } catch { /* fall through to CHANGELOG.md */ }
            }

            // 3. CHANGELOG.md fallback
            if (!releaseNotes) {
                const changelogFilenames = [
                    "CHANGELOG.md",
                    "changelog.md",
                    "CHANGES.md",
                    "changes.md",
                    "HISTORY.md",
                    "history.md",
                    "RELEASES.md",
                ];

                for (const filename of changelogFilenames) {
                    try {
                        const rawUrl = `https://raw.githubusercontent.com/${repoPath}/HEAD/${filename}`;
                        const res = await fetch(rawUrl);
                        if (res.ok) {
                            const fullChangelog = await res.text();
                            changelogUrl = `https://github.com/${repoPath}/blob/HEAD/${filename}`;
                            source = `${filename} (GitHub)`;
                            releaseNotes = extractVersionSection(fullChangelog, fromVersion, toVersion);
                            break;
                        }
                    } catch {
                        continue;
                    }
                }
            }
        }

        return {
            description,
            homepage,
            repository: rawRepo,
            releaseNotes: releaseNotes || "No release notes found on GitHub.",
            changelogUrl,
            source,
        };
    } catch {
        return empty;
    }
}

function extractVersionSection(
    changelog: string,
    fromVersion: string,
    toVersion: string
): string {
    const lines = changelog.split("\n");
    const result: string[] = [];
    const versionHeadingRegex = /^#{1,4}\s+[\[(]?v?([\d]+\.[\d]+\.[\d]+[^\s\])]*)[\])]?/;

    let capturing = false;
    let foundToVersion = false;

    for (const line of lines) {
        const match = line.match(versionHeadingRegex);
        if (match) {
            const lineVersion = match[1].replace(/^v/, "");
            if (lineVersion === toVersion || isVersionInRange(lineVersion, fromVersion, toVersion)) {
                capturing = true;
                foundToVersion = true;
            } else if (capturing) {
                break;
            }
        }
        if (capturing) result.push(line);
    }

    if (!foundToVersion && changelog.length > 0) {
        return changelog.slice(0, 3000) + "\n\n[…truncated — see full changelog]";
    }
    return result.join("\n").trim();
}

function isVersionInRange(version: string, from: string, to: string): boolean {
    try {
        const parse = (v: string) => v.split(".").map(Number);
        const [vMaj, vMin, vPat] = parse(version);
        const [fMaj, fMin, fPat] = parse(from);
        const [tMaj, tMin, tPat] = parse(to);
        const n = (a: number, b: number, c: number) =>  a * 1e8 + b * 1e4 + c;
        return (
            n(vMaj, vMin, vPat) > n(fMaj, fMin, fPat) &&
            n(vMaj, vMin, vPat) <= n(tMaj, tMin, tPat)
        );
    } catch {
        return false;
    }
}