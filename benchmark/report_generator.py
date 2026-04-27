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
            <td style="text-align:center">{breaking}</td>
            <td style="text-align:center">{migration}</td>
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

    html_doc = f"""<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dependency Agent Benchmark</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;600&family=Geist:wght@300;400;500;600;700&display=swap');
:root {{
  --bg:#080810;--surface:#0e0e1a;--surface2:#161625;--surface3:#1e1e30;
  --border:#252538;--border2:#2e2e4a;--text:#e8e8f8;--muted:#6060a0;
  --accent:#818cf8;--green:#34d399;--orange:#fb923c;--red:#f87171;
}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:var(--bg);color:var(--text);font-family:'Geist',sans-serif;font-size:13px;line-height:1.6}}
header{{background:var(--surface);border-bottom:1px solid var(--border);padding:40px 52px 36px;position:relative;overflow:hidden}}
header::before{{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 10% 50%,rgba(129,140,248,.07) 0%,transparent 60%),radial-gradient(ellipse 40% 60% at 85% 20%,rgba(52,211,153,.05) 0%,transparent 60%);pointer-events:none}}
.eyebrow{{font-family:'Geist Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}}
h1{{font-size:32px;font-weight:700;letter-spacing:-.03em;background:linear-gradient(120deg,#e8e8f8 30%,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}}
.meta{{font-family:'Geist Mono',monospace;font-size:11px;color:var(--muted)}}
main{{padding:36px 52px;max-width:1500px}}
section{{margin-bottom:52px}}
.section-label{{font-family:'Geist Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid var(--border)}}
.winner{{background:linear-gradient(135deg,rgba(129,140,248,.1),rgba(52,211,153,.06));border:1px solid rgba(129,140,248,.25);border-radius:14px;padding:28px 36px;display:flex;align-items:center;gap:24px;margin-bottom:36px}}
.winner-emoji{{font-size:44px}}
.winner-sub{{font-size:10px;color:var(--muted);font-family:'Geist Mono',monospace;letter-spacing:.12em;text-transform:uppercase}}
.winner-name{{font-size:28px;font-weight:700;margin-top:2px}}
.winner-right{{margin-left:auto;text-align:right}}
.winner-right .big{{font-size:52px;font-weight:700;font-family:'Geist Mono',monospace;color:var(--accent);line-height:1}}
.winner-right .sub{{color:var(--muted);font-size:11px;margin-top:4px}}
.pills{{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:36px}}
.pill{{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 22px;flex:1;min-width:120px;text-align:center}}
.pill .val{{font-size:22px;font-weight:700;font-family:'Geist Mono',monospace;color:var(--accent)}}
.pill .lbl{{font-size:10px;color:var(--muted);margin-top:3px;text-transform:uppercase;letter-spacing:.08em}}
.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}}
.card{{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px;position:relative;transition:border-color .2s,transform .2s}}
.card:hover{{border-color:var(--border2);transform:translateY(-2px)}}
.card-topbar{{height:3px;border-radius:14px 14px 0 0;position:absolute;top:0;left:0;right:0}}
.card h3{{font-size:17px;font-weight:600;margin:8px 0 18px}}
.row{{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px}}
.row:last-child{{border-bottom:none}}
.row-label{{color:var(--muted)}}
.row-val{{font-family:'Geist Mono',monospace;font-weight:600;font-size:13px}}
.bar{{height:3px;background:var(--border);border-radius:2px;margin-top:3px;overflow:hidden}}
.bar-fill{{height:100%;border-radius:2px;transition:width 1.2s cubic-bezier(.4,0,.2,1)}}
.charts{{display:grid;grid-template-columns:1fr 1fr;gap:20px}}
.chart-box{{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px 24px}}
.chart-box.wide{{grid-column:span 2}}
.chart-title{{font-size:12px;font-weight:600;margin-bottom:18px;color:var(--text)}}
canvas{{max-height:260px}}
.table-wrap{{overflow-x:auto;border-radius:12px;border:1px solid var(--border)}}
table{{width:100%;border-collapse:collapse;font-size:12px}}
thead th{{font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-align:left;padding:11px 12px;background:var(--surface2);border-bottom:1px solid var(--border);white-space:nowrap}}
td{{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle}}
tbody tr:last-child td{{border-bottom:none}}
tbody tr:hover td{{background:var(--surface2)}}
.badge{{display:inline-block;padding:2px 10px;border-radius:100px;font-size:11px;font-weight:600;white-space:nowrap}}
.pkg{{font-weight:600}}
.version{{font-family:'Geist Mono',monospace;font-size:11px;color:var(--muted)}}
.update-type{{display:inline-block;padding:1px 8px;border-radius:4px;font-size:10px;font-family:'Geist Mono',monospace;font-weight:600;text-transform:uppercase}}
.update-type.major{{background:rgba(248,113,113,.15);color:var(--red)}}
.update-type.minor{{background:rgba(251,146,60,.15);color:var(--orange)}}
.update-type.patch{{background:rgba(52,211,153,.15);color:var(--green)}}
.num{{font-family:'Geist Mono',monospace;text-align:right}}
.score{{font-weight:700}}
.latency{{color:var(--muted)}}
code{{background:var(--surface3);padding:2px 7px;border-radius:5px;font-family:'Geist Mono',monospace;font-size:11px}}
.filters{{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}}
.fbtn{{background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:5px 14px;color:var(--muted);cursor:pointer;font-size:11px;font-family:'Geist',sans-serif;transition:all .15s}}
.fbtn:hover,.fbtn.active{{border-color:var(--accent);color:var(--text);background:rgba(129,140,248,.1)}}
.modal-overlay{{display:none;position:fixed;inset:0;background:rgba(8,8,16,.85);backdrop-filter:blur(4px);z-index:1000;align-items:center;justify-content:center}}
.modal-overlay.open{{display:flex}}
.modal{{background:var(--surface);border:1px solid var(--border2);border-radius:16px;width:90%;max-width:860px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column}}
.modal-header{{padding:22px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}}
.modal-header h2{{font-size:16px;font-weight:600}}
.modal-close{{background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--muted);cursor:pointer;padding:4px 10px;font-size:16px;font-family:inherit;transition:color .15s}}
.modal-close:hover{{color:var(--text)}}
.modal-meta{{padding:14px 28px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;gap:20px;flex-wrap:wrap;flex-shrink:0}}
.modal-meta span{{font-family:'Geist Mono',monospace;font-size:11px;color:var(--muted)}}
.modal-meta span strong{{color:var(--text)}}
.modal-body{{padding:20px 28px;overflow-y:auto;flex:1}}
.modal-body pre{{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:18px;font-family:'Geist Mono',monospace;font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-word;color:var(--text);overflow-x:auto}}
.modal-section-title{{font-size:11px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.1em;font-family:'Geist Mono',monospace}}
.reasoning-box{{background:rgba(129,140,248,.06);border:1px solid rgba(129,140,248,.2);border-radius:8px;padding:12px 16px;font-size:12px;color:#a5b4fc;margin-bottom:16px;line-height:1.6}}
@media(max-width:900px){{header,main{{padding:22px 20px}}.charts{{grid-template-columns:1fr}}.chart-box.wide{{grid-column:span 1}}h1{{font-size:22px}}}}
</style>
</head>
<body>

<header>
  <h1>Agent Performance Rapport</h1>
  <div>{benchmark_date} · {duration:.1f}s · {len(agents)} agents</div>
</header>

<div id="usage-overview"></div>
<div id="winner"></div>
<div id="pills"></div>
<div id="cards"></div>

<table>
<tbody id="tbody">
{detail_rows}
</tbody>
</table>

<script>
const stats={stats_json};
const colors={colors_json};
const agents={agents_json};
const perTest={per_test_json};
const testIds={test_ids_json};

const ranked = Object.entries(stats)
    .sort((a,b) => b[1].avg_overall_score - a[1].avg_overall_score);

const [winner, ws] = ranked[0];

document.getElementById('winner').innerHTML = `
<div>
    🏆 <strong style="color:${{colors[winner]}}">${{winner}}</strong>
    (${{ws.avg_overall_score.toFixed(1)}}/10)
</div>`;

const totalCalls = Object.values(stats)
    .reduce((s,v) => s + v.total_calls, 0);

const totalTokens = Object.values(stats)
    .reduce((s,v) => s + v.total_tokens, 0);

const totalCost = Object.values(stats)
    .reduce((s,v) => s + (v.total_cost || 0), 0);

const openAIAgentName = "OpenAI"; // pas aan naar exacte agentnaam in jouw stats

const openAIStats = stats[openAIAgentName] || {{}};

const estimatedTotalTokens = (openAIStats.total_tokens || 0) * 3;
const estimatedTotalCost = (openAIStats.total_cost || 0) * 3;

const fastestAgent = ranked.reduce((a,b) =>
    a[1].avg_latency_ms < b[1].avg_latency_ms ? a : b
);

document.getElementById('pills').innerHTML = `
<div>Calls: ${{totalCalls}}</div>
<div>Packages: ${{testIds.length}}</div>
<div>Fastest: ${{fastestAgent[0]}} (${{fastestAgent[1].avg_latency_ms.toFixed(0)}}ms)</div>
<div>Tokens: ${{totalTokens.toLocaleString()}}</div>
${{totalCost > 0 ? `<div>Cost: $${{totalCost.toFixed(4)}}</div>` : ''}}
`;

document.getElementById('usage-overview').innerHTML = `
<div style="
    margin:20px 0;
    padding:16px 20px;
    background:var(--surface);
    border:1px solid var(--border);
    border-radius:12px;
">
    <div style="
        font-size:11px;
        color:var(--muted);
        text-transform:uppercase;
        letter-spacing:.08em;
        margin-bottom:10px;
        font-family:'Geist Mono',monospace;
    ">
        Usage Overview (Estimated)
    </div>

    <div style="font-size:14px; line-height:1.8">
        <div>• Totale Tokens: <strong>${{estimatedTotalTokens.toLocaleString()}}</strong></div>
        <div>• Totale Cost: <strong>$${{estimatedTotalCost.toFixed(4)}}</strong></div>
    </div>
</div>
`;

document.getElementById('cards').innerHTML = ranked.map(([agent,s]) => {{
    const c = colors[agent];

    const safetyStr = Object.entries(s.safety_verdict_counts || {{}})
        .map(([k,v]) => `${{k}}: ${{v}}x`)
        .join(' · ') || '—';

    const errorRow = s.error_count
        ? `<div style="color:red">Errors: ${{s.error_count}}</div>`
        : '';

    return `
    <div>
        <h3 style="color:${{c}}">${{agent}}</h3>
        <div>Overall: ${{s.avg_overall_score.toFixed(1)}}/10</div>
        <div>Latency: ${{s.avg_latency_ms.toFixed(0)}}ms</div>
        <div>P95: ${{s.p95_latency_ms.toFixed(0)}}ms</div>
        <div>Safety: ${{safetyStr}}</div>
        ${{errorRow}}
    </div>
    `;
}}).join('');

const fc = document.createElement('div');
agents.forEach(agent => {{
    const b = document.createElement('button');
    b.textContent = agent;
    b.onclick = () => filterTable(agent, b);
    fc.appendChild(b);
}});
document.body.prepend(fc);

function filterTable(agent, btn) {{
    document.querySelectorAll('#tbody tr[data-agent]').forEach(row => {{
        row.style.display =
            (agent === 'all' || row.dataset.agent === agent)
                ? ''
                : 'none';
    }});
}}

function openModal(idx) {{
    console.log(window.__modalData[idx]);
}}
</script>

</body>
</html>
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_doc)

    return output_path