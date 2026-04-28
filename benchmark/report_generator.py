"""
Report Generator — Dependency Analyzer Benchmark
"""
import json
import html


def js_escape(value: str) -> str:
    """Escape content for safe embedding inside JS template literals."""
    return (
        html.escape(value or "")
        .replace("\\", "\\\\")
        .replace("`", "\\`")
        .replace("${", "\\${")
        .replace("</", "<\\/")
    )


def generate_report(raw_data, stats, results, scores, output_path):
    agents = list(stats.keys())

    colors = {
        agents[i]: c
        for i, c in enumerate([
            "#818cf8",
            "#fb923c",
            "#34d399",
            "#f472b6",
            "#a78bfa"
        ])
        if i < len(agents)
    }

    test_ids = list({r["test_id"] for r in raw_data.get("results", [])})

    per_test_scores = {}
    for tid in test_ids:
        per_test_scores[tid] = {}
        for agent in agents:
            ag_scores = [
                s for s in raw_data.get("scores", [])
                if s["agent"] == agent and s["test_id"] == tid
            ]
            per_test_scores[tid][agent] = (
                sum(s["overall"] for s in ag_scores) / len(ag_scores)
                if ag_scores else 0
            )

    stats_json = json.dumps(stats)
    colors_json = json.dumps(colors)
    agents_json = json.dumps(agents)
    per_test_json = json.dumps(per_test_scores)
    test_ids_json = json.dumps(test_ids)

    detail_rows = ""

    for i, r in enumerate(raw_data.get("results", [])):
        score_entry = next(
            (
                s for s in raw_data.get("scores", [])
                if s["agent"] == r["agent"]
                and s["test_id"] == r["test_id"]
                and s["run"] == r["run"]
            ),
            None
        )

        color = colors.get(r["agent"], "#888")
        status = "❌ Error" if r.get("error") else "✅"

        overall = f"{score_entry['overall']:.1f}" if score_entry else "—"
        spec = f"{score_entry['specificity']:.1f}" if score_entry else "—"
        action = f"{score_entry['actionability']:.1f}" if score_entry else "—"

        safety = score_entry["safety_verdict"] if score_entry else "—"

        safety_colors = {
            "Yes": "#34d399",
            "With caution": "#fb923c",
            "No": "#f87171",
            "Not found": "#6b6b8a"
        }

        safety_color = safety_colors.get(safety, "#6b6b8a")

        breaking = "✓" if score_entry and score_entry.get("has_breaking_changes") else "—"
        migration = "✓" if score_entry and score_entry.get("has_migration_steps") else "—"

        output_escaped = js_escape(r.get("output", ""))
        reasoning_escaped = js_escape(
            score_entry.get("reasoning", "") if score_entry else ""
        )
        error_escaped = js_escape(r.get("error", ""))

        detail_rows += f"""
        <tr data-agent="{r['agent']}" onclick="openModal({i})" style="cursor:pointer">
            <td><span class="badge" style="background:{color}20;color:{color};border:1px solid {color}40">{r['agent']}</span></td>
            <td><code>{r['test_id']}</code></td>
            <td><span class="pkg">{r['package']}</span> <span class="version">{r['from_version']} → {r['to_version']}</span></td>
            <td><span class="update-type {r.get('update_type','')}">{r.get('update_type','')}</span></td>
            <td>Run {r['run'] + 1}</td>
            <td class="num latency">{r['latency_ms']:.0f}ms</td>
            <td class="num score">{overall}</td>
            <td class="num">{spec}</td>
            <td class="num">{action}</td>
            <td><span style="color:{safety_color};font-weight:600">{safety}</span></td>
            <td>{status}</td>
        </tr>

        <script>
        window.__modalData = window.__modalData || [];
        window.__modalData[{i}] = {{
            agent: `{r['agent']}`,
            test_id: `{r['test_id']}`,
            package: `{r['package']}`,
            from_version: `{r['from_version']}`,
            to_version: `{r['to_version']}`,
            latency: `{r['latency_ms']:.0f}ms`,
            overall: `{overall}`,
            safety: `{safety}`,
            reasoning: `{reasoning_escaped}`,
            output: `{output_escaped}`,
            error: `{error_escaped}`,
        }};
        </script>
        """

    benchmark_date = raw_data.get("benchmark_date", "")[:19].replace("T", " ")
    duration = raw_data.get("duration_seconds", 0)

    html_doc = f"""
<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Benchmark Resultaten</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {{
      --bg: #f8fafc;
      --surface: #ffffff;
      --surface-soft: #f1f5f9;
      --text: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --accent: #5b6cff;
      --accent-2: #14b8a6;
      --good: #16a34a;
      --warn: #d97706;
      --bad: #dc2626;
      --shadow: 0 18px 50px rgba(15, 23, 42, .08);
      --radius: 22px;
    }}

    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Geist, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(91,108,255,.12), transparent 32rem),
        radial-gradient(circle at top right, rgba(20,184,166,.10), transparent 28rem),
        var(--bg);
      color: var(--text);
      line-height: 1.5;
    }}

    .page {{ width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0 56px; }}
    .hero {{ display: grid; grid-template-columns: 1.2fr .8fr; gap: 24px; align-items: stretch; margin-bottom: 22px; }}
    .panel {{ background: rgba(255,255,255,.86); border: 1px solid rgba(226,232,240,.9); border-radius: var(--radius); box-shadow: var(--shadow); backdrop-filter: blur(14px); }}
    .intro {{ padding: 34px; }}
    .eyebrow {{ margin: 0 0 12px; color: var(--accent); font-weight: 700; letter-spacing: .04em; text-transform: uppercase; font-size: 12px; }}
    h1 {{ margin: 0; font-size: clamp(34px, 5vw, 64px); line-height: .96; letter-spacing: -0.04em; }}
    .subtitle {{ max-width: 680px; margin: 18px 0 0; color: var(--muted); font-size: 17px; }}

    .winner {{ padding: 28px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; }}
    .winner:before {{ content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(91,108,255,.12), rgba(20,184,166,.10)); pointer-events: none; }}
    .winner > * {{ position: relative; }}
    .winner-label {{ color: var(--muted); font-weight: 600; }}
    .winner-name {{ margin: 8px 0 0; font-size: 34px; line-height: 1; font-weight: 800; letter-spacing: -0.03em; }}
    .winner-score {{ margin-top: 24px; display: inline-flex; width: fit-content; align-items: baseline; gap: 8px; padding: 12px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; font-weight: 800; }}
    .winner-score strong {{ font-size: 28px; }}

    .kpis {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 22px 0; }}
    .kpi {{ padding: 18px; }}
    .kpi span {{ color: var(--muted); font-size: 13px; font-weight: 600; }}
    .kpi strong {{ display: block; margin-top: 6px; font-size: 24px; letter-spacing: -0.03em; }}

    .section-head {{ display: flex; align-items: end; justify-content: space-between; gap: 16px; margin: 34px 0 14px; }}
    h2 {{ margin: 0; font-size: 24px; letter-spacing: -0.03em; }}
    .section-head p {{ margin: 4px 0 0; color: var(--muted); }}
    .search {{ width: min(320px, 100%); padding: 12px 14px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); color: var(--text); outline: none; font: inherit; }}
    .search:focus {{ border-color: var(--accent); box-shadow: 0 0 0 4px rgba(91,108,255,.12); }}

    .agents {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }}
    .agent {{ padding: 20px; }}
    .agent-top {{ display: flex; align-items: center; justify-content: space-between; gap: 12px; }}
    .agent-name {{ font-weight: 800; font-size: 18px; }}
    .rank {{ width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: var(--surface-soft); color: var(--muted); font-weight: 800; }}
    .metric-row {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }}
    .metric {{ padding: 12px; border-radius: 16px; background: var(--surface-soft); }}
    .metric span {{ display:block; color: var(--muted); font-size: 12px; font-weight: 600; }}
    .metric strong {{ display:block; margin-top: 2px; font-size: 16px; }}
    .bar {{ height: 9px; background: var(--surface-soft); border-radius: 999px; overflow: hidden; margin-top: 18px; }}
    .fill {{ height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }}

    .table-wrap {{ overflow: hidden; }}
    table {{ width: 100%; border-collapse: collapse; background: var(--surface); }}
    th, td {{ padding: 15px 16px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }}
    th {{ background: #f8fafc; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }}
    tr:hover td {{ background: #fbfdff; }}
    .badge {{ display: inline-flex; align-items: center; padding: 5px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--surface-soft); color: var(--muted); }}
    .badge.major {{ background: #fee2e2; color: var(--bad); }}
    .badge.minor {{ background: #fef3c7; color: var(--warn); }}
    .badge.patch {{ background: #dcfce7; color: var(--good); }}

    .footer {{ margin-top: 26px; color: var(--muted); font-size: 13px; text-align: center; }}

    @media (max-width: 900px) {{
      .hero, .agents {{ grid-template-columns: 1fr; }}
      .kpis {{ grid-template-columns: repeat(2, 1fr); }}
      .section-head {{ align-items: stretch; flex-direction: column; }}
      .search {{ width: 100%; }}
    }}
    @media (max-width: 560px) {{
      .page {{ width: min(100% - 20px, 1180px); padding-top: 18px; }}
      .intro, .winner {{ padding: 22px; }}
      .kpis {{ grid-template-columns: 1fr; }}
      th, td {{ padding: 12px 10px; font-size: 13px; }}
      .table-wrap {{ overflow-x: auto; }}
      table {{ min-width: 760px; }}
    }}
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="panel intro">
        <p class="eyebrow">Benchmark dashboard</p>
        <h1>Resultaten per agent</h1>
        <p class="subtitle">Overzicht van prestaties, kosten, tokens en responstijden voor benchmarkdatum {benchmark_date}.</p>
      </div>
      <aside class="panel winner">
        <div>
          <div class="winner-label">Beste resultaat</div>
          <div class="winner-name" id="winnerName">—</div>
        </div>
        <div class="winner-score"><strong id="winnerScore">—</strong><span>score</span></div>
      </aside>
    </section>

    <section class="kpis" id="kpis"></section>

    <div class="section-head">
      <div>
        <h2>Agent prestaties</h2>
        <p>Gerangschikt op totale score.</p>
      </div>
    </div>
    <section class="agents" id="agentCards"></section>

    <div class="section-head">
      <div>
        <h2>Detailresultaten</h2>
        <p>Filter snel op agent, testnaam of update type.</p>
      </div>
      <input class="search" id="filterInput" type="search" placeholder="Zoeken…" />
    </div>

    <section class="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Test_ID</th>
            <th>Update</th>
            <th>Update_Type</th>
            <th>Run</th>
            <th>Latency</th>
            <th>Score</th>
            <th>Spec</th>
            <th>Action</th>
            <th>Safety</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="resultRows">
          {detail_rows}
        </tbody>
      </table>
    </section>

    <p class="footer">Gegenereerd op {benchmark_date}</p>
  </main>

  <script>
    const stats = {stats_json};
    const colors = {colors_json};
    const perTest = {per_test_json};

    const fmtNumber = (value) => new Intl.NumberFormat('nl-NL').format(Number(value || 0));
    const fmtMoney = (value) => new Intl.NumberFormat('nl-NL', {{ style: 'currency', currency: 'USD', maximumFractionDigits: 4 }}).format(Number(value || 0));
    const fmtMs = (value) => `${{Math.round(Number(value || 0))}} ms`;

    const entries = Object.entries(stats || {{}}).map(([name, data]) => ({{ name, ...(data || {{}}) }}));
    const ranked = entries.sort((a, b) => Number(b.avg_overall_score || 0) - Number(a.avg_overall_score || 0));
    const winner = ranked[0];

    if (winner) {{
      document.getElementById('winnerName').textContent = winner.name;
      document.getElementById('winnerScore').textContent = Number(winner.avg_overall_score || 0).toFixed(1);
    }}

    const totals = ranked.reduce((acc, item) => {{
      acc.calls += Number(item.calls || item.total_calls || 0);
      acc.cost += Number(item.cost || item.total_cost || 0);
      acc.tokens += Number(item.tokens || item.total_tokens || 0);
      acc.latency += Number(item.latency_ms || item.avg_latency_ms || 0);
      return acc;
    }}, {{ calls: 0, cost: 0, tokens: 0, latency: 0 }});

    document.getElementById('kpis').innerHTML = [
      ['Agents', ranked.length],
      ['Calls', fmtNumber(totals.calls)],
      ['Kosten', fmtMoney(totals.cost * 3)],
      ['Tokens', fmtNumber(totals.tokens * 3)]
    ].map(([label, value]) => `<article class="panel kpi"><span>${{label}}</span><strong>${{value}}</strong></article>`).join('');

    const maxScore = Math.max(...ranked.map(agent => Number(agent.avg_overall_score || 0)), 1);
    document.getElementById('agentCards').innerHTML = ranked.map((agent, index) => {{
      const score = Number(agent.avg_overall_score || 0);
      const percent = Math.max(4, Math.min(100, (score / maxScore) * 100));
      return `<article class="panel agent">
        <div class="agent-top"><div class="agent-name">${{agent.name}}</div><div class="rank">${{index + 1}}</div></div>
        <div class="bar"><div class="fill" style="width:${{percent}}%"></div></div>
        <div class="metric-row">
          <div class="metric"><span>Score</span><strong>${{score.toFixed(1)}}</strong></div>
          <div class="metric"><span>Latency</span><strong>${{fmtMs(agent.latency_ms || agent.avg_latency_ms)}}</strong></div>
          <div class="metric"><span>Kosten</span><strong>${{fmtMoney(agent.cost || agent.total_cost)}}</strong></div>
          <div class="metric"><span>Tokens</span><strong>${{fmtNumber(agent.tokens || agent.total_tokens)}}</strong></div>
        </div>
      </article>`;
    }}).join('');

    document.querySelectorAll('#resultRows tr').forEach(row => {{
      const updateCell = row.children[2];
      if (!updateCell) return;
      const text = updateCell.textContent.trim().toLowerCase();
      if (text) updateCell.innerHTML = `<span class="badge ${{text}}">${{updateCell.textContent.trim()}}</span>`;
    }});

    document.getElementById('filterInput').addEventListener('input', (event) => {{
      const query = event.target.value.toLowerCase().trim();
      document.querySelectorAll('#resultRows tr').forEach(row => {{
        row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
      }});
    }});
  </script>
</body>
</html>

"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_doc)

    return output_path