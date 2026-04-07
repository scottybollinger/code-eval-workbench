// Typed definitions for all coding challenges.
//
// This is the single source of truth for what challenges exist, what prompts
// are sent to the LLM, and what test cases are used to evaluate the response.
//
// Test cases are designed to probe specific known failure modes in LLMs — not
// just "does it work on the happy path", but "does it handle the edge cases
// that distinguish a correct solution from a plausible-looking wrong one".

export type TestCase = {
  // Shown in the results UI to explain what this case is checking
  description: string
  // Arguments passed to the evaluated function (must be JSON-serializable)
  args: unknown[]
  // Expected return value, compared with deep equality
  expected: unknown
}

export type Challenge = {
  id: string
  title: string
  // Brief description of interesting failure modes, shown in the UI
  failureModeHint: string
  // Sent verbatim to the LLM
  prompt: string
  // The function name the sandbox will look for in the generated code
  functionName: string
  testCases: TestCase[]
}

export const challenges: Challenge[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    functionName: 'twoSum',
    failureModeHint: 'Probes duplicate values, negative numbers, and non-adjacent pairs',
    prompt: `Write a JavaScript function called twoSum(nums, target) that takes an array of integers nums and an integer target. Return an array containing the indices of the two numbers that add up to target. Exactly one solution exists. Return the indices in ascending order.

Requirements:
- Use a function declaration: function twoSum(nums, target) { ... }
- Do not use require, import, or module.exports
- Return only the JavaScript code, no markdown formatting or explanation`,
    testCases: [
      {
        description: 'basic case — adjacent elements',
        args: [[2, 7, 11, 15], 9],
        expected: [0, 1],
      },
      {
        description: 'solution in the middle of the array',
        args: [[3, 2, 4], 6],
        expected: [1, 2],
      },
      {
        description: 'duplicate values used as both inputs',
        args: [[3, 3], 6],
        expected: [0, 1],
      },
      {
        description: 'negative numbers',
        args: [[-1, -2, -3, -4, -5], -8],
        expected: [2, 4],
      },
      {
        description: 'non-adjacent solution in larger array',
        args: [[1, 5, 3, 8, 12, 4], 9],
        expected: [1, 5],
      },
    ],
  },

  {
    id: 'max-subarray-sum',
    title: 'Max Subarray Sum',
    functionName: 'maxSubarraySum',
    failureModeHint:
      'Classic LLM failure: returning 0 for all-negative arrays (empty subarray is not valid)',
    prompt: `Write a JavaScript function called maxSubarraySum(nums) that takes a non-empty array of integers and returns the sum of the contiguous subarray with the largest sum. The subarray must contain at least one element.

Requirements:
- Use a function declaration: function maxSubarraySum(nums) { ... }
- Do not use require, import, or module.exports
- Return only the JavaScript code, no markdown formatting or explanation`,
    testCases: [
      {
        description: 'mixed positive and negative — classic Kadane\'s input',
        args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]],
        expected: 6,
      },
      {
        description: 'all positive — entire array is the answer',
        args: [[1, 2, 3, 4, 5]],
        expected: 15,
      },
      {
        description: 'all negative — must return max element, not 0',
        args: [[-3, -1, -2]],
        expected: -1,
      },
      {
        description: 'single element',
        args: [[7]],
        expected: 7,
      },
      {
        description: 'best subarray is at the start',
        args: [[5, -9, 1, 2]],
        expected: 5,
      },
    ],
  },

  {
    id: 'longest-common-prefix',
    title: 'Longest Common Prefix',
    functionName: 'longestCommonPrefix',
    failureModeHint: 'Probes empty string inputs, single-element arrays, and fully-identical arrays',
    prompt: `Write a JavaScript function called longestCommonPrefix(strs) that takes an array of strings and returns the longest common prefix string. If there is no common prefix, return an empty string.

Requirements:
- Use a function declaration: function longestCommonPrefix(strs) { ... }
- Do not use require, import, or module.exports
- Return only the JavaScript code, no markdown formatting or explanation`,
    testCases: [
      {
        description: 'standard case with partial prefix',
        args: [['flower', 'flow', 'flight']],
        expected: 'fl',
      },
      {
        description: 'no common prefix — should return empty string',
        args: [['dog', 'racecar', 'car']],
        expected: '',
      },
      {
        description: 'single string — entire string is the prefix',
        args: [['alone']],
        expected: 'alone',
      },
      {
        description: 'empty string in array — prefix must be empty',
        args: [['', 'b', 'c']],
        expected: '',
      },
      {
        description: 'all strings identical',
        args: [['same', 'same', 'same']],
        expected: 'same',
      },
    ],
  },
]
