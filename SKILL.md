---
name: claude-council
description: Multi-perspective AI council powered entirely by parallel Claude subagents on the user's own Claude Code subscription — no external API keys. Spawns independent council members (distinct personas, fresh contexts, smartest spawnable Claude models) who answer in parallel, anonymously peer-review and rank each other's answers, then the main session synthesizes a final plan with attribution. Use when the user explicitly asks to "consult the council", "ask the council", "get perspectives from other AIs/models", "استشر المجلس", "اسأل المجلس", "رأي ثاني", or wants multiple independent AI opinions / a second opinion before a plan, design, or decision. Also use the fixed legal preset when the user says "استدعِ مجلس النقض", "استدع مجلس النقض", or "مجلس النقض".
---

# Claude Council

Convene a council of **independent Claude subagents** to debate the user's question, then synthesize their perspectives into one plan. Every member runs in a fresh, isolated context (they cannot see this conversation or each other's first-pass answers), so you get genuinely independent takes — all billed as normal subagent usage on the user's subscription. **No API keys are involved.**

## The three stages

1. **Opinions** — council members answer the question in parallel, each through a distinct persona lens.
2. **Peer review** (full mode) — each member receives all answers **anonymized** as "Response A/B/C/D", critiques them, and ranks them best→worst.
3. **Chairman synthesis** — you (the main session) de-anonymize, weigh the critiques and rankings, and present the final plan.

## Default council

| ID | Persona | Model | Lens |
|----|---------|-------|------|
| A | The Architect | Opus 4.8 | Systems design, long-term maintainability, how the solution evolves |
| B | The Skeptic | Opus 4.8 | Red-teams the premise; risks, hidden costs, the alternative nobody considered |
| C | The Pragmatist | Opus 4.8 | Simplest thing that ships; what to cut; smallest de-risking first step |
| D | The Researcher | Opus 4.8 | Prior art, established tools/papers/best practices; may web-search |

## مجلس النقض — fixed legal preset

When the user says **"استدعِ مجلس النقض"**, **"استدع مجلس النقض"**, or clearly asks for **مجلس النقض**, invoke the workflow with `preset: "cassation"` and keep the user's actual legal question verbatim in `question`.

The preset always seats these six independent members:

| ID | Persona | Model | Legal lens |
|----|---------|-------|------------|
| A | قاضي قبول الالتماس | Opus 4.8 | Admissibility first: finality, statutory gateway, deadline, standing, and whether the alleged ground truly opens reconsideration |
| B | محامي المحكمة الإدارية العليا | Opus 4.8 | Cassation-level legal error: exact rule, ratio, standard of review, and whether the challenged reasoning can actually be displaced |
| C | خبير نظام خدمة الأفراد | Opus 4.8 | Saudi military-service rules, implementing regulations, allowances, job classifications, and hierarchy of legal instruments |
| D | خبير الإثبات وإعادة النظر | Opus 4.8 | Decisive documents, fraud/concealment, inability to produce evidence earlier, causation, and proof architecture |
| E | محامي الجهة الإدارية | Opus 4.8 | Strongest defense for the government/agency; res judicata, independent grounds, statutory bars, evidentiary attacks, and harmless-error arguments |
| F | فريق النقض الأحمر | Opus 4.8 | Judicial red-team: tries to reject every proposed ground, identifies fatal defects, and states what evidence would cure them |

### Mandatory cassation rules

- **Separate admissibility from merits.** A strong merits argument is not itself a valid reconsideration gateway.
- **Do not invent statutes, cases, dates, holdings, or facts.** Quote/identify the controlling source precisely when available; otherwise label the point unverified.
- **Distinguish old evidence from a truly new decisive document** and state why it could not reasonably have been produced before judgment.
- **Identify independent grounds in the challenged judgment.** A petition is not dispositive if another untouched ground still supports the result.
- **Argue both sides.** The agency-defense seat must make the best rejection case, not a token objection.
- The chairman must end with: **(1) admissibility gateway, (2) strongest merits attack, (3) strongest defense, (4) missing decisive evidence, (5) recommended next filing step**.

> **Why all Opus 4.8:** as of mid-2026, Claude Code subagents cannot run Fable 5 — `model: "fable"` silently falls back to Opus 4.8, so Opus 4.8 is the smartest spawnable model. Member diversity comes from personas + fully isolated contexts; the chairman (main session) runs on whatever model the user's session uses. If Fable subagents become available, set Architect/Skeptic to `"fable"` — the script already accepts it.

## How to run

Invoke the Workflow tool with the bundled script (runs in background; you'll be notified when done). The script `council-workflow.js` lives next to this SKILL.md — resolve its **absolute** path from wherever this skill is installed (user-level: `~/.claude/skills/claude-council/council-workflow.js`; project-level: `<project>/.claude/skills/claude-council/council-workflow.js`).

```
Workflow({
  scriptPath: "<absolute path to council-workflow.js>",
  args: {
    question: "<the user's question, verbatim>",
    mode: "full",            // "full" (default) = with peer review; "quick" = opinions → synthesis only
    preset: "cassation",       // optional named preset; use for "مجلس النقض"
    context: "<optional: 1–3 sentences of relevant conversation/project context, including repo paths worth investigating>",
    members: [               // optional override (2–8 members) when the user wants a custom council,
      { persona: "...", brief: "...", model: "opus" }   // e.g. "a council of security experts";
    ]                        // model ∈ fable | opus | sonnet | haiku (invalid/missing → opus)
  }
})
```

- Pass the user's question **verbatim**; put any framing into `context` instead.
- If the question concerns the current project, say so in `context` and name the relevant paths — members run in the working directory and will investigate the code before opining (something an external-API council could never do).
- Use `mode: "quick"` when the user says quick/cheap/fast or the question is small. Arabic triggers such as "استشر المجلس", "اسأل المجلس", "خذ رأي ثاني", and "مجلس خبراء" should invoke this skill as well. **"استدعِ مجلس النقض" / "استدع مجلس النقض" / "مجلس النقض" must invoke `preset: "cassation"` in full mode unless the user explicitly asks for quick mode.** Use `full` otherwise — the anonymized cross-critique is where most of the value comes from.

## Stage 3 — Chairman synthesis (you, after the workflow returns)

The workflow returns `{ question, mode, council[], peer_reviews[], aggregate_ranking[] }` where each council entry has `{ id, persona, model, stance, confidence, key_points, answer }` and `aggregate_ranking` gives each member's average peer rank (lower = better). Your final message must contain:

1. **The synthesized plan/answer** — integrate the strongest ideas across members; attribute inline ("The Skeptic flagged…", "The Researcher found…"). Where members disagreed, say how you resolved it and why. Apply your own judgment — you may overrule the council's ranking, but say so explicitly.
2. **Council verdict table** — `Member (model) | Stance | Avg peer rank`.
3. **Consensus & dissent** — the strongest point of agreement, the sharpest disagreement, and any minority dissent the user should weigh before committing.
4. One closing line noting the council was N independent Claude agents (fresh contexts, distinct personas) run on the user's own subscription.

**Integrity:** never present council members as ChatGPT, Gemini, or any external vendor — they are Claude agents with personas. If the user wants literally-other-vendor opinions, explain that this skill provides independent *Claude* perspectives instead, and that true cross-vendor councils require API keys (e.g. karpathy/llm-council or gcpdev/llm-council-skill).

## Fallback (Workflow tool unavailable)

Reproduce the stages with parallel Agent tool calls: spawn all members in one message (one Agent call per member, `model` set per the table, fresh prompts containing persona brief + question + ground rules), then in full mode a second parallel round where each member reviews the anonymized answer packet, then synthesize as above.

## Error handling

- Members that fail or return nothing are reported by the workflow; proceed with the responders and tell the user which seats were empty.
- If the whole workflow fails, tell the user and offer your own single-perspective analysis instead.
