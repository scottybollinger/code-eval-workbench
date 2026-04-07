# code-eval-workbench

A coding evaluation workbench that presents predefined challenges to xAI's Grok model, executes the generated code against test cases in a sandboxed environment, and displays pass/fail results with timing and failure analysis.

Built as a demo for xAI's Human Data team evaluation engineering role.

---

## Architecture

```
code-eval-workbench/
├── app/
│   ├── layout.tsx                  # Root layout — html/body, fonts, metadata
│   ├── page.tsx                    # Client shell — owns all UI state
│   ├── _components/
│   │   ├── ChallengeSelector.tsx   # Challenge picker cards
│   │   ├── RunButton.tsx           # Triggers evaluation, shows loading state
│   │   ├── ResultsPanel.tsx        # Generated code + per-test pass/fail table
│   │   └── ErrorBanner.tsx         # Dismissable banner for fatal errors
│   └── api/
│       ├── challenges/route.ts     # GET  — public challenge list (no test internals)
│       └── evaluate/route.ts       # POST — full evaluation pipeline (API key stays here)
│
├── lib/
│   ├── challenges.ts               # Typed Challenge + TestCase config (single source of truth)
│   ├── types.ts                    # Shared TypeScript types
│   ├── grok.ts                     # Server-only xAI API client
│   ├── sandbox.ts                  # Server-only: forks worker, manages timeout
│   └── sandbox-runner.js           # Child process worker: vm isolation + test execution
│
├── .env.local.example              # Environment variable template
└── README.md
```

---

## Data flow

```
Browser
  │  POST /api/evaluate  { challengeId }
  ▼
app/api/evaluate/route.ts
  │
  ├─► lib/challenges.ts      look up Challenge by id
  ├─► lib/grok.ts            call xAI API → raw code string
  └─► lib/sandbox.ts         fork sandbox-runner.js
            │
            └─► lib/sandbox-runner.js  (child process)
                  │  vm.runInNewContext(code)   — compile
                  │  fn(...testCase.args)       — call per test
                  └─► IPC → TestResult[]
  │
  └─► EvaluationResult  →  ResultsPanel
```

---

## Sandbox design

Running untrusted LLM-generated code requires two layers of isolation. Using only a timeout leaves the main server process exposed. The Node.js `vm` module alone has known escape vectors. This project uses both, in series — defense in depth.

### Layer 1 — child_process.fork (process isolation)

`lib/sandbox.ts` forks `sandbox-runner.js` as a separate Node.js process via `child_process.fork`. Results are exchanged over an IPC channel. From the parent's perspective:

- **Crash isolation**: a thrown exception or segfault in the worker cannot affect the Next.js server process.
- **Kill switch**: a `setTimeout` in the parent kills the worker after `PROCESS_TIMEOUT_MS` (15s) if it hasn't responded. This catches infinite loops that survive the vm timeout.
- **stdio suppression**: the worker runs with `{ silent: true }` so its stdout/stderr don't pollute the dev console.

### Layer 2 — vm.runInNewContext (context isolation)

Inside the worker, `lib/sandbox-runner.js` runs the generated code with Node's built-in `vm` module:

```js
const sandbox = Object.create(null)  // no prototype chain, no inherited globals
vm.runInNewContext(code, sandbox, { timeout: 3000 })
```

The sandbox context intentionally contains **nothing** — no `require`, no `process`, no `Buffer`, no `setTimeout`, no `fetch`. The generated code can only use pure JavaScript language features.

A second `vm.runInNewContext` call is used per test case so the per-call timeout applies to function invocation as well:

```js
vm.runInNewContext('__result = __fn(...__args)', callSandbox, { timeout: 2000 })
```

### Why not vm alone?

The Node.js `vm` module documentation explicitly warns that it does not provide a security sandbox — a determined script can escape it (e.g. via `this.constructor.constructor`). The child process boundary is what actually enforces isolation. The vm layer adds a meaningful additional barrier and gives us granular per-call timeouts.

### Timeout hierarchy

| Layer | Timeout | What it catches |
|---|---|---|
| vm compile | 3s | Infinite loops at module-level initialization |
| vm per-call | 2s | Infinite loops in the function body |
| process kill | 15s | Anything that bypasses vm timeouts |

---

## Challenge design

Challenges are defined in `lib/challenges.ts`. Each one includes test cases specifically designed to probe known LLM failure modes — not just "does it work on the happy path."

| Challenge | Key failure mode probed |
|---|---|
| **Two Sum** | Duplicate values; negative numbers; non-adjacent solution |
| **Max Subarray Sum** | All-negative array — many models return `0` (treating empty subarray as valid) |
| **Longest Common Prefix** | Empty string in input; single-element array; no common prefix |

### Adding a new challenge

Add an entry to the `challenges` array in `lib/challenges.ts`:

```ts
{
  id: 'my-challenge',
  title: 'My Challenge',
  functionName: 'myFunc',
  failureModeHint: 'What failure mode does this probe?',
  prompt: `Write a JavaScript function called myFunc(...) ...
    Use a function declaration: function myFunc(...) { ... }
    Do not use require, import, or module.exports.
    Return only the JavaScript code.`,
  testCases: [
    { description: 'happy path', args: [...], expected: ... },
    { description: 'edge case', args: [...], expected: ... },
  ],
}
```

**Important**: prompts must instruct the model to use a `function` declaration (not `const`/arrow functions). The vm sandbox only promotes `function` declarations and `var` assignments onto the context object — `const` and `let` are block-scoped and are not accessible after `runInNewContext` returns.

---

## API routes

### `GET /api/challenges`
Returns the public challenge list. Only exposes `id`, `title`, and `failureModeHint` — test case arguments and expected values are intentionally withheld from the client.

### `POST /api/evaluate`
**Body**: `{ challengeId: string }`
**Returns**: `EvaluationResult`

Runs the full pipeline: LLM call → sandbox execution → structured results. The `XAI_API_KEY` is read server-side and never included in any response.

Both LLM errors and sandbox errors are returned as `fatalError` in the result body (HTTP 200) rather than HTTP 5xx, so the UI can always render whatever partial state exists (e.g. show the generated code even if the sandbox crashed).

---

## Setup

```bash
cp .env.local.example .env.local
# Add your XAI_API_KEY to .env.local

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `XAI_API_KEY` | Yes | xAI API key — used server-side only in `lib/grok.ts` |
