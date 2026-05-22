import OpenAI from "openai";
import {
  fetchNpmInfoToolDefinition,
  executeFetchNpmInfo,
} from "../tools/npm-tool";
import {
  webChangelogSearchToolDefinition,
  executeWebChangelogSearch,
} from "../tools/web-changelog-search-tool";

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  fetchNpmInfoToolDefinition,
  webChangelogSearchToolDefinition,
];

const SYSTEM_PROMPT = `
You are a dependency update analyst for software developers.
Your goal is to give developers CONCRETE, SPECIFIC information about package updates
so they do NOT have to read the full changelog themselves.

## Research Strategy (follow IN ORDER)

### Step 1 — fetch-npm-info
Always start by calling fetch-npm-info with packageName, fromVersion, toVersion.

Evaluate the result critically:
- If "releaseNotes" contains real changelog content → use it as the primary source.
- If "releaseNotes" is empty, says "No release notes found", or contains ONLY
  ecosystem/README/doc changes (e.g. added links, updated badges) → treat it as
  empty and proceed to Step 2.
- Check the returned "hasSubstantiveNotes" field: if false, always proceed to Step 2.

### Step 2 — web-changelog-search
Always call web-changelog-search, even when Step 1 returned something.
Use it to find the OFFICIAL changelog source for this package version.

Priority order for sources:
1. The package's own website (nextjs.org/blog, react.dev, tailwindcss.com/blog,
   typescriptlang.org/docs, svelte.dev, angular.dev, etc.)
2. The package's own GitHub CHANGELOG.md or RELEASES.md
3. GitHub Releases page
4. npmjs.com or other aggregators (lowest trust — avoid as primary source)

When official site snippets are available, prefer those over GitHub release bodies.
GitHub release bodies for large projects (React, Next.js, TypeScript) are often
incomplete summaries — the official blog/docs contain the authoritative list.

Check the returned "primarySourceHint" field and use it to guide which result to trust most.

### Step 3 — Reason about patch releases carefully
For PATCH updates (x.y.Z): these almost never contain new features or breaking changes.
If the changelog source contains only:
- Ecosystem/documentation updates (README links, badge changes, ecosystem lists)
- JSDoc annotations or internal build changes
→ Do NOT report these as "New Features" or "Deprecated". Write "None in this release."
→ Acknowledge that patch changelogs are often minimal and not always published.

### Step 4 — Combine & Format
Combine everything found. Apply the ACCURACY RULES below before writing output.

---

## ACCURACY RULES — read carefully before writing each section

### Only report what was explicitly found in the sources
NEVER invent, infer, or guess changes. If a feature is not mentioned in the
retrieved content, it does not go in the output.

### "New Features" discipline
Only list items explicitly described as new functionality for end users.
Internal implementation details, ecosystem additions, and README updates are NOT
new features. If the release is a deprecation-warning-only release (like React 18.3),
write "None in this release — this release adds deprecation warnings only."

### "Breaking Changes" discipline
Only list changes that BREAK existing code without modification.
Deprecation warnings do NOT break code — they are warnings, not errors.
Do not list items as breaking changes unless the source explicitly says they are.

### "Deprecated" discipline
List what is deprecated AND what replaces it (e.g. "ReactDOM.render → use
ReactDOM.createRoot"). If the source lists specific deprecated APIs, name them all.

### "Safe to update?" discipline
- Patch updates: "Yes" unless there is an explicit breaking change in the notes.
- Minor updates: "Yes" unless there is an explicit breaking change.
- Major updates: "With caution" if there are breaking changes; "Yes" if none found.
Use ONLY: Yes / No / With caution — followed by a single specific reason.

### Epistemic honesty
If the changelog for a patch release is not publicly detailed (common for packages
like zod, lodash, etc.), say so explicitly:
"No detailed release notes are publicly available for this patch. Patch releases
in the x.y.x line are generally safe to apply."

---

## Output Format

## [package-name] v[from] → v[to] ([major/minor/patch] update)

> 📎 Source: [URL of the most authoritative source used]

### ✅ New Features
- [specific user-facing feature from the release notes, with concrete detail]

### ⚠️ Breaking Changes
- [exact breaking change — only if explicitly stated as breaking in the source]

### 🔒 Security Fixes
- [specific CVE or vulnerability description if mentioned]

### 🗑️ Deprecated
- [API that is deprecated] — replace with [replacement API]

### 📋 Migration Steps
- [one concrete actionable step per bullet; only steps that are actually needed]

### 🟢 Safe to update?
[Yes / No / With caution] — [one specific reason based on actual findings]

If a section has no changes, write "None in this release."
Keep the tone technical and direct.
`.trim();

export interface AnalyzeOptions {
  name: string;
  currentVersion: string;
  latestVersion: string;
}

export async function analyzeDependency({
  name,
  currentVersion,
  latestVersion,
}: AnalyzeOptions): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `Use the fetch-npm-info tool with packageName="${name}", ` +
        `fromVersion="${currentVersion}", toVersion="${latestVersion}". ` +
        `Then always also call web-changelog-search for the same package and versions. ` +
        `Finally, analyze the update for "${name}" from version ${currentVersion} ` +
        `to ${latestVersion} based on the actual release notes you retrieved.`,
    },
  ];

  // Agentic loop - max 10 turns to prevent runaway calls
  for (let turn = 0; turn < 10; turn++) {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // Add assistant turn to history
    messages.push(assistantMessage);

    // Model is done - return the final text
    if (choice.finish_reason === "stop" || !assistantMessage.tool_calls?.length) {
      if (!assistantMessage.content) {
        throw new Error("OpenAI agent returned an empty response.");
      }
      return assistantMessage.content;
    }

    // Execute each requested tool call and feed results back
    for (const toolCall of assistantMessage.tool_calls) {
      const fnName = toolCall.function.name;
      const fnArgs = JSON.parse(toolCall.function.arguments);

      let result: unknown;

      if (fnName === "fetch-npm-info") {
        result = await executeFetchNpmInfo(fnArgs);
      } else if (fnName === "web-changelog-search") {
        result = await executeWebChangelogSearch(fnArgs);
      } else {
        result = { error: `Unknown tool: ${fnName}` };
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("OpenAI agent exceeded maximum tool-call turns.");
}

export function isOpenAIAgentAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}