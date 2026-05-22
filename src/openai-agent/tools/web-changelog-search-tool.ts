import type OpenAI from "openai";

export const webChangelogSearchToolDefinition: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "web-changelog-search",
    description:
      "Searches the web for changelog, release notes, or migration guides for a package. " +
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
  const primarySourceHint = getPrimarySourceHint(packageName, toVersion);

  try {
    const provider = process.env.CHANGELOG_SEARCH_PROVIDER || "tavily";

    let searchResult: { results: { title: string; url: string; snippet: string }[]; query: string };

    if (provider === "brave" && process.env.BRAVE_SEARCH_API_KEY) {
      searchResult = await searchWithBrave(query);
    } else if (process.env.TAVILY_API_KEY) {
      searchResult = await searchWithTavily(query, packageName);
    } else {
      searchResult = await searchWithDuckDuckGo(query);
    }

    // Sort so official package sites come before GitHub, GitHub before aggregators
    const sorted = sortBySourcePriority(searchResult.results, packageName);

    return {
      ...searchResult,
      results: sorted,
      primarySourceHint,
    };
  } catch {
    return { results: [], query, primarySourceHint };
  }
}

// ─────────────────────────────────────────────
// QUERY BUILDER
// ─────────────────────────────────────────────

function buildQuery(pkg: string, from: string, to: string): string {
  // For packages with a known official blog/docs site, use site: filter
  // to maximise the chance of hitting the right changelog post
  const officialSite = getOfficialChangelogSite(pkg);

  if (officialSite) {
    if (to) return `site:${officialSite} ${pkg} ${to} release`;
    return `site:${officialSite} ${pkg} changelog release notes`;
  }

  if (from && to) return `${pkg} ${to} changelog release notes`;
  if (to) return `${pkg} ${to} changelog release notes`;
  return `${pkg} changelog release notes`;
}

/**
 * Returns the canonical changelog/blog domain for well-known packages.
 * Used to construct a targeted site: query and as a Tavily include_domain.
 */
function getOfficialChangelogSite(pkg: string): string | null {
  const map: Record<string, string> = {
    next: "nextjs.org/blog",
    react: "react.dev/blog",
    "react-dom": "react.dev/blog",
    tailwindcss: "tailwindcss.com/blog",
    typescript: "devblogs.microsoft.com/typescript",
    svelte: "svelte.dev/blog",
    "@sveltejs/kit": "kit.svelte.dev/docs",
    nuxt: "nuxt.com/blog",
    astro: "astro.build/blog",
    vite: "vitejs.dev/blog",
    vitest: "vitest.dev/blog",
    prisma: "prisma.io/blog",
    angular: "angular.dev/reference/releases",
    "@angular/core": "angular.dev/reference/releases",
  };

  for (const [key, domain] of Object.entries(map)) {
    if (pkg === key || pkg.startsWith(key + "/")) return domain;
  }
  return null;
}

/** Human-readable hint returned to the agent about where the authoritative source lives */
function getPrimarySourceHint(pkg: string, version: string): string {
  const site = getOfficialChangelogSite(pkg);
  if (site) {
    return `Primary source for ${pkg} is ${site}. Prefer results from this domain over GitHub releases.`;
  }
  return `Check GitHub releases and CHANGELOG.md for ${pkg} ${version}.`;
}

// ─────────────────────────────────────────────
// SOURCE PRIORITY SORT
// ─────────────────────────────────────────────

/**
 * Sorts search results so official package sites come before GitHub,
 * and GitHub before aggregators like npmjs.com.
 */
function sortBySourcePriority(
  results: { url: string; title: string; snippet: string }[],
  pkg: string
): { url: string; title: string; snippet: string }[] {
  const officialDomains = getKnownDomains(pkg).filter(
    (d) => !d.includes("github.com") && !d.includes("npmjs.com")
  );

  const priority = (url: string): number => {
    for (const domain of officialDomains) {
      if (url.includes(domain)) return 0; // official site first
    }
    if (url.includes("github.com")) return 1;
    if (url.includes("npmjs.com")) return 3;
    return 2;
  };

  return [...results].sort((a, b) => priority(a.url) - priority(b.url));
}

// ─────────────────────────────────────────────
// SEARCH PROVIDERS
// ─────────────────────────────────────────────

async function searchWithTavily(query: string, packageName: string) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      max_results: 7,
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
  url.searchParams.set("count", "7");

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

  // Fixed typo from original: "RematedTopics" → "RelatedTopics"
  for (const topic of data.RelatedTopics?.slice(0, 6) || []) {
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

// ─────────────────────────────────────────────
// DOMAIN LISTS
// ─────────────────────────────────────────────

function getKnownDomains(packageName: string): string[] {
  const domains: string[] = ["github.com", "npmjs.com"];

  const knownSites: Record<string, string[]> = {
    next: ["nextjs.org"],
    nuxt: ["nuxt.com"],
    svelte: ["svelte.dev"],
    "@sveltejs/kit": ["kit.svelte.dev"],
    astro: ["astro.build"],
    remix: ["remix.run"],
    "@angular": ["angular.dev", "angular.io"],
    react: ["react.dev", "reactjs.org"],
    "react-dom": ["react.dev"],
    "react-router": ["reactrouter.com"],
    "react-query": ["tanstack.com"],
    "@tanstack": ["tanstack.com"],
    vite: ["vitejs.dev"],
    webpack: ["webpack.js.org"],
    rollup: ["rollupjs.org"],
    esbuild: ["esbuild.github.io"],
    turbo: ["turbo.build"],
    vitest: ["vitest.dev"],
    jest: ["jestjs.io"],
    playwright: ["playwright.dev"],
    cypress: ["cypress.io"],
    tailwindcss: ["tailwindcss.com"],
    zustand: ["github.com/pmndrs/zustand"],
    redux: ["redux.js.org"],
    "@reduxjs": ["redux-toolkit.js.org"],
    typescript: ["devblogs.microsoft.com", "typescriptlang.org"],
    eslint: ["eslint.org"],
    prettier: ["prettier.io"],
    prisma: ["prisma.io"],
    "drizzle-orm": ["orm.drizzle.team"],
  };

  for (const [key, sites] of Object.entries(knownSites)) {
    if (packageName === key || packageName.startsWith(key + "/")) {
      domains.push(...sites);
    }
  }

  return [...new Set(domains)];
}