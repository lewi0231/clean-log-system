# HUMAN Protocol

**Heuristics for User Machine Alignment Navigation**

> The best AI is the one that speaks your language.

---

## What is HUMAN?

HUMAN is SCAINET's natural language interface for AI agent interaction. It allows team members to communicate with AI agents using casual, professional language without requiring developer knowledge.

**Core Principle:** Intent matters more than syntax.

---

## Quick Start

### Starting a Session
```
"Let's get started"
"Catch me up"
```

### During Work
```
"What needs me?"
"Show me the services module"
"Fix that error we just saw"
```

### Ending a Session
```
"Wrap it up"
"Hand off to Sarah"
```

That's it. The agent understands.

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                      YOU (Human)                        │
│                                                         │
│   "catch me up"    "what's urgent"    "ship it"        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   HUMAN Protocol                        │
│                                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │   Aliases   │  │   Context   │  │    Role     │   │
│   │   Matching  │─▶│   Parsing   │─▶│   Aware     │   │
│   └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    AI Agent                             │
│                                                         │
│   Executes formal action with full understanding        │
└─────────────────────────────────────────────────────────┘
```

---

## Command Reference

### 🚀 Session Management

| Say This | Or This | Agent Does |
|----------|---------|------------|
| **"Catch me up"** | "brief me", "what did I miss" | Shows critical items, recent changes, outstanding work |
| **"Let's get started"** | "begin", "I'm ready" | Confirms framework read, shows today's priorities |
| **"Wrap it up"** | "I'm done", "hand it off" | Creates handover, updates state, commits |
| **"Hand off to [name]"** | "pass to [name]" | Creates targeted handover for that person |
| **"Quick save"** | "checkpoint", "save progress" | Commits current work, continues session |

### 📋 Status & Priorities

| Say This | Or This | Agent Does |
|----------|---------|------------|
| **"What needs me"** | "my priorities", "what's mine" | Shows your action items by priority |
| **"What's urgent"** | "what's hot", "fires" | Shows Priority 1 items only |
| **"Any blockers"** | "what's stuck", "bottlenecks" | Shows blocked items and dependencies |
| **"How are we tracking"** | "project health", "on track?" | Shows roadmap progress and velocity |
| **"What's changed"** | "recent updates", "what's new" | Shows activity in last 24-48h |

### ⚡ Work Actions

| Say This | Or This | Agent Does |
|----------|---------|------------|
| **"Ship it"** | "deploy", "push live" | Tests, builds, deploys, documents (must pass preflight guard) |
| **"Test it"** | "run tests", "validate" | Runs test suite, reports results |
| **"Fix that"** | "sort it out", "resolve it" | Diagnoses first, then fixes |
| **"Clean it up"** | "tidy up", "polish" | Lints, formats, removes dead code |
| **"Document this"** | "write it up", "add docs" | Creates/updates documentation |

### 🔍 Information & Discovery

| Say This | Or This | Agent Does |
|----------|---------|------------|
| **"Show me [X]"** | "find [X]", "where's [X]" | Searches and displays results |
| **"Explain [X]"** | "what is [X]", "how does [X] work" | Explains at your level |
| **"What can you do"** | "help", "commands" | Shows available commands |
| **"Who owns [X]"** | "who handles [X]" | Shows responsible person/role |

### 📅 Planning & Strategy

| Say This | Or This | Agent Does |
|----------|---------|------------|
| **"Let's plan [X]"** | "think through [X]" | Creates structured plan with tasks |
| **"Add to roadmap"** | "roadmap this" | Links work to roadmap phase |
| **"Board review"** | "escalate this" | Creates AI Board matter |
| **"Estimate this"** | "how long for [X]" | Provides time/effort estimate |

### 👥 Team & Communication

| Say This | Or This | Agent Does |
|----------|---------|------------|
| **"Update the team"** | "notify everyone" | Drafts update for stakeholders |
| **"Client update"** | "update [client]" | Prepares client-appropriate status |
| **"Flag for [role]"** | "CTO needs this" | Creates high-priority item for role |

### 🛡️ Framework & Governance

| Say This | Or This | Agent Does |
|----------|---------|------------|
| **"Framework check"** | "compliance check" | Runs `agent-excellence validate` (required before high‑risk actions) |
| **"Preflight guard"** | "gate high-risk", "guard command" | Runs `agent-excellence guard -- <command>` and blocks on warnings/errors |
| **"Share this learning"** | "add to framework" | Tags as [UNIVERSAL] |
| **"Sync framework"** | "update framework" | Pulls latest from Chazwazza |
| **"Version"** | "what version", "framework version" | Shows local/remote version, staleness |
| **"Rules"** | "show rules", "constitution" | Displays the 10 Articles |

### 🤖 Agent Identity (EGO Protocol)

| Say This | Or This | Agent Does |
|----------|---------|------------|
| **"Who are you"** | "identity", "which agent" | Shows Agent ID and stats |
| **"Learnings"** | "project learnings", "what have we learned" | Shows recent PROJECT_LEARNINGS entries |
| **"Action items"** | "tasks", "what's pending" | Shows ACTION_ITEMS.yaml filtered |

---

## Role-Aware Interpretation

The same phrase means different things based on who you are:

### "What's the status?"

| Role | Agent Shows |
|------|-------------|
| 👔 **CEO** | Dashboard overview, financials, hiring, board matters |
| 🔧 **CTO** | Tech metrics, PRs, infrastructure, deployments |
| 🎮 **CGO** | Game dev progress, player metrics, platform status |
| 📣 **CCO** | Marketing campaigns, content pipeline, community |

### "Any blockers?"

| Role | Agent Shows |
|------|-------------|
| 👔 **CEO** | Cross-team dependencies, legal issues, funding gaps |
| 🔧 **CTO** | Technical blockers, infrastructure issues, tech debt |
| 🎮 **CGO** | Asset delivery, platform approvals, critical bugs |
| 📣 **CCO** | Content approvals, brand issues, vendor delays |

---

## Confirmation Required

Some commands are high-impact and require confirmation:

| Command | Confirmation | Reason |
|---------|--------------|--------|
| "Ship it" | ✅ Required | Production deployment |
| "Delete [X]" | ✅ Required | Destructive action |
| "Start over" | ✅ Required | Could lose work |
| "Archive [X]" | ✅ Required | Removes from active view |
| "Clean it up" | ⚠️ If ambiguous | Multiple interpretations |

---

## Ambiguity Handling

When the agent isn't sure what you mean:

```
You: "clean it up"

Agent: "I can interpret 'clean it up' a few ways:
  1. 🧹 Clean up code (lint, format, remove dead code)
  2. 📁 Clean up files (archive old docs, organize)
  3. 🔄 Clean up session (commit, handover)

Which did you mean? (or say 'all' for everything)"
```

---

## Discoverability

Not sure what to say? Just ask:

```
You: "What can you do?"

Agent: "Here's what I can help with:

📋 Session: 'catch me up', 'wrap it up', 'quick save'
🔍 Status: 'what needs me', 'any blockers', 'what's changed'
⚡ Actions: 'ship it', 'fix that', 'test it'
📅 Planning: 'let's plan [X]', 'estimate this'

Say any of these naturally - I understand variations!"
```

---

## Adding New Commands

The HUMAN dictionary grows with your team. When you find yourself repeatedly explaining something:

1. **Use it naturally** - Agent will ask for clarification
2. **Define it** - "When I say 'moonshot mode', I mean relax constraints and prioritize innovation"
3. **Agent adds it** - Tagged with your name and date

Or add directly to `.human-commands.yaml`:

```yaml
moonshot_mode:
  casual:
    - "moonshot mode"
    - "let's go big"
    - "swing for the fences"
  formal: "Relax constraints, prioritize innovation over incremental safety"
  added_by: "simon@scainet.io"
  added_date: "2026-01-22"
```

---

## Philosophy

### Why "HUMAN"?

The acronym stands for:
- **H**euristics - Rules of thumb, not rigid commands
- **U**ser - You come first, always
- **M**achine - AI that serves your intent
- **A**lignment - Getting both sides on the same page
- **N**avigation - Guiding interaction naturally

### The Irony is Intentional

We named our AI interaction protocol "HUMAN" because:
1. It reminds us who's in charge
2. It emphasizes natural communication
3. It represents what we're building: AI that feels human

### Casual ≠ Sloppy

HUMAN commands are:
- ✅ Professional
- ✅ Precise in meaning
- ✅ Accessible to everyone
- ❌ Not vague
- ❌ Not ambiguous (agent asks if unclear)

---

## Integration with Framework

HUMAN is part of the Agent Excellence Framework:

```
Agent Excellence Framework v4.1.0
├── Core Documents
│   ├── AGENT_EXCELLENCE_CORE.md
│   ├── HUMAN_PROTOCOL.md          ← You are here
│   └── ...
├── HUMAN Commands
│   └── .human-commands.yaml
└── Templates
    └── ...
```

When you run `agent-excellence init`, HUMAN files are included automatically.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│                 HUMAN Quick Reference                   │
├─────────────────────────────────────────────────────────┤
│ START      │ "let's get started" / "catch me up"       │
│ PRIORITIES │ "what needs me" / "what's urgent"         │
│ STATUS     │ "how are we tracking" / "any blockers"    │
│ DO WORK    │ "fix that" / "ship it" / "test it"        │
│ FIND       │ "show me [X]" / "explain [X]"             │
│ PLAN       │ "let's plan [X]" / "estimate this"        │
│ END        │ "wrap it up" / "hand off to [name]"       │
│ HELP       │ "what can you do"                         │
└─────────────────────────────────────────────────────────┘
```

---

*HUMAN Protocol v1.0.0 - Part of the Agent Excellence Framework*
*© 2026 SCAINET Enterprise*
