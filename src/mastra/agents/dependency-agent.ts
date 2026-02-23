import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { fetchNpmInfoTool } from "../tools/npm-tool";

const MODEL = google("gemini-2.5-flash");
// const MODEL = openai("gpt-4o-mini");

export const dependencyAgent = new Agent({
    id: "DependencyAnalyzer",
    name: "Dependency Analyzer",
    instructions: `
        You are a dependency analysis assistant for software developers.
    
        When asked to analyze an npm package update, you do the following:
        1. Use the fetch-npm-info tool to retrieve current package info
        2. Analyze the update based on semantic versioning (major/minor/patch)
        3. Provide a concise but useful summary.
        
        Focus on: breaking changes, new features, deprecations, and security fixes.
        Keep your response under 200 words and use bullet points.
        Always respond in English (this is developer documentation).

        Translated with DeepL.com (free version)
    `,
    model: MODEL,
    tools: {
        fetchNpmInfoTool,
    },
});