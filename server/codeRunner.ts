import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import vm from 'vm';
import { TestCase } from '../src/types/contest';

export interface ExecutionResult {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  expectedOutput?: string;
  actualOutput?: string;
  executionTimeMs: number;
  isHidden?: boolean;
  error?: string;
  status?: 'passed' | 'failed' | 'timeout' | 'runtime_error' | 'compile_error';
}

export interface RunResult {
  allPassed: boolean;
  results: ExecutionResult[];
  charCount: number;
  lineCount: number;
  compileError?: string;
  rejectionReason?: string;
}

// Default standard boilerplates
export const DEFAULT_BOILERPLATES = {
  C: {
    prefix: `#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n\nint main() {\n`,
    suffix: `\n    return 0;\n}\n`
  },
  'C++': {
    prefix: `#include <iostream>\n#include <string>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n`,
    suffix: `\n    return 0;\n}\n`
  },
  Java: {
    prefix: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n`,
    suffix: `\n    }\n}\n`
  }
};

export function getFullBoilerplate(lang: string): string {
  const normalized = normalizeLanguage(lang);
  if (normalized === 'C') {
    return `#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n\nint main() {\n    // Code here\n    return 0;\n}`;
  }
  if (normalized === 'C++') {
    return `#include <iostream>\n#include <string>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    // Code here\n    return 0;\n}`;
  }
  if (normalized === 'Java') {
    return `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Code here\n    }\n}`;
  }
  return '';
}

export function normalizeLanguage(lang: string): 'C' | 'C++' | 'Java' | 'JavaScript' | 'Python' {
  const l = (lang || '').toLowerCase().trim();
  if (l === 'c') return 'C';
  if (l === 'c++' || l === 'cpp') return 'C++';
  if (l === 'java') return 'Java';
  if (l === 'javascript' || l === 'js') return 'JavaScript';
  if (l === 'python' || l === 'py') return 'Python';
  return 'C++';
}

/**
 * Reconstructs the full source code from the participant code and the protected boilerplate
 */
export function reconstructFullCode(
  language: string,
  participantCode: string,
  customBoilerplate?: any
): string {
  const normLang = normalizeLanguage(language);
  const trimmed = (participantCode || '').trim();

  // If the participant already wrote a complete standalone program with their own entry point:
  const hasMain = normLang === 'Java'
    ? /public\s+class\s+Main/.test(trimmed) || /static\s+void\s+main\s*\(/.test(trimmed)
    : /(int|void)\s+main\s*\(/.test(trimmed) || /#include\s*</.test(trimmed);

  if (hasMain) {
    return participantCode;
  }

  // Extract boilerplate for this language if custom boilerplate is provided
  let prefix = '';
  let suffix = '';

  if (customBoilerplate) {
    const langBp = customBoilerplate[normLang] || customBoilerplate[language] || customBoilerplate;
    if (typeof langBp === 'object' && langBp !== null) {
      prefix = langBp.top || langBp.prefix || '';
      suffix = langBp.bottom || langBp.suffix || '';
    } else if (typeof langBp === 'string' && langBp.trim().length > 0) {
      if (langBp.includes('// Code here')) {
        const parts = langBp.split('// Code here');
        prefix = parts[0];
        suffix = parts.slice(1).join('// Code here');
      } else if (langBp.includes('cout << "";')) {
        const parts = langBp.split('cout << "";');
        prefix = parts[0];
        suffix = parts.slice(1).join('cout << "";');
      } else if (langBp.includes('printf("");')) {
        const parts = langBp.split('printf("");');
        prefix = parts[0];
        suffix = parts.slice(1).join('printf("");');
      } else if (langBp.includes('System.out.println("");')) {
        const parts = langBp.split('System.out.println("");');
        prefix = parts[0];
        suffix = parts.slice(1).join('System.out.println("");');
      } else {
        prefix = langBp;
      }
    }
  }

  // If no prefix/suffix found, fallback to DEFAULT_BOILERPLATES
  const bp = (normLang === 'C' || normLang === 'C++' || normLang === 'Java')
    ? DEFAULT_BOILERPLATES[normLang]
    : null;

  const finalPrefix = prefix || (bp ? bp.prefix : '');
  const finalSuffix = suffix || (bp ? bp.suffix : '');

  return `${finalPrefix}\n${participantCode}\n${finalSuffix}`;
}

/**
 * Calculates official character count: non-whitespace characters.
 * Ignores spaces, tabs, newlines, and carriage returns.
 */
export function calculateCharCount(code: string): number {
  if (!code) return 0;
  return code.replace(/\s+/g, '').length;
}

/**
 * Calculates additional characters written beyond the starting boilerplate:
 * Subtracts initial boilerplate non-whitespace characters from total non-whitespace characters.
 */
export function calculateAdditionalChars(currentCode: string, boilerplateCode?: string): number {
  const currentChars = calculateCharCount(currentCode);
  if (!boilerplateCode) return currentChars;
  const bpChars = calculateCharCount(boilerplateCode);
  return Math.max(0, currentChars - bpChars);
}

/**
 * Prepares Java source code to ensure valid class declaration for compilers
 */
export function prepareJavaSource(code: string): string {
  if (/\bclass\s+Main\b/.test(code)) {
    return code;
  }
  if (/\bpublic\s+class\s+[A-Za-z0-9_]+/.test(code)) {
    return code.replace(/\bpublic\s+class\s+[A-Za-z0-9_]+/, 'public class Main');
  }
  return code.replace(/\bclass\s+([A-Za-z0-9_]+)/, 'class Main');
}

/**
 * Checks if native compiler binary is available in system PATH
 */
export function isNativeCompilerAvailable(language: 'C' | 'C++' | 'Java' | 'Python'): boolean {
  try {
    if (language === 'C') {
      const res = spawnSync('gcc', ['--version'], { timeout: 1500, encoding: 'utf8' });
      return res.status === 0 && !res.error;
    }
    if (language === 'C++') {
      const res = spawnSync('g++', ['--version'], { timeout: 1500, encoding: 'utf8' });
      return res.status === 0 && !res.error;
    }
    if (language === 'Java') {
      const resC = spawnSync('javac', ['-version'], { timeout: 1500, encoding: 'utf8' });
      const resR = spawnSync('java', ['-version'], { timeout: 1500, encoding: 'utf8' });
      return resC.status === 0 && !resC.error && resR.status === 0 && !resR.error;
    }
    if (language === 'Python') {
      const res = spawnSync('python3', ['--version'], { timeout: 1500, encoding: 'utf8' });
      return res.status === 0 && !res.error;
    }
  } catch {
    return false;
  }
  return false;
}

// Judge0 Language ID Mapping
const JUDGE0_LANG_IDS: Record<string, number> = {
  C: 103, // GCC 14.1.0 (fallback 50)
  'C++': 105, // GCC 14.1.0 (fallback 54)
  Java: 91, // JDK 17.0.6 (fallback 62)
  Python: 100 // Python 3.12.5 (fallback 92)
};

/**
 * Cloud compilation engine using Judge0 CE (Primary high-performance cloud judge)
 */
async function executeJudge0(
  language: 'C' | 'C++' | 'Java' | 'Python',
  fullCode: string,
  testCases: TestCase[],
  timeLimitMs: number = 3000
): Promise<{
  compileSuccess: boolean;
  compileError?: string;
  results: ExecutionResult[];
}> {
  const langId = JUDGE0_LANG_IDS[language] || 105;
  const sourceCode = language === 'Java' ? prepareJavaSource(fullCode) : fullCode;
  const timeoutSec = Math.max(3, Math.ceil(timeLimitMs / 1000) + 1);

  // Run test cases in parallel for fast response
  const promises = testCases.map(async (tc, idx) => {
    const startTime = Date.now();
    try {
      const res = await fetch('https://ce.judge0.com/submissions?wait=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: sourceCode,
          language_id: langId,
          stdin: tc.input || '',
          cpu_time_limit: timeoutSec
        }),
        signal: AbortSignal.timeout((timeoutSec + 6) * 1000)
      });

      if (!res.ok) {
        throw new Error(`Judge0 responded with status ${res.status}`);
      }

      const data = await res.json();
      const execTime = data.time ? Math.round(parseFloat(data.time) * 1000) : (Date.now() - startTime);

      // Status 6 = Compilation Error
      if (data.status?.id === 6 || (data.compile_output && data.status?.id !== 3)) {
        return {
          isCompileError: true,
          compileError: (data.compile_output || data.message || 'Compilation Error').trim(),
          result: null
        };
      }

      const rawStdout = data.stdout || '';
      const cleanExpected = (tc.expectedOutput || '').trim();
      const cleanActual = rawStdout.trim();

      let status: 'passed' | 'failed' | 'timeout' | 'runtime_error' = 'passed';
      let errorMsg: string | undefined;

      if (data.status?.id === 5) {
        status = 'timeout';
        errorMsg = 'Time Limit Exceeded';
      } else if (data.status?.id >= 7) {
        status = 'runtime_error';
        errorMsg = (data.stderr || data.message || `Runtime error: ${data.status?.description || 'Error'}`).trim();
      } else if (cleanActual !== cleanExpected) {
        status = 'failed';
      }

      const passed = status === 'passed';

      const executionResult: ExecutionResult = {
        passed,
        input: tc.isHidden ? '[HIDDEN TEST CASE]' : tc.input,
        expected: tc.isHidden ? '[HIDDEN]' : cleanExpected,
        expectedOutput: tc.isHidden ? '[HIDDEN]' : cleanExpected,
        actual: tc.isHidden ? (passed ? '[PASSED]' : '[FAILED]') : cleanActual,
        actualOutput: tc.isHidden ? (passed ? '[PASSED]' : '[FAILED]') : cleanActual,
        executionTimeMs: execTime,
        isHidden: tc.isHidden,
        error: tc.isHidden ? (passed ? undefined : (status === 'timeout' ? 'Time Limit Exceeded' : 'Wrong Answer or Runtime Error')) : errorMsg,
        status
      };

      return {
        isCompileError: false,
        result: executionResult
      };
    } catch (err: any) {
      throw err;
    }
  });

  const settled = await Promise.all(promises);

  const compErr = settled.find(s => s.isCompileError);
  if (compErr) {
    return {
      compileSuccess: false,
      compileError: compErr.compileError,
      results: []
    };
  }

  return {
    compileSuccess: true,
    results: settled.map(s => s.result!).filter(Boolean)
  };
}

/**
 * Cloud compilation engine using Wandbox API (Secondary cloud fallback)
 */
async function executeWandbox(
  language: 'C' | 'C++' | 'Java' | 'Python',
  fullCode: string,
  testCases: TestCase[],
  timeLimitMs: number = 3000
): Promise<{
  compileSuccess: boolean;
  compileError?: string;
  results: ExecutionResult[];
}> {
  const compiler = language === 'Java'
    ? 'openjdk-jdk-22+36'
    : (language === 'Python' ? 'cpython-head' : (language === 'C' ? 'gcc-head-c' : 'gcc-head'));

  let adjustedCode = fullCode;
  if (language === 'Java') {
    adjustedCode = prepareJavaSource(fullCode).replace(/\bpublic\s+class\b/g, 'class');
  }

  const timeoutSec = Math.max(6, Math.ceil(timeLimitMs / 1000) + 3);

  const promises = testCases.map(async (tc) => {
    const startTime = Date.now();
    const payload = JSON.stringify({
      compiler,
      code: adjustedCode,
      stdin: tc.input || '',
      compiler_options: language === 'C++' ? '-std=c++17 -O2' : (language === 'C' ? '-O2 -lm' : undefined)
    });

    const res = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout((timeoutSec + 4) * 1000)
    });

    if (!res.ok) {
      throw new Error(`Wandbox returned HTTP ${res.status}`);
    }

    const resp = await res.json();
    const statusNum = Number(resp.status);
    const compileErr = (resp.compiler_error || resp.compiler_message || '').trim();

    if (statusNum !== 0 && compileErr && !resp.program_output) {
      return {
        isCompileError: true,
        compileError: compileErr,
        result: null
      };
    }

    const rawStdout = resp.program_output || '';
    const execTime = Date.now() - startTime;
    const cleanExpected = (tc.expectedOutput || '').trim();
    const cleanActual = rawStdout.trim();

    let status: 'passed' | 'failed' | 'timeout' | 'runtime_error' = 'passed';
    let errorMsg: string | undefined;

    if (resp.signal === 'SIGKILL' || resp.signal === 'SIGXCPU' || resp.program_message?.includes('Time limit') || resp.program_message?.includes('CPUTIME')) {
      status = 'timeout';
      errorMsg = 'Time Limit Exceeded';
    } else if (statusNum !== 0 && !compileErr) {
      status = 'runtime_error';
      errorMsg = (resp.program_error || `Exit code ${statusNum}`).trim();
    } else if (cleanActual !== cleanExpected) {
      status = 'failed';
    }

    const passed = status === 'passed';

    const result: ExecutionResult = {
      passed,
      input: tc.isHidden ? '[HIDDEN TEST CASE]' : tc.input,
      expected: tc.isHidden ? '[HIDDEN]' : cleanExpected,
      expectedOutput: tc.isHidden ? '[HIDDEN]' : cleanExpected,
      actual: tc.isHidden ? (passed ? '[PASSED]' : '[FAILED]') : cleanActual,
      actualOutput: tc.isHidden ? (passed ? '[PASSED]' : '[FAILED]') : cleanActual,
      executionTimeMs: execTime,
      isHidden: tc.isHidden,
      error: tc.isHidden ? (passed ? undefined : (status === 'timeout' ? 'Time Limit Exceeded' : 'Wrong Answer or Runtime Error')) : errorMsg,
      status
    };

    return {
      isCompileError: false,
      result
    };
  });

  const settled = await Promise.all(promises);
  const compErr = settled.find(s => s.isCompileError);
  if (compErr) {
    return {
      compileSuccess: false,
      compileError: compErr.compileError,
      results: []
    };
  }

  return {
    compileSuccess: true,
    results: settled.map(s => s.result!).filter(Boolean)
  };
}

/**
 * Universal Cloud Compiler Engine with automatic redundant failover
 * Ensures C, C++, and Java compile and run reliably in published Cloud Run environments
 */
async function executeCloudCode(
  language: 'C' | 'C++' | 'Java' | 'Python',
  fullCode: string,
  testCases: TestCase[],
  timeLimitMs: number = 3000
): Promise<{
  compileSuccess: boolean;
  compileError?: string;
  results: ExecutionResult[];
}> {
  // 1. Try Primary Cloud Runner: Judge0 CE
  try {
    const j0 = await executeJudge0(language, fullCode, testCases, timeLimitMs);
    if (j0.compileSuccess || (j0.compileError && !j0.compileError.includes('responded with status') && !j0.compileError.includes('failed to fetch'))) {
      return j0;
    }
  } catch (err: any) {
    console.warn(`[Judge0] Cloud execution unavailable (${err?.message}), falling back to Wandbox...`);
  }

  // 2. Try Secondary Cloud Runner: Wandbox
  try {
    const wb = await executeWandbox(language, fullCode, testCases, timeLimitMs);
    if (wb.compileSuccess || wb.compileError) {
      return wb;
    }
  } catch (err: any) {
    console.warn(`[Wandbox] Cloud execution unavailable (${err?.message})`);
  }

  return {
    compileSuccess: false,
    compileError: 'Online compiler runner is temporarily synchronizing. Please retry your submission in a moment.',
    results: []
  };
}

/**
 * Native execution for C, C++, Java, and Python in isolated temporary sandbox
 */
function executeNativeCode(
  language: 'C' | 'C++' | 'Java' | 'Python',
  fullCode: string,
  testCases: TestCase[],
  timeLimitMs: number = 2000
): {
  compileSuccess: boolean;
  compileError?: string;
  results: ExecutionResult[];
} {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `judge-${Date.now()}-`));
  const results: ExecutionResult[] = [];

  try {
    let executablePath = '';
    let runCommand = '';
    let runArgs: string[] = [];

    // 1. Compilation phase
    if (language === 'C') {
      const srcFile = path.join(tempDir, 'solution.c');
      executablePath = path.join(tempDir, 'solution');
      fs.writeFileSync(srcFile, fullCode, 'utf8');

      const compileProc = spawnSync('gcc', ['-O2', srcFile, '-o', executablePath, '-lm'], {
        timeout: 6000,
        encoding: 'utf8'
      });

      if (compileProc.status !== 0 || compileProc.error) {
        const isMissing = (compileProc.error as any)?.code === 'ENOENT' ||
          compileProc.status === 127 ||
          (compileProc.stderr && (
            compileProc.stderr.includes('not found') ||
            compileProc.stderr.includes('No such file') ||
            compileProc.stderr.includes('command not found')
          ));
        return {
          compileSuccess: false,
          compileError: isMissing
            ? '__COMPILER_NOT_AVAILABLE__'
            : (compileProc.stderr || compileProc.error?.message || 'C Compilation Failed'),
          results: []
        };
      }
      runCommand = executablePath;
      runArgs = [];
    } else if (language === 'C++') {
      const srcFile = path.join(tempDir, 'solution.cpp');
      executablePath = path.join(tempDir, 'solution');
      fs.writeFileSync(srcFile, fullCode, 'utf8');

      const compileProc = spawnSync('g++', ['-O2', '-std=c++17', srcFile, '-o', executablePath], {
        timeout: 6000,
        encoding: 'utf8'
      });

      if (compileProc.status !== 0 || compileProc.error) {
        const isMissing = (compileProc.error as any)?.code === 'ENOENT' ||
          compileProc.status === 127 ||
          (compileProc.stderr && (
            compileProc.stderr.includes('not found') ||
            compileProc.stderr.includes('No such file') ||
            compileProc.stderr.includes('command not found')
          ));
        return {
          compileSuccess: false,
          compileError: isMissing
            ? '__COMPILER_NOT_AVAILABLE__'
            : (compileProc.stderr || compileProc.error?.message || 'C++ Compilation Failed'),
          results: []
        };
      }
      runCommand = executablePath;
      runArgs = [];
    } else if (language === 'Java') {
      const srcFile = path.join(tempDir, 'Main.java');
      const javaSource = prepareJavaSource(fullCode);
      fs.writeFileSync(srcFile, javaSource, 'utf8');

      const compileProc = spawnSync('javac', [srcFile], {
        timeout: 8000,
        encoding: 'utf8'
      });

      if (compileProc.status !== 0 || compileProc.error) {
        const isMissing = (compileProc.error as any)?.code === 'ENOENT' ||
          compileProc.status === 127 ||
          (compileProc.stderr && (
            compileProc.stderr.includes('not found') ||
            compileProc.stderr.includes('No such file') ||
            compileProc.stderr.includes('command not found')
          ));
        return {
          compileSuccess: false,
          compileError: isMissing
            ? '__COMPILER_NOT_AVAILABLE__'
            : (compileProc.stderr || compileProc.error?.message || 'Java Compilation Failed'),
          results: []
        };
      }
      runCommand = 'java';
      runArgs = ['-client', '-XX:+TieredCompilation', '-XX:TieredStopAtLevel=1', '-Xmx128m', '-cp', tempDir, 'Main'];
    } else if (language === 'Python') {
      const srcFile = path.join(tempDir, 'solution.py');
      fs.writeFileSync(srcFile, fullCode, 'utf8');
      runCommand = 'python3';
      runArgs = [srcFile];
    }

    // 2. Execution phase across test cases
    for (const tc of testCases) {
      const startTime = Date.now();
      const execProc = spawnSync(runCommand, runArgs, {
        input: tc.input || '',
        timeout: timeLimitMs,
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024
      });

      const execTime = Date.now() - startTime;
      let status: 'passed' | 'failed' | 'timeout' | 'runtime_error' = 'passed';
      let errorMsg: string | undefined;

      if (execProc.error) {
        if ((execProc.error as any).code === 'ENOENT') {
          return {
            compileSuccess: false,
            compileError: '__COMPILER_NOT_AVAILABLE__',
            results: []
          };
        }
        if ((execProc.error as any).code === 'ETIMEDOUT') {
          status = 'timeout';
          errorMsg = 'Time Limit Exceeded';
        } else {
          status = 'runtime_error';
          errorMsg = execProc.error.message;
        }
      } else if (execProc.status !== 0) {
        status = 'runtime_error';
        errorMsg = execProc.stderr ? execProc.stderr.trim() : `Process exited with code ${execProc.status}`;
      }

      const cleanExpected = (tc.expectedOutput || '').trim();
      const cleanActual = (execProc.stdout || '').trim();

      const isMatch = cleanActual === cleanExpected;
      const passed = status === 'passed' && isMatch;
      if (status === 'passed' && !isMatch) {
        status = 'failed';
      }

      results.push({
        passed,
        input: tc.isHidden ? '[HIDDEN TEST CASE]' : tc.input,
        expected: tc.isHidden ? '[HIDDEN]' : cleanExpected,
        expectedOutput: tc.isHidden ? '[HIDDEN]' : cleanExpected,
        actual: tc.isHidden ? (passed ? '[PASSED]' : '[FAILED]') : cleanActual,
        actualOutput: tc.isHidden ? (passed ? '[PASSED]' : '[FAILED]') : cleanActual,
        executionTimeMs: execTime,
        isHidden: tc.isHidden,
        error: tc.isHidden ? (passed ? undefined : (status === 'timeout' ? 'Time Limit Exceeded' : 'Wrong Answer or Runtime Error')) : errorMsg,
        status
      });
    }

    return {
      compileSuccess: true,
      results
    };
  } catch (err: any) {
    return {
      compileSuccess: false,
      compileError: err.message || 'Execution failed',
      results: []
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Universal compiler runner with automatic fallbacks:
 * 1. Native execution if toolchain is installed and functional
 * 2. Cloud compiler execution (Judge0 CE / Wandbox) if native toolchain is not available
 */
export async function executeCompiledCode(
  language: 'C' | 'C++' | 'Java' | 'Python',
  fullCode: string,
  testCases: TestCase[],
  timeLimitMs: number = 2000
): Promise<{
  compileSuccess: boolean;
  compileError?: string;
  results: ExecutionResult[];
}> {
  const hasNative = isNativeCompilerAvailable(language);

  if (hasNative) {
    try {
      const nativeRes = executeNativeCode(language, fullCode, testCases, timeLimitMs);
      if (nativeRes.compileSuccess) {
        return nativeRes;
      }
      // If native execution produced actual user syntax error, return it directly
      if (nativeRes.compileError &&
          nativeRes.compileError !== '__COMPILER_NOT_AVAILABLE__' &&
          !nativeRes.compileError.includes('not available') &&
          !nativeRes.compileError.includes('not found')) {
        return nativeRes;
      }
    } catch (e) {
      console.warn(`[NativeExecution] Failed for ${language}, falling back to cloud:`, e);
    }
  }

  // Fallback to Cloud Compiler Engine (ensures C, C++, and Java work reliably on published Cloud Run containers)
  return await executeCloudCode(language, fullCode, testCases, Math.max(3000, timeLimitMs));
}

/**
 * Evaluates JavaScript code inside VM sandbox
 */
function runJavaScriptSandbox(
  code: string,
  input: string,
  timeoutMs: number = 2000
): { output: string; executionTimeMs: number; error?: string } {
  const startTime = Date.now();
  let capturedOutput = '';

  const sandbox = {
    console: {
      log: (...args: any[]) => {
        capturedOutput += args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n';
      },
      error: (...args: any[]) => {
        capturedOutput += args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n';
      }
    },
    input: input.trim(),
    lines: input.trim().split('\n'),
    fs: undefined,
    process: undefined
  };

  try {
    const context = vm.createContext(sandbox);
    const wrappedCode = `(function() { ${code} })();`;
    const script = new vm.Script(wrappedCode);
    script.runInContext(context, { timeout: timeoutMs });
    return { output: capturedOutput.trim(), executionTimeMs: Date.now() - startTime };
  } catch (err: any) {
    return { output: capturedOutput.trim(), executionTimeMs: Date.now() - startTime, error: err.message || String(err) };
  }
}

/**
 * Main code runner function for Round 3
 */
export async function executeCode(
  language: string,
  code: string,
  testCases: TestCase[],
  prohibitedKeywords: string[] = [],
  participantCodeOnly?: string,
  timeLimitSeconds: number = 2,
  customBoilerplate?: any,
  initialBoilerplate?: string
): Promise<RunResult> {
  const normLang = normalizeLanguage(language);

  // Character count calculation:
  // If initialBoilerplate is provided, subtract initial boilerplate characters from total characters!
  let charCount = 0;
  if (initialBoilerplate) {
    charCount = calculateAdditionalChars(code, initialBoilerplate);
  } else if (participantCodeOnly !== undefined && participantCodeOnly !== code) {
    charCount = calculateCharCount(participantCodeOnly);
  } else {
    charCount = calculateCharCount(code);
  }

  const codeForLineCount = participantCodeOnly !== undefined ? participantCodeOnly : code;
  const lineCount = codeForLineCount.split('\n').filter(l => l.trim().length > 0).length;

  // Check prohibited keywords in participant code
  for (const kw of prohibitedKeywords) {
    if (kw && new RegExp(`\\b${kw}\\b`, 'i').test(codeForLineCount)) {
      return {
        allPassed: false,
        results: [],
        charCount,
        lineCount,
        rejectionReason: `Prohibited keyword detected: "${kw}". Code rejected.`
      };
    }
  }

  // If language is C, C++, Java, or Python, execute with native compiler / interpreter
  if (normLang === 'C' || normLang === 'C++' || normLang === 'Java' || normLang === 'Python') {
    // If code already contains full program, use code directly; otherwise reconstruct
    const fullSource = (normLang === 'Python' || code.includes('main(') || code.includes('Main'))
      ? code
      : reconstructFullCode(normLang, codeForLineCount, customBoilerplate);

    const exec = await executeCompiledCode(normLang, fullSource, testCases, Math.max(1000, timeLimitSeconds * 1000));

    if (!exec.compileSuccess) {
      return {
        allPassed: false,
        results: [],
        charCount,
        lineCount,
        compileError: exec.compileError
      };
    }

    const allPassed = exec.results.length > 0 && exec.results.every(r => r.passed);
    return {
      allPassed,
      results: exec.results,
      charCount,
      lineCount
    };
  }

  // Fallback for JavaScript
  const results: ExecutionResult[] = [];
  let allPassed = true;

  for (const tc of testCases) {
    const exec = runJavaScriptSandbox(code, tc.input);
    const cleanExpected = tc.expectedOutput.trim();
    const cleanActual = exec.output.trim();
    const passed = !exec.error && cleanActual === cleanExpected;

    if (!passed) allPassed = false;

    results.push({
      passed,
      input: tc.isHidden ? '[HIDDEN TEST CASE]' : tc.input,
      expected: tc.isHidden ? '[HIDDEN]' : cleanExpected,
      expectedOutput: tc.isHidden ? '[HIDDEN]' : cleanExpected,
      actual: tc.isHidden ? (passed ? '[PASSED]' : '[FAILED]') : cleanActual,
      actualOutput: tc.isHidden ? (passed ? '[PASSED]' : '[FAILED]') : cleanActual,
      executionTimeMs: exec.executionTimeMs,
      isHidden: tc.isHidden,
      error: tc.isHidden ? (passed ? undefined : 'Test Failed') : exec.error
    });
  }

  return {
    allPassed,
    results,
    charCount,
    lineCount
  };
}
