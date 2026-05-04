import type OpenAI from "openai";

export const webChangelogSearchToolDefinition: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
        name: "web-changelog-search",
        description: "Searches the web for changelog, release notes, or migration guides for a package. " +
        "Use this when fetch-npm-info did not return useful release notes, or when the package " +
        "hosts its changelog on its own website (e.g. Angular, React, Next.js, Svelte, etc.).",
        parameters: {
            type: "object",
            properties: {
                packageName: {
                    type: "string",
                    description: "The npm package name, e.g. '@angular/core' or 'svelte'",
                },
                fromVersion: {
                    type: "string",
                    description: "The version the user is upgrading from",
                },
                toVersion: {
                    type: "string",
                    description: "The version the user is upgrading to",
                },
            },
            required: ["packageName", "fromVersion", "toVersion"],
        },
    },
};

export async function executeWebChangelogSearch(args: {
    packageName: string;
    fromVersion: string;
    toVersion: string;
}) {
    const { packageName, fromVersion, toVersion } = args;
    const query = buildQuery(packageName, fromVersion, toVersion);

    try {
        const provider = process.env.CHANGELOG_SEARCH_PROVIDER || "tavily";

        if (provider === "brave" && process.env.BRAVE_SEARCH_API_KEY) {
            return await searchWithBrave(query);
        }
        if (process.env.TAVILY_API_KEY) {
            return await searchWithTavily(query, packageName);
        }
        return await searchWithDuckDuckGo(query);
    } catch {
        return { results: [], query };
    }
}

function buildQuery(pkg: string, from: string, to: string) {
    if (from && to) {
        return `${pkg} changelog ${from} to ${to} release notes migration`;
    }
    if (to) {
        return `${pkg} ${to} changelog release notes`;
    }
    return `${pkg} changelog release notes`;
}

async function searchWithTavily(query: string, packageName: string) {
    const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            search_depth: "advanced",
            max_results: 5,
            include_domains: getKnownDomains(packageName),
        }),
    });

    if (!res.ok) throw new Error(`Tavily error: ${res.status}`);
    const data = await res.json();

    return {
        query,
        results: (data.results || []).map((r: any) => ({
            title: r.title || "",
            url: r.url || "",
            snippet: r.content || r.snippet || "",
        })),
    };
}

async function searchWithBrave(query: string) {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "5");

    const res = await fetch(url.toString(), {
        headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
        },
    });

    if (!res.ok) throw new Error(`Brave error: ${res.status}`);
    const data = await res.json();

    return {
        query,
        results: (data.web?.results || []).map((r: any) => ({
            title: r.title || "",
            url: r.url || "",
            snippet: r.description || "",
        })),
    };
}

async function searchWithDuckDuckGo(query: string) {
    const url = new URL("https://api.duckduckgo.com/");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_redirect", "1");
    url.searchParams.set("t", "DepGuardAI");

    const res = await fetch(url.toString(), {
        headers: { "User-Agent": "DepGuardAI" },
    });

    if (!res.ok) throw new Error(`DDG error: ${res.status}`);
    const data = await res.json();

    const results: { title: string; url: string; snippet: string }[] = [];

    if (data.AbstractURL) {
        results.push({
            title: data.Heading || query,
            url: data.AbstractURL,
            snippet: data.AbstractText || "",
        });
    }

    for (const topic of data.RematedTopics?.slice(0, 4) || []) {
        if (topic.FirstURL) {
            results.push({
                title: topic.Text?.split(" - ")[0] || "",
                url: topic.FirstURL,
                snippet: topic.Text || "",
            });
        }
    }

    return { query, results };
}

function getKnownDomains(packageName: string): string[] {
    const domains: string[] = ["github.com", "npmjs.com"];

    const knownSites: Record<string, string[]> = {
        "next": ["nextjs.org"],
        "nuxt": ["nuxt.com"],
        "svelte": ["svelte.dev"],
        "sveltekit": ["kit.svelte.dev"],
        "astro": ["astro.build"],
        "remix": ["remix.run"],
        "@angular": ["angular.dev", "angular.io"],
        "react": ["react.dev", "reactjs.org"],
        "react-dom": ["react.dev"],
        "react-router": ["reactrouter.com"],
        "@tanstack": ["tanstack.com"],
        "vite": ["vitejs.dev"],
        "webpack": ["webpack.js.org"],
        "rollup": ["rollupjs.org"],
        "esbuild": ["esbuild.github.io"],
        "turbo": ["turbo.build"],
        "vitest": ["vitest.dev"],
        "jest": ["jestjs.io"],
        "playwright": ["playwright.dev"],
        "cypress": ["cypress.io"],
        "tailwindcss": ["tailwindcss.com"],
        "zustand": ["github.com/pmndrs/zustand"],
        "redux": ["redux.js.org"],
        "@reduxjs": ["redux-toolkit.js.org"],
        "typescript": ["typescriptlang.org"],
        "eslint": ["eslint.org"],
        "prettier": ["prettier.io"],
        "prisma": ["prisma.io"],
        "drizzle-orm": ["orm.drizzle.team"],
    };

    for (const [key, sites] of Object.entries(knownSites)) {
        if (packageName.startsWith(key)) {
            domains.push(...sites);
        }
    }

    return [...new Set(domains)];
}