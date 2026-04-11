# HUMAN Protocol Command Reference

## Framework for Heuristics in User-Machine Alignment Navigation

| Document Info      |                         |
| ------------------ | ----------------------- |
| **Version**        | 1.0                     |
| **Framework**      | Agent Excellence v4.5.0 |
| **Classification** | Core Module             |
| **Last Updated**   | January 24, 2026        |

---

## Overview

HUMAN Protocol defines natural language commands that trigger standardized agent behaviors. These commands create predictable, reliable interactions between humans and AI agents.

**Design Principles:**

- Commands should feel natural, not robotic
- Multiple trigger phrases for the same action
- Consistent behavior across all SCAINET projects
- Self-documenting through the `.agent-excellence.json` config

---

## Session Commands

### 🚀 "I'm ready" / "ready" / "start session"

**Purpose:** Full session initialization protocol

**Triggers:**

- "I'm ready"
- "ready"
- "start session"
- "begin"
- "let's go"

**Agent Behavior:**

1. **Read** `.agent-excellence.json` (MANDATORY FIRST FILE)
2. **Validate** framework version against remote source
3. **Warn** if local version is stale (> staleDays threshold)
4. **Load** core rules from `AGENT_EXCELLENCE_CORE.md`
5. **Load** stack-specific modules based on project config
6. **Load** project learnings from `PROJECT_LEARNINGS.md`
7. **Load** action items from `ACTION_ITEMS.yaml`
8. **Report** session status with framework signature

**Expected Response Format:**

```markdown
## ✅ Session Initialized

**Framework:** v4.5.0 (source: Chazwazza/version.json)
**Project:** [Project Name]
**Stack:** [platforms], [services], [environments]

### Action Items Summary

| Status         | Count |
| -------------- | ----- |
| 🔴 Urgent      | X     |
| 🟡 In Progress | X     |
| ⚪ Pending     | X     |

[Top 5 action items table]

**What would you like to work on?**

---

⚡ AEF v4.5.0 | HUMAN v1.0 | Session: New | Tasks: X pending
```

---

### 🔄 "sync framework" / "update framework"

**Purpose:** Pull latest framework from source of truth

**Triggers:**

- "sync framework"
- "update framework"
- "pull latest"
- "refresh framework"

**Agent Behavior:**

1. **Check** remote version from GitHub raw URL
2. **Compare** to local `.agent-excellence.json` version
3. **If newer:** Download and update core files
4. **Update** `.agent-excellence.json` with new version and timestamp
5. **Report** changes and new features

**Expected Response Format:**

```markdown
## 🔄 Framework Sync Complete

**Previous:** v4.4.0
**Current:** v4.5.0
**Source:** github.com/scainet-enterprise/Chazwazza

### New in v4.5.0:

- HUMAN Protocol Command System
- Zero-Friction Version Propagation
- Automatic Staleness Detection

Files updated:

- ✅ AGENT_EXCELLENCE_CORE.md
- ✅ HUMAN_COMMANDS.md
- ✅ PLATFORM_GOTCHAS.md
- ✅ .agent-excellence.json

---

⚡ AEF v4.5.0 | HUMAN v1.0 | Session: Continuing | Sync complete
```

---

### 📋 "handover" / "end session"

**Purpose:** Create comprehensive handover document for next agent

**Triggers:**

- "handover"
- "end session"
- "create handover"
- "session complete"
- "wrap up"

**Agent Behavior:**

1. **Summarize** all work completed in session
2. **Document** any outstanding issues or blockers
3. **List** files modified with key changes
4. **Update** `AGENT_HANDOVER.md` with full context
5. **Update** `ACTION_ITEMS.yaml` with any new items
6. **Report** handover readiness

**Expected Response Format:**

```markdown
## 📋 Session Handover Created

**Session Duration:** [time]
**Files Modified:** [count]
**Action Items Created:** [count]
**Action Items Completed:** [count]

### Summary

[Brief description of what was accomplished]

### Outstanding Work

[Any incomplete tasks or known issues]

### Key Context for Next Agent

[Critical information the next agent needs]

Handover saved to: `AGENT_HANDOVER.md`

---

⚡ AEF v4.5.0 | HUMAN v1.0 | Session: Handover Ready | Tasks: X pending
```

---

## Quick Commands

### 📊 "status"

**Purpose:** Quick session state report without full reload

**Triggers:**

- "status"
- "what's the status"
- "where are we"

**Response:** Current task, action items count, session duration

---

### 📜 "rules"

**Purpose:** Display the 10 non-negotiable rules

**Triggers:**

- "rules"
- "show rules"
- "what are the rules"

**Response:** Formatted list of Rules 1-10 with brief descriptions

---

### 🔢 "version"

**Purpose:** Show framework version and check for updates

**Triggers:**

- "version"
- "what version"
- "framework version"

**Response:** Local version, remote version, staleness status

---

### ✅ "framework check" / "compliance check"

**Purpose:** Validate framework compliance before high‑risk actions

**Triggers:**

- "framework check"
- "compliance check"

**Agent Behavior:**

1. Run `agent-excellence validate`
2. If warnings/errors exist, do **not** proceed with high‑risk actions

---

### 🛡️ "preflight guard" / "gate high-risk"

**Purpose:** Hard gate for high‑risk commands

**Triggers:**

- "preflight guard"
- "gate high-risk"
- "guard command"

**Agent Behavior:**

1. Run `agent-excellence guard -- <command>`
2. Block execution if validation warns or fails

### 📝 "action items" / "tasks"

**Purpose:** Display current action items

**Triggers:**

- "action items"
- "tasks"
- "show tasks"
- "what's pending"

**Response:** Action items table filtered by current project/owner

---

### 🔍 "learnings"

**Purpose:** Show project-specific learnings

**Triggers:**

- "learnings"
- "project learnings"
- "what have we learned"

**Response:** Recent entries from `PROJECT_LEARNINGS.md`

---

## Command Processing Logic

### For Agent Implementers

When processing user input, check against command triggers in this order:

```
1. Exact match against triggers array
2. Case-insensitive match
3. Fuzzy match (optional, with confirmation)
```

**Example Implementation:**

```javascript
const COMMANDS = {
  ready: {
    triggers: ["i'm ready", "ready", "start session", "begin", "let's go"],
    handler: "sessionStart",
  },
  sync: {
    triggers: ["sync framework", "update framework", "pull latest"],
    handler: "frameworkSync",
  },
  // ... etc
};

function findCommand(input) {
  const normalized = input.toLowerCase().trim();

  for (const [name, config] of Object.entries(COMMANDS)) {
    if (config.triggers.some((t) => normalized.includes(t))) {
      return { name, config };
    }
  }

  return null; // Not a command, process as normal request
}
```

---

## Extending Commands

Projects can define custom commands in their `.agent-excellence.json`:

```json
{
  "commands": {
    "deploy": {
      "description": "Deploy to production",
      "triggers": ["deploy", "ship it", "push to prod"],
      "handler": "customDeploy",
      "steps": ["runTests", "buildProject", "deployToVercel", "verifyDeployment"]
    }
  }
}
```

Custom commands extend (don't override) the core HUMAN commands.

---

## Best Practices

### For Humans

1. **Be concise** - "ready" works as well as "I'm ready to start the session"
2. **Trust the system** - Commands are designed to be predictable
3. **Correct the agent** - If behavior is wrong, say so; the framework learns

### For Agents

1. **Always check `.agent-excellence.json` first** - It's the entry point
2. **Acknowledge commands explicitly** - Users should know their command was recognized
3. **Include signature in every response** - Builds trust and proves compliance
4. **Warn about staleness proactively** - Don't wait for problems

---

## Version History

| Version | Date       | Changes                                    |
| ------- | ---------- | ------------------------------------------ |
| 1.0     | 2026-01-24 | Initial release with core session commands |

---

_HUMAN Protocol Command Reference v1.0_
_Part of Agent Excellence Framework v4.5.0_
