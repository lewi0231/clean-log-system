# MDC (Markdown with Components/Metadata) Specification

**Version:** 1.0.0  
**Framework:** Agent Excellence Framework v4.0.0

---

## Overview

MDC files extend standard Markdown with YAML frontmatter optimized for AI agent consumption. This structured metadata allows agents to understand document context, relationships, and purpose without reading full content.

---

## File Format

```
---
# YAML frontmatter
document:
  title: "Document Title"
  type: "start_prompt|handover|framework|specification|process|reference"
  version: "1.0.0"

agent_context:
  purpose: "What this document is for"
  priority: "critical|high|medium|low"
  read_first: true
  estimated_read_time: "5 minutes"

dependencies:
  must_read_before:
    - path: "PREREQ.md"
      reason: "Why this is required"
  related_documents:
    - path: "RELATED.md"
      relevance: "How it relates"

tags:
  - "tag1"
  - "tag2"
---

# Markdown Content

Standard markdown content here...
```

---

## Required Fields

### `document` (required)

| Field     | Type   | Description                   |
| --------- | ------ | ----------------------------- |
| `title`   | string | Human-readable document title |
| `type`    | enum   | Document type classification  |
| `version` | semver | Document version              |

### `agent_context` (required)

| Field      | Type   | Description                 |
| ---------- | ------ | --------------------------- |
| `purpose`  | string | What this document is for   |
| `priority` | enum   | critical, high, medium, low |

---

## Optional Fields

### `document` (optional)

| Field          | Type   | Description                       |
| -------------- | ------ | --------------------------------- |
| `last_updated` | date   | ISO 8601 format                   |
| `author`       | string | Document author                   |
| `status`       | enum   | draft, review, approved, archived |

### `agent_context` (optional)

| Field                 | Type     | Description                   |
| --------------------- | -------- | ----------------------------- |
| `read_first`          | boolean  | Should agent read this first? |
| `estimated_read_time` | string   | e.g., "5 minutes"             |
| `skip_if`             | string[] | Conditions when to skip       |

### `dependencies` (optional)

| Field               | Type  | Description              |
| ------------------- | ----- | ------------------------ |
| `must_read_before`  | array | Documents to read first  |
| `related_documents` | array | Related but not required |
| `blocks`            | array | Documents this blocks    |

### `tags` (optional)

Array of strings for searchable categorization.

---

## Document Types

### `start_prompt`

Entry point for new agent sessions. Contains:

- Before Starting checklist
- Previous session summary
- Outstanding work

### `handover`

Session handover between agents. Contains:

- Session summary
- Completed work
- Files modified
- Outstanding work

### `framework`

Framework rules and guidelines. Contains:

- Critical rules
- Standards
- Best practices

### `specification`

Technical specifications. Contains:

- Overview
- Requirements
- Implementation details

### `process`

Process documentation. Contains:

- Steps
- Success criteria
- Verification

### `reference`

Reference documentation. Contains:

- Lookup tables
- API references
- Configuration

---

## Priority Levels

| Level      | Color   | Auto-Surface | Description                      |
| ---------- | ------- | ------------ | -------------------------------- |
| `critical` | #ef4444 | Yes          | Must read before any work        |
| `high`     | #f59e0b | Yes          | Important context for most tasks |
| `medium`   | #3b82f6 | No           | Useful reference material        |
| `low`      | #71717a | No           | Background information           |

---

## Agent Behaviors

### On Session Start

1. Parse all `.mdc` files in repo root
2. Build dependency graph from `must_read_before`
3. Present `critical` priority documents first
4. Note `recent_changes` from last 7 days

### On Document Access

1. Check `dependencies.must_read_before`
2. Warn if prerequisites not read
3. Log document access for session tracking

### On Session End

1. Generate `handover.mdc` from session
2. Update `current_state` in `start_prompt.mdc`
3. Tag any `[UNIVERSAL]` learnings

---

## Examples

### Minimal MDC File

```markdown
---
document:
  title: "Example Document"
  type: "reference"
  version: "1.0.0"
agent_context:
  purpose: "Example of minimal MDC"
  priority: "low"
---

# Example Document

Content here...
```

### Full MDC File

```markdown
---
document:
  title: "Full Example"
  type: "specification"
  version: "2.1.0"
  last_updated: "2026-01-22"
  author: "Simon Case"
  status: "approved"

agent_context:
  purpose: "Demonstrates all MDC fields"
  priority: "high"
  read_first: false
  estimated_read_time: "10 minutes"

dependencies:
  must_read_before:
    - path: "PREREQ.md"
      reason: "Required background"
  related_documents:
    - path: "RELATED.md"
      relevance: "Additional context"

project:
  name: "ProjectName"
  framework_version: "4.0.0"

current_state:
  last_updated: "2026-01-22"
  active_tasks:
    - "Task 1"
    - "Task 2"

tags:
  - "example"
  - "full-spec"
---

# Full Example

Content with all features...
```

---

## Migration from .md

To convert existing `.md` files to `.mdc`:

1. Add YAML frontmatter with required fields
2. Assess document purpose and set `type`
3. Determine priority level
4. Identify dependencies
5. Add relevant tags

### Example Migration

**Before (`README.md`):**

```markdown
# Project README

This project does X, Y, Z.
```

**After (`README.mdc`):**

```markdown
---
document:
  title: "Project README"
  type: "reference"
  version: "1.0.0"
agent_context:
  purpose: "Project overview and setup instructions"
  priority: "high"
tags:
  - "readme"
  - "setup"
---

# Project README

This project does X, Y, Z.
```

---

## Best Practices

1. **Be specific in `purpose`** - Help agents understand relevance quickly
2. **Use `must_read_before` sparingly** - Only for true prerequisites
3. **Keep `estimated_read_time` accurate** - Helps agent time management
4. **Update `current_state` regularly** - Keep context fresh
5. **Tag consistently** - Use project-wide tag conventions

---

## CLI Support

The `agent-excellence` CLI supports MDC files:

```bash
# Initialize with MDC templates
agent-excellence init --mdc

# Validate MDC frontmatter
agent-excellence validate --mdc

# List documents by priority
agent-excellence list --priority critical
```

---

_MDC Specification v1.0.0 - Agent Excellence Framework_
