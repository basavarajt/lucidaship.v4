import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  UploadCloud, ArrowRight, ArrowLeft, Download, Lock,
  Sparkles, Trophy, ChevronDown, ChevronUp, X, AlertCircle,
  CheckCircle2, Loader, FileSpreadsheet, Zap, BarChart3, Target,
  Mail, Building, ArrowUpRight
} from 'lucide-react';
import { auth, googleProvider } from '../firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { scoringApi } from '../api/client';

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────
const FREE_ROW_LIMIT = 100;
const ROWS_PER_PAGE = 25;

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function RankingPage() {
  // ── Auth state ──
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('register'); // 'register' | 'login'
  const [authReason, setAuthReason] = useState('');

  // ── Upload state ──
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── Training config ──
  const [trainingMode, setTrainingMode] = useState('unsupervised');
  const [targetColumn, setTargetColumn] = useState('');
  const [modelName, setModelName] = useState('RankModel-01');

  // ── Pipeline state ──
  const [currentPhase, setCurrentPhase] = useState('upload'); // 'upload' | 'configure' | 'training' | 'results'
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState(null);

  // ── Results state ──
  const [rankedResults, setRankedResults] = useState(null);
  const [trainingMetrics, setTrainingMetrics] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState(null);

  // Check auth on mount
  useEffect(() => {
    const isAuth = localStorage.getItem('lucida_authenticated');
    if (isAuth) setIsAuthenticated(true);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // FILE HANDLING
  // ─────────────────────────────────────────────────────────────
  const parseCSVPreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        setError('CSV must have at least a header row and one data row.');
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1, 6).map(line => {
        const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
        return obj;
      });
      setPreviewHeaders(headers);
      setPreviewRows(rows);
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      setUploadedFile(file);
      setError(null);
      parseCSVPreview(file);
    } else {
      setError('Please upload a .csv file');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.csv')) {
      setUploadedFile(file);
      setError(null);
      parseCSVPreview(file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setPreviewRows([]);
    setPreviewHeaders([]);
    setError(null);
  };

  // ─────────────────────────────────────────────────────────────
  // TRAINING + SCORING PIPELINE (Real Backend)
  // ─────────────────────────────────────────────────────────────
  const executePipeline = async () => {
    if (!uploadedFile) return;
    setIsProcessing(true);
    setError(null);
    setCurrentPhase('training');
    setProgress(0);
    setProgressLabel('Uploading data...');

    // Simulate progress for UX (backend doesn't stream progress for sync calls)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 85) return prev;
        return prev + Math.random() * 8;
      });
    }, 500);

    try {
      // Step 1: Train
      setProgressLabel('Training ML model...');
      const trainResp = await scoringApi.train(
        modelName,
        [uploadedFile],
        targetColumn || null,
        trainingMode
      );

      setTrainingMetrics(trainResp.data);
      setProgress(60);
      setProgressLabel('Scoring and ranking leads...');

      // Step 2: Score the same file
      const scoreResp = await scoringApi.score(modelName, [uploadedFile], false);
      setProgress(95);
      setProgressLabel('Building ranked list...');

      // Small delay for visual effect
      await new Promise(r => setTimeout(r, 600));
      setProgress(100);

      setRankedResults(scoreResp.data);
      setCurrentPhase('results');
      setCurrentPage(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const backendErr = err.response?.data?.error?.message || err.response?.data?.detail;
      setError(backendErr || err.message || 'Pipeline failed. Please check your CSV format.');
      setCurrentPhase('configure');
    } finally {
      clearInterval(progressInterval);
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // DOWNLOAD HANDLER (gated)
  // ─────────────────────────────────────────────────────────────
  const downloadRankedResults = () => {
    if (!rankedResults?.results) return;

    const rowsToExport = rankedResults.results;

    const headers = ['Rank', 'Profile_Score_%', 'Engagement_Score_%', 'Recommended_Action', 'Action_Priority', 'Top_Leading_Factors'];
    const dataKeys = new Set();
    rowsToExport.forEach(r => Object.keys(r.data).forEach(k => dataKeys.add(k)));
    const dataKeysArr = Array.from(dataKeys);
    headers.push(...dataKeysArr);

    const csvRows = [];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

    rowsToExport.forEach((row, idx) => {
      const profileScore = row.profile_score ?? row.score;
      const engagementScore = row.engagement_score;
      const cols = [
        idx + 1,
        profileScore?.toFixed(2) ?? '',
        engagementScore !== null && engagementScore !== undefined ? engagementScore.toFixed(2) : '',
        row.recommended_action || '',
        row.action_priority || '',
        `"${(row.top_drivers || []).join(' | ')}"`
      ];
      dataKeysArr.forEach(k => {
        let val = row.data[k];
        if (val === null || val === undefined) val = '';
        val = String(val).replace(/"/g, '""');
        cols.push(`"${val}"`);
      });
      csvRows.push(cols.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lucida-ranked-${modelName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    localStorage.setItem('lucida_rank_downloaded', 'true');
  };

  const handleDownload = () => {
    if (!isAuthenticated) {
      setAuthReason('download');
      setAuthMode('register');
      setShowAuthModal(true);
      return;
    }

    downloadRankedResults();
  };

  // ─────────────────────────────────────────────────────────────
  // AUTH HANDLERS (in-page modal)
  // ─────────────────────────────────────────────────────────────
  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    setShowAuthModal(false);
    if (authReason === 'download') {
      setTimeout(() => downloadRankedResults(), 500);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // DERIVED VALUES
  // ─────────────────────────────────────────────────────────────
  const totalResults = rankedResults?.results?.length || 0;
  const visibleLimit = isAuthenticated ? totalResults : Math.min(totalResults, FREE_ROW_LIMIT);
  const totalPages = Math.ceil(visibleLimit / ROWS_PER_PAGE);
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const endIdx = Math.min(startIdx + ROWS_PER_PAGE, visibleLimit);
  const displayedRows = rankedResults?.results?.slice(startIdx, endIdx) || [];
  const hasLockedRows = !isAuthenticated && totalResults > FREE_ROW_LIMIT;
  const isAtVisibleRowLimit = hasLockedRows && currentPage >= totalPages;
  const isNextDisabled = !isAtVisibleRowLimit && currentPage >= totalPages;

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const requestUnlockRows = () => {
    setAuthReason('unlock');
    setAuthMode('register');
    setShowAuthModal(true);
  };

  const handleNextPage = () => {
    if (isAtVisibleRowLimit) {
      requestUnlockRows();
      return;
    }
    setCurrentPage(p => Math.min(totalPages, p + 1));
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/30 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />

      {/* ── Navbar ── */}
      <nav className="relative z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 border border-blue-500/50 flex items-center justify-center font-mono text-[0.8rem] text-blue-400 group-hover:bg-blue-500/10 transition-colors rounded-sm relative overflow-hidden">
                <span className="relative z-10">L</span>
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="font-serif font-semibold text-xl tracking-wide text-gray-100">
                Lucida<span className="text-blue-500 font-light">Analytics</span><span className="text-gray-500">.tech</span>
              </span>
            </Link>

            <div className="flex items-center gap-6">
              <Link to="/" className="font-mono text-[0.75rem] tracking-[0.15em] uppercase text-gray-400 hover:text-white transition-colors hidden md:inline">
                Home
              </Link>
              {isAuthenticated ? (
                <Link to="/dashboard" className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-400 transition-all font-mono text-[0.7rem] uppercase tracking-wider">
                  Dashboard <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <>
                  <Link to="/login" className="font-mono text-[0.75rem] tracking-[0.15em] uppercase text-gray-400 hover:text-white transition-colors">
                    Log in
                  </Link>
                  <Link to="/register" className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-400 transition-all font-mono text-[0.7rem] uppercase tracking-wider">
                    Get Started <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* ── PHASE: UPLOAD ── */}
        {currentPhase === 'upload' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            {/* Hero */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono uppercase tracking-[0.2em] mb-8">
                <Trophy className="w-3.5 h-3.5" />
                Free Lead Ranking
              </div>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-light tracking-tight mb-8 leading-[0.98]">
                Rank Your Leads With{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 italic">
                  Machine Learning
                </span>
              </h1>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto font-light leading-[1.85] mb-4">
                Upload any CSV, train a custom ML model, and get your leads ranked by conversion probability.
                See your top 100 leads free — no account required.
              </p>
              <p className="text-sm text-gray-500 font-mono tracking-wider">
                * Ranking is free without signup. Register or sign in only to download or view beyond 100 rows.
              </p>
            </div>

            {/* How it Works — Compact */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              {[
                { icon: <UploadCloud className="w-6 h-6" />, title: 'Upload CSV', desc: 'Any schema. We auto-detect columns.' },
                { icon: <Zap className="w-6 h-6" />, title: 'Train & Rank', desc: 'ML model trained on your data in seconds.' },
                { icon: <BarChart3 className="w-6 h-6" />, title: 'Review Results', desc: 'See the top 100 instantly. Sign in to export or unlock every row.' }
              ].map((step, i) => (
                <div key={i} className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-blue-500/30 transition-colors group">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500" />
                  <div className="w-12 h-12 rounded-full border border-blue-500/40 bg-blue-500/10 flex items-center justify-center mb-4 text-blue-400">
                    {step.icon}
                  </div>
                  <h3 className="font-serif text-xl font-light text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-400 font-light">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Upload Zone */}
            <div className="max-w-3xl mx-auto">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                  isDragging ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_40px_rgba(59,130,246,0.15)]' : 'border-white/10 hover:border-blue-500/50 hover:bg-white/[0.02]'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".csv"
                  onChange={handleFileSelect}
                />
                <UploadCloud className={`w-12 h-12 mb-6 transition-colors ${isDragging ? 'text-blue-400' : 'text-gray-500'}`} />
                <span className="font-serif text-2xl font-light mb-3 text-white">Drop your CSV here</span>
                <span className="font-mono text-[0.7rem] tracking-[0.15em] text-gray-500 uppercase">
                  or click to browse • Any schema accepted
                </span>
              </div>

              {/* File preview */}
              {uploadedFile && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                      <div>
                        <span className="text-white text-sm font-medium">{uploadedFile.name}</span>
                        <span className="text-gray-500 text-xs ml-3">{(uploadedFile.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeFile(); }} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preview table */}
                  {previewRows.length > 0 && (
                    <div className="mt-4 rounded-xl border border-white/10 overflow-hidden">
                      <div className="px-4 py-3 bg-white/[0.03] border-b border-white/10">
                        <span className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-gray-500">
                          Preview — First {previewRows.length} rows • {previewHeaders.length} columns
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              {previewHeaders.slice(0, 6).map(h => (
                                <th key={h} className="text-left px-4 py-3 text-gray-400 font-mono text-[0.65rem] tracking-wider uppercase whitespace-nowrap">{h}</th>
                              ))}
                              {previewHeaders.length > 6 && (
                                <th className="text-left px-4 py-3 text-gray-500 font-mono text-[0.6rem]">+{previewHeaders.length - 6} more</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, i) => (
                              <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                                {previewHeaders.slice(0, 6).map(h => (
                                  <td key={h} className="px-4 py-2.5 text-gray-300 text-xs whitespace-nowrap max-w-[200px] truncate">{row[h]}</td>
                                ))}
                                {previewHeaders.length > 6 && (
                                  <td className="px-4 py-2.5 text-gray-600 text-xs">...</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Proceed button */}
                  <button
                    onClick={() => setCurrentPhase('configure')}
                    className="mt-6 w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 group text-sm"
                  >
                    Configure & Train <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm flex items-center gap-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── PHASE: CONFIGURE ── */}
        {currentPhase === 'configure' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
            <button onClick={() => setCurrentPhase('upload')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 font-mono text-xs uppercase tracking-wider">
              <ArrowLeft className="w-4 h-4" /> Back to Upload
            </button>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 sm:p-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500" />

              <h2 className="text-3xl font-serif font-light text-white mb-2">Configure Training</h2>
              <p className="text-gray-400 text-sm font-light mb-8">
                Set up your model parameters. The ML engine will automatically detect features and build a ranking model.
              </p>

              {/* File indicator */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 mb-8">
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">{uploadedFile?.name}</span>
                <span className="text-xs text-gray-500 ml-auto">{(uploadedFile?.size / 1024).toFixed(1)} KB</span>
              </div>

              {/* Model Name */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Model Name</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="RankModel-01"
                />
              </div>

              {/* Training Mode */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-3">Training Mode</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    trainingMode === 'unsupervised'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-white/10 hover:border-white/30 text-gray-300'
                  }`}>
                    <input type="radio" name="mode" value="unsupervised" checked={trainingMode === 'unsupervised'} onChange={(e) => setTrainingMode(e.target.value)} className="hidden" />
                    <div className="font-medium mb-1">Unsupervised</div>
                    <div className="text-xs text-gray-500">Ranks rows without labels. Best for new lists.</div>
                  </label>
                  <label className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    trainingMode === 'supervised'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-white/10 hover:border-white/30 text-gray-300'
                  }`}>
                    <input type="radio" name="mode" value="supervised" checked={trainingMode === 'supervised'} onChange={(e) => setTrainingMode(e.target.value)} className="hidden" />
                    <div className="font-medium mb-1">Supervised</div>
                    <div className="text-xs text-gray-500">Uses a target column (e.g., "converted").</div>
                  </label>
                </div>
              </div>

              {/* Target Column (only for supervised) */}
              {trainingMode === 'supervised' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">Target Column <span className="text-gray-600">(auto-detected if blank)</span></label>
                  <select
                    value={targetColumn}
                    onChange={(e) => setTargetColumn(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="">Auto-Detect</option>
                    {previewHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </motion.div>
              )}

              {error && (
                <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm flex items-center gap-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Execute */}
              <button
                onClick={executePipeline}
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Target className="w-5 h-5" />
                Train Model & Rank My List
              </button>
            </div>
          </motion.div>
        )}

        {/* ── PHASE: TRAINING ── */}
        {currentPhase === 'training' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto text-center py-20">
            <div className="w-20 h-20 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-8">
              <Loader className="w-10 h-10 animate-spin" />
            </div>
            <h2 className="text-3xl font-serif font-light text-white mb-4">Training Your Model</h2>
            <p className="text-gray-400 text-sm mb-10">{progressLabel}</p>

            {/* Progress bar */}
            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mb-4">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="font-mono text-[0.7rem] tracking-wider text-gray-500">
              {Math.round(progress)}% complete
            </div>

            {/* Pipeline steps */}
            <div className="mt-12 space-y-4 text-left max-w-md mx-auto">
              {[
                { label: 'Uploading data', done: progress > 10 },
                { label: 'Detecting features', done: progress > 25 },
                { label: 'Training ML model', done: progress > 55 },
                { label: 'Scoring & ranking leads', done: progress > 75 },
                { label: 'Finalizing results', done: progress >= 95 }
              ].map((step, i) => (
                <div key={i} className={`flex items-center gap-3 text-sm transition-colors ${step.done ? 'text-green-400' : 'text-gray-500'}`}>
                  {step.done ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-gray-600" />}
                  {step.label}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── PHASE: RESULTS ── */}
        {currentPhase === 'results' && rankedResults && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Results Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-3xl font-serif font-light text-white">Ranked Results</h2>
                </div>
                <p className="text-gray-400 text-sm font-light">
                  {totalResults} leads ranked by {rankedResults.model_name || modelName}
                  {!isAuthenticated && totalResults > FREE_ROW_LIMIT && (
                    <span className="text-blue-400 ml-2">• Showing top {FREE_ROW_LIMIT} of {totalResults}</span>
                  )}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setCurrentPhase('upload'); setRankedResults(null); setUploadedFile(null); setPreviewRows([]); setPreviewHeaders([]); }}
                  className="px-5 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition-all text-sm font-mono uppercase tracking-wider"
                >
                  Rank Another List
                </button>
                <button
                  onClick={handleDownload}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 transition-all text-sm font-medium flex items-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  <Download className="w-4 h-4" />
                  {isAuthenticated ? 'Download CSV' : 'Register to Download'}
                </button>
              </div>
            </div>

            {/* Training Metrics Summary */}
            {trainingMetrics?.metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Accuracy', value: `${((trainingMetrics.metrics.accuracy || 0) * 100).toFixed(1)}%`, color: 'text-blue-400' },
                  { label: 'ROC AUC', value: `${((trainingMetrics.metrics.roc_auc || 0) * 100).toFixed(1)}`, color: 'text-indigo-400' },
                  { label: 'Precision', value: `${((trainingMetrics.metrics.precision || 0) * 100).toFixed(1)}%`, color: 'text-purple-400' },
                  { label: 'Leads Scored', value: totalResults.toLocaleString(), color: 'text-green-400' }
                ].map((m, i) => (
                  <div key={i} className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="font-mono text-[0.6rem] tracking-[0.2em] uppercase text-gray-500 mb-2">{m.label}</div>
                    <div className={`text-2xl font-serif font-light ${m.color}`}>{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Results Table */}
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              {/* Table header */}
              <div className="bg-white/[0.03] border-b border-white/10 px-6 py-4 flex justify-between items-center">
                <span className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-gray-500">
                  Showing {startIdx + 1}–{endIdx} of {visibleLimit} leads
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${currentPage <= 1 ? 'border-white/5 text-gray-700 cursor-not-allowed' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'}`}
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-gray-500 font-mono px-2">
                      {currentPage}/{totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={isNextDisabled}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${isNextDisabled ? 'border-white/5 text-gray-700 cursor-not-allowed' : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'}`}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>

              {/* Lead rows */}
              <div className="divide-y divide-white/5">
                {displayedRows.map((row, i) => {
                  const globalIdx = startIdx + i;
                  const rank = globalIdx + 1;
                  const profileScore = row.profile_score ?? row.score ?? 0;
                  const engagementScore = row.engagement_score;
                  const hasEngagement = engagementScore !== null && engagementScore !== undefined;
                  const isExpanded = expandedRow === globalIdx;

                  return (
                    <div
                      key={globalIdx}
                      className="px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(isExpanded ? null : globalIdx)}
                    >
                      {/* Main row */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        {/* Rank */}
                        <div className="font-serif text-2xl text-gray-600 w-16">#{rank}</div>

                        {/* Profile Score */}
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-[0.55rem] tracking-wider uppercase text-gray-500">Profile</div>
                          <span className="font-mono text-base text-white">{profileScore.toFixed(1)}<span className="text-[0.6em] text-gray-500">%</span></span>
                          <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: `${Math.min(profileScore, 100)}%` }} />
                          </div>
                        </div>

                        {/* Engagement Score */}
                        {hasEngagement && (
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-[0.55rem] tracking-wider uppercase text-gray-500">Engagement</div>
                            <span className="font-mono text-base text-white">{engagementScore.toFixed(1)}<span className="text-[0.6em] text-gray-500">%</span></span>
                            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${engagementScore >= 50 ? 'bg-sky-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(engagementScore, 100)}%` }} />
                            </div>
                          </div>
                        )}

                        {/* Action Badge */}
                        {row.recommended_action && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                            row.action_color === 'green' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            row.action_color === 'yellow' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                            row.action_color === 'orange' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                            'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                            {row.action_emoji && <span>{row.action_emoji}</span>}
                            {row.recommended_action}
                          </span>
                        )}

                        {/* Expand toggle */}
                        <div className="ml-auto text-gray-600">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {/* Top Drivers */}
                      {row.top_drivers?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {row.top_drivers.slice(0, 4).map((drv, idx) => (
                            <span key={idx} className="inline-block px-2.5 py-0.5 text-[0.6rem] font-mono tracking-wider uppercase border border-white/10 rounded-full text-gray-400">
                              {drv}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t border-white/5"
                          >
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {Object.entries(row.data || {}).slice(0, 12).map(([key, val]) => (
                                <div key={key} className="p-2 rounded bg-white/[0.02]">
                                  <div className="text-[0.55rem] font-mono uppercase text-gray-600 tracking-wider truncate">{key}</div>
                                  <div className="text-sm text-gray-300 truncate">{val !== null && val !== undefined ? String(val) : '—'}</div>
                                </div>
                              ))}
                            </div>
                            {row.rationale_summary && (
                              <p className="mt-3 text-xs text-gray-500 leading-relaxed">{row.rationale_summary}</p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Pagination */}
              {totalPages > 1 && (
                <div className="bg-white/[0.02] border-t border-white/10 px-6 py-4 flex justify-between items-center">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className={`px-4 py-2 rounded-lg border text-sm font-mono transition-colors ${currentPage <= 1 ? 'border-white/5 text-gray-700 cursor-not-allowed' : 'border-white/10 text-gray-400 hover:text-white'}`}
                  >
                    ← Previous
                  </button>
                  <span className="text-sm text-gray-500 font-mono">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={isNextDisabled}
                    className={`px-4 py-2 rounded-lg border text-sm font-mono transition-colors ${isNextDisabled ? 'border-white/5 text-gray-700 cursor-not-allowed' : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'}`}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>

            {/* ── LOCKED ROWS OVERLAY ── */}
            {hasLockedRows && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 rounded-2xl border border-blue-500/30 bg-gradient-to-b from-blue-500/10 to-transparent p-8 text-center relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50 pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-6">
                    <Lock className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-serif font-light text-white mb-3">
                    {totalResults - FREE_ROW_LIMIT} more leads are hidden
                  </h3>
                  <p className="text-gray-400 text-sm max-w-md mx-auto mb-6 font-light">
                    Register for free to unlock the full ranked list and download your results. No credit card required.
                  </p>
                  <button
                    onClick={requestUnlockRows}
                    className="px-8 py-3 bg-white text-black font-medium rounded-full hover:bg-gray-100 transition-colors inline-flex items-center gap-2"
                  >
                    Register to Unlock All Leads <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </main>

      {/* ── AUTH MODAL ── */}
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            mode={authMode}
            onModeSwitch={setAuthMode}
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleAuthSuccess}
            reason={authReason}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AUTH MODAL (In-page registration/login)
// ─────────────────────────────────────────────────────────────────
function AuthModal({ mode, onModeSwitch, onClose, onSuccess, reason }) {
  const [formData, setFormData] = useState({ company_name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let userCredential;

      if (mode === 'register') {
        if (!formData.company_name.trim() || !formData.email.trim() || !formData.password) {
          throw new Error('All fields are required.');
        }
        userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await updateProfile(userCredential.user, { displayName: formData.company_name.trim() });
      } else {
        if (!formData.email.trim() || !formData.password) {
          throw new Error('Email and password are required.');
        }
        userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      }

      const token = await userCredential.user.getIdToken();
      localStorage.setItem('access_token', token);
      localStorage.setItem('lucida_authenticated', 'true');
      if (mode === 'register') {
        localStorage.setItem('lucida_profile', JSON.stringify({
          company_name: formData.company_name.trim(),
          email: formData.email.trim(),
        }));
      }

      onSuccess();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const token = await userCredential.user.getIdToken();
      localStorage.setItem('access_token', token);
      localStorage.setItem('lucida_authenticated', 'true');
      onSuccess();
    } catch (err) {
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const reasonText = reason === 'download'
    ? 'Create a free account to download your ranked list'
    : reason === 'unlock'
    ? 'Register to see all your ranked leads'
    : 'Sign in to continue';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-gray-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors z-10">
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
              {reason === 'download' ? <Download className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>
            <h3 className="text-xl font-serif text-white mb-2">
              {mode === 'register' ? 'Create Free Account' : 'Welcome Back'}
            </h3>
            <p className="text-sm text-gray-400">{reasonText}</p>
            {reason === 'download' && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
                <Sparkles className="w-3 h-3" /> First download is free
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm flex items-center gap-3 rounded-lg mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-mono uppercase tracking-wider">
                  <Building className="w-3 h-3 inline mr-1.5" />Company Name
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                  placeholder="Acme Corp"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-mono uppercase tracking-wider">
                <Mail className="w-3 h-3 inline mr-1.5" />Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-mono uppercase tracking-wider">
                <Lock className="w-3 h-3 inline mr-1.5" />Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
              ) : (
                <>{mode === 'register' ? 'Create Account' : 'Sign In'} <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 h-px bg-white/10" />
            <span className="px-3 text-xs text-gray-500 font-mono uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3 bg-transparent border border-white/10 text-white rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 text-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Toggle mode */}
          <p className="text-center text-xs text-gray-500 mt-6">
            {mode === 'register' ? (
              <>Already have an account? <button onClick={() => onModeSwitch('login')} className="text-blue-400 hover:text-white transition-colors">Sign In</button></>
            ) : (
              <>Need an account? <button onClick={() => onModeSwitch('register')} className="text-blue-400 hover:text-white transition-colors">Register Free</button></>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
