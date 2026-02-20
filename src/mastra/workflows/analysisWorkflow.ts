import { Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import { fetchNpmPackageInfo } from "../tools/npmTools";
import { dependencyAnalyzer } from "../agents/dependencyAnalyzer";

export const analysisWorkflow = new Workflow({
  id: "dependency-analysis",
  description: "Analyzes npm package updates",
  inputSchema: z.object({
    dependencyId: z.string(),
    packageName: z.string(),
    currentVersion: z.string(),
    latestVersion: z.string(),
  }),
  outputSchema: z.object({
    analysis: z.string().optional(),
  }),
  steps: [
    // Stap 1: tool step
    {
      id: "fetch-npm-data",
      tool: fetchNpmPackageInfo,
      input: (ctx) => ({
        packageName: ctx.input.packageName,
        fromVersion: ctx.input.currentVersion,
        toVersion: ctx.input.latestVersion,
      }),
    },
    // Stap 2: agent step
    {
      id: "generate-analysis",
      agent: dependencyAnalyzer,
      input: async (ctx) => {
        const npmData = await ctx.getStepResult("fetch-npm-data");
        return {
          messages: [
            {
              role: "user",
              content: `Analyze the update for the npm package "${ctx.input.packageName}" 
                       from version ${ctx.input.currentVersion} to ${ctx.input.latestVersion}.
                       
                       ${npmData?.context ? `Context:\n${npmData.context}` : ""}
                       
                       Provide a comprehensive summary following your instructions.`,
            },
          ],
        };
      },
    },
  ],
});