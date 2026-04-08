// Server-only module — never import this from a client component.
//
// Forks sandbox-runner.js as a child process, sends it the generated code and
// test cases over IPC, and resolves with the TestResult array it sends back.
//
// Two levels of protection against runaway code:
//   1. vm timeouts inside the worker (per compile + per call) — see sandbox-runner.js
//   2. A process-level kill timeout here — if the worker hasn't responded
//      within PROCESS_TIMEOUT_MS, it is forcibly killed.

import { fork } from 'child_process'
import path from 'path'
import type { TestCase, TestResult } from './types'

const WORKER_PATH = path.join(process.cwd(), 'lib', 'sandbox-runner.js')
const PROCESS_TIMEOUT_MS = 15_000

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

    const worker = fork(WORKER_PATH, [], {
      // Suppress worker stdout/stderr from appearing in the Next.js dev console.
      // Errors surface through IPC, not stdio.
      silent: true,
    })

    const timer = setTimeout(() => {
      settleReject(new Error('Sandbox process timed out after 15s'))
    }, PROCESS_TIMEOUT_MS)

    worker.on('message', (results) => settleResolve(results as TestResult[]))

    worker.on('error', (err) => settleReject(err))

    worker.on('exit', (code) => {
      // Non-zero exit without a prior message means the worker crashed.
      if (code !== 0 && code !== null) {
        settleReject(new Error(`Sandbox worker exited unexpectedly (code ${code})`))
      }
    })

    worker.send({ code, functionName, testCases })
  })
}
