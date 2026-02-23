import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const fetchNpmInfoTool = createTool({
    id: "fetch-npm-info",
    description: "Fetches package metadata from the npm registry including description, homepage and repository URL.",
    inputSchema: z.object({
        packageName: z.string().describe("The npm package name to look up"),
    }),
    outputSchema: z.object({
        description: z.string(),
        homepage: z.string(),
        repository: z.string(),
    }),
    execute: async ({ context }) => {
        const res = await fetch(
            `https://registry.npmjs.org/${context.packageName}`,
            { next: { revalidate: 3600 } } as RequestInit
        );

        if (!res.ok) {
            return { description: "", homepage: "", repository: "" };
        }

        const data = await res.json();

        return {
            description: data.description || "",
            homepage: data.homepage || "",
            repository:
                typeof data.repository === "string"
                    ? data.repository
                    : data.repository?.url || "",
        };
    },
});