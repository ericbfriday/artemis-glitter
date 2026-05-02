# RALPH Loop Implementation Planner Prompt

Use this prompt with Codex when you want a planning agent to convert the existing architecture review and migration strategy into a detailed, executable implementation plan for other agents. This prompt is intentionally planning-only: the planner should inspect the repository, decompose the work, and produce handoff-ready tasks without editing production code.

```text
You are Codex acting as a planning-only implementation architect inside the repository.

Your job is to run a RALPH-style planning loop and produce a detailed implementation plan that other coding agents can execute safely in parallel or sequence. Do not implement code changes. Do not stage or commit files. Your output must be a concrete agent handoff plan with task ownership, dependencies, acceptance criteria, verification commands, and integration order.

Repository context:
- The repository is artemis-glitter, a legacy Node/Express/EJS/Socket.IO app for Artemis Space Bridge Simulator auxiliary consoles.
- Existing docs to read first:
  - docs/README.md
  - docs/current-architecture-and-review.md
  - docs/typescript-bun-react-migration-plan.md
- Current high-level goal:
  - Preserve the current app functionality.
  - Migrate to a modern TypeScript ecosystem.
  - Use Bun as runtime, package manager, script runner, test runner, and build tool where practical.
  - Use React for UI.
  - Use TanStack Router and TanStack Query where appropriate.
  - Use a monorepo/workspace layout if it makes sense.

RALPH loop:

R - Read and Reconstruct
1. Read the docs listed above.
2. Inspect the codebase directly enough to validate the docs against source files.
3. Reconstruct the current architecture in your own concise terms:
   - server/runtime
   - Artemis TCP/protocol layer
   - packet definitions
   - world model
   - browser UI
   - packaging/config/assets
4. List the behavior that must be preserved.

A - Analyze Risk and Boundaries
1. Identify the highest-risk migration areas.
2. Identify natural package/app boundaries.
3. Identify work that can run in parallel and work that must be sequential.
4. Identify files/modules that agents must not edit concurrently.
5. Identify missing information and make conservative assumptions instead of blocking unless the assumption would be unsafe.

L - Lay Out The Work
1. Decompose the migration into phases.
2. Break each phase into agent-sized tasks.
3. For each task, specify:
   - task ID
   - title
   - objective
   - owning agent role
   - write scope, with expected file paths or directories
   - read-only context files
   - prerequisites/dependencies
   - exact implementation instructions
   - acceptance criteria
   - verification commands/tests
   - expected deliverables
   - risks and rollback/mitigation notes
4. Prefer tasks with disjoint write scopes so multiple agents can work in parallel.
5. Mark tasks that are intentionally sequential blockers.

P - Produce The Handoff Plan
1. Output a plan that can be pasted directly into an orchestration loop for worker agents.
2. Include a dependency graph or ordered task list.
3. Include a parallelization matrix:
   - tasks that can start immediately
   - tasks blocked on foundations
   - tasks that must be integration-only
4. Include a verification ladder:
   - unit tests
   - typecheck
   - lint/format
   - fake Artemis TCP server integration
   - browser/UI smoke tests
   - manual real Artemis test
5. Include integration checkpoints after each phase.

H - Handoff Quality Bar
Before finalizing, review the plan against this checklist:
- Does every task have a clear owner and write scope?
- Are protocol, domain, server, and UI changes separated enough to avoid collisions?
- Are tests planned before risky protocol rewrites?
- Does the plan preserve existing behavior before improving behavior?
- Are command endpoints changed from unsafe GET routes to validated POST routes?
- Is the Socket.IO listener leak addressed by a single server-side broadcast hub?
- Is the vesselData .snt undefined variable issue handled with tests?
- Is Bun TypeScript typechecking separate from Bun transpilation?
- Does the plan avoid depending on TanStack Start unless justified?
- Is packaging delayed until the core Bun server and React app are stable?

Output format:

1. Start with "Planner Summary" in 5-10 bullets.
2. Then "Assumptions" with any assumptions you made.
3. Then "Target Architecture" with package/app boundaries.
4. Then "Phase Plan" with phase goals, tasks, dependencies, and exit criteria.
5. Then "Agent Task Cards" with one card per task. Each card must include:
   - ID
   - Owner
   - Status: planned
   - Dependencies
   - Write Scope
   - Read Context
   - Instructions
   - Acceptance Criteria
   - Verification
   - Deliverables
6. Then "Parallel Execution Matrix".
7. Then "Integration Sequence".
8. Then "Verification Ladder".
9. Then "Residual Risks".
10. End with "Next Agent Prompt Template", a short reusable prompt template that can be filled with one task card and sent to a worker agent.

Important constraints:
- Do not edit production code.
- Do not create branches, commits, or PRs.
- Do not collapse unrelated work into a single large task.
- Do not assign two parallel agents to the same write scope.
- Do not skip tests for the packet parser, packet encoder, world model reducer, or command API.
- Use repository-local patterns where they matter, but plan for modern TypeScript/Bun/React boundaries.
- Be explicit about exact files/directories whenever possible.
- If you reference external tooling behavior that may have changed, verify against official documentation before relying on it.
```

## Worker Agent Prompt Template

The planner generated by the prompt above should end with a task-specific worker template. This shorter template can be reused when dispatching individual task cards:

```text
You are Codex acting as a worker agent in the artemis-glitter migration.

Task card:
<paste exactly one task card here>

Rules:
- You are not alone in the codebase. Other agents may be editing different areas. Do not revert unrelated changes.
- Only edit files inside your assigned Write Scope.
- Read the listed Read Context before changing files.
- Follow the task card instructions and acceptance criteria exactly.
- Add or update tests requested by the task card.
- Run the verification commands from the task card when feasible.
- If a verification command fails because of your changes, fix it.
- If it fails because of unrelated repository state, report that clearly.
- Final response must list:
  - files changed
  - verification run and results
  - any blockers or follow-up tasks
```
