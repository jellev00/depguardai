import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const fetchNpmPackageInfo = createTool({
    id: "fetch-npm-package-info",
    description: "Fetch package information from npm registry",
    inputSchema: z.object({
        packageName: z.string().describe("The name of the npm package"),
        fromVersion: z.string().describe("The current version"),
        toVersion: z.string().describe("The target version"),
    }),
    outputSchema: z.object({
        context: z.string().nullable(),
        packageData: z.any().optional(),
    }),
    execute: async ({ context }) => {
        const { packageName, fromVersion, toVersion } = context;

        try {
            const res = await fetch(`https://registry.npmjs.org/${packageName}`, {
                next: { revalidate: 3600 }
            });

            if (!res.ok) {
                return {
                    context: null,
                    packageData: null
                }
            }

            const data = await res.json();

            const description = data.description || "";
            const homepage = data.homepage || "";
            const repository = typeof data.repository === "string"
                ? data.repository
                : data.repository?.url || "";

            const contextString = `Package: ${packageName}\nDescription: ${description}\nHomepage: ${homepage}\nRepository: ${repository}\nUpdate from ${fromVersion} to ${toVersion}`;

            return {
                context: contextString,
                packageData: data
            };
        } catch (error) {
            console.error("Error fetching npm data:", error);
            return { context: null };
        }
    },
});
