import React, { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CodingProblem, CodeSubmission, ContestState } from '../../types/contest';
import {
  Play,
  Send,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  Terminal,
  Layers,
  History,
  Info,
  Check,
  Cpu,
  ShieldCheck
} from 'lucide-react';

interface Round3CodeViewProps {
  stageData: any;
  contestState: ContestState;
  onRefresh: () => void;
}

export const Round3CodeView: React.FC<Round3CodeViewProps> = ({
  stageData,
  contestState,
  onRefresh
}) => {
  const { token, previewTeamId } = useAuth();

  // Problems list & Submissions
  const problems: CodingProblem[] = useMemo(() => {
    return stageData?.problems || (stageData?.codingProblem ? [stageData.codingProblem] : []);
  }, [stageData]);

  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [language, setLanguage] = useState<'C' | 'C++' | 'Java'>('C++');

  // Code state per problem & language
  const [codeMap, setCodeMap] = useState<Record<string, Record<string, string>>>({});
  
  // Execution state
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<CodeSubmission | null>(null);

  // Submissions drawer
  const [showHistory, setShowHistory] = useState(false);

  // Initialize selected problem
  useEffect(() => {
    if (problems.length > 0) {
      if (!selectedProblemId || !problems.find(p => p.id === selectedProblemId)) {
        setSelectedProblemId(problems[0].id);
      }
    }
  }, [problems, selectedProblemId]);

  const activeProblem = useMemo(() => {
    return problems.find(p => p.id === selectedProblemId) || problems[0] || null;
  }, [problems, selectedProblemId]);

  // Resolve starting boilerplate template for active problem and language
  const initialBoilerplate = useMemo(() => {
    if (!activeProblem) return '';
    const rawBp = (activeProblem.boilerplates as any)?.[language];
    if (typeof rawBp === 'string' && rawBp.trim().length > 0) {
      return rawBp;
    }
    if (typeof rawBp === 'object' && rawBp !== null) {
      const p = rawBp.top || rawBp.prefix || '';
      const s = rawBp.bottom || rawBp.suffix || '';
      return `${p}\n    // Write your code here\n${s}`;
    }
    if (language === 'C') {
      return `#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n\nint main() {\n    char s[1005];\n    if (scanf("%s", s) == 1) {\n        // Code here\n    }\n    return 0;\n}`;
    }
    if (language === 'C++') {
      return `#include <iostream>\n#include <string>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    string s;\n    if (cin >> s) {\n        // Code here\n    }\n    return 0;\n}`;
    }
    return `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNext()) {\n            String s = sc.next();\n            // Code here\n        }\n    }\n}`;
  }, [activeProblem, language]);

  // Current code in editor: initialized from boilerplate if untouched
  const currentCode = (activeProblem && codeMap[activeProblem.id]?.[language]) ?? initialBoilerplate;

  const handleCodeChange = (newCode: string) => {
    if (!activeProblem) return;
    setCodeMap(prev => ({
      ...prev,
      [activeProblem.id]: {
        ...(prev[activeProblem.id] || {}),
        [language]: newCode
      }
    }));
  };

  const handleResetToBoilerplate = () => {
    if (!activeProblem) return;
    handleCodeChange(initialBoilerplate);
  };

  // Character calculation:
  // Initial boilerplate non-whitespace characters
  const initialBoilerplateChars = useMemo(() => {
    return initialBoilerplate.replace(/\s+/g, '').length;
  }, [initialBoilerplate]);

  // Current total non-whitespace characters
  const totalCodeChars = useMemo(() => {
    return currentCode.replace(/\s+/g, '').length;
  }, [currentCode]);

  // Additional characters written beyond initial boilerplate (displayed at top)
  const additionalChars = useMemo(() => {
    return Math.max(0, totalCodeChars - initialBoilerplateChars);
  }, [totalCodeChars, initialBoilerplateChars]);

  const lineCount = useMemo(() => {
    return currentCode.split('\n').length;
  }, [currentCode]);

  // Submissions for this team
  const submissions: CodeSubmission[] = stageData?.submissions || [];
  const currentProblemSubmissions = useMemo(() => {
    if (!activeProblem) return [];
    return submissions.filter(s => s.problemId === activeProblem.id);
  }, [submissions, activeProblem]);

  // Solved status map
  const solvedMap = stageData?.solvedStatus || {};

  // Check if current problem is solved
  const isCurrentProblemSolved = activeProblem ? Boolean(solvedMap[activeProblem.id]?.solved) : false;

  // Auto-scroll into view when compilation or execution error occurs
  useEffect(() => {
    if (compileError) {
      const el = document.getElementById('compiler-error-box');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [compileError]);

  // Run Sample / Visible Tests
  const handleRunSampleTests = async () => {
    if (!token || !activeProblem || isRunningTests) return;
    setIsRunningTests(true);
    setTestResults(null);
    setCompileError(null);
    setExecutionMessage(null);

    try {
      const res = await api.runCode(token, {
        problemId: activeProblem.id,
        code: currentCode,
        participantCode: currentCode,
        language
      }, previewTeamId);

      if (res.success) {
        setTestResults(res.results || res.testResults || []);
        if (res.compileError) {
          setCompileError(res.compileError);
          setExecutionMessage('Compilation failed. See compiler output below.');
        } else if (res.allPassed) {
          setCompileError(null);
          setExecutionMessage(`All sample test cases passed! (+${res.charCount ?? additionalChars} additional chars)`);
        } else {
          setCompileError(null);
          setExecutionMessage('Some sample test cases failed. Review test outputs below.');
        }
      } else {
        const errorDetail = res.compileError || res.error || res.message || 'Execution error';
        setCompileError(errorDetail);
        setExecutionMessage(res.message || 'Execution error. See compiler error box below.');
      }
    } catch (err: any) {
      const errorDetail = err.message || 'Error running sample tests';
      setCompileError(errorDetail);
      setExecutionMessage(errorDetail);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Submit Solution (Full evaluation including hidden testcases)
  const handleSubmitSolution = async () => {
    if (!token || !activeProblem || isSubmitting) return;
    setIsSubmitting(true);
    setTestResults(null);
    setCompileError(null);
    setExecutionMessage(null);

    try {
      const res = await api.submitCode(token, {
        problemId: activeProblem.id,
        code: currentCode,
        participantCode: currentCode,
        language
      }, previewTeamId);

      if (res.success) {
        setLatestSubmission(res.submission);
        setTestResults(res.testResults || res.results || res.submission?.testResults || []);
        if (res.compileError) {
          setCompileError(res.compileError);
          setExecutionMessage('Compile Error: Solution failed to build. See compiler output below.');
        } else if (res.isAccepted) {
          setCompileError(null);
          setExecutionMessage(`ACCEPTED! Solution passed all test cases! Score: ${res.score} pts (+${res.charCount ?? additionalChars} additional chars)`);
        } else {
          setCompileError(null);
          setExecutionMessage('Submission evaluated. Some test cases failed.');
        }
        onRefresh();
      } else {
        const errorDetail = res.compileError || res.error || res.message || 'Submission failed';
        setCompileError(errorDetail);
        setExecutionMessage(res.message || 'Submission failed. See compiler error box below.');
      }
    } catch (err: any) {
      const errorDetail = err.message || 'Error submitting solution';
      setCompileError(errorDetail);
      setExecutionMessage(errorDetail);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard Shortcuts: Ctrl + ' for Run, Ctrl + Enter for Submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (!isCmdOrCtrl) return;

      if (e.key === "'" || e.key === '"' || e.code === 'Quote') {
        e.preventDefault();
        if (!isRunningTests && !isSubmitting) {
          handleRunSampleTests();
        }
      } else if (e.key === 'Enter' || e.code === 'Enter') {
        e.preventDefault();
        if (!isRunningTests && !isSubmitting) {
          handleSubmitSolution();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunningTests, isSubmitting, currentCode, activeProblem, language]);

  if (!activeProblem || problems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
        <Cpu className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
        <h3 className="text-lg font-bold text-white mb-1">No Active Coding Problems</h3>
        <p className="text-sm text-slate-400 max-w-md">
          Coding challenges will appear here once configured and enabled by the contest administrator.
        </p>
      </div>
    );
  }

  const monacoLang = language === 'C++' ? 'cpp' : language === 'C' ? 'c' : 'java';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Banner & Timer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-wide">Round 3: Code Minimalist</h1>
              <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-mono uppercase font-bold">
                Live Challenge
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Solve algorithmic problems with minimal additional code. Initial boilerplate does not count towards your score.
            </p>
          </div>
        </div>

        {/* Global Timer & Solved Counter */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block leading-none">Remaining</span>
              <span className="font-mono font-black text-sm text-amber-300">
                {Math.floor((contestState.timer?.remainingSeconds || 0) / 60)}:
                {String((contestState.timer?.remainingSeconds || 0) % 60).padStart(2, '0')}
              </span>
            </div>
          </div>

          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-right">
            <span className="text-[10px] text-slate-500 uppercase font-bold block leading-none">Solved</span>
            <span className="font-mono font-black text-sm text-emerald-400">
              {Object.values(solvedMap).filter((s: any) => s.solved).length} / {problems.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Problem Navigation Tab (4 Cols) + Right Editor Workspace (8 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Problems List Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Challenge Problems ({problems.length})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Select to code</span>
            </div>

            <div className="space-y-2">
              {problems.map((prob, idx) => {
                const isSelected = prob.id === activeProblem.id;
                const status = solvedMap[prob.id];
                const isSolved = Boolean(status?.solved);
                const attempts = submissions.filter(s => s.problemId === prob.id).length;

                return (
                  <button
                    key={prob.id}
                    onClick={() => {
                      setSelectedProblemId(prob.id);
                      setTestResults(null);
                      setCompileError(null);
                      setExecutionMessage(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-black shrink-0 ${
                          isSolved
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : attempts > 0
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        #{prob.problemNumber || idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{prob.title}</div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>{prob.points || 100} pts</span>
                          <span>•</span>
                          <span
                            className={
                              prob.difficulty === 'Easy'
                                ? 'text-emerald-400'
                                : prob.difficulty === 'Hard'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }
                          >
                            {prob.difficulty || 'Medium'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isSolved ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold">
                          <Check className="w-3 h-3" /> +{status.bestChars}c
                        </span>
                      ) : attempts > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 text-[10px] font-mono">
                          {attempts} att
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">Unsolved</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Problem Details Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" /> Problem Specifications
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                Time: {activeProblem.timeLimitSeconds || 2}s
              </span>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-2">
              <p className="font-medium text-slate-200">
                {activeProblem.description || activeProblem.statement}
              </p>

              {activeProblem.inputFormat && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Input Format</span>
                  <span className="text-[11px] font-mono text-slate-300">{activeProblem.inputFormat}</span>
                </div>
              )}

              {activeProblem.outputFormat && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Output Format</span>
                  <span className="text-[11px] font-mono text-slate-300">{activeProblem.outputFormat}</span>
                </div>
              )}

              {activeProblem.constraints && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Constraints</span>
                  <span className="text-[11px] font-mono text-slate-300">{activeProblem.constraints}</span>
                </div>
              )}
            </div>

            {/* Sample Testcases */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Sample Test Cases (Visible)</span>
              {(activeProblem.visibleTestCases || activeProblem.sampleTestCases || []).map((tc, idx) => (
                <div key={tc.id || idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono space-y-1">
                  <div className="text-slate-400">
                    Input: <span className="text-white font-bold">{tc.input}</span>
                  </div>
                  <div className="text-emerald-400">
                    Output: <span className="font-bold">{tc.expectedOutput}</span>
                  </div>
                  {tc.explanation && (
                    <div className="text-[10px] text-slate-500 italic mt-0.5">{tc.explanation}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Code Editor & Submission Workspace (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Editor Header Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-indigo-400">
                  Problem #{activeProblem.problemNumber || 1}
                </span>
                <h2 className="text-sm sm:text-base font-bold text-white">{activeProblem.title}</h2>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['C', 'C++', 'Java'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      language === lang
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Character Counting Metric: ONLY Additional Characters displayed on top */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs">
              <div className="flex items-center gap-5">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">
                    Additional Characters Written
                  </span>
                  <span className="font-mono font-black text-xl text-amber-400">
                    +{additionalChars} <span className="text-xs font-normal text-slate-400">chars</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Lines</span>
                  <span className="font-mono font-bold text-base text-slate-300">{lineCount}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/60">
                  <ShieldCheck className="w-3.5 h-3.5" /> Boilerplate subtracted
                </span>
                <button
                  onClick={handleResetToBoilerplate}
                  title="Reset editor back to initial starter boilerplate"
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
            </div>

            {/* Monaco Code Editor */}
            <div className="space-y-1">
              <div className="rounded-xl overflow-hidden border border-indigo-500/40 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 bg-[#1e1e1e]">
                <Editor
                  height="420px"
                  language={monacoLang}
                  theme="vs-dark"
                  value={currentCode}
                  onChange={(val) => handleCodeChange(val || '')}
                  options={{
                    fontSize: 13,
                    lineNumbers: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    tabSize: 4,
                    insertSpaces: true,
                    automaticLayout: true,
                    wordWrap: 'on',
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    lineHeight: 20
                  }}
                />
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <History className="w-3.5 h-3.5" /> Submissions ({currentProblemSubmissions.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Run Sample Tests */}
                <button
                  onClick={handleRunSampleTests}
                  disabled={isRunningTests || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                  title="Run Sample Tests (Ctrl + ')"
                >
                  <Play className={`w-3.5 h-3.5 text-emerald-400 ${isRunningTests ? 'animate-spin' : ''}`} />
                  <span>{isRunningTests ? 'Evaluating...' : 'Run Sample Tests'}</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 border border-slate-700 rounded text-slate-400">Ctrl + '</kbd>
                </button>

                {/* Submit Solution */}
                <button
                  onClick={handleSubmitSolution}
                  disabled={isSubmitting || isRunningTests}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/30 cursor-pointer transition-colors"
                  title="Submit Solution (Ctrl + Enter)"
                >
                  <Send className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-bounce' : ''}`} />
                  <span>{isSubmitting ? 'Judging Full Suite...' : 'Submit Solution'}</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-indigo-950 border border-indigo-400/40 rounded text-indigo-200">Ctrl + ↵</kbd>
                </button>
              </div>
            </div>
          </div>

          {/* Execution Message & Notification */}
          {executionMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-1 ${
                executionMessage.includes('ACCEPTED')
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : executionMessage.includes('Compile') || executionMessage.includes('failed')
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {executionMessage.includes('ACCEPTED') ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : executionMessage.includes('Compile') ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                ) : (
                  <Terminal className="w-4 h-4 text-indigo-400" />
                )}
                <span>{executionMessage}</span>
              </div>
              <button onClick={() => setExecutionMessage(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
            </div>
          )}

          {/* Compilation / Execution Error Console Box */}
          {compileError && (
            <div
              id="compiler-error-box"
              className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex items-center justify-between border-b border-rose-900/60 pb-2.5">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Compiler Output & Error Diagnostics ({language})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (compileError && typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(compileError);
                      }
                    }}
                    title="Copy Error to Clipboard"
                    className="px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setCompileError(null)}
                    title="Dismiss"
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl font-mono text-xs text-rose-300 whitespace-pre-wrap overflow-x-auto leading-relaxed border border-rose-950/80">
                {compileError}
              </pre>
            </div>
          )}

          {/* Test Results Breakdown */}
          {testResults && testResults.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" /> Test Execution Results ({testResults.length})
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {testResults.filter(t => t.passed).length} of {testResults.length} passed
                </span>
              </div>

              <div className="space-y-2">
                {testResults.map((tr, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between gap-3 ${
                      tr.passed
                        ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-800/60 text-rose-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold">
                          {tr.isHidden ? `Hidden Test Case #${idx + 1}` : `Sample Test Case #${idx + 1}`}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                            tr.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {tr.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      {!tr.isHidden ? (
                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          <div>Input: <span className="text-slate-200 font-mono">{tr.input}</span></div>
                          <div>Expected: <span className="text-emerald-400 font-mono">{tr.expectedOutput || (tr as any).expected || '(none)'}</span></div>
                          <div>Actual: <span className={`font-mono ${tr.passed ? 'text-emerald-400' : 'text-rose-400'}`}>{tr.actualOutput || (tr as any).actual || (tr.error ? tr.error : '(none)')}</span></div>
                          {tr.error && tr.error !== tr.actualOutput && (
                            <div className="text-rose-400/90 text-[10px] mt-1 font-mono bg-rose-950/40 p-1.5 rounded border border-rose-900/50">
                              Error: {tr.error}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400">
                          Hidden verification test ({tr.passed ? 'All constraints satisfied' : tr.error || 'Output mismatch'})
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-500 font-mono">{tr.executionTimeMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submissions History Drawer */}
          {showHistory && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-400" /> Past Submissions for Problem #{activeProblem.problemNumber}
                </span>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Close
                </button>
              </div>

              {currentProblemSubmissions.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No submissions recorded for this problem yet.</p>
              ) : (
                <div className="divide-y divide-slate-800/60 font-mono text-xs">
                  {currentProblemSubmissions.map((sub, sIdx) => (
                    <div key={sub.id || sIdx} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              sub.isAccepted
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {sub.executionStatus}
                          </span>
                          <span className="text-indigo-400 font-bold">{sub.language}</span>
                          <span className="text-amber-400 font-bold">+{sub.charCount} additional chars</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {new Date(sub.submittedAt).toLocaleTimeString()} • Score: {sub.score} pts
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          if (sub.code || sub.participantCode) {
                            handleCodeChange(sub.code || sub.participantCode || '');
                            if (sub.language) setLanguage(sub.language as any);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold cursor-pointer"
                      >
                        Restore Code
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
