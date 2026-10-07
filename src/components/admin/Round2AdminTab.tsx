import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  QuizQuestion,
  QuizSubmission,
  QuizStage,
  TeamQuizStats,
  ContestState
} from '../../types/contest';
import {
  BrainCircuit,
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  AlertTriangle,
  Award,
  Ban,
  CheckCircle2,
  HelpCircle,
  Code,
  Layers,
  Sparkles,
  Clock,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  RotateCcw,
  Copy,
  ArrowUp,
  ArrowDown,
  FileText,
  FileSpreadsheet,
  Upload,
  Download,
  Sliders,
  Users,
  Search,
  Filter,
  Check,
  Send,
  XCircle,
  Trophy,
  Activity
} from 'lucide-react';

interface Round2AdminTabProps {
  contestState: ContestState;
  onRefresh: () => void;
}

export const Round2AdminTab: React.FC<Round2AdminTabProps> = ({ contestState, onRefresh }) => {
  const { token } = useAuth();
  const [subTab, setSubTab] = useState<'LIVE' | 'BANK' | 'STAGES' | 'SCORING'>('LIVE');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [stages, setStages] = useState<QuizStage[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [teamStats, setTeamStats] = useState<TeamQuizStats[]>([]);

  // Filtering & Search
  const [stageFilter, setStageFilter] = useState<number | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingQuestion, setEditingQuestion] = useState<Partial<QuizQuestion> | null>(null);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuizQuestion | null>(null);
  const [editingStage, setEditingStage] = useState<Partial<QuizStage> | null>(null);
  const [isEditingStage, setIsEditingStage] = useState(false);
  const [overrideModalTeam, setOverrideModalTeam] = useState<TeamQuizStats | null>(null);
  const [overrideForm, setOverrideForm] = useState<{
    type: 'override' | 'bonus' | 'penalty' | 'reset';
    value: number;
    note: string;
  }>({
    type: 'override',
    value: 0,
    note: ''
  });
  const [fairnessWarning, setFairnessWarning] = useState<{
    action: string;
    question: QuizQuestion;
    execute: () => Promise<void>;
  } | null>(null);
  const [qualifyModalOpen, setQualifyModalOpen] = useState(false);
  const [qualifyTopN, setQualifyTopN] = useState(8);
  const [qualifyMinScore, setQualifyMinScore] = useState(50);
  const [autoLaunchNext, setAutoLaunchNext] = useState(false);

  // Safe Feedback & Confirmation Dialog States (Safe inside iframes)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4500);
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDangerous?: boolean;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Multi-select for Question Bank bulk operations
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Bulk CSV Import Modal State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [parsedCsvQuestions, setParsedCsvQuestions] = useState<Partial<QuizQuestion>[]>([]);
  const [csvOverwrite, setCsvOverwrite] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccessMsg, setCsvSuccessMsg] = useState<string | null>(null);

  // Parse CSV content into QuizQuestion objects
  const parseClientCSV = (text: string): Partial<QuizQuestion>[] => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const row: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          row.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      row.push(cur.trim());
      return row;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const findIdx = (aliases: string[]) => {
      for (const a of aliases) {
        const norm = a.toLowerCase().replace(/[^a-z0-9]/g, '');
        const idx = headers.indexOf(norm);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const qIdx = findIdx(['question', 'questiontext', 'title', 'prompt']);
    const aIdx = findIdx(['optiona', 'option1', 'a', 'choicea', 'choice1']);
    const bIdx = findIdx(['optionb', 'option2', 'b', 'choiceb', 'choice2']);
    const cIdx = findIdx(['optionc', 'option3', 'c', 'choicec', 'choice3']);
    const dIdx = findIdx(['optiond', 'option4', 'd', 'choiced', 'choice4']);
    const optsIdx = findIdx(['options', 'choices']);
    const ansIdx = findIdx(['correctanswer', 'answer', 'correctoption', 'key', 'correct']);
    const catIdx = findIdx(['category', 'topic', 'subject']);
    const diffIdx = findIdx(['difficulty', 'level']);
    const stageIdx = findIdx(['stage', 'stagenumber', 'phase']);
    const ptsIdx = findIdx(['points', 'score', 'pts', 'weight']);
    const timeIdx = findIdx(['timelimitseconds', 'timelimit', 'time', 'duration']);
    const typeIdx = findIdx(['type', 'questiontype']);
    const codeIdx = findIdx(['codesnippet', 'code', 'snippet']);
    const expIdx = findIdx(['explanation', 'solution', 'reason']);

    const list: Partial<QuizQuestion>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length === 0 || cols.every(c => c === '')) continue;
      const questionText = qIdx !== -1 ? cols[qIdx] : cols[0];
      if (!questionText || !questionText.trim()) continue;

      let options: string[] = [];
      if (aIdx !== -1 && bIdx !== -1) {
        options = [cols[aIdx] || '', cols[bIdx] || '', cIdx !== -1 ? cols[cIdx] || '' : '', dIdx !== -1 ? cols[dIdx] || '' : ''].filter(Boolean);
      } else if (optsIdx !== -1 && cols[optsIdx]) {
        const raw = cols[optsIdx];
        options = (raw.includes('|') ? raw.split('|') : raw.includes(';') ? raw.split(';') : [raw]).map(s => s.trim()).filter(Boolean);
      }
      if (options.length === 0) {
        options = ['Option A', 'Option B', 'Option C', 'Option D'];
      }

      let rawAns = ansIdx !== -1 ? (cols[ansIdx] || '') : '';
      let correctAnswer = options[0] || 'Option A';
      const cleanAns = rawAns.trim().toUpperCase();
      if (cleanAns === 'A' || cleanAns === '1') correctAnswer = options[0] || 'Option A';
      else if (cleanAns === 'B' || cleanAns === '2') correctAnswer = options[1] || 'Option B';
      else if (cleanAns === 'C' || cleanAns === '3') correctAnswer = options[2] || 'Option C';
      else if (cleanAns === 'D' || cleanAns === '4') correctAnswer = options[3] || 'Option D';
      else if (rawAns.trim()) {
        const found = options.find(o => o.trim().toLowerCase() === rawAns.trim().toLowerCase());
        correctAnswer = found || rawAns.trim();
      }

      let stageNumber = 1;
      if (stageIdx !== -1 && cols[stageIdx]) {
        const n = parseInt(cols[stageIdx], 10);
        if (n === 2 || n === 3 || n === 1) stageNumber = n;
      }

      let difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'EASY';
      if (diffIdx !== -1 && cols[diffIdx]) {
        const d = cols[diffIdx].trim().toUpperCase();
        if (d === 'HARD' || d === 'H') {
          difficulty = 'HARD';
          if (stageIdx === -1) stageNumber = 3;
        } else if (d === 'MEDIUM' || d === 'MED' || d === 'M') {
          difficulty = 'MEDIUM';
          if (stageIdx === -1) stageNumber = 2;
        } else {
          difficulty = 'EASY';
          if (stageIdx === -1) stageNumber = 1;
        }
      } else {
        difficulty = stageNumber === 3 ? 'HARD' : stageNumber === 2 ? 'MEDIUM' : 'EASY';
      }

      const category = (catIdx !== -1 && cols[catIdx]) ? cols[catIdx].trim() : 'General Technology';
      const points = (ptsIdx !== -1 && cols[ptsIdx]) ? (parseInt(cols[ptsIdx], 10) || (stageNumber === 3 ? 6 : stageNumber === 2 ? 4 : 2)) : (stageNumber === 3 ? 6 : stageNumber === 2 ? 4 : 2);
      const timeLimitSeconds = (timeIdx !== -1 && cols[timeIdx]) ? (parseInt(cols[timeIdx], 10) || (stageNumber === 3 ? 60 : stageNumber === 2 ? 45 : 30)) : (stageNumber === 3 ? 60 : stageNumber === 2 ? 45 : 30);
      const qType = (typeIdx !== -1 && cols[typeIdx]) ? cols[typeIdx].trim().toLowerCase() : 'mcq';
      const codeSnippet = (codeIdx !== -1 && cols[codeIdx]) ? cols[codeIdx].trim() : undefined;
      const explanation = (expIdx !== -1 && cols[expIdx]) ? cols[expIdx].trim() : '';

      list.push({
        id: `q-csv-${Date.now()}-${i}`,
        questionText: questionText.trim(),
        options,
        correctAnswer,
        category,
        difficulty,
        stageNumber,
        points,
        timeLimitSeconds,
        type: qType as any,
        codeSnippet,
        explanation,
        order: questions.length + i,
        isVoided: false,
        isFullPointsAwarded: false
      });
    }

    return list;
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvRawText(text);
        const parsed = parseClientCSV(text);
        setParsedCsvQuestions(parsed);
        if (parsed.length === 0) {
          setCsvError('No valid questions could be parsed from the CSV file. Please verify column headers.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleCsvTextChange = (text: string) => {
    setCsvRawText(text);
    setCsvError(null);
    if (text.trim()) {
      const parsed = parseClientCSV(text);
      setParsedCsvQuestions(parsed);
    } else {
      setParsedCsvQuestions([]);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const headerRow = 'Question,Option A,Option B,Option C,Option D,Correct Answer,Category,Difficulty,Stage,Points,Time Limit,Explanation';
    const sample1 = '"What is the average time complexity of QuickSort?","O(n)","O(n log n)","O(n^2)","O(log n)","B","Algorithms & Data Structures","EASY",1,2,30,"Average time complexity of quicksort is O(n log n)."';
    const sample2 = '"Which clause in SQL is used to filter aggregate results?","WHERE","HAVING","FILTER","GROUP BY","B","Databases & SQL","MEDIUM",2,4,45,"HAVING filters aggregated groups, whereas WHERE filters individual rows."';
    const sample3 = '"In C++, what does the volatile keyword indicate to the compiler?","Thread safety","Prevents compiler optimization on memory access","Constant memory allocation","Automatic pointer dereference","B","Systems Programming & C++","HARD",3,6,60,"Volatile tells compiler not to cache access to the memory address."';
    const csvData = [headerRow, sample1, sample2, sample3].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'round2_quiz_questions_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExecuteCsvImport = async () => {
    if (!token || parsedCsvQuestions.length === 0) return;
    setIsImportingCsv(true);
    setCsvError(null);
    try {
      const res = await api.bulkImportQuizQuestions(token, {
        questions: parsedCsvQuestions,
        overwrite: csvOverwrite
      });
      if (res && res.success) {
        setCsvSuccessMsg(`Successfully imported ${res.addedCount || parsedCsvQuestions.length} questions into Round 2!`);
        setTimeout(() => {
          setIsCsvModalOpen(false);
          setCsvRawText('');
          setParsedCsvQuestions([]);
          setCsvSuccessMsg(null);
        }, 1200);
        await fetchAllData();
        onRefresh();
      } else {
        setCsvError(res?.message || 'Failed to import questions.');
      }
    } catch (err: any) {
      setCsvError(err.message || 'Error occurred while importing CSV.');
    } finally {
      setIsImportingCsv(false);
    }
  };

  // Phase-based state
  const [phaseMonitoring, setPhaseMonitoring] = useState<any[]>([]);
  const [monitoredPhase, setMonitoredPhase] = useState<number>(contestState.currentQuizPhase || 1);
  const isFetchingMonitoringRef = useRef<boolean>(false);

  const fetchMonitoring = async (phaseNum = monitoredPhase) => {
    if (!token || isFetchingMonitoringRef.current) return;
    isFetchingMonitoringRef.current = true;
    try {
      const res = await api.getAdminQuizMonitoring(token, phaseNum);
      if (res && res.success && Array.isArray(res.monitoring)) {
        setPhaseMonitoring(res.monitoring);
      } else if (res && Array.isArray(res.teams)) {
        setPhaseMonitoring(res.teams);
      } else if (res && res.phaseInfo && Array.isArray(res.phaseInfo.teams)) {
        setPhaseMonitoring(res.phaseInfo.teams);
      } else {
        setPhaseMonitoring(Array.isArray(res?.monitoring) ? res.monitoring : []);
      }
    } catch (err) {
      console.error('Error fetching phase monitoring:', err);
      setPhaseMonitoring([]);
    } finally {
      isFetchingMonitoringRef.current = false;
    }
  };

  const fetchAllData = async () => {
    if (!token) return;
    try {
      const [qRes, stRes, subRes, statsRes] = await Promise.all([
        api.getQuizQuestions(token),
        api.getQuizStages(token),
        api.getQuizSubmissions(token),
        api.getTeamQuizStats(token)
      ]);
      if (qRes.success) setQuestions(qRes.questions);
      if (stRes.success) setStages(stRes.stages);
      if (subRes.success) setSubmissions(subRes.submissions);
      if (statsRes.success) setTeamStats(statsRes.teamStats);
      fetchMonitoring(monitoredPhase);
    } catch (err) {
      console.error('Error fetching quiz admin data:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchAllData();
      const timer = setInterval(() => {
        Promise.all([
          api.getTeamQuizStats(token),
          api.getQuizSubmissions(token)
        ]).then(([statsRes, subRes]) => {
          if (statsRes?.success && Array.isArray(statsRes.teamStats)) {
            setTeamStats(statsRes.teamStats);
          }
          if (subRes?.success && Array.isArray(subRes.submissions)) {
            setSubmissions(subRes.submissions);
          }
        }).catch((err) => {
          console.error('Error polling quiz leaderboard stats:', err);
        });
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [token, contestState.currentStage]);

  // Master Stage & Arena Controls
  const handleSwitchToQuizArena = async () => {
    if (!token) return;
    try {
      await api.startQuizArena(token);
      fetchAllData();
      onRefresh();
    } catch (err) {
      console.error('Error switching to quiz arena:', err);
    }
  };

  const handleStartInstructions = async () => {
    if (!token) return;
    try {
      await api.startQuizInstructions(token);
      onRefresh();
    } catch (err) {
      console.error('Error starting instructions:', err);
    }
  };

  const handleStartPhase = async (phaseNum: number) => {
    if (!token) return;
    try {
      await api.startQuizPhase(token, phaseNum);
      setMonitoredPhase(phaseNum);
      fetchAllData();
      fetchMonitoring(phaseNum);
      onRefresh();
    } catch (err) {
      console.error('Error starting phase:', err);
    }
  };

  const handlePausePhase = async () => {
    if (!token) return;
    try {
      await api.pauseQuizPhase(token);
      onRefresh();
    } catch (err) {
      console.error('Error pausing phase:', err);
    }
  };

  const handleResumePhase = async () => {
    if (!token) return;
    try {
      await api.resumeQuizPhase(token);
      onRefresh();
    } catch (err) {
      console.error('Error resuming phase:', err);
    }
  };

  const handleAddTimePhase = async (secs: number = 30) => {
    if (!token) return;
    try {
      await api.addTimeQuizPhase(token, secs);
      onRefresh();
    } catch (err) {
      console.error('Error adding time:', err);
    }
  };

  const handleRestartRound2 = () => {
    if (!token) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Restart Round 2',
      message: 'Are you sure you want to restart Round 2? This will reset the round timer back to 10 minutes and sync all connected workstations.',
      confirmText: 'Restart Round',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await api.restartRound(token, 'r2', 600);
          showFeedback('Round 2 timer restarted to 10 minutes.', 'success');
          fetchAllData();
          onRefresh();
        } catch (err) {
          console.error('Error restarting round 2:', err);
          showFeedback('Error restarting round 2.', 'error');
        }
      }
    });
  };

  const handleEndRound2 = () => {
    if (!token) return;
    setConfirmDialog({
      isOpen: true,
      title: 'End Round 2',
      message: 'Are you sure you want to end Round 2 and prepare results?',
      confirmText: 'End Round 2',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await api.endRound2(token);
          showFeedback('Round 2 ended successfully.', 'success');
          onRefresh();
        } catch (err) {
          console.error('Error ending round 2:', err);
          showFeedback('Error ending round 2.', 'error');
        }
      }
    });
  };

  const handleShowResults = () => {
    if (!token) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Conclude & Publish Results',
      message: 'Are you sure you want to conclude Round 2 and publish the final quiz results to participants?',
      confirmText: 'Publish Results',
      isDangerous: false,
      onConfirm: async () => {
        try {
          await api.showQuizResults(token);
          showFeedback('Round 2 results published to participants.', 'success');
          onRefresh();
        } catch (err) {
          console.error('Error showing results:', err);
          showFeedback('Error showing results.', 'error');
        }
      }
    });
  };

  const handleToggleLeaderboard = async () => {
    if (!token) return;
    try {
      await api.toggleQuizLeaderboard(token);
      onRefresh();
    } catch (err) {
      console.error('Error toggling leaderboard:', err);
    }
  };

  // Timer controls
  const handleAdd30s = async () => {
    if (!token) return;
    try {
      await api.addTimerTime(token, 30);
      onRefresh();
    } catch (err) {
      console.error('Error adding time:', err);
    }
  };

  const handleTogglePause = async () => {
    if (!token) return;
    try {
      if (contestState.timer.isRunning) {
        await api.controlTimer(token, 'pause');
      } else {
        await api.controlTimer(token, 'resume');
      }
      onRefresh();
    } catch (err) {
      console.error('Error toggling pause:', err);
    }
  };

  // Question Bank Actions
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingQuestion) return;

    const performSave = async () => {
      try {
        await api.saveQuizQuestion(token, editingQuestion, isEditingQuestion);
        showFeedback(isEditingQuestion ? 'Question updated successfully.' : 'Question created successfully.', 'success');
        setEditingQuestion(null);
        fetchAllData();
        onRefresh();
      } catch (err) {
        console.error('Error saving question:', err);
        showFeedback('Error saving question.', 'error');
      }
    };

    const safeSubmissions = Array.isArray(submissions) ? submissions : [];
    const existingSubmissions = safeSubmissions.filter(s => editingQuestion && s.questionId === editingQuestion.id);
    if (isEditingQuestion && existingSubmissions.length > 0) {
      setFairnessWarning({
        action: `Modify Question (${existingSubmissions.length} teams have already answered)`,
        question: editingQuestion as QuizQuestion,
        execute: performSave
      });
      return;
    }

    await performSave();
  };

  const performDeleteQuestion = async (id: string) => {
    if (!token) return;
    const targetQ = questions.find(q => q.id === id);
    // Optimistic state update: remove immediately so UI updates instantly
    setQuestions(prev => prev.filter(q => q.id !== id));
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (editingQuestion?.id === id) setEditingQuestion(null);
    if (previewQuestion?.id === id) setPreviewQuestion(null);

    try {
      const res = await api.deleteQuizQuestion(token, id);
      if (res && res.success) {
        showFeedback(`Question deleted successfully${targetQ ? `: "${targetQ.questionText.slice(0, 35)}..."` : ''}.`, 'success');
        fetchAllData();
        onRefresh();
      } else {
        showFeedback(res?.message || 'Failed to delete question from server.', 'error');
        fetchAllData();
      }
    } catch (err: any) {
      console.error('Error deleting question:', err);
      showFeedback(err?.message || 'Network error while deleting question.', 'error');
      fetchAllData();
    }
  };

  const requestDeleteQuestion = (q: QuizQuestion) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Quiz Question',
      message: `Are you sure you want to permanently delete this question?\n\n"${q.questionText}"\n\n• Stage ${q.stageNumber} | Category: ${q.category} | Points: ${q.points} pts\nThis action cannot be undone.`,
      confirmText: 'Delete Question',
      isDangerous: true,
      onConfirm: async () => {
        await performDeleteQuestion(q.id);
      }
    });
  };

  const handleDeleteQuestion = async (id: string) => {
    const q = questions.find(item => item.id === id);
    if (q) {
      requestDeleteQuestion(q);
    } else {
      await performDeleteQuestion(id);
    }
  };

  const handleToggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllVisible = (visibleQuestions: QuizQuestion[]) => {
    const visibleIds = visibleQuestions.map(q => q.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedQuestionIds.has(id));
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const requestBulkDeleteQuestions = () => {
    const ids: string[] = Array.from(selectedQuestionIds) as string[];
    if (ids.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${ids.length} Selected Questions`,
      message: `Are you sure you want to permanently delete the ${ids.length} selected question(s)?\n\nThis will remove them from the Question Bank and cannot be undone.`,
      confirmText: `Delete ${ids.length} Questions`,
      isDangerous: true,
      onConfirm: async () => {
        const idSet = new Set(ids);
        setQuestions(prev => prev.filter(q => !idSet.has(q.id)));
        setSelectedQuestionIds(new Set());
        try {
          const res = await api.bulkDeleteQuizQuestions(token!, { ids });
          if (res && res.success) {
            showFeedback(`Successfully deleted ${res.deletedCount || ids.length} questions.`, 'success');
            fetchAllData();
            onRefresh();
          } else {
            showFeedback(res?.message || 'Failed to delete selected questions.', 'error');
            fetchAllData();
          }
        } catch (err: any) {
          showFeedback(err?.message || 'Error deleting questions.', 'error');
          fetchAllData();
        }
      }
    });
  };

  const requestClearQuestions = (targetQuestions: QuizQuestion[], filterLabel: string) => {
    if (targetQuestions.length === 0) {
      showFeedback('No questions available in current view to clear.', 'error');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: `Clear Questions (${filterLabel})`,
      message: `Are you sure you want to permanently delete all ${targetQuestions.length} questions in ${filterLabel}?\n\nThis will wipe these questions from the database.`,
      confirmText: `Clear ${targetQuestions.length} Questions`,
      isDangerous: true,
      onConfirm: async () => {
        const ids = targetQuestions.map(q => q.id);
        const idSet = new Set(ids);
        setQuestions(prev => prev.filter(q => !idSet.has(q.id)));
        setSelectedQuestionIds(new Set());
        try {
          const res = await api.bulkDeleteQuizQuestions(token!, { ids });
          if (res && res.success) {
            showFeedback(`Cleared ${res.deletedCount || ids.length} questions successfully.`, 'success');
            fetchAllData();
            onRefresh();
          } else {
            showFeedback(res?.message || 'Failed to clear questions.', 'error');
            fetchAllData();
          }
        } catch (err: any) {
          showFeedback(err?.message || 'Error clearing questions.', 'error');
          fetchAllData();
        }
      }
    });
  };

  const handleDuplicateQuestion = async (id: string) => {
    if (!token) return;
    try {
      await api.duplicateQuizQuestion(token, id);
      showFeedback('Question duplicated successfully.', 'success');
      fetchAllData();
    } catch (err) {
      console.error('Error duplicating question:', err);
      showFeedback('Error duplicating question.', 'error');
    }
  };

  const handleReorderQuestion = async (index: number, direction: 'up' | 'down') => {
    if (!token) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newQuestions = [...questions];
    const [moved] = newQuestions.splice(index, 1);
    newQuestions.splice(targetIndex, 0, moved);

    setQuestions(newQuestions);
    try {
      await api.reorderQuizQuestions(token, newQuestions.map(q => q.id));
    } catch (err) {
      console.error('Error reordering questions:', err);
      fetchAllData();
    }
  };

  const handleVoidQuestion = async (q: QuizQuestion) => {
    if (!token) return;
    const performVoid = async () => {
      try {
        await api.voidQuizQuestion(token, q.id);
        fetchAllData();
        onRefresh();
      } catch (err) {
        console.error('Error voiding question:', err);
      }
    };

    setFairnessWarning({
      action: 'Void Question (Cancels points for all teams and recalculates leaderboard)',
      question: q,
      execute: performVoid
    });
  };

  const handleAwardAllPoints = async (q: QuizQuestion) => {
    if (!token) return;
    const performAward = async () => {
      try {
        await api.awardAllQuizPoints(token, q.id);
        fetchAllData();
        onRefresh();
      } catch (err) {
        console.error('Error awarding points:', err);
      }
    };

    setFairnessWarning({
      action: `Award Full Points to All Teams (${q.points} pts)`,
      question: q,
      execute: performAward
    });
  };

  // Stage Actions
  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingStage) return;
    try {
      await api.saveQuizStage(token, editingStage, isEditingStage);
      showFeedback(isEditingStage ? 'Stage updated successfully.' : 'Stage created successfully.', 'success');
      setEditingStage(null);
      fetchAllData();
    } catch (err) {
      console.error('Error saving stage:', err);
      showFeedback('Error saving stage.', 'error');
    }
  };

  const requestDeleteStage = (st: QuizStage) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Stage #${st.stageNumber}`,
      message: `Are you sure you want to delete stage "${st.title}"?\nAssociated questions will remain in the bank, but the stage configuration will be removed.`,
      confirmText: 'Delete Stage',
      isDangerous: true,
      onConfirm: async () => {
        if (!token) return;
        setStages(prev => prev.filter(s => s.id !== st.id));
        try {
          await api.deleteQuizStage(token, st.id);
          showFeedback(`Stage #${st.stageNumber} deleted successfully.`, 'success');
          fetchAllData();
          onRefresh();
        } catch (err) {
          console.error('Error deleting stage:', err);
          showFeedback('Error deleting stage.', 'error');
          fetchAllData();
        }
      }
    });
  };

  const handleDeleteStage = async (id: string) => {
    const st = stages.find(s => s.id === id);
    if (st) {
      requestDeleteStage(st);
    } else {
      if (!token) return;
      await api.deleteQuizStage(token, id);
      fetchAllData();
    }
  };

  // Score Overrides
  const handleOpenOverrideModal = (team: TeamQuizStats) => {
    setOverrideModalTeam(team);
    setOverrideForm({
      type: team.overrideInfo?.type || 'override',
      value: team.overrideInfo?.value || team.finalRound2Score,
      note: team.overrideInfo?.note || ''
    });
  };

  const handleSaveScoreOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !overrideModalTeam) return;
    try {
      await api.overrideQuizScore(token, {
        teamId: overrideModalTeam.teamId,
        type: overrideForm.type,
        value: Number(overrideForm.value),
        note: overrideForm.note
      });
      setOverrideModalTeam(null);
      fetchAllData();
      onRefresh();
    } catch (err) {
      console.error('Error overriding score:', err);
    }
  };

  const handleQualifyTeams = async (method: 'topN' | 'minScore') => {
    if (!token) return;
    try {
      if (method === 'topN') {
        await api.qualifyQuizTeams(token, { topN: qualifyTopN });
      } else {
        await api.qualifyQuizTeams(token, { minScore: qualifyMinScore });
      }
      setQualifyModalOpen(false);
      fetchAllData();
      onRefresh();
      alert(`Teams qualified successfully for subsequent contest evaluation.`);
    } catch (err) {
      console.error('Error qualifying teams:', err);
    }
  };

  const safeQuestions = Array.isArray(questions) ? questions : [];
  const uniqueCategories = Array.from(new Set(safeQuestions.map(q => q && q.category).filter(Boolean))) as string[];
  const activeQuestionId = contestState.currentQuizQuestionId;
  const activeQuestion = safeQuestions.find(q => q && q.id === activeQuestionId);

  // Submissions for active question
  const activeQuestionSubmissions = activeQuestion
    ? submissions.filter(s => s.questionId === activeQuestion.id)
    : [];

  const filteredQuestions = safeQuestions.filter(q => {
    if (!q) return false;
    const matchStage = stageFilter === 'all' || q.stageNumber === stageFilter;
    const matchCat = categoryFilter === 'all' || q.category === categoryFilter;
    const matchSearch =
      searchQuery.trim() === '' ||
      q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.codeSnippet && q.codeSnippet.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchStage && matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Dynamic Action Message / Toast Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-mono flex items-center justify-between gap-3 shadow-xl animate-in slide-in-from-top-2 duration-200 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5 cursor-pointer font-mono"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Master Control & Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">Round 2: Byte-Sized Brains Manager</h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-mono font-bold">
                  {contestState.currentStage}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative stage controller, question broadcaster, and live response monitoring.
              </p>
            </div>
          </div>

          {/* Quick Timer Pill */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-xs">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-white text-sm">{contestState.remainingSeconds}s</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                contestState.timer.isRunning ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
              }`}>
                {contestState.timer.isRunning ? 'Live' : 'Paused'}
              </span>
            </div>

            <button
              onClick={handleAdd30s}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-bold transition-all cursor-pointer"
              title="Add 30 Seconds"
            >
              +30s
            </button>

            <button
              onClick={handleTogglePause}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
              title={contestState.timer.isRunning ? 'Pause Timer' : 'Resume Timer'}
            >
              {contestState.timer.isRunning ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Master Stage Stepper Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {contestState.currentStage === 'ROUND_2_QUIZ' || contestState.currentStage === 'R2_QUIZ' || contestState.currentStage === 'ROUND_2_ACTIVE' ? (
              <div className="px-4 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                R2 QUIZ ARENA ACTIVE
              </div>
            ) : (
              <button
                onClick={handleSwitchToQuizArena}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 text-emerald-300" /> SWITCH TO R2 QUIZ ARENA
              </button>
            )}

            <button
              onClick={handleStartInstructions}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                contestState.currentStage === 'ROUND_2_INSTRUCTIONS' || contestState.currentStage === 'R2_INSTRUCTIONS'
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-400" /> Instructions
            </button>

            {/* PAUSE / RESUME */}
            {contestState.timer.isRunning ? (
              <button
                onClick={handlePausePhase}
                className="px-3.5 py-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Pause className="w-4 h-4 text-amber-400" /> PAUSE
              </button>
            ) : (
              <button
                onClick={handleResumePhase}
                className="px-3.5 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 text-emerald-400" /> RESUME
              </button>
            )}

            {/* RESTART ROUND 2 */}
            <button
              onClick={handleRestartRound2}
              className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Restart Round 2 Timer & Workstations"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" /> RESTART ROUND 2
            </button>

            <button
              onClick={() => handleAddTimePhase(30)}
              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-mono font-bold transition-all cursor-pointer"
              title="Add 30 seconds"
            >
              +30s
            </button>

            <button
              onClick={() => handleAddTimePhase(60)}
              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-mono font-bold transition-all cursor-pointer"
              title="Add 60 seconds"
            >
              +60s
            </button>

            <button
              onClick={() => handleAddTimePhase(300)}
              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-mono font-bold transition-all cursor-pointer"
              title="Add 5 minutes"
            >
              +5m
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleLeaderboard}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                contestState.leaderboardVisible
                  ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {contestState.leaderboardVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {contestState.leaderboardVisible ? 'Leaderboard: Visible' : 'Leaderboard: Hidden'}
            </button>

            <button
              onClick={handleEndRound2}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 border border-slate-700 hover:border-rose-800 text-slate-300 hover:text-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <XCircle className="w-4 h-4 text-rose-400" /> END ROUND 2
            </button>

            <button
              onClick={handleShowResults}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Award className="w-4 h-4" /> SHOW RESULTS
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
        <button
          onClick={() => setSubTab('LIVE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            subTab === 'LIVE'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-400" /> Live Scores &amp; Leaderboard
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
        <button
          onClick={() => setSubTab('BANK')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            subTab === 'BANK'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" /> Question Bank ({questions.length})
        </button>
        <button
          onClick={() => setSubTab('STAGES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            subTab === 'STAGES'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" /> Stage Architecture ({stages.length})
        </button>
        <button
          onClick={() => setSubTab('SCORING')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            subTab === 'SCORING'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> Score Adjustments &amp; Overrides
        </button>
      </div>

      {/* SUBTAB 1: LIVE LEADERBOARD & SCORES */}
      {subTab === 'LIVE' && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Current Leader</span>
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-extrabold text-white truncate">
                {teamStats.length > 0
                  ? [...teamStats].sort((a, b) => b.finalRound2Score - a.finalRound2Score)[0]?.teamName
                  : '—'}
              </div>
              <div className="text-xs text-amber-400 font-mono font-bold">
                {teamStats.length > 0
                  ? `${[...teamStats].sort((a, b) => b.finalRound2Score - a.finalRound2Score)[0]?.finalRound2Score || 0} pts`
                  : '0 pts'}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Participating Teams</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {teamStats.length}
              </div>
              <div className="text-xs text-slate-500">
                All competing in Round 2
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Average Score</span>
                <Award className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                {teamStats.length > 0
                  ? (teamStats.reduce((acc, t) => acc + t.finalRound2Score, 0) / teamStats.length).toFixed(1)
                  : '0.0'}
              </div>
              <div className="text-xs text-slate-500">
                Points across teams
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Question Bank Total</span>
                <Layers className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold text-purple-300 font-mono">
                {questions.length}
              </div>
              <div className="text-xs text-slate-500">
                Stage-wise questions
              </div>
            </div>
          </div>

          {/* Main Live Leaderboard Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-white">
                      Round 2 Live Leaderboard &amp; Scores
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time rankings and stage-wise scores directly updated as participants answer questions in the quiz arena.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAllData}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4 text-center">Round 2 Score</th>
                    <th className="py-3 px-4">Questions Answered</th>
                    <th className="py-3 px-4">Accuracy</th>
                    <th className="py-3 px-4 text-center">Stage 1 (Easy)</th>
                    <th className="py-3 px-4 text-center">Stage 2 (Med)</th>
                    <th className="py-3 px-4 text-center">Stage 3 (Hard)</th>
                    <th className="py-3 px-4">Total Time</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {[...teamStats]
                    .sort((a, b) => b.finalRound2Score - a.finalRound2Score || a.totalTimeTaken - b.totalTimeTaken)
                    .map((team, idx) => {
                      const totalQ = questions.length || 1;
                      const answeredPercent = Math.min(100, Math.round((team.totalSubmissions / totalQ) * 100));

                      return (
                        <tr
                          key={team.teamId}
                          className="hover:bg-slate-850/50 transition-colors"
                        >
                          {/* Rank */}
                          <td className="py-3.5 px-3">
                            {idx === 0 ? (
                              <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center font-mono shadow-sm">
                                🥇
                              </div>
                            ) : idx === 1 ? (
                              <div className="w-7 h-7 rounded-xl bg-slate-400/20 border border-slate-400/40 text-slate-200 font-bold flex items-center justify-center font-mono">
                                🥈
                              </div>
                            ) : idx === 2 ? (
                              <div className="w-7 h-7 rounded-xl bg-amber-700/20 border border-amber-700/40 text-amber-500 font-bold flex items-center justify-center font-mono">
                                🥉
                              </div>
                            ) : (
                              <span className="font-mono text-slate-400 font-bold px-2">
                                #{idx + 1}
                              </span>
                            )}
                          </td>

                          {/* Team Name & Code */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-sm">
                                {team.teamName}
                              </span>
                              <span className="text-[11px] font-mono text-indigo-400">
                                {team.teamCode}
                              </span>
                            </div>
                          </td>

                          {/* Round 2 Score */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="text-base font-extrabold text-amber-400 font-mono bg-amber-950/40 border border-amber-800/60 px-3 py-1 rounded-xl">
                              {team.finalRound2Score} pts
                            </span>
                          </td>

                          {/* Questions Answered */}
                          <td className="py-3.5 px-4 min-w-[150px]">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                                <span>{team.totalSubmissions} / {questions.length}</span>
                                <span>{answeredPercent}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-500 transition-all duration-300"
                                  style={{ width: `${answeredPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Accuracy */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-mono text-slate-200 font-bold">
                                {team.accuracy}%
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {team.correctSubmissions} correct
                              </span>
                            </div>
                          </td>

                          {/* Stage 1 */}
                          <td className="py-3.5 px-4 text-center font-mono">
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-900 font-bold">
                              {team.stageScores?.[1] || 0} pts
                            </span>
                          </td>

                          {/* Stage 2 */}
                          <td className="py-3.5 px-4 text-center font-mono">
                            <span className="px-2 py-0.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-900 font-bold">
                              {team.stageScores?.[2] || 0} pts
                            </span>
                          </td>

                          {/* Stage 3 */}
                          <td className="py-3.5 px-4 text-center font-mono">
                            <span className="px-2 py-0.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-900 font-bold">
                              {team.stageScores?.[3] || 0} pts
                            </span>
                          </td>

                          {/* Time */}
                          <td className="py-3.5 px-4 font-mono text-slate-400">
                            {Math.floor((team.totalTimeTaken || 0) / 60)}m {(team.totalTimeTaken || 0) % 60}s
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-3 text-right">
                            <button
                              onClick={() => handleOpenOverrideModal(team)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                              title="Override or Adjust Team Score"
                            >
                              Adjust Score
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {teamStats.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        No team data recorded yet. Scores will populate live once teams begin submitting answers.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real-time Submissions Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Live Submissions Feed ({submissions.length})
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Latest answers from all stages
              </span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {[...submissions]
                .reverse()
                .slice(0, 15)
                .map((sub) => {
                  const q = questions.find((item) => item.id === sub.questionId);
                  const isVoided = q?.isVoided;
                  const fullPoints = q?.isFullPointsAwarded;

                  return (
                    <div
                      key={sub.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          sub.isCorrect || fullPoints ? 'bg-emerald-400' : 'bg-rose-400'
                        }`} />
                        <span className="font-bold text-white">
                          {sub.teamName}
                        </span>
                        <span className="text-slate-400">
                          answered {q ? `"${q.category}"` : 'Question'} in Stage {q?.stageNumber || 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-mono">
                        <span className={`font-bold px-2 py-0.5 rounded-md ${
                          sub.isCorrect || fullPoints
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {sub.pointsAwarded > 0 ? `+${sub.pointsAwarded} pts` : '0 pts'}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {new Date(sub.submittedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                })}

              {submissions.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Awaiting initial submissions from contestants...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: QUESTION BANK */}
      {subTab === 'BANK' && (
        <div className="space-y-4">
          {/* Action Bar & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-3xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['all', 1, 2, 3] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStageFilter(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      stageFilter === s ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s === 'all' ? 'All Stages' : `Stage ${s}`}
                  </button>
                ))}
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
              >
                <option value="all">All Categories ({safeQuestions.length})</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions or code..."
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCsvError(null);
                  setCsvSuccessMsg(null);
                  setIsCsvModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer font-mono transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Bulk Import CSV
              </button>

              <button
                onClick={() => {
                  setEditingQuestion({
                    id: `q-${Date.now()}`,
                    stageNumber: 1,
                    category: 'General Technology',
                    type: 'mcq',
                    difficulty: 'EASY',
                    questionText: '',
                    codeSnippet: '',
                    options: ['Option A', 'Option B', 'Option C', 'Option D'],
                    correctAnswer: 'Option A',
                    points: 10,
                    timeLimitSeconds: 30,
                    explanation: '',
                    order: questions.length + 1,
                    isVoided: false,
                    isFullPointsAwarded: false
                  });
                  setIsEditingQuestion(false);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" /> Create Question
              </button>
            </div>
          </div>

          {/* Bulk Operations & Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 px-4 py-3 rounded-2xl border border-slate-800 shadow-inner">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestionIds.has(q.id))}
                  onChange={() => handleSelectAllVisible(filteredQuestions)}
                  className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="font-semibold">Select All Visible ({filteredQuestions.length})</span>
              </label>
              {selectedQuestionIds.size > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[11px] font-mono font-bold animate-in fade-in">
                  {selectedQuestionIds.size} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedQuestionIds.size > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionIds(new Set())}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={requestBulkDeleteQuestions}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-rose-950/40 transition-colors cursor-pointer font-mono"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected ({selectedQuestionIds.size})
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => requestClearQuestions(filteredQuestions, stageFilter === 'all' ? 'All Questions' : `Stage ${stageFilter}`)}
                  disabled={filteredQuestions.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/60 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                  title="Clear all questions in current view"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Clear {stageFilter === 'all' ? 'Bank' : `Stage ${stageFilter}`} ({filteredQuestions.length})
                </button>
              )}
            </div>
          </div>

          {/* Question List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredQuestions.map((q, idx) => (
              <div
                key={q.id}
                className={`bg-slate-900 border rounded-3xl p-5 shadow-xl flex flex-col justify-between gap-4 transition-all ${
                  selectedQuestionIds.has(q.id)
                    ? 'border-rose-500/70 bg-slate-900/90 shadow-rose-950/20 ring-1 ring-rose-500/30'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedQuestionIds.has(q.id)}
                          onChange={() => handleToggleSelectQuestion(q.id)}
                          className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-bold font-mono">
                          Q{idx + 1} &bull; Stage {q.stageNumber}
                        </span>
                      </label>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                        {q.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-mono font-bold">
                        {q.points} pts
                      </span>
                      {q.isVoided && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                          VOIDED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleReorderQuestion(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleReorderQuestion(idx, 'down')}
                        disabled={idx === questions.length - 1}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setPreviewQuestion(q)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicateQuestion(q.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                        title="Duplicate Question"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingQuestion({ ...q });
                          setIsEditingQuestion(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                        title="Edit Question"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => requestDeleteQuestion(q)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-800/80 transition-colors"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-2 leading-snug">{q.questionText}</h4>

                  {q.codeSnippet && (
                    <pre className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-indigo-300 mb-3 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {q.codeSnippet}
                    </pre>
                  )}

                  {q.options && q.options.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {q.options.map((opt, i) => {
                        const isCorrect = Array.isArray(q.correctAnswer)
                          ? q.correctAnswer.includes(opt)
                          : q.correctAnswer === opt;
                        return (
                          <div
                            key={i}
                            className={`p-2 rounded-lg text-xs font-mono border ${
                              isCorrect
                                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300 font-bold'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400'
                            }`}
                          >
                            {String.fromCharCode(65 + i)}. {opt}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Limit: {q.timeLimitSeconds}s &bull; Type: {q.type}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
                    Phase {q.stageNumber} Auto-Delivered
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: STAGE ARCHITECTURE */}
      {subTab === 'STAGES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-3xl border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Quiz Stages Architecture</h3>
              <p className="text-xs text-slate-400">
                Configure progressive difficulty stages for Round 2.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingStage({
                  id: `stage-${Date.now()}`,
                  stageNumber: stages.length + 1,
                  title: `Stage ${stages.length + 1}`,
                  description: 'Stage overview description',
                  order: stages.length + 1
                });
                setIsEditingStage(false);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Stage
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stages.map((st) => {
              const stageQuestions = questions.filter(q => q.stageNumber === st.stageNumber);
              const totalPoints = stageQuestions.reduce((acc, q) => acc + (q.points || 0), 0);
              return (
                <div
                  key={st.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs font-bold font-mono">
                        Stage #{st.stageNumber}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingStage(st);
                            setIsEditingStage(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                          title="Edit Stage"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStage(st.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400"
                          title="Delete Stage"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-base font-extrabold text-white">{st.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{st.description}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-2 text-center text-xs font-mono">
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase">Questions</span>
                      <span className="font-bold text-white">{stageQuestions.length}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase">Total Points</span>
                      <span className="font-bold text-amber-400">{totalPoints} pts</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 4: TEAM RESPONSES & SCORING OVERRIDES */}
      {subTab === 'SCORING' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-3xl border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Team Performance &amp; Score Management</h3>
              <p className="text-xs text-slate-400">
                View submission metrics, apply manual overrides, and qualify teams for next rounds.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setQualifyModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/30 cursor-pointer"
              >
                <Award className="w-4 h-4" /> Qualify Teams for Round 2
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4 text-center">Submissions</th>
                    <th className="py-3 px-4 text-center">Accuracy</th>
                    <th className="py-3 px-4 text-center">Time</th>
                    <th className="py-3 px-4 text-center">S1 / S2 / S3</th>
                    <th className="py-3 px-4 text-center">Calculated</th>
                    <th className="py-3 px-4 text-center text-indigo-400 font-bold">Final R2 Score</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {teamStats.map((team) => (
                    <tr key={team.teamId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-white font-bold block">{team.teamName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{team.teamCode}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {team.correctSubmissions} / {team.totalSubmissions}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className={team.accuracy >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                          {team.accuracy}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-400">
                        {team.totalTimeTaken}s
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[11px]">
                        {team.stageScores ? `${team.stageScores[1] || 0} / ${team.stageScores[2] || 0} / ${team.stageScores[3] || 0}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-400">
                        {team.calculatedScore}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-indigo-300">
                        {team.finalRound2Score}
                        {team.overrideInfo && (
                          <span className="block text-[9px] text-amber-400 font-normal">
                            ({team.overrideInfo.type}: {team.overrideInfo.value})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setOverrideModalTeam(team);
                            setOverrideForm({
                              type: team.overrideInfo?.type || 'override',
                              value: team.overrideInfo?.value || team.finalRound2Score,
                              note: team.overrideInfo?.note || ''
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-bold transition-all cursor-pointer"
                        >
                          Override Score
                        </button>
                      </td>
                    </tr>
                  ))}
                  {teamStats.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500 text-xs">
                        No team quiz data available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QUESTION PREVIEW */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs font-bold">
                  Participant View Preview &bull; Stage {previewQuestion.stageNumber}
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {previewQuestion.points} Points
                </span>
              </div>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Close Preview
              </button>
            </div>

            <h3 className="text-lg font-bold text-white">{previewQuestion.questionText}</h3>

            {previewQuestion.codeSnippet && (
              <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs text-indigo-300 whitespace-pre-wrap">
                {previewQuestion.codeSnippet}
              </pre>
            )}

            {previewQuestion.options && (
              <div className="space-y-2">
                {previewQuestion.options.map((opt, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 text-xs font-mono flex items-center justify-between"
                  >
                    <span>{String.fromCharCode(65 + i)}. {opt}</span>
                    {previewQuestion.correctAnswer === opt && (
                      <span className="text-emerald-400 text-[10px] font-bold">✓ (Correct Answer)</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {previewQuestion.explanation && (
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-indigo-200 text-xs">
                <strong>Explanation:</strong> {previewQuestion.explanation}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewQuestion(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK CSV IMPORT */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-tactical">Bulk CSV Question Import</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Import and validate multiple Round 2 questions simultaneously</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvError(null);
                  setCsvSuccessMsg(null);
                }}
                className="text-slate-400 hover:text-white p-1 text-xs cursor-pointer font-mono"
              >
                ✕ Close
              </button>
            </div>

            {/* Template Download & Guide */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Download Standard CSV Template</span>
                <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                  Columns: Question, Option A, Option B, Option C, Option D, Correct Answer, Category, Difficulty, Stage, Points, Time Limit, Explanation
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 font-mono"
              >
                <Download className="w-3.5 h-3.5" /> Download Template (.csv)
              </button>
            </div>

            {/* File Upload Zone */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Option 1: Upload CSV File</label>
              <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-2xl p-4 text-center bg-slate-950/60 transition-colors">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                  id="csv-file-input"
                />
                <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6 text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-400 hover:underline">Click to browse file (.csv)</span>
                  <span className="text-[10px] text-slate-500 font-mono">UTF-8 comma-separated file format</span>
                </label>
              </div>
            </div>

            {/* Raw Text Input Zone */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300">Option 2: Paste CSV Text</label>
                {csvRawText && (
                  <button
                    type="button"
                    onClick={() => {
                      setCsvRawText('');
                      setParsedCsvQuestions([]);
                      setCsvError(null);
                    }}
                    className="text-[10px] text-slate-400 hover:text-rose-400 underline font-mono cursor-pointer"
                  >
                    Clear Text
                  </button>
                )}
              </div>
              <textarea
                value={csvRawText}
                onChange={(e) => handleCsvTextChange(e.target.value)}
                placeholder="Question,Option A,Option B,Option C,Option D,Correct Answer,Category,Difficulty,Stage,Points..."
                rows={4}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Error & Success Notices */}
            {csvError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{csvError}</span>
              </div>
            )}
            {csvSuccessMsg && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{csvSuccessMsg}</span>
              </div>
            )}

            {/* Live Parsing Preview */}
            {parsedCsvQuestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 font-mono">
                    Preview: {parsedCsvQuestions.length} Questions Ready to Import
                  </span>
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={csvOverwrite}
                      onChange={(e) => setCsvOverwrite(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <span>Overwrite existing question bank</span>
                  </label>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-2 border border-slate-800 rounded-2xl p-2 bg-slate-950">
                  {parsedCsvQuestions.slice(0, 15).map((pq, pidx) => (
                    <div key={pidx} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-[10px] font-bold">
                          #{pidx + 1} • Stage {pq.stageNumber}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                          {pq.category}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-mono">
                          {pq.difficulty} • {pq.points} pts
                        </span>
                        <span className="text-emerald-400 font-mono text-[10px] ml-auto font-bold">
                          Answer: {pq.correctAnswer}
                        </span>
                      </div>
                      <p className="text-white font-medium line-clamp-2">{pq.questionText}</p>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                        {pq.options?.map((opt, oidx) => (
                          <span key={oidx} className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800 text-[10px]">
                            {String.fromCharCode(65 + oidx)}: {opt}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {parsedCsvQuestions.length > 15 && (
                    <p className="text-[11px] text-slate-500 text-center py-1 font-mono">
                      ...and {parsedCsvQuestions.length - 15} more questions
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvError(null);
                  setCsvSuccessMsg(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isImportingCsv || parsedCsvQuestions.length === 0}
                onClick={handleExecuteCsvImport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-extrabold text-xs shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 font-mono"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {isImportingCsv
                  ? 'Importing Questions...'
                  : `Confirm Import (${parsedCsvQuestions.length} Questions)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QUESTION EDITOR */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">
              {isEditingQuestion ? 'Edit Quiz Question' : 'Create Quiz Question'}
            </h3>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Stage (1-3)</label>
                  <select
                    value={editingQuestion.stageNumber || 1}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, stageNumber: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value={1}>Stage 1: Easy</option>
                    <option value={2}>Stage 2: Medium</option>
                    <option value={3}>Stage 3: Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Category</label>
                  <input
                    type="text"
                    value={editingQuestion.category || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                    placeholder="e.g. Programming Languages, Databases, Systems..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Question Type</label>
                  <select
                    value={editingQuestion.type || 'mcq'}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value="mcq">Single Select MCQ</option>
                    <option value="multi_select">Multi-Select Checkboxes</option>
                    <option value="true_false">True / False</option>
                    <option value="fill_blank">Fill in the Blank</option>
                    <option value="code_output">Code Output Prediction</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Question Text</label>
                <textarea
                  value={editingQuestion.questionText || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, questionText: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Code Snippet (Optional)
                </label>
                <textarea
                  value={editingQuestion.codeSnippet || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, codeSnippet: e.target.value })}
                  rows={3}
                  placeholder="e.g. const a = [1, 2, 3];"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                />
              </div>

              {/* Options */}
              {editingQuestion.type !== 'fill_blank' && editingQuestion.type !== 'code_output' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Options (One per line)
                  </label>
                  <textarea
                    value={(editingQuestion.options || []).join('\n')}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        options: e.target.value.split('\n').filter(Boolean)
                      })
                    }
                    rows={4}
                    placeholder={"Option A\nOption B\nOption C\nOption D"}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Correct Answer</label>
                  <input
                    type="text"
                    value={editingQuestion.correctAnswer || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                    placeholder={editingQuestion.type === 'multi_select' ? 'Opt1,Opt2' : 'Exact answer'}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Points</label>
                  <input
                    type="number"
                    value={editingQuestion.points || 10}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, points: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Time Limit (Seconds)</label>
                  <input
                    type="number"
                    value={editingQuestion.timeLimitSeconds || 30}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, timeLimitSeconds: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Explanation (Shown in Review)</label>
                <textarea
                  value={editingQuestion.explanation || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                  rows={2}
                  placeholder="Explain why the answer is correct for participants after round finishes..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-850">
                {isEditingQuestion && editingQuestion?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      const q = editingQuestion as QuizQuestion;
                      setEditingQuestion(null);
                      requestDeleteQuestion(q);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-900 border border-rose-800/80 flex items-center gap-1.5 transition-colors cursor-pointer font-mono"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Question
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingQuestion(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-colors cursor-pointer"
                  >
                    Save Question
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STAGE EDITOR */}
      {editingStage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <h3 className="text-base font-bold text-white">
              {isEditingStage ? 'Edit Quiz Stage' : 'Create Quiz Stage'}
            </h3>

            <form onSubmit={handleSaveStage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Stage Number</label>
                <input
                  type="number"
                  value={editingStage.stageNumber || 1}
                  onChange={(e) => setEditingStage({ ...editingStage, stageNumber: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Stage Title</label>
                <input
                  type="text"
                  value={editingStage.title || ''}
                  onChange={(e) => setEditingStage({ ...editingStage, title: e.target.value })}
                  placeholder="e.g. Stage 1: Syntax &amp; Output Prediction"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Description</label>
                <textarea
                  value={editingStage.description || ''}
                  onChange={(e) => setEditingStage({ ...editingStage, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStage(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                >
                  Save Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SCORE OVERRIDE */}
      {overrideModalTeam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <h3 className="text-base font-bold text-white">
              Score Adjustment: {overrideModalTeam.teamName}
            </h3>

            <form onSubmit={handleSaveScoreOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Adjustment Type</label>
                <select
                  value={overrideForm.type}
                  onChange={(e) => setOverrideForm({ ...overrideForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                >
                  <option value="override">Set Exact Score</option>
                  <option value="bonus">Add Bonus Points (+)</option>
                  <option value="penalty">Deduct Penalty (-)</option>
                  <option value="reset">Reset to Calculated Score</option>
                </select>
              </div>

              {overrideForm.type !== 'reset' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    {overrideForm.type === 'override'
                      ? 'New Final Score'
                      : overrideForm.type === 'bonus'
                      ? 'Bonus Points'
                      : 'Penalty Points'}
                  </label>
                  <input
                    type="number"
                    value={overrideForm.value}
                    onChange={(e) => setOverrideForm({ ...overrideForm, value: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Audit Note</label>
                <textarea
                  value={overrideForm.note}
                  onChange={(e) => setOverrideForm({ ...overrideForm, note: e.target.value })}
                  placeholder="Reason for adjustment (recorded in audit trail)..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalTeam(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                >
                  Apply Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUALIFY TEAMS */}
      {qualifyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-400" />
              Round 2 Team Qualification Tool
            </h3>
            <p className="text-xs text-slate-400">
              Qualify teams based on Round 2 performance without automatically advancing to Round 3.
            </p>

            <div className="space-y-4 pt-2">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white block">Method A: Qualify Top N Teams</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={qualifyTopN}
                    onChange={(e) => setQualifyTopN(Number(e.target.value))}
                    min={1}
                    className="w-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                  />
                  <button
                    onClick={() => handleQualifyTeams('topN')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Qualify Top {qualifyTopN}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white block">Method B: Minimum Score Threshold</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={qualifyMinScore}
                    onChange={(e) => setQualifyMinScore(Number(e.target.value))}
                    min={0}
                    className="w-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                  />
                  <button
                    onClick={() => handleQualifyTeams('minScore')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Qualify &ge; {qualifyMinScore} pts
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setQualifyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAIRNESS WARNING MODAL */}
      {fairnessWarning && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/60 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Competition Fairness Confirmation</h4>
                <span className="text-[10px] text-amber-400 font-mono">Irreversible Action</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You are about to execute: <strong>{fairnessWarning.action}</strong>.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will immediately recompute points for all affected teams and recalculate the live standings.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setFairnessWarning(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const exec = fairnessWarning.execute;
                  setFairnessWarning(null);
                  await exec();
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-md shadow-amber-600/30 cursor-pointer"
              >
                Confirm &amp; Recalculate Scores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAFE CONFIRMATION DIALOG (Works reliably in iframe without window.confirm suppression) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                confirmDialog.isDangerous
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}>
                {confirmDialog.isDangerous ? (
                  <Trash2 className="w-5 h-5 text-rose-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-white text-base font-tactical">{confirmDialog.title}</h4>
                <span className="text-[10px] text-slate-400 font-mono">Confirmation Required</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed break-words whitespace-pre-wrap font-sans">
              {confirmDialog.message}
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50 font-mono"
              >
                {confirmDialog.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={async () => {
                  setIsConfirming(true);
                  try {
                    await confirmDialog.onConfirm();
                  } finally {
                    setIsConfirming(false);
                    setConfirmDialog(null);
                  }
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 font-mono ${
                  confirmDialog.isDangerous
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40'
                }`}
              >
                {isConfirming ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Processing...
                  </>
                ) : (
                  confirmDialog.confirmText || 'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
