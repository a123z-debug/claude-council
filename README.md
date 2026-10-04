# Claude Council

**An [LLM Council](https://github.com/karpathy/llm-council) for Claude Code — with zero API keys.**

Ask a question and a council of independent AI advisors debates it: each member answers in parallel from a completely isolated context, the members anonymously peer-review and rank each other's answers, and a chairman synthesizes the final recommendation — with attribution, consensus, and dissent.

The twist: **every council member is a Claude subagent running on the Claude Code subscription you already have.** No OpenAI key, no Gemini key, no separate billing. If Claude Code runs on your machine, the council runs.

```
Opinions · 4 agents
  ✓ The Architect      Opus 4.8    22.9k tok
  ✓ The Skeptic        Opus 4.8    15.0k tok
  ✓ The Pragmatist     Opus 4.8    14.9k tok
  ✓ The Researcher     Opus 4.8    18.2k tok
Peer Review · 4 agents
  ✓ review by The Architect   ✓ review by The Skeptic
  ✓ review by The Pragmatist  ✓ review by The Researcher
```

## Why

[karpathy/llm-council](https://github.com/karpathy/llm-council) and [gcpdev/llm-council-skill](https://github.com/gcpdev/llm-council-skill) are great — if you have API keys for multiple vendors. Lots of people just have a Claude Pro/Max subscription and no API keys at all. Claude Council recreates the council experience with what actually makes opinions independent:

- **Fresh contexts** — members can't see your conversation or each other's first drafts, so they can't anchor on each other
- **Distinct personas** — The Architect, The Skeptic, The Pragmatist, The Researcher (or any custom lineup you ask for)
- **Anonymized peer review** — answers are judged as "Response A/B/C/D", so nobody defers to a name
- **Repo awareness** — members run in your working directory and can actually read your code before opining, something an external-API council can never do

Honest caveat: all members are Claude, so you get independence from isolation and personas, not cross-vendor diversity. It won't tell you "what GPT thinks" — it gives you four genuinely independent, adversarial Claude takes plus a ranked synthesis.

## How it works

1. **Opinions** — N members (default 4) answer your question in parallel, each through its persona lens.
2. **Peer review** — each member critiques all answers anonymized as Response A/B/C/D and ranks them best→worst (this stage is from Karpathy's original design, and it's where most of the value comes from).
3. **Chairman synthesis** — your main Claude session de-anonymizes, weighs critiques and aggregate rankings, and presents one plan with attribution, the council verdict table, consensus, and dissent worth weighing.

## Install

User-wide (available in every project):

```sh
git clone https://github.com/a123z-debug/claude-council ~/.claude/skills/claude-council
```

Or per-project: clone into `<project>/.claude/skills/claude-council`. Claude Code picks up skills automatically (start a new session if it doesn't appear).

## Usage

Just ask, in any Claude Code session:

> consult the council: should we migrate this service to async now or after the launch?

Also triggers on "ask the council …", "get a second opinion on …", Arabic phrases such as "استشر المجلس" and "اسأل المجلس", or invoke directly with `/claude-council`. Useful variants:

- **Quick mode** — "quick council: …" skips peer review (roughly half the tokens).
- **Custom councils** — "consult a council of security experts about …" and the chairman will seat custom personas (2–8 members).
- **Project questions** — mention files/paths and members will go read them before opining.

## مجلس النقض (Legal Cassation Council)

This fork includes a fixed six-seat Saudi administrative-law preset. In Claude Code, say:

> **استدعِ مجلس النقض:** راجع الحكم والمرفقات وحدد أقوى سبب نظامي صالح للالتماس.

The skill invokes `preset: "cassation"` and seats six independent Opus agents:

1. **قاضي قبول الالتماس** — tests the statutory gateway, finality, deadline, and admissibility before touching the merits.
2. **محامي المحكمة الإدارية العليا** — analyzes cassation-level legal error, ratio, standard of review, and independent grounds.
3. **خبير نظام خدمة الأفراد** — focuses on Saudi military-service statutes, implementing rules, allowances, job classifications, and hierarchy of instruments.
4. **خبير الإثبات وإعادة النظر** — tests decisive documents, inability to produce them earlier, concealment/fraud if proven, and causation.
5. **محامي الجهة الإدارية** — presents the strongest government-side case for rejection.
6. **فريق النقض الأحمر** — judicial red-team that tries to break every proposed ground and identifies the missing evidence needed to cure it.

The preset has mandatory safeguards: it separates **admissibility** from **merits**, forbids invented statutes/cases/facts, checks whether another independent ground still sustains the judgment, and forces the chairman to finish with the admissibility gateway, strongest attack, strongest defense, missing decisive evidence, and next filing step.

## Example (real run)

Question: *"For a solo NLP research project with a ~7-week deadline, should experiment configurations live in YAML config files or as plain Python dicts in the code?"*

| Member | Stance | Avg peer rank |
|---|---|---|
| The Architect | Typed dataclasses + argparse; thin YAML only as a sweep manifest | **1.25** 🏆 |
| The Pragmatist | Plain dicts in `configs.py`; promote to YAML only when sweeps demand it | 1.75 |
| The Skeptic | False binary — the real risk is config drift; freeze per-run config snapshots | 3.00 |
| The Researcher | Dataclasses that serialize to YAML, logged as run artifacts | 4.00 |

Chairman's synthesis: don't pick YAML *or* dicts — use typed dataclass configs and make every run emit its resolved config + git SHA next to its outputs; all four members independently rejected adopting Hydra on that timeline. (Full run: 8 agents, ~173k tokens, ~2.5 minutes.)

## Cost

Everything is normal subagent usage on your own plan. Ballpark for a substantive question: full mode ~100–200k tokens, quick mode roughly half. There is no external spend.

## Requirements

- Claude Code (CLI, desktop app, or IDE integration) recent enough to have the **Workflow** tool — the skill includes a documented fallback to parallel Agent calls for older versions.
- Any plan that runs Claude Code (Pro/Max subscription or API billing).

As of mid-2026 subagents max out at **Opus 4.8** (`model: "fable"` falls back silently — the script already accepts `fable`, so it lights up automatically if subagent support arrives). The chairman runs on whatever model your session uses.

## Credits

- [Andrej Karpathy's llm-council](https://github.com/karpathy/llm-council) — the original council concept: parallel answers, anonymized peer ranking, chairman synthesis.
- [gcpdev/llm-council-skill](https://github.com/gcpdev/llm-council-skill) — the Claude Code skill packaging of the idea (external APIs), which inspired this no-API-key version.

## License

[MIT](LICENSE)
