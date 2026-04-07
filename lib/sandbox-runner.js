/**
 * Sandbox worker — runs as a forked child process via lib/sandbox.ts.
 *
 * Isolation layers:
 *   1. Process boundary (fork): a crash or hang here cannot affect the parent.
 *   2. vm.runInNewContext: the generated code runs in a context with no access
 *      to require, process, fs, or any Node global.  The sandbox object passed
 *      as the context starts completely empty (Object.create(null)).
 *
 * The parent sends one IPC message: { code, functionName, testCases }.
 * This worker replies with one IPC message: TestResult[].
 *
 * A per-script compile timeout (vm option) catches infinite loops or runaway
 * code at the module level.  Per-call timeouts are applied when invoking the
 * function for each test case.
 */

'use strict'

const vm = require('vm')

const COMPILE_TIMEOUT_MS = 3000
const PER_CALL_TIMEOUT_MS = 2000

process.on('message', ({ code, functionName, testCases }) => {
  const results = runAll(code, functionName, testCases)
  // Disconnect after send so the process can exit cleanly.
  process.send(results, undefined, undefined, () => process.disconnect())
})

function runAll(code, functionName, testCases) {
  // Step 1: compile the code in an isolated vm context.
  const sandbox = Object.create(null)

  try {
    vm.runInNewContext(code, sandbox, {
      timeout: COMPILE_TIMEOUT_MS,
      filename: 'generated.js',
      // Disable access to microtask queue (Promise, queueMicrotask, etc.)
      microtaskMode: 'afterEvaluate',
    })
  } catch (err) {
    return testCases.map((testCase) => ({
      testCase,
      passed: false,
      actual: undefined,
      durationMs: 0,
      error: `Compile error: ${err.message}`,
    }))
  }

  // Step 2: locate the function.
  // vm.runInNewContext promotes `function` declarations and `var` assignments
  // onto the sandbox object.  `const`/`let` are NOT promoted — the prompt
  // explicitly asks the model to use function declarations.
  const fn = sandbox[functionName]

  if (typeof fn !== 'function') {
    const hint =
      `Function "${functionName}" was not found in the generated code. ` +
      'Ensure the model used a function declaration (function foo() {}) ' +
      'rather than const/let or arrow functions.'
    return testCases.map((testCase) => ({
      testCase,
      passed: false,
      actual: undefined,
      durationMs: 0,
      error: hint,
    }))
  }

  // Step 3: run each test case.
  return testCases.map((testCase) => {
    const start = Date.now()
    try {
      // Wrap the call in a new vm context so per-call timeout applies.
      // We pass the function reference in via the context.
      const callSandbox = Object.assign(Object.create(null), {
        __fn: fn,
        __args: testCase.args,
        __result: undefined,
      })
      vm.runInNewContext('__result = __fn(...__args)', callSandbox, {
        timeout: PER_CALL_TIMEOUT_MS,
        filename: 'test-call.js',
      })
      const actual = callSandbox.__result
      const durationMs = Date.now() - start
      const passed = deepEqual(actual, testCase.expected)
      return { testCase, passed, actual, durationMs }
    } catch (err) {
      return {
        testCase,
        passed: false,
        actual: undefined,
        durationMs: Date.now() - start,
        error: err.message,
      }
    }
  })
}

/**
 * Structural deep equality — handles primitives, arrays, and plain objects.
 * Does not handle circular references (not needed for JSON-safe test values).
 */
function deepEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false

  if (typeof a === 'object') {
    const keysA = Object.keys(a).sort()
    const keysB = Object.keys(b).sort()
    if (!deepEqual(keysA, keysB)) return false
    return keysA.every((k) => deepEqual(a[k], b[k]))
  }

  return false
}
