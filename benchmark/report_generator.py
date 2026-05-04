"""
Report Generator — Dependency Analyzer Benchmark
"""
import json
import html


def js_escape(value: str) -> str:
    """Escape content for safe embedding inside JS template literals."""
    if value is None:
        return ""
    return (
        html.escape(str(value))
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

    # Bouw een lookup voor expected_facts per test_id
    expected_facts_map = {}
    for r in raw_data.get("results", []):
        tid = r["test_id"]
        if tid not in expected_facts_map:
            # Zoek de expected_facts uit de test case (via raw_data of via scores/results)
            # We halen het uit de results (de test_case is niet direct opgeslagen, maar we kunnen het uit de prompt halen)
            # In de raw_data zit de test case info in de results
            expected_facts_map[tid] = r.get("expected_facts", [])
    
    # Alternatief: als expected_facts niet in results zit, proberen we het uit de scores te halen
    # Maar we moeten het ergens vandaan halen. Laten we een fallback toevoegen.
    # We vullen het aan met data uit de test_cases uit raw_data als die er is
    if "test_cases" in raw_data:
        for tc in raw_data["test_cases"]:
            expected_facts_map[tc["id"]] = tc.get("expected_facts", [])

    stats_json = json.dumps(stats)
    colors_json = json.dumps(colors)
    agents_json = json.dumps(agents)
    per_test_json = json.dumps(per_test_scores)
    test_ids_json = json.dumps(test_ids)
    expected_facts_json = json.dumps(expected_facts_map)

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
        
        # Extra data voor de modal
        prompt_escaped = js_escape(r.get("prompt", ""))
        expected_facts_list = expected_facts_map.get(r["test_id"], [])
        expected_facts_escaped = js_escape("\n".join([f"- {fact}" for fact in expected_facts_list]) if expected_facts_list else "Geen verwachte feiten opgegeven.")
        
        # Haal de update details op
        package_name = r.get("package", "")
        from_version = r.get("from_version", "")
        to_version = r.get("to_version", "")
        update_type = r.get("update_type", "unknown")
        
        # Haal de scores op als getallen voor de modal
        specificity_score = score_entry['specificity'] if score_entry else 0
        completeness_score = score_entry['completeness'] if score_entry else 0
        actionability_score = score_entry['actionability'] if score_entry else 0
        fact_coverage_score = score_entry.get('fact_coverage', 0) if score_entry else 0
        fabricated_details = score_entry.get('fabricated_details', False) if score_entry else False
        has_breaking_changes = score_entry.get('has_breaking_changes', False) if score_entry else False
        has_migration_steps = score_entry.get('has_migration_steps', False) if score_entry else False

        changelog_source = r.get("changelog_source", "")
        changelog_source_escaped = js_escape(changelog_source)

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
            package: `{package_name}`,
            from_version: `{from_version}`,
            to_version: `{to_version}`,
            update_type: `{update_type}`,
            run: `{r['run'] + 1}`,
            latency: `{r['latency_ms']:.0f}ms`,
            tokens: `{r.get('tokens', '?')}`,
            overall: `{overall}`,
            specificity: `{specificity_score:.1f}`,
            completeness: `{completeness_score:.1f}`,
            actionability: `{actionability_score:.1f}`,
            fact_coverage: `{fact_coverage_score:.1f}`,
            safety: `{safety}`,
            has_breaking_changes: `{has_breaking_changes}`,
            has_migration_steps: `{has_migration_steps}`,
            fabricated_details: `{fabricated_details}`,
            reasoning: `{reasoning_escaped}`,
            output: `{output_escaped}`,
            error: `{error_escaped}`,
            expected_facts: `{expected_facts_escaped}`,
            changelog_source: `{changelog_source_escaped}`,
            prompt: `Analyseer de npm package update voor '{package_name}' van versie {from_version} naar {to_version}. Geef concrete informatie over wat er veranderd is, breaking changes, migratiestappen en of het veilig is om te updaten.`
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

    /* Modal styles */
    .modal {{
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      overflow: auto;
    }}
    .modal-content {{
      background-color: var(--surface);
      margin: 2% auto;
      width: 90%;
      max-width: 1000px;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      animation: modalFadeIn 0.2s ease-out;
      max-height: 90vh;
      overflow-y: auto;
    }}
    @keyframes modalFadeIn {{
      from {{ opacity: 0; transform: translateY(-20px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}
    .modal-header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(135deg, rgba(91,108,255,.05), rgba(20,184,166,.05));
      border-radius: var(--radius) var(--radius) 0 0;
    }}
    .modal-header h3 {{
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }}
    .close {{
      font-size: 28px;
      font-weight: 400;
      color: var(--muted);
      cursor: pointer;
      transition: color 0.2s;
      line-height: 1;
    }}
    .close:hover {{
      color: var(--text);
    }}
    .modal-body {{
      padding: 24px;
    }}
    .detail-section {{
      margin-bottom: 28px;
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
    }}
    .detail-section h4 {{
      margin: 0;
      padding: 14px 20px;
      background: var(--surface-soft);
      font-size: 15px;
      font-weight: 700;
      border-bottom: 1px solid var(--line);
    }}
    .detail-section .content {{
      padding: 16px 20px;
      font-size: 14px;
      line-height: 1.6;
      background: var(--surface);
    }}
    .detail-section pre {{
      background: #1e1e2e;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 12px;
      overflow-x: auto;
      font-size: 13px;
      font-family: 'Monaco', 'Menlo', monospace;
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }}
    .score-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }}
    .score-card {{
      background: var(--surface-soft);
      padding: 12px;
      border-radius: 14px;
      text-align: center;
    }}
    .score-card .label {{
      font-size: 12px;
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .score-card .value {{
      font-size: 28px;
      font-weight: 800;
      color: var(--accent);
    }}
    .score-card .value.warning {{ color: var(--warn); }}
    .score-card .value.bad {{ color: var(--bad); }}
    .score-card .value.good {{ color: var(--good); }}
    .badge-status {{
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }}
    .badge-status.true {{ background: #dcfce7; color: var(--good); }}
    .badge-status.false {{ background: #fee2e2; color: var(--bad); }}
    .badge-status.caution {{ background: #fef3c7; color: var(--warn); }}
    .facts-list {{
      margin: 0;
      padding-left: 20px;
    }}
    .facts-list li {{
      margin-bottom: 6px;
    }}
    .update-badge {{
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }}
    .update-badge.major {{ background: #fee2e2; color: var(--bad); }}
    .update-badge.minor {{ background: #fef3c7; color: var(--warn); }}
    .update-badge.patch {{ background: #dcfce7; color: var(--good); }}

    .detail-section a {{
      color: var(--accent);
      text-decoration: none;
      word-break: break-all;
    }}
    .detail-section a:hover {{
        text-decoration: underline;
    }}

    @media (max-width: 900px) {{
      .hero, .agents {{ grid-template-columns: 1fr; }}
      .kpis {{ grid-template-columns: repeat(2, 1fr); }}
      .section-head {{ align-items: stretch; flex-direction: column; }}
      .search {{ width: 100%; }}
      .score-grid {{ grid-template-columns: repeat(2, 1fr); }}
    }}
    @media (max-width: 560px) {{
      .page {{ width: min(100% - 20px, 1180px); padding-top: 18px; }}
      .intro, .winner {{ padding: 22px; }}
      .kpis {{ grid-template-columns: 1fr; }}
      th, td {{ padding: 12px 10px; font-size: 13px; }}
      .table-wrap {{ overflow-x: auto; }}
      table {{ min-width: 760px; }}
      .modal-body {{ padding: 16px; }}
      .score-grid {{ grid-template-columns: 1fr; }}
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
        <p>Klik op een rij voor alle details (prompt, output, verwachte feiten, evaluatie).</p>
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

  <!-- Modal -->
  <div id="detailModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modalTitle">Detail weergave</h3>
        <span class="close" onclick="closeModal()">&times;</span>
      </div>
      <div class="modal-body" id="modalBody">
        <!-- Dynamisch gevuld -->
      </div>
    </div>
  </div>

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

    // Modal functies
    function openModal(index) {{
      const data = window.__modalData[index];
      if (!data) return;
      
      const modal = document.getElementById('detailModal');
      const modalBody = document.getElementById('modalBody');
      
      const getBadgeClass = (value, trueClass='true', falseClass='false') => {{
        if (value === 'true' || value === true) return trueClass;
        return falseClass;
      }};
      
      const getScoreClass = (score) => {{
        const num = parseFloat(score);
        if (num >= 8) return 'good';
        if (num >= 6) return '';
        return 'bad';
      }};
      
      const updateTypeClass = data.update_type.toLowerCase();
      
      modalBody.innerHTML = `
        <div class="detail-section">
          <h4>📋 Update informatie</h4>
          <div class="content">
            <strong>Package:</strong> <code>${{data.package}}</code><br>
            <strong>Versie:</strong> ${{data.from_version}} → ${{data.to_version}} <span class="update-badge ${{updateTypeClass}}">${{data.update_type}}</span><br>
            <strong>Agent:</strong> ${{data.agent}}<br>
            <strong>Run:</strong> #${{data.run}}<br>
            <strong>Latency:</strong> ${{data.latency}}<br>
            <strong>Tokens gebruikt:</strong> ${{data.tokens || '?'}}<br>
            ${{data.changelog_source ? `<strong>📖 Changelog bron:</strong> <a href="${{data.changelog_source}}" target="_blank" style="color: var(--accent);">${{data.changelog_source}}</a><br>` : ''}}
          </div>
        </div>
        
        <div class="detail-section">
          <h4>🎯 Wat er gevraagd werd (Prompt)</h4>
          <div class="content">
            <pre>${{data.prompt || 'Geen prompt beschikbaar'}}</pre>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>🤖 Output van de AI-agent</h4>
          <div class="content">
            ${{data.error ? `<div style="color: var(--bad); padding: 12px; background: #fee2e2; border-radius: 12px;">❌ Fout: ${{data.error}}</div>` : `<pre>${{data.output || 'Geen output gegenereerd'}}</pre>`}}
          </div>
        </div>
        
        <div class="detail-section">
          <h4>✅ Wat er verwacht werd (Expected facts)</h4>
          <div class="content">
            <pre>${{data.expected_facts || 'Geen verwachte feiten opgegeven'}}</pre>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>📊 Evaluatie scores</h4>
          <div class="content">
            <div class="score-grid">
              <div class="score-card">
                <div class="label">Overall</div>
                <div class="value ${{getScoreClass(data.overall)}}">${{data.overall}}</div>
              </div>
              <div class="score-card">
                <div class="label">Specificiteit</div>
                <div class="value">${{data.specificity}}</div>
              </div>
              <div class="score-card">
                <div class="label">Compleetheid</div>
                <div class="value">${{data.completeness}}</div>
              </div>
              <div class="score-card">
                <div class="label">Actionability</div>
                <div class="value">${{data.actionability}}</div>
              </div>
              <div class="score-card">
                <div class="label">Fact Coverage</div>
                <div class="value">${{data.fact_coverage}}</div>
              </div>
            </div>
            <div style="margin-top: 16px;">
              <strong>Safety verdict:</strong> <span class="badge-status ${{data.safety === 'Yes' ? 'true' : (data.safety === 'With caution' ? 'caution' : 'false')}}">${{data.safety}}</span><br>
              <strong>Breaking Changes sectie:</strong> <span class="badge-status ${{getBadgeClass(data.has_breaking_changes)}}">${{data.has_breaking_changes === 'true' ? '✓ Aanwezig' : '✗ Niet gevonden'}}</span><br>
              <strong>Migration Steps sectie:</strong> <span class="badge-status ${{getBadgeClass(data.has_migration_steps)}}">${{data.has_migration_steps === 'true' ? '✓ Aanwezig' : '✗ Niet gevonden'}}</span><br>
              <strong>Verzonnen details:</strong> <span class="badge-status ${{getBadgeClass(data.fabricated_details)}}">${{data.fabricated_details === 'true' ? '⚠️ Ja' : '✓ Nee'}}</span>
            </div>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>🧑‍⚖️ Redenering van de judge</h4>
          <div class="content">
            <p>${{data.reasoning || 'Geen redenering beschikbaar'}}</p>
          </div>
        </div>
      `;
      
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }}
    
    function closeModal() {{
      const modal = document.getElementById('detailModal');
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }}
    
    // Sluit modal bij klikken buiten de content
    window.onclick = function(event) {{
      const modal = document.getElementById('detailModal');
      if (event.target === modal) {{
        closeModal();
      }}
    }}
    
    // ESC toets sluit modal
    document.addEventListener('keydown', function(event) {{
      if (event.key === 'Escape') {{
        closeModal();
      }}
    }});
  </script>
</body>
</html>

"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_doc)

    return output_path