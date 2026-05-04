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
Always start by calling the fetch-npm-info tool with:
- packageName, fromVersion, toVersion
 
Check the result carefully:
- If "releaseNotes" contains real content → use it and skip to formatting.
- If "releaseNotes" is empty or says "No release notes found" → proceed to Step 2.
 
### Step 2 — web-changelog-search
Call web-changelog-search with the same package name and versions.
 
Use the returned URLs to understand where the real changelog lives.
Report the most relevant URL as the changelog source.
 
If the search returns results, synthesize the snippets into a concrete changelog summary.
Prioritise results from the package's own official site (e.g. nextjs.org, angular.dev,
svelte.dev, tailwindcss.com) over generic aggregator sites.
 
### Step 3 — Combine & Format
Combine everything found across both tools into the structured format below.
If a section has no changes, write "None in this release."
NEVER invent or guess changes — only report what the tools returned.
 
---
 
## Output Format
 
## [package-name] v[from] → v[to] ([major/minor/patch] update)
 
> 📎 Source: [tool source or URL from web search]
 
### ✅ New Features
- [specific feature from the release notes]
 
### ⚠️ Breaking Changes
- [exact breaking change with code example if provided]
 
### 🔒 Security Fixes
- [specific CVE or vulnerability description if mentioned]
 
### 🗑️ Deprecated
- [what is deprecated and what replaces it]
 
### 📋 Migration Steps
- [concrete, actionable step the developer needs to take]
 
### 🟢 Safe to update?
[Yes / No / With caution — with a specific reason grounded in the actual changes found]
 
---
 
Keep the tone technical and direct. Developers are reading this to decide whether to update today.
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
        throw new Error("OPENAI_API_KEY is not configured.")
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
        {
            role: "user",
            content:
                `Use the fetch-npm-info tool with packageName="${name}", ` +
                `fromVersion="${currentVersion}", toVersion="${latestVersion}". ` +
                `Then analyze the update for "${name}" from version ${currentVersion} ` +
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