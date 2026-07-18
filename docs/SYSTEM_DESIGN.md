# Automatix Warehouse AI Manager — System Design

Status: **Draft v1** — defines the target system. Read this before writing code.
Audience: anyone picking up this project cold (new session, new contributor).

---

## 1. Vision

Replace the day-to-day decision-making role of a human warehouse/store manager with an AI agent that:
- Can be asked **any** question about the business (stock, sales, alerts, rules) and answer from live data.
- **Watches** inventory continuously and surfaces problems before a human has to look.
- Produces **reports** on demand (sales history, past alerts, past transfers/decisions).
- Recommends actions (transfers, reorders, promotions) but — in v1 — does not execute irreversible actions without a human confirming, because we are replacing the manager's *analysis and attention*, not their accountability.

## 2. Problem Statement

Today (`Automatix-Inventory` as cloned) a human has to:
1. Open a dashboard, manually notice low-stock/near-expiry rows.
2. Manually click "Trigger AI Squad Audit" to get a one-shot report.
3. Manually decide and click "Swap Stock" for transfers.

There is no persistent memory, no history of past alerts/decisions, no free-form Q&A, and no proactive behavior — the system only acts when a human clicks a button. The Warehouse AI Manager closes that gap.

## 3. Goals (v1)

- G1. A single conversational agent ("the Manager") answerable via a chat endpoint, that can answer arbitrary natural-language questions about live inventory, sales, rules, and alerts.
- G2. Scheduled/background monitoring that detects low-stock and near-expiry conditions without a human triggering it, and persists them (alert log), not just prints a report.
- G3. On-demand report generation: sales history over a period, alert history over a period, transfer/decision history over a period — as structured, readable output (markdown, and eventually a UI view).
- G4. Tool-based grounding: the agent never guesses numbers — every factual claim comes from a tool call against the database, same discipline as the current SQL Agent.
- G5. Human-in-the-loop for anything that mutates state with business consequence (transfers, rule changes) — agent recommends, human (or an explicit "auto-approve" toggle, later) confirms.
- G6. Conversation memory per session, so follow-up questions ("what about Sharjah?") work without repeating context.

## 4. Non-Goals (v1)

- Not building multi-tenant auth/user management yet (single-operator assumption).
- Not fully autonomous execution of transfers/reorders/rule changes without human confirmation (this is a deliberate safety boundary, revisit in a later phase only if explicitly requested).
- Not replacing SQLite with Postgres yet (tracked as a hardening-phase item, not blocking).
- Not building a mobile app / notifications to phone — a notification **hook** is stubbed, not a full delivery channel.
- Not doing real supplier integration (external ordering stays a recommendation, not an API call to a real supplier).

## 5. Primary Persona

**Store Operations Owner/Manager** — wants a single place to ask "how are we doing", get warned about problems, and get a report to send upward, without personally reading tables every day.

## 6. Use Cases

### UC1 — Ask-Anything Q&A
- Trigger: user types a free-form question in chat ("Which branch is lowest on dates?", "What's our Ramadan multiplier?", "Why did you recommend a transfer yesterday?").
- Flow: agent decides which tool(s) to call (schema/query/alerts/rules/report), calls them, synthesizes a natural-language answer.
- Output: conversational answer, optionally with an inline table.

### UC2 — Proactive Monitoring & Alerts
- Trigger: scheduled job (e.g. every N minutes/hours) — not user-initiated.
- Flow: run the same low-stock/near-expiry detection logic used today, but **persist** new alerts to an `alerts_log` table (dedup against already-open alerts), and (stub) call a `notify()` tool.
- Output: rows in `alerts_log`; these become answerable via UC1 and reportable via UC3.

### UC3 — Historical Reporting
- Trigger: user asks for a report ("give me last week's sales report", "summarize alerts from this month", "what transfers happened in July?").
- Flow: agent calls a reporting tool with a date range, gets aggregated data, formats/writes a markdown report.
- Output: markdown report (chat-rendered now; downloadable/emailable later).

### UC4 — Restock/Transfer Decision Support
- Trigger: either UC2 finds a problem, or a user asks directly.
- Flow: reuse existing business-rule-driven logic (transfer feasibility vs. distance limit, reorder multipliers, Ramadan handling) — now as **tools the single agent calls**, not four separate CrewAI agents.
- Output: recommendation text + (if user/UI confirms) a call to the existing `execute_transfer` capability.

### UC5 — Rule Configuration Assistant (stretch, not core v1)
- Trigger: user says "raise the near-expiry threshold to 5 days."
- Flow: agent confirms the change in natural language, then (only after explicit confirmation) calls the rule-update tool.
- Output: confirmation message + updated rule.

## 7. Architecture Decision: CrewAI → LangChain (LCEL), not LangGraph

**Current state:** CrewAI with 4 fixed-role agents (`interface`, `sql`, `alerts`, `analysis`) running a hardcoded sequential task chain, triggered only by a button. Good for a "generate one report" demo; wrong shape for "always-on conversational manager."

**Decision:** Replace CrewAI with a **single LangChain tool-calling agent built on LCEL** (`ChatOpenAI.bind_tools(...)` + a tool-calling agent executor loop). LangGraph is explicitly **not** used for v1.

**Why LCEL is enough:**
- The workload is fundamentally: user/system message in → 1..N deterministic tool calls → synthesized answer out. That's a straight-line loop, not a graph with branching/cyclic state.
- One agent with many tools is simpler to reason about and cheaper (fewer LLM round-trips) than four role-played agents debating in sequence.
- LCEL composes cleanly with the existing FastAPI app and is trivial to unit test (each tool is a plain Python function).

**When to revisit LangGraph** (write this down so we don't re-debate it later): if we need the agent to autonomously loop/re-plan across many steps without a human prompting each turn, or need multiple specialized agents that hand off to each other dynamically, or need durable interrupt/resume state for long-running human approval workflows. None of that is required for UC1–UC5.

**Dependency impact:** `crewai` is dropped from `requirements.txt` once the cutover is validated; `langchain-openai` is already present (kept); add `langchain` (core + agent building blocks). See Phase 2 (build) and Phase 7 (actual CrewAI removal, per OQ1).

## 8. High-Level Architecture (target)

```
Next.js dashboard (chat UI + alerts feed + reports view + existing rule/transfer UI)
        │  REST + (later) streaming
        ▼
FastAPI (existing app.py, extended)
        │
        ├─ /api/chat            → Warehouse Manager Agent (LCEL tool-calling loop)
        │                            │
        │                            ├─ tool: get_schema
        │                            ├─ tool: run_db_query (read-only SELECT)
        │                            ├─ tool: get_business_rules
        │                            ├─ tool: get_active_alerts
        │                            ├─ tool: get_sales_report(range)
        │                            ├─ tool: get_alert_history(range)
        │                            ├─ tool: recommend_transfer_or_reorder
        │                            ├─ tool: propose_transfer / propose_rule_change (writes require confirm=True)
        │                            └─ tool: get_system_date
        │
        ├─ /api/inventory, /api/rules, /api/transfer   → rewritten on top of the DB abstraction layer (Phase 1)
        │
        ├─ auth middleware (token check on all mutating endpoints — not deferred, see Section 13)
        │
        └─ scheduled job (APScheduler, in-process)
                → runs alert-detection logic on an interval
                → writes to alerts_log (dedup)
                → calls notify() stub
        │
        ▼
   SQLAlchemy engine (DATABASE_URL env var)
        → SQLite for local dev, Postgres/MySQL/etc. in real deployment — same code, no dialect-specific SQL in application code
        → tables: existing (stores, products, store_inventory, store_connections, business_rules, sales_history) + new: alerts_log, chat_sessions, chat_messages, agent_actions_log
```

## 9. Tool Specification

All tools are plain Python functions wrapped with LangChain's `@tool` decorator (mirrors the existing CrewAI `@tool` style in `tools.py`, so migration is mostly a decorator swap + registration change).

| Tool | Args | Returns | Side effects | Notes |
|---|---|---|---|---|
| `get_schema` | — | schema text | none | reuse as-is from `tools.py` |
| `run_db_query` | `sql: str` (SELECT only) | markdown table | none | reuse as-is |
| `get_system_date` | — | date string | none | reuse as-is |
| `get_business_rules` | — | dict of rules | none | thin wrapper so agent doesn't need to hand-write the SQL every time |
| `get_active_alerts` | `store_id: int \| None` | list of {product, store, type, stock, threshold, expiry} | none | single source of truth for "what's wrong right now" — used by both chat and the scheduled job |
| `get_sales_report` | `start_date, end_date, store_id?` | aggregated sales table | none | powers UC3 |
| `get_alert_history` | `start_date, end_date, store_id?` | rows from `alerts_log` | none | powers UC3 |
| `get_transfer_history` | `start_date, end_date` | rows from `agent_actions_log` | none | powers UC3 |
| `recommend_transfer_or_reorder` | `product_id, store_id` | recommendation object (standard transfer / override opportunity / supplier reorder + reasoning) | none | encapsulates today's Analysis Agent logic as a callable function, not prose |
| `propose_transfer` | `from_store_id, to_store_id, product_id, quantity` | pending-action id + summary | writes a *pending* row, not committed | only `confirm_action` actually calls the existing `/api/transfer` logic |
| `propose_rule_change` | `key, value` | pending-action id + summary | writes a *pending* row | same confirm pattern |
| `confirm_action` | `action_id` | result | **executes** the pending transfer/rule change | the only tool with real write side effects; called only after explicit user/UI confirmation |
| `notify` (stub) | `message, severity` | ack | logs only in v1 (prints / writes to a table); real channel (email/Slack) is a later phase | exists so the interface is stable when we add real delivery |

Guardrail: any tool with a side effect beyond `propose_*`/`confirm_action` should not exist. This keeps "the AI can recommend anything, but only executes what a human confirmed" true by construction, not by prompt instruction alone.

## 10. Data Model

### 10.1 Database Abstraction Strategy (resolved decision, see Section 15 / OQ2)

The database must be treated as **fixed, pre-existing, external state** — the agent and API look into it, they don't recreate it. It also must not be tied to a specific engine (not hardcoded to SQLite or Postgres or MySQL). This means:

- **SQLAlchemy Core/ORM** replaces every raw `sqlite3.connect(...)` call in `app.py`/`tools.py`/`db_setup.py`. A single `engine = create_engine(os.environ["DATABASE_URL"])` is the only place a connection string is built. `DATABASE_URL` defaults to `sqlite:///inventory.db` for local dev but works unchanged against `postgresql://...` or `mysql://...` in a real deployment.
- **Table definitions live once**, as SQLAlchemy `Table`/model objects (e.g. `backend/db/models.py`), not as hand-written `CREATE TABLE` strings — SQLAlchemy translates types/autoincrement/etc. per dialect, so the same model file works on SQLite and Postgres without edits.
- **Schema creation is idempotent, not destructive.** `ensure_schema()` uses `Base.metadata.create_all(engine)` (or Alembic migrations once the schema needs to evolve without data loss — prefer Alembic from the start given the "no deferring" decision in OQ3: it gives real migration history instead of a create-all script pretending to be one). This replaces `db_setup.py`'s current `DROP TABLE IF EXISTS` + reseed pattern entirely.
- **Seeding demo data is a separate, explicit, idempotent step** (`backend/db/seed.py`, run via `python -m backend.db.seed`), not something that runs automatically on every backend start. It checks whether data already exists (e.g. `stores` table empty) before inserting, so running it twice is harmless and running the backend never wipes real data.
- **`get_schema` tool** must stop reading `sqlite_master` (SQLite-only) and instead use `sqlalchemy.inspect(engine)` to list tables/columns — this is the one piece of today's `tools.py` that is actively dialect-locked and must change for OQ2 to hold.
- **`run_db_query` tool** keeps accepting raw SQL text (agents need ad-hoc SELECT flexibility) executed via `engine.connect().execute(text(sql))`. Note as a known, accepted limitation: raw SQL is mostly portable ANSI SQL for simple SELECTs, but a query written against SQLite quirks may not run verbatim against Postgres/MySQL — this is a tradeoff of allowing free-form SQL at all, not something to solve now.

### 10.2 Schema (logical — implemented as SQLAlchemy models, not raw DDL)

Existing tables (`stores`, `products`, `store_inventory`, `store_connections`, `business_rules`, `sales_history`) are unchanged in shape; they move from hand-written SQLite DDL to SQLAlchemy models.

New tables:

```
alerts_log
    id              PK, autoincrement
    store_id        FK -> stores.id
    product_id      FK -> products.id
    alert_type      'low_stock' | 'near_expiry'
    detected_at     simulated system date
    resolved_at     nullable — null while open
    details         free text snapshot (stock level, threshold, expiry date at detection time)

chat_sessions
    id              PK (session/thread id, string)
    created_at

chat_messages
    id              PK, autoincrement
    session_id      FK -> chat_sessions.id
    role            'user' | 'assistant' | 'tool'
    content
    created_at

agent_actions_log
    id              PK, autoincrement
    action_type     'transfer' | 'rule_change'
    payload         JSON snapshot of the proposed action
    status          'pending' | 'confirmed' | 'rejected'
    created_at
    resolved_at     nullable
```

## 11. Memory & State Strategy

- Each chat conversation has a `session_id` (frontend generates a UUID per browser tab/session, sent with every `/api/chat` call).
- Message history is loaded from `chat_messages` for that session and passed to the agent as prior turns (simple list-of-messages, no vector store needed at this scale — the dataset is small enough that tools re-query live data every time rather than relying on stale memory).
- No long-term "user profile" memory in v1 — every fact must come from a tool call, not from what the agent "remembers" about the business, to avoid stale/hallucinated numbers.

## 12. Human-in-the-Loop & Safety Guardrails

- The agent can **read** anything and **propose** anything, but can only **write** (transfer, rule change) through the `propose_* → confirm_action` two-step pattern.
- The frontend must render a proposal as an explicit confirm/reject UI element, never auto-confirm based on the agent's own text output.
- `run_db_query` keeps the existing SELECT-only guard.
- All confirmed actions are recorded in `agent_actions_log` for auditability — this is what makes "the AI is the manager" defensible: there's a paper trail of exactly what it did and when.

## 13. Non-Functional Requirements

- **Cost control:** every `/api/chat` turn is a real OpenAI call (possibly several, for tool round-trips). Log token usage; consider a cheap model (`gpt-4o-mini`, already the default) and a max-tool-call cap per turn to avoid runaway loops.
- **Latency:** chat should feel responsive; avoid unnecessary tool calls by giving the agent a good system prompt describing what data exists (schema-in-context) rather than always calling `get_schema` first.
- **Security:** per OQ3 (resolved — no deferring), basic auth (a shared bearer token checked on every mutating endpoint) and a configurable CORS allow-list (env var, default `http://localhost:3000`, not `*`) are built starting **Phase 1**, not pushed to a final hardening phase. What genuinely can't be done without a real target (choosing a real auth provider, real hosting, real TLS) is the only thing left for the final phase.
- **Testing:** every phase's Definition of Done includes unit tests for the new pure-function logic it introduces (tools, recommendation logic, report aggregation) — not a bucket left for the end.
- **Containerization:** a working `Dockerfile` for backend and frontend is introduced in **Phase 1** alongside the DB abstraction layer, since Docker doesn't require a hosting target to be useful locally (`docker compose up` against a real Postgres container is also how the DB-agnostic claim from OQ2 gets proven, not just asserted).
- **Observability:** minimum viable is the `agent_actions_log`/`alerts_log`/`chat_messages` tables; deeper logging/metrics remains a later, target-dependent concern (needs somewhere to ship logs to).

## 14. Phased Roadmap

Each phase lists: Goal, Deliverables, Steps, Files touched, Definition of Done. Work through phases in order; do not start a phase whose dependencies aren't done.

---

### Phase 0 — Baseline (done)

Repo cloned, fully read, current CrewAI/FastAPI/Next.js architecture understood and documented in this file's Section 7-8 rationale. No action needed; this phase exists so a new contributor knows the starting point was audited, not assumed.

---

### Phase 1 — Database Abstraction Layer + Baseline Hardening

**Goal:** Replace the raw, SQLite-locked, destructively-reseeded persistence with a fixed, engine-agnostic database that the rest of the system (existing CRUD endpoints included) reads/writes through — this is foundational, everything else builds on it. Baseline hardening (auth, CORS, tests, Docker) starts here per OQ3, not at the end.

**Deliverables:**
- `backend/db/engine.py` — `create_engine(os.environ["DATABASE_URL"])`, single source of the connection.
- `backend/db/models.py` — SQLAlchemy models for all existing tables plus the four new ones (`alerts_log`, `chat_sessions`, `chat_messages`, `agent_actions_log`) from Section 10.2.
- `backend/db/schema.py` — `ensure_schema()` (Alembic migration setup preferred over a bare `create_all`, per Section 10.1 — gives real migration history as the schema evolves in later phases).
- `backend/db/seed.py` — idempotent demo-data seeding, run explicitly (`python -m backend.db.seed`), never automatically on app start.
- `app.py`'s existing `/api/inventory`, `/api/rules`, `/api/transfer` rewritten against SQLAlchemy instead of raw `sqlite3.connect`.
- `tools.py`'s `get_schema` rewritten to use `sqlalchemy.inspect(engine)` instead of `sqlite_master`.
- Auth: a shared bearer token (env var `API_AUTH_TOKEN`) checked via FastAPI dependency on every mutating endpoint (`/api/rules` POST, `/api/transfer`, later `/api/chat` confirm actions).
- CORS: allowed origins from an env var (default `http://localhost:3000`), replacing the current `allow_origins=["*"]`.
- `Dockerfile` for backend, `Dockerfile` for frontend, and a `docker-compose.yml` that runs the backend against a real Postgres container — this is what actually proves the DB-agnostic claim, not just the code shape.
- Unit tests (`backend/tests/test_db.py`) covering: schema creation is idempotent (running `ensure_schema()` twice doesn't error or drop data), seeding is idempotent, CRUD endpoints work against both SQLite and the Postgres compose service.

**Steps:**
1. Add `sqlalchemy`, `alembic`, `pytest` to `requirements.txt`.
2. Write the models, matching the existing schema's shapes exactly (don't change column meanings, only how they're declared).
3. Set up Alembic (`alembic init`), generate the first migration from the models.
4. Write `seed.py`: check `if not session.query(Store).first(): insert seed rows` before inserting — mirrors today's `db_setup.py` seed data verbatim, just gated.
5. Rewrite `app.py`'s three existing endpoints to use SQLAlchemy sessions instead of raw `sqlite3`.
6. Add the auth dependency and CORS env-var wiring.
7. Write the Dockerfiles + compose file; run the test suite against both the SQLite default and the compose Postgres service to prove portability.
8. Delete `db_setup.py` once `db/schema.py` + `db/seed.py` fully replace it (don't leave two competing initialization paths).

**Definition of Done:** `docker compose up` brings up backend + Postgres + frontend from a clean checkout with zero manual DB setup steps; running the backend twice never wipes data; the same test suite passes against SQLite and Postgres; mutating endpoints reject requests without a valid token.

---

### Phase 2 — Core Manager Agent (replace CrewAI with LCEL tool-calling agent)

**Goal:** One conversational agent that can answer questions using tools built on top of the Phase 1 DB layer, reachable via a new `/api/chat` endpoint. No proactive monitoring, no memory persistence yet — prove the core loop works.

**Deliverables:**
- `backend/manager_agent.py` — builds the LCEL tool-calling agent (system prompt + tool list + `ChatOpenAI.bind_tools`).
- `backend/manager_tools.py` — tool functions (`get_schema`, `run_db_query`, `get_system_date` ported from `tools.py` onto the SQLAlchemy engine; add `get_business_rules`, `get_active_alerts`, `recommend_transfer_or_reorder`).
- `POST /api/chat` endpoint in `app.py`: body `{ "message": str, "session_id": str }`, returns `{ "reply": str }`. No persistence yet (in-memory history per request is fine for this phase).
- `backend/requirements.txt` updated: remove `crewai` only once Phase 2 is validated (see OQ1 — keep `/api/run-audit` running side by side until then), add `langchain`, keep `langchain-openai`.
- Unit tests for every new tool function (pure functions against a test DB fixture) and an integration test for the `/api/chat` happy path — per OQ3, not deferred to later.

**Steps:**
1. Write `manager_tools.py` against the SQLAlchemy engine from Phase 1, re-decorated with LangChain's `@tool`. Add `get_business_rules()` (thin wrapper), `get_active_alerts(store_id=None)` (single source of truth for low-stock/near-expiry logic, replacing the duplication between today's `alerts_task` prompt and the frontend's `getAlerts()`).
2. Write `recommend_transfer_or_reorder(product_id, store_id)` — port the Analysis Agent's decision logic (transfer feasibility vs. `max_transfer_distance_km`, standard vs. override, reorder multiplier selection) into a plain function returning a structured result, not prose.
3. Write `manager_agent.py`: system prompt describing the Warehouse AI Manager's role/scope/safety rules (can read anything, can only propose writes), bind the tool list, build the executor.
4. Add `/api/chat` to `app.py` (behind the auth dependency from Phase 1), wire to `manager_agent.py`.
5. Keep `/api/run-audit` (CrewAI) running unchanged alongside it, per OQ1 — compare outputs on the same scenarios before removing CrewAI.
6. Write tests; manually test via curl/Postman before touching the frontend.

**Definition of Done:** `/api/chat` answers grounded questions correctly for all three current stores using live tool calls (verified via tool-call traces, not just plausible text); CrewAI is still running and comparable side by side.

---

### Phase 3 — Reporting Engine

**Goal:** On-demand historical reports (sales, alerts, transfers) over a date range, callable via chat.

**Deliverables:**
- `get_sales_report(start_date, end_date, store_id=None)`, `get_alert_history(...)`, `get_transfer_history(...)` tools added to `manager_tools.py`.
- Reports are markdown-formatted (reuse the existing `renderMarkdown` frontend parser — don't invent a new format).
- Unit tests for each history/aggregation tool.

**Steps:**
1. Implement the three history tools as SQL aggregations via SQLAlchemy against `alerts_log`/`agent_actions_log`/`sales_history` (all already exist from Phase 1 — no schema decision left to make here, unlike the original draft's OQ2).
2. Add a report-formatting step: start with straight templating (cheaper, deterministic); only add an LLM narrative pass if plain tables prove insufficient.

**Definition of Done:** asking the chat agent for "last week's sales report for Dubai Marina" or "alert history this month" produces a correct, data-backed markdown report, with a passing test for the underlying aggregation logic.

---

### Phase 4 — Proactive Monitoring

**Goal:** The system notices problems without a human clicking anything.

**Deliverables:**
- `backend/scheduler.py` using APScheduler (new dependency), running an interval job.
- Job calls `get_active_alerts()`, diffs against open rows in `alerts_log`, inserts new ones, marks resolved ones (`resolved_at`) when a previously-flagged product is no longer low/expiring.
- `notify(message, severity)` stub tool — logs to console + inserts a reviewable row; real delivery channel (email/Slack) explicitly out of scope until a target exists (Section 4 non-goals).
- Test covering dedup logic (same alert doesn't get re-inserted every tick).

**Steps:**
1. Add `apscheduler` to `requirements.txt`.
2. Implement dedup logic carefully — an alert should not be re-inserted every tick while still open.
3. Start the scheduler on FastAPI app startup (lifespan handler).
4. Manually verify: adjust `SIMULATED_CURRENT_DATE` or seed data to trigger a new alert, confirm it appears once in `alerts_log` and isn't duplicated on the next tick.

**Definition of Done:** alerts appear in the log without any user action, and are answerable via chat ("what new alerts came in today?"), with the dedup test passing.

---

### Phase 5 — Persistent Memory & Sessions

**Goal:** Multi-turn conversations survive across requests and server restarts (tables already exist from Phase 1 — no new schema work here).

**Deliverables:**
- `/api/chat` loads prior turns for the given `session_id` before invoking the agent, and stores both the user message and assistant reply after, via `chat_sessions`/`chat_messages`.

**Steps:**
1. Update `/api/chat` to read/write `chat_messages` through the SQLAlchemy layer.
2. Frontend (Phase 6) generates and persists a `session_id` (e.g. `localStorage`) per browser session.

**Definition of Done:** asking a follow-up question ("what about the Downtown branch?") without repeating context works correctly after a page refresh.

---

### Phase 6 — Frontend Integration

**Goal:** Dashboard exposes the new capabilities, not just the existing CRUD/rules UI.

**Deliverables:**
- Chat panel (new component) calling `/api/chat`.
- Alerts feed reading from `alerts_log` (new `GET /api/alerts` endpoint) instead of only client-computed alerts.
- Reports view (renders markdown from the reporting tools via chat or a dedicated `/api/reports` endpoint).
- Pending-action confirm/reject UI for any `propose_transfer`/`propose_rule_change` results.

**Steps:** standard Next.js work against the new endpoints; reuse the existing dark theme in `globals.css` and the `renderMarkdown` helper in `page.tsx`.

**Definition of Done:** a user can have a full conversation, see proactive alerts appear without refreshing manually (poll or refetch), and confirm/reject a proposed transfer from the UI.

---

### Phase 7 — Final Polish & Target-Specific Deployment

**Goal:** Everything that genuinely cannot be done without a real deployment target (Section 4 non-goals notwithstanding, per OQ3 this is the only thing left deferred, and only because it's impossible to do otherwise).

**Deliverables (scope depends on the target when this phase actually starts):**
- Real hosting choice (cloud VM, PaaS, etc.), real TLS certificate, real Postgres instance (the compose Postgres from Phase 1 already proved the code works against it).
- Remove CrewAI/`agents.py`/`tasks.py`/`/api/run-audit` once Phase 2's agent has fully replaced it (per OQ1 — this is the actual cutover point, not Phase 2 itself).
- Root `README.md` rewritten with real setup instructions (currently one line — recurring gap, fixed here).
- Anything from Section 4's non-goals the user explicitly decides to pull in at this point (multi-tenant auth, real notification delivery, real supplier integration).

---

## 15. Decisions Log (resolved)

- **OQ1 — CrewAI cutover:** Keep `/api/run-audit` and CrewAI running alongside the new agent through Phase 2; only remove CrewAI in Phase 7 once the replacement is proven side by side.
- **OQ2 — Database behavior:** The database is fixed, pre-existing, external state — never recreated by the app — and must be engine-agnostic (not locked to SQLite/Postgres/MySQL). Resolved via SQLAlchemy + Alembic, detailed in Section 10.1, implemented in Phase 1.
- **OQ3 — Deployment target & deferring:** No concrete target exists yet, but the user wants completeness rather than deferred work. Resolved by pulling auth, CORS, tests, and Docker into Phase 1 as baseline requirements for every subsequent phase, rather than bucketing them into a final "hardening" phase. Only genuinely target-dependent work (real hosting, real TLS, real Postgres credentials) remains in Phase 7.

## 16. Glossary

- **LCEL** — LangChain Expression Language; the `|`-composable way to build prompt→model→parser pipelines and tool-calling loops in LangChain.
- **Tool-calling agent** — an LLM given a fixed set of callable functions (tools) and looped until it produces a final answer instead of another tool call.
- **Proposal / confirm pattern** — the two-step write safety mechanism in Section 12: agent proposes, human confirms, only then does the action execute.
