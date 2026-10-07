import React from 'react';
import { ContestStage } from '../../types/contest';
import {
  Keyboard,
  BrainCircuit,
  Code2,
  KeyRound,
  ShieldAlert,
  Zap,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface InstructionsViewProps {
  stage: ContestStage;
}

export const InstructionsView: React.FC<InstructionsViewProps> = ({ stage }) => {
  const getRoundDetails = () => {
    switch (stage) {
      case 'ROUND_1_INSTRUCTIONS':
        return {
          roundNumber: 'Round 1',
          title: 'Fastest Fingers First — Typing Speed & Precision',
          icon: <Keyboard className="w-8 h-8 text-indigo-400" />,
          overview:
            'Test your keyboard dexterity and precision on real programming syntax and algorithmic data structures.',
          rules: [
            'Practice Warmup (1 Minute): A non-scoring practice passage to get accustomed to the typing engine.',
            'Official Scoring Test: Official timed passage where your performance is measured and recorded.',
            'Scoring Formula: Score = Words Per Minute (WPM) × Accuracy (decimal) × Multiplier.',
            'Accuracy Threshold: Minimum 85% accuracy required for full scoring eligibility.',
            'Auto-Submit: When the timer expires or the passage is completed, your result is instantly submitted to the server.'
          ],
          tips: 'Focus on rhythm and high accuracy rather than raw speed. A 95% accuracy score easily beats a 70% accuracy attempt with higher raw keystrokes.'
        };

      case 'ROUND_2_INSTRUCTIONS':
        return {
          roundNumber: 'Round 2',
          title: 'Byte-Sized Brains — Progressive Tech & Syntax Quiz',
          icon: <BrainCircuit className="w-8 h-8 text-violet-400" />,
          overview:
            'A multi-stage technical quiz spanning Programming Languages, Databases, System Architecture, and Computer Science Fundamentals.',
          rules: [
            'Stage 1 (Easy): Foundational syntax and output prediction (10 points each).',
            'Stage 2 (Medium): Complex closures, async event loops, SQL queries (20 points each).',
            'Stage 3 (Hard): Deep system design, memory management, algorithmic nuances (30 points each).',
            'Question Formats: Single-select MCQ, Multi-select checkboxes, True/False, and Fill-in-the-Blank.',
            'Per-Question Timers: Each question has an independent countdown timer managed by the Admin.'
          ],
          tips: 'Read code snippets carefully. Watch out for edge cases, implicit type conversions, and scoping quirks.'
        };

      case 'ROUND_3_INSTRUCTIONS':
        return {
          roundNumber: 'Round 3',
          title: 'Code Minimalist — Algorithmic Challenge',
          icon: <Code2 className="w-8 h-8 text-emerald-400" />,
          overview:
            'Solve the algorithmic problem correctly using the absolute minimum number of characters and lines of code.',
          rules: [
            'Correctness First: Your solution must pass 100% of sample and hidden test cases to earn points.',
            'Shortest Code Metric: Shorter character count earns significantly higher scores compared to reference length.',
            'Supported Languages: JavaScript, Python, C++, and Java.',
            'Prohibited Keywords: Usage of prohibited keywords (e.g. require, eval, process) will automatically reject the submission.',
            'Test Runner: Use "Run Test Cases" to verify sample inputs before submitting for official evaluation.'
          ],
          tips: 'Take advantage of standard language built-in functions, arrow functions, and compact expressions.'
        };

      case 'ROUND_4_INSTRUCTIONS':
      default:
        return {
          roundNumber: 'Round 4',
          title: 'Crack & Compete — Security & Reverse Engineering Chain',
          icon: <KeyRound className="w-8 h-8 text-rose-400" />,
          overview:
            'A linear puzzle chain of cryptographic ciphers, hex dumps, regex challenges, and logic riddles.',
          rules: [
            'Linear Sequence: Puzzles must be solved in order. Challenge 2 unlocks only after Challenge 1 is solved.',
            'Unlock Hints: Solving a challenge reveals a crucial hint or password segment for the subsequent nodes.',
            'Speed Advantage: Earlier completions receive tie-breaker precedence on the live leaderboard.',
            'Answer Formats: Enter the exact decrypted string, key, or token in the answer field.'
          ],
          tips: 'Keep a scratchpad open. Inspect formatting, base64 encodings, ASCII shifts, and bitwise relationships.'
        };
    }
  };

  const details = getRoundDetails();

  return (
    <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 shrink-0">
          {details.icon}
        </div>
        <div>
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase">
            {details.roundNumber} Briefing
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
            {details.title}
          </h1>
        </div>
      </div>

      <p className="text-slate-300 text-sm leading-relaxed font-medium">
        {details.overview}
      </p>

      {/* Rules Card */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Round Rules & Scoring Guidelines
        </h3>

        <ul className="space-y-2.5">
          {details.rules.map((rule, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pro-Tip */}
      <div className="bg-indigo-950/40 border border-indigo-800/60 p-4 rounded-2xl flex items-start gap-3 text-xs text-indigo-200">
        <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white">Strategy Tip:</strong> {details.tips}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <Clock className="w-4 h-4 text-slate-500" />
        <span>Waiting for Admin to initiate the live round...</span>
      </div>
    </div>
  );
};
