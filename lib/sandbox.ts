// Server-only module — never import this from a client component.
//
// Spawns a short-lived Node.js child process to execute untrusted
// LLM-generated code in isolation.
//
// Why spawn + inline code instead of fork + external file:
//   Next.js's webpack bundler statically analyzes fork() call sites and
//   tries to bundle the referenced file at build time. An external
//   sandbox-runner.js works in local dev but breaks Vercel's build because
//   the file path can't be resolved from the build root.  Inlining the
//   worker as a string and passing it via `node -e` avoids any file-path
//   resolution entirely — nothing for the bundler to chase.
//
// Isolation layers (unchanged from the fork-based design):
//   1. Process boundary — a crash or hang in the worker cannot affect the
//      Next.js server.  The parent kills the worker after PROCESS_TIMEOUT_MS.
//   2. vm.runInNewContext inside the worker — generated code runs with no
//      access to require, process, fs, or any Node global.

import { spawn } from 'child_process'
import type { TestCase, TestResult } from './types'

const PROCESS_TIMEOUT_MS = 15_000

// ---------------------------------------------------------------------------
// Inline worker — executed by the child process via `node -e WORKER_CODE`.
// Written in CommonJS so it runs without any transpilation.
// Reads { code, functionName, testCases } as JSON from stdin.
// Writes TestResult[] as JSON to stdout.
// ---------------------------------------------------------------------------
const WORKER_CODE = `
'use strict';
const vm = require('vm');

const COMPILE_TIMEOUT_MS = 3000;
const PER_CALL_TIMEOUT_MS = 2000;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const { code, functionName, testCases } = JSON.parse(input);
    const results = runAll(code, functionName, testCases);
    process.stdout.write(JSON.stringify(results));
  } catch (err) {
    // Should never happen — runAll handles its own errors — but guard anyway.
    process.stderr.write('Worker fatal: ' + err.message);
    process.exit(1);
  }
});

function runAll(code, functionName, testCases) {
  const sandbox = Object.create(null);

  try {
    vm.runInNewContext(code, sandbox, {
      timeout: COMPILE_TIMEOUT_MS,
      filename: 'generated.js',
      microtaskMode: 'afterEvaluate',
    });
  } catch (err) {
    return testCases.map(testCase => ({
      testCase, passed: false, actual: undefined, durationMs: 0,
      error: 'Compile error: ' + err.message,
    }));
  }

  const fn = sandbox[functionName];
  if (typeof fn !== 'function') {
    const hint =
      'Function "' + functionName + '" was not found in the generated code. ' +
      'Ensure the model used a function declaration (function foo() {}) ' +
      'rather than const/let or arrow functions.';
    return testCases.map(testCase => ({
      testCase, passed: false, actual: undefined, durationMs: 0, error: hint,
    }));
  }

  return testCases.map(testCase => {
    const start = Date.now();
    try {
      const callSandbox = Object.assign(Object.create(null), {
        __fn: fn, __args: testCase.args, __result: undefined,
      });
      vm.runInNewContext('__result = __fn(...__args)', callSandbox, {
        timeout: PER_CALL_TIMEOUT_MS,
        filename: 'test-call.js',
      });
      const actual = callSandbox.__result;
      const durationMs = Date.now() - start;
      return { testCase, passed: deepEqual(actual, testCase.expected), actual, durationMs };
    } catch (err) {
      return {
        testCase, passed: false, actual: undefined,
        durationMs: Date.now() - start, error: err.message,
      };
    }
  });
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a === 'object') {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (!deepEqual(keysA, keysB)) return false;
    return keysA.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}
`

// ---------------------------------------------------------------------------

export function runTestCases(
  code: string,
  functionName: string,
  testCases: TestCase[]
): Promise<TestResult[]> {
  return new Promise((resolve, reject) => {
    let settled = false

    function settleResolve(value: TestResult[]) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { worker.kill() } catch { /* already dead */ }
      resolve(value)
    }

    function settleReject(reason: Error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { worker.kill() } catch { /* already dead */ }
      reject(reason)
    }

    // process.execPath is the Node.js binary that started this process —
    // guaranteed to exist in both local dev and Vercel's serverless runtime.
    const worker = spawn(process.execPath, ['-e', WORKER_CODE], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => {
      settleReject(new Error('Sandbox process timed out after 15s'))
    }, PROCESS_TIMEOUT_MS)

    let output = ''
    worker.stdout.on('data', (chunk: Buffer) => { output += chunk.toString() })

    worker.stdout.on('end', () => {
      try {
        settleResolve(JSON.parse(output) as TestResult[])
      } catch {
        settleReject(new Error(`Failed to parse sandbox output: ${output.slice(0, 200)}`))
      }
    })

    worker.on('error', (err) => settleReject(err))

    worker.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        settleReject(new Error(`Sandbox worker exited unexpectedly (code ${code})`))
      }
    })

    // Deliver the generated code and test cases to the worker via stdin.
    worker.stdin.write(JSON.stringify({ code, functionName, testCases }))
    worker.stdin.end()
  })
}
