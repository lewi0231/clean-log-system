# HUMAN Protocol — Command Reference

| Document Info |                                       |
| ------------- | ------------------------------------- |
| **Version**   | 4.8.1                                 |
| **Type**      | Universal Core                        |
| **Generated** | 2026-02-09                            |
| **Source**    | aef-core (canonical rules repository) |

---

> **SINGLE SOURCE OF TRUTH** for all HUMAN Protocol commands.

## Command Reference

| Command               | Triggers | Action                                                                                     |
| --------------------- | -------- | ------------------------------------------------------------------------------------------ |
| **Start / Ready**     |          | Full session initialization — read project, check git, load action items, report status    |
| **Quick Save**        |          | Stage and commit current work with a meaningful message. Do NOT end the session.           |
| **Handover**          |          | Create a handover summary of everything done, what's pending, and any learnings. Then end. |
| **Targeted Handover** |          | Creates a handover targeted at a specific person/agent                                     |
| **Catch Me Up**       |          | Shows critical items, recent changes, outstanding work                                     |
| **Status**            |          | Report current task progress, files modified, git status, pending items                    |
| **My Priorities**     |          | Shows action items by priority                                                             |
| **Urgent Items**      |          | Shows Priority 1 items only                                                                |
| **Blockers**          |          | Shows blocked items and dependencies                                                       |
| **Tasks**             |          | List pending action items from context or own tracking                                     |
| **Recent Changes**    |          | Shows activity in last 24-48h                                                              |
| **Who Are You**       |          | Display EGO identity, session count, and score                                             |
| **Version**           |          | Show framework version                                                                     |
| **Rules**             |          | Display the 10 Articles                                                                    |
| **Sync Framework**    |          | Pull latest framework config from central API                                              |
| **Ship It**           |          | Tests, builds, deploys, documents. Must pass preflight guard.                              |
| **Test It**           |          | Runs test suite, reports results                                                           |
| **Fix That**          |          | Diagnoses first, then fixes                                                                |
| **Clean Up**          |          | Lints, formats, removes dead code                                                          |
| **Document This**     |          | Creates/updates documentation                                                              |

## Session Start Protocol

When a session begins (user says "I'm ready", "start", "begin", or similar):

1. Read `.agent-excellence.json` (mandatory entry point)
2. Check framework version against remote
3. Run `agent-excellence validate`
4. Load AGENT_EXCELLENCE_CORE.md
5. Load HUMAN_PROTOCOL.md
6. Load PROJECT_LEARNINGS.md
7. Load ACTION_ITEMS.yaml
8. Report session status with framework signature
