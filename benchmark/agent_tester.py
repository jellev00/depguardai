"""
Dependency Analyzer - Agent Benchmarking Suite
"""

import asyncio
import json
import time
import statistics
import os
from dataclasses import dataclass
from typing import Optional
import aiohttp
import yaml
from datetime import datetime
from openai import AsyncOpenAI

from report_generator import generate_report

from dotenv import load_dotenv
load_dotenv()

# ─────────────────────────────────────────────
# DATA MODELS
# ─────────────────────────────────────────────

@dataclass
class TestCase:
    id: str
    package_name: str
    from_version: str
    to_version: str
    update_type: str
    notes: str = ""

@dataclass
class AgentResult:
    agent_name: str
    test_case: TestCase
    output: str
    latency_ms: float
    tokens_used: Optional[int] = None
    cost_estimate: Optional[float] = None
    error: Optional[str] = None
    run_index: int = 0

@dataclass
class EvaluationScore:
    agent_name: str
    test_id: str
    run_index: int
    specificity_score: float
    completeness_score: float
    actionability_score: float
    safety_verdict: str
    has_breaking_changes: bool
    has_migration_steps: bool
    overall_score: float
    judge_reasoning: str = ""

@dataclass
class BenchmarkConfig:
    agents: list
    test_cases: list
    runs_per_prompt: int = 3
    judge_model: str = "gpt-4o-mini"
    output_dir: str = "results"

# ─────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────

DEPENDENCY_SYSTEM_PROMPT = """
You are a dependency update analyst for software developers.
Your goal is to give developers CONCRETE, SPECIFIC information about package updates
so they do NOT have to read the full changelog themselves.

## Output Format

## [package-name] v[from] → v[to] ([major/minor/patch] update)

> 📎 Source: [tool source or URL]

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
[Yes / No / With caution — with a specific reason]

If a section has no changes, write "None in this release."
Keep the tone technical and direct.
"""

# ─────────────────────────────────────────────
# AGENT CALLERS
# ─────────────────────────────────────────────

async def call_mastra_agent(session, endpoint, tc):
    prompt_content = (
        f'Use the fetch-npm-info tool with packageName="{tc.package_name}", '
        f'fromVersion="{tc.from_version}", toVersion="{tc.to_version}". '
        f'Then analyze the update for "{tc.package_name}" from version "{tc.from_version}" '
        f'to {tc.to_version} based on the actual release notes you retrieved.'
    )
    payload = {"messages": [{"role": "user", "content": prompt_content}]}
    start = time.perf_counter()
    async with session.post(
        endpoint,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=aiohttp.ClientTimeout(total=120),
    ) as resp:
        if not resp.ok:
            raise RuntimeError(f"HTTP {resp.status}: {(await resp.text())[:200]}")
        data = await resp.json()
    latency_ms = (time.perf_counter() - start) * 1000
    return data.get("text", "") or str(data), latency_ms, None

async def call_n8n_agent(session, endpoint, tc):
    payload = {
        "packageName": tc.package_name,
        "fromVersion": tc.from_version,
        "toVersion": tc.to_version,
    }
    start = time.perf_counter()
    async with session.post(
        endpoint,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=aiohttp.ClientTimeout(total=120),
    ) as resp:
        if not resp.ok:
            raise RuntimeError(f"HTTP {resp.status}: {(await resp.text())[:200]}")
        data = await resp.json()
    latency_ms = (time.perf_counter() - start) * 1000
    return data.get("summary", "") or str(data), latency_ms, None

async def call_openai_agent(agent_cfg, tc):
    api_key = agent_cfg.get("api_key") or os.environ.get("OPENAI_API_KEY", "")
    client = AsyncOpenAI(api_key=api_key)
    user_message = (
        f"Analyze the npm package update for '{tc.package_name}' "
        f"from version {tc.from_version} to {tc.to_version}. "
        f"Provide concrete information about what changed, breaking changes, "
        f"migration steps, and whether it's safe to update."
    )
    start = time.perf_counter()
    response = await client.chat.completions.create(
        model = agent_cfg.get("model", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": DEPENDENCY_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )
    latency_ms = (time.perf_counter() - start) * 1000
    output = response.choices[0].message.content or ""
    tokens = response.usage.total_tokens if response.usage else None
    return output, latency_ms, tokens

async def call_agent(session, agent_cfg, tc):
    agent_type = agent_cfg["type"]
    if agent_type == "mastra":
        return await call_mastra_agent(session, agent_cfg["endpoint"], tc)
    elif agent_type == "n8n":
        return await call_n8n_agent(session, agent_cfg["endpoint"], tc)
    elif agent_type == "openai":
        return await call_openai_agent(agent_cfg, tc)
    else:
        raise ValueError(f"Onbekend agent type: {agent_type}")
    
# ─────────────────────────────────────────────
# LLM-AS-JUDGE
# ─────────────────────────────────────────────

JUDGE_PROMPT = """Je bent een expert software engineer die een AI-gegenereerde dependency update analyse beoordeelt.

## Package update
- Package: {package_name}
- Van versie: {from_version}
- Naar versie: {to_version}
- Type: {update_type} update

## Output van de AI agent
{output}

---

Beoordeel op de volgende criteria (schaal 0-10). Geef JE antwoord ALLEEN als JSON (geen andere tekst):

{{
  "specificity": <0-10, bevat de analyse concrete package-specifieke info of is het vaag/generiek?>,
  "completeness": <0-10, zijn de verwachte secties aanwezig: New Features, Breaking Changes, Migration Steps, Safe to update?>,
  "actionability": <0-10, kan een developer op basis hiervan beslissen of hij update zonder de changelog te lezen?>,
  "safety_verdict": "<kopieer de exacte Safe to update waarde: Yes / No / With caution / Not found>",
  "has_breaking_changes_section": <true/false>,
  "has_migration_steps_section": <true/false>,
  "reasoning": "<2-3 zinnen uitleg>"
}}"""

async def evaluate_output(client, tc, output, judge_model):
    prompt = JUDGE_PROMPT.format(
        package_name=tc.package_name,
        from_version=tc.from_version,
        to_version=tc.to_version,
        update_type=tc.update_type,
        output=output[:4000],
    )

    response = await client.chat.completions.create(
        model=judge_model,
        messages=[
            {"role": "system", "content": "You are a strict evaluator. Respond ONLY with valid JSON, no other text."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        response_format={"type": "json_object"}
    )

    text = response.choices[0].message.content.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    data = json.loads(text)
    specificity = float(data["specificity"])
    completeness = float(data["completeness"])
    actionability = float(data["actionability"])
    overall = (actionability * 0.45) + (specificity * 0.35) + (completeness * 0.2)
    return EvaluationScore(
        agent_name="",
        test_id=tc.id,
        run_index=0,
        specificity_score=specificity,
        completeness_score=completeness,
        actionability_score=actionability,
        safety_verdict=data.get("safety_verdict", "Not found"),
        has_breaking_changes=bool(data.get("has_breaking_changes_section", False)),
        has_migration_steps=bool(data.get("has_migration_steps_section", False)),
        overall_score=overall,
        judge_reasoning=data.get("reasoning", ""),
    )

# ─────────────────────────────────────────────
# BENCHMARK RUNNER
# ─────────────────────────────────────────────

async def run_benchmark(config):
    openai_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
    all_results, all_scores = [], []

    async with aiohttp.ClientSession() as session:
        for tc in config.test_cases:
            print(f"\n📦 [{tc.id}] {tc.package_name} {tc.from_version} → {tc.to_version} ({tc.update_type})")
            if tc.notes:
                print(f"   💬 {tc.notes}")

            for run_idx in range(config.runs_per_prompt):
                print(f"  Run {run_idx + 1}/{config.runs_per_prompt}")
                tasks = [call_agent(session, ag, tc) for ag in config.agents]
                outcomes = await asyncio.gather(*tasks, return_exceptions=True)

                for agent_cfg, outcome in zip(config.agents, outcomes):
                    agent_name = agent_cfg["name"]
                    if isinstance(outcome, Exception):
                        print(f"    ❌ {agent_name}: {outcome}")
                        all_results.append(AgentResult(
                            agent_name=agent_name, test_case=tc,
                            output="", latency_ms=0,
                            error=str(outcome), run_index=run_idx,
                        ))
                        continue

                    output, latency_ms, tokens = outcome
                    cost = estimate_cost(agent_cfg, tokens)
                    print(f"    ✅ {agent_name}: {latency_ms:.0f}ms | {tokens or '?'} tokens | {len(output)} chars")
                    all_results.append(AgentResult(
                        agent_name=agent_name, test_case=tc,
                        output=output, latency_ms=latency_ms,
                        tokens_used=tokens, cost_estimate=cost,
                        run_index=run_idx,
                    ))

                    try:
                        print(f"    🧑‍⚖️  Evaluating {agent_name}...")
                        score = await evaluate_output(openai_client, tc, output, config.judge_model)
                        score.agent_name = agent_name
                        score.run_index = run_idx
                        all_scores.append(score)
                        print(f"       Overall: {score.overall_score:.1f}/10 | Safe? {score.safety_verdict}")
                    except Exception as e:
                        print(f"    ⚠️  Judge error: {e}")

    return all_results, all_scores

def estimate_cost(agent_cfg, tokens):
    if not tokens:
        return None
    cpt = agent_cfg.get("cost_per_1k_tokens")
    return (tokens / 1000) * cpt if cpt else None


# ─────────────────────────────────────────────
# STATISTIEKEN
# ─────────────────────────────────────────────

def compute_statistics(results, scores):
    stats = {}
    for agent in {r.agent_name for r in results}:
        ok = [r for r in results if r.agent_name == agent and not r.error]
        ag_scores = [s for s in scores if s.agent_name == agent]
        latencies = [r.latency_ms for r in ok]
        overall_scores = [s.overall_score for s in ag_scores]

        consistency = 0.0
        if len(overall_scores) > 1:
            consistency = max(0.0, 10.0 - statistics.stdev(overall_scores) * 2)
        elif len(overall_scores) == 1:
            consistency = 10.0

        safety_counts = {}
        for s in ag_scores:
            safety_counts[s.safety_verdict] = safety_counts.get(s.safety_verdict, 0) + 1

        stats[agent] = {
            "total_calls": len(ok),
            "error_count": len([r for r in results if r.agent_name == agent and r.error]),
            "avg_latency_ms": statistics.mean(latencies) if latencies else 0,
            "p95_latency_ms": sorted(latencies)[max(0, int(len(latencies) * 0.95) - 1)] if latencies else 0,
            "min_latency_ms": min(latencies) if latencies else 0,
            "max_latency_ms": max(latencies) if latencies else 0,
            "avg_overall_score": statistics.mean(overall_scores) if overall_scores else 0,
            "avg_specificity": statistics.mean([s.specificity_score for s in ag_scores]) if ag_scores else 0,
            "avg_completeness": statistics.mean([s.completeness_score for s in ag_scores]) if ag_scores else 0,
            "avg_actionability": statistics.mean([s.actionability_score for s in ag_scores]) if ag_scores else 0,
            "consistency_score": consistency,
            "has_breaking_changes_pct": sum(1 for s in ag_scores if s.has_breaking_changes) / len(ag_scores) * 100 if ag_scores else 0,
            "has_migration_steps_pct": sum(1 for s in ag_scores if s.has_migration_steps) / len(ag_scores) * 100 if ag_scores else 0,
            "safety_verdict_counts": safety_counts,
            "total_tokens": sum(r.tokens_used for r in ok if r.tokens_used),
            "total_cost": sum(r.cost_estimate for r in ok if r.cost_estimate),
        }
    return stats

# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────

def load_config(path):
    with open(path) as f:
        raw = yaml.safe_load(f)
    test_cases = [
        TestCase(
            id=p["id"],
            package_name=p["package_name"],
            from_version=p["from_version"],
            to_version=p["to_version"],
            update_type=p.get("update_type", "unknown"),
            notes=p.get("notes", ""),
        )
        for p in raw["test_prompts"]
    ]
    return BenchmarkConfig(
        agents=raw["agents"],
        test_cases=test_cases,
        runs_per_prompt=raw.get("runs_per_prompt", 3),
        judge_model=raw.get("judge_model", "gpt-4o-mini"),
        output_dir=raw.get("output_dir", "results"),
    )

async def main():
    print("🚀 Dependency Analyzer — Benchmark Suite")
    print("=" * 50)
    config = load_config("config.yaml")
    os.makedirs(config.output_dir, exist_ok=True)

    start_time = datetime.now()
    results, scores = await run_benchmark(config)
    duration = (datetime.now() - start_time).total_seconds()

    print(f"\n📊 Statistieken berekenen...")
    stats = compute_statistics(results, scores)

    raw_data = {
        "benchmark_date": start_time.isoformat(),
        "duration_seconds": duration,
        "config": {"runs_per_prompt": config.runs_per_prompt, "judge_model": config.judge_model},
        "results": [
            {
                "agent": r.agent_name, "test_id": r.test_case.id,
                "package": r.test_case.package_name,
                "from_version": r.test_case.from_version,
                "to_version": r.test_case.to_version,
                "update_type": r.test_case.update_type,
                "output": r.output, "latency_ms": r.latency_ms,
                "tokens": r.tokens_used, "error": r.error, "run": r.run_index,
            }
            for r in results
        ],
        "scores": [
            {
                "agent": s.agent_name, "test_id": s.test_id, "run": s.run_index,
                "specificity": s.specificity_score, "completeness": s.completeness_score,
                "actionability": s.actionability_score, "overall": s.overall_score,
                "safety_verdict": s.safety_verdict,
                "has_breaking_changes": s.has_breaking_changes,
                "has_migration_steps": s.has_migration_steps,
                "reasoning": s.judge_reasoning,
            }
            for s in scores
        ],
        "statistics": stats,
    }

    ts = start_time.strftime("%Y%m%d_%H%M%S")
    json_path = os.path.join(config.output_dir, f"benchmark_{ts}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(raw_data, f, indent=2, ensure_ascii=False)
    print(f"📁 Raw data: {json_path}")

    html_path = os.path.join(config.output_dir, f"report_{ts}.html")
    generate_report(raw_data, stats, results, scores, html_path)
    print(f"📄 Rapport: {html_path}")

    print("\n" + "=" * 50)
    print("📈 SAMENVATTING")
    print("=" * 50)
    for agent, s in sorted(stats.items(), key=lambda x: -x[1]["avg_overall_score"]):
        print(f"\n🤖 {agent}")
        print(f"   Overall:          {s['avg_overall_score']:.1f}/10")
        print(f"   Specificiteit:    {s['avg_specificity']:.1f}/10")
        print(f"   Actionability:    {s['avg_actionability']:.1f}/10")
        print(f"   Consistentie:     {s['consistency_score']:.1f}/10")
        print(f"   Gem. latency:     {s['avg_latency_ms']:.0f}ms")
        print(f"   Breaking sections:{s['has_breaking_changes_pct']:.0f}%")
        print(f"   Migration sections:{s['has_migration_steps_pct']:.0f}%")
        if s["total_cost"]:
            print(f"   Kosten:           ${s['total_cost']:.4f}")

if __name__ == "__main__":
    asyncio.run(main())