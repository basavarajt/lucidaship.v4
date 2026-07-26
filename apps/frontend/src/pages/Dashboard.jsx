import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client, { scoringApi, modelsApi } from '../api/client';
import { LogOut, UploadCloud, Database, Download, CheckCircle2, Trash2, AlertCircle, Loader, File as FileIcon, Target, Activity, X, BrainCircuit, Lock } from 'lucide-react';
import ProgressBar from '../components/ProgressBar';
import UpgradeModal from '../components/UpgradeModal';
import axios from 'axios';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState('train'); // 'train' | 'score' | 'feedback' | 'models'

  // Progress Tracking State
  const [progressType, setProgressType] = useState(null); // 'train' | 'score' | 'feedback' | null
  const [estimatedTime, setEstimatedTime] = useState(30); // Default estimate in seconds

  // Uploader State
  const [files, setFiles] = useState([]);
  const [modelName, setModelName] = useState(() => {
    return localStorage.getItem('lucida_last_model') || 'Ensemble-01';
  });
  const [targetCol, setTargetCol] = useState('');
  const [isHovering, setIsHovering] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const [trainingMode, setTrainingMode] = useState('supervised'); // 'supervised' | 'unsupervised'
  const [autoSelectModel, setAutoSelectModel] = useState(true);
  const [selectModelFromList, setSelectModelFromList] = useState(false);

  // Results State
  const [trainingData, setTrainingData] = useState(null);
  const [scoringData, setScoringData] = useState(null);
  const [feedbackData, setFeedbackData] = useState(null);
  const [feedbackRetrainData, setFeedbackRetrainData] = useState(null);
  const [segmentRetrainData, setSegmentRetrainData] = useState(null);
  const [viewFilter, setViewFilter] = useState('all'); // 'top100' | 'top500' | 'all' | 'worst100'
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PER_PAGE = 100;
  const [outcomeColumn, setOutcomeColumn] = useState('');
  const [feedbackWeight, setFeedbackWeight] = useState(2);
  const [autoRetrainEnabled, setAutoRetrainEnabled] = useState(true);


  // Registry State
  const [modelsArchive, setModelsArchive] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModelIntel, setSelectedModelIntel] = useState(null);

  useEffect(() => {
    const isAuth = localStorage.getItem('lucida_authenticated');
    if (!isAuth) {
      navigate('/login');
      return;
    }

    let profile = { email: '', company_name: '' };
    try {
      const raw = localStorage.getItem('lucida_profile');
      if (raw) {
        profile = { ...profile, ...JSON.parse(raw) };
      }
    } catch {
      // Ignore malformed profile data.
    }

    setUser({
      email: profile.email,
      company_name: profile.company_name,
      role: 'admin',
    });

    // Fetch up-to-date plan status from backend
    client.get('/auth/me').then(res => {
      if (res.data && res.data.data && res.data.data.plan !== 'free') {
        setIsPremium(true);
      } else {
        setIsPremium(false);
      }
    }).catch(err => console.error("Failed to fetch plan:", err));

    setLoading(false);
  }, [navigate]);



  useEffect(() => {
    if (activeTab === 'models') {
      loadModels();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'score' && modelsArchive.length === 0) {
      loadModels();
    }
  }, [activeTab, modelsArchive.length]);

  useEffect(() => {
    if (activeTab === 'feedback' && modelName) {
      loadModelIntel(modelName);
    }
  }, [activeTab, modelName]);

  useEffect(() => {
    if (modelName) {
      localStorage.setItem('lucida_last_model', modelName);
    }
  }, [modelName]);

  const loadModels = async () => {
    setModelsLoading(true);
    setError(null);
    try {
      const resp = await modelsApi.list();
      setModelsArchive(resp.data.models);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Archive linkage failed.");
    } finally {
      setModelsLoading(false);
    }
  };

  const loadModelIntel = async (name) => {
    try {
      const resp = await modelsApi.get(name);
      setSelectedModelIntel(resp.data);
    } catch {
      setSelectedModelIntel(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('lucida_authenticated');
    localStorage.removeItem('lucida_auth_time');
    localStorage.removeItem('lucida_profile');
    localStorage.removeItem('access_token');
    navigate('/login');
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setError(null);
    setFiles([]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsHovering(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    setFiles(prev => [...prev, ...dropped]);
  };

  const handleChange = (e) => {
    const selected = Array.from(e.target.files).filter(f => f.name.endsWith('.csv'));
    setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const executePipeline = async () => {
    if (files.length === 0) {
      setError("Please stage at least one CSV payload.");
      return;
    }
    setActionLoading(true);
    setError(null);
    setProgressType(activeTab);
    
    // Estimate time based on file size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const estimatedSeconds = activeTab === 'train' 
      ? Math.max(30, Math.ceil(totalSize / 1024 / 100)) // ~100KB per second
      : activeTab === 'score'
      ? Math.max(15, Math.ceil(totalSize / 1024 / 500)) // ~500KB per second (faster)
      : Math.max(20, Math.ceil(totalSize / 1024 / 300)); // ~300KB per second for feedback
    
    setEstimatedTime(estimatedSeconds);
    
    try {
      if (activeTab === 'train') {
        const resp = await scoringApi.train(modelName, files, targetCol, trainingMode);
        setTrainingData(resp.data);
      } else if (activeTab === 'score') {
        const resp = await scoringApi.score(modelName, files, autoSelectModel);
        setScoringData(resp.data);
      } else if (activeTab === 'feedback') {
        const resp = await scoringApi.feedback(modelName, files[0], outcomeColumn, autoRetrainEnabled, feedbackWeight);
        setFeedbackData(resp.data);
        loadModelIntel(modelName);
      }
      setFiles([]);
    } catch (err) {
      const backendErr = err.response?.data?.error?.message || err.response?.data?.detail;
      
      if (backendErr && backendErr.includes("FREE_LIMIT_REACHED")) {
        setShowUpgradeModal(true);
      } else {
        setError(backendErr || err.message || "An unexpected anomaly occurred.");
      }
    } finally {
      setActionLoading(false);
      setProgressType(null);
    }
  };



  const handleDeleteModel = async (mName) => {
    if (!window.confirm(`Are you sure you want to delete model '${mName}'? This action cannot be undone.`)) return;
    try {
      await modelsApi.delete(mName);
      setModelsArchive(prev => prev.filter(m => m.model_name !== mName));
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete model. Please try again.");
    }
  };

  const handleCancelSubscription = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await client.post('/billing/cancel');
      setShowCancelModal(false);
      alert("Cancellation requested successfully. A support ticket has been created on your behalf.");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit cancellation request. Please email support directly.");
      setShowCancelModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetrainFromFeedback = async () => {
    setActionLoading(true);
    setError(null);
    setProgressType('train');
    setEstimatedTime(30); // Default 30s for retrain
    try {
      const resp = await scoringApi.retrainFromFeedback(modelName, feedbackWeight);
      setFeedbackRetrainData(resp.data);
      setTrainingData(resp.data);
      loadModelIntel(modelName);
    } catch (err) {
      const backendErr = err.response?.data?.error?.message;
      const detailErr = err.response?.data?.detail;
      setError(backendErr || detailErr || err.message || "Feedback retrain failed.");
    } finally {
      setActionLoading(false);
      setProgressType(null);
    }
  };

  const handleSegmentRetrain = async (dimension, segment) => {
    setActionLoading(true);
    setError(null);
    try {
      const resp = await scoringApi.retrainSegmentFromFeedback(modelName, dimension, segment, feedbackWeight);
      setSegmentRetrainData(resp.data);
      loadModels();
      loadModelIntel(modelName);
    } catch (err) {
      const backendErr = err.response?.data?.error?.message;
      const detailErr = err.response?.data?.detail;
      setError(backendErr || detailErr || err.message || "Segment retrain failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!scoringData || !scoringData.results) return;

    const total = scoringData.results.length;
    let rowsToExport;
    let filterSuffix;

    if (viewFilter === 'worst100') {
      rowsToExport = [...scoringData.results].reverse().slice(0, 100);
      filterSuffix = 'worst-100';
    } else if (viewFilter.startsWith('top')) {
      const n = parseInt(viewFilter.replace('top', ''));
      rowsToExport = scoringData.results.slice(0, n);
      filterSuffix = `top-${n}`;
    } else {
      rowsToExport = scoringData.results;
      filterSuffix = 'all';
    }

    if (!isPremium && rowsToExport.length > 100) {
      setShowUpgradeModal(true);
      return;
    }

    const headers = ['Rank', 'Profile_Score_%', 'Engagement_Score_%', 'Recommended_Action', 'Action_Priority', 'Top_Leading_Factors', 'Top_Engagement_Signals'];
    const dataKeys = new Set();
    rowsToExport.forEach(r => Object.keys(r.data).forEach(k => dataKeys.add(k)));
    const dataKeysArr = Array.from(dataKeys);
    
    headers.push(...dataKeysArr);
    
    const csvRows = [];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
    
    rowsToExport.forEach((row, idx) => {
      const rank = viewFilter === 'worst100' ? total - idx : idx + 1;
      const profileScore = row.profile_score ?? row.score;
      const engagementScore = row.engagement_score;
      const cols = [
        rank,
        profileScore.toFixed(2),
        engagementScore !== null && engagementScore !== undefined ? engagementScore.toFixed(2) : '',
        row.recommended_action || '',
        row.action_priority || '',
        `"${row.top_drivers.join(' | ')}"`,
        `"${(row.top_engagement_signals || []).join(' | ')}"`
      ];
      
      dataKeysArr.forEach(k => {
        let val = row.data[k];
        if (val === null || val === undefined) val = '';
        val = String(val).replace(/"/g, '""');
        cols.push(`"${val}"`);
      });
      csvRows.push(cols.join(','));
    });
    
    const safeModelName = String(scoringData.model_name || 'scored').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `lucida-${filterSuffix}-${safeModelName}.csv`;

    // We will use the exact same logic as your reference ZIP archive. 
    // No BOM, no FileSaver, using setAttribute("download", ...).
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="font-mono text-[0.7rem] tracking-[0.25em] uppercase text-accent animate-pulse">Initializing Interface...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex flex-col relative text-white">
      <div className="bg-glow"></div>

      {/* ── Navbar ── */}
      <nav className="border-b border-line bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border border-accent flex items-center justify-center font-mono text-[0.7rem] text-accent">L</div>
              <span className="font-serif font-semibold text-lg tracking-wide">Lucida</span>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 font-mono text-[0.6rem] tracking-[0.15em] uppercase text-dim">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                <span className="hidden md:inline">{user?.company_name || user?.email}</span>
              </div>
              {isPremium ? (
                <button 
                  onClick={() => setShowCancelModal(true)}
                  className="font-mono text-[0.6rem] tracking-[0.15em] uppercase px-4 py-2 border border-red-500/50 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                >
                  Cancel Plan
                </button>
              ) : (
                <button 
                  onClick={() => setShowUpgradeModal(true)}
                  className="font-mono text-[0.6rem] tracking-[0.15em] uppercase px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded hover:opacity-90 transition-opacity"
                >
                  Upgrade
                </button>
              )}
              <button onClick={handleLogout} className="font-mono text-[0.6rem] tracking-[0.15em] uppercase border border-line px-4 py-2 text-dim hover:text-white hover:border-white transition-colors flex items-center gap-2">
                Sign Out <LogOut className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        
        <header className="mb-12 text-center">
          <div className="font-mono text-[0.65rem] tracking-[0.25em] uppercase text-accent mb-4">Dashboard</div>
          <h1 className="text-4xl md:text-5xl font-serif font-light mb-4">Adaptive Lead Scorer</h1>
          <p className="text-dim font-light max-w-2xl mx-auto">Upload any CSV → auto-detect patterns → get ML-powered lead scores. Zero configuration needed.</p>
        </header>

        {/* ── Tabs ── */}
        <div className="flex border border-line bg-surface/50 p-1 mb-8">
          <button 
            onClick={() => switchTab('train')}
            className={`flex-1 py-4 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-colors flex items-center justify-center gap-2 ${activeTab === 'train' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-dim hover:text-white'}`}
          >
            <Target className="w-4 h-4" /> Train Model
          </button>
          <button 
            onClick={() => switchTab('score')}
            className={`flex-1 py-4 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-colors flex items-center justify-center gap-2 ${activeTab === 'score' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-dim hover:text-white'}`}
          >
            <Activity className="w-4 h-4" /> Score Leads
          </button>
          <button 
            onClick={() => switchTab('models')}
            className={`flex-1 py-4 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-colors flex items-center justify-center gap-2 ${activeTab === 'models' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-dim hover:text-white'}`}
          >
            <Database className="w-4 h-4" /> Registry
          </button>
          <button
            onClick={() => switchTab('feedback')}
            className={`flex-1 py-4 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-colors flex items-center justify-center gap-2 ${activeTab === 'feedback' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-dim hover:text-white'}`}
          >
            <BrainCircuit className="w-4 h-4" /> Feedback Loop
          </button>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm font-sans flex items-start gap-3 mb-8">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="whitespace-pre-wrap">{typeof error === 'object' ? JSON.stringify(error) : error}</p>
          </div>
        )}

        {/* ── TRAIN TAB ── */}
        {activeTab === 'train' && (
          <section className="fade-in space-y-8">
            <div className="glass-card p-8 border border-line bg-surface/30">
              <h3 className="font-serif text-2xl font-light mb-2">Train a New Model</h3>
              <p className="text-dim text-sm mb-6 font-light">Upload a CSV with historical lead data. The system auto-detects columns, target variable, and trains an ML model.</p>
              
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
                onDragLeave={() => setIsHovering(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300 mb-6 ${isHovering ? 'border-accent bg-accent/5' : 'border-line hover:border-accent hover:bg-surface'} ${actionLoading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input type="file" ref={fileInputRef} className="hidden" multiple accept=".csv" onChange={handleChange} />
                <UploadCloud className={`w-8 h-8 mb-4 ${isHovering ? 'text-accent' : 'text-dim'}`} />
                <span className="font-serif text-xl font-light mb-2 text-white">Drop CSV files here</span>
                <span className="font-mono text-[0.6rem] tracking-[0.1em] text-dim">Upload multiple files to auto-join by matching columns</span>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mb-6">
                  {files.map((file, i) => (
                    <div key={i} className="flex justify-between items-center border border-line p-3 bg-surface">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon className="w-4 h-4 text-dim shrink-0" />
                        <span className="font-mono text-[0.7rem] truncate text-light">{file.name}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} disabled={actionLoading} className="text-dim hover:text-red-400 p-1"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="form-group mb-0 relative group">
                  <label className="block font-mono text-[0.6rem] tracking-[0.25em] uppercase text-dim mb-3">Model Name</label>
                  <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} disabled={actionLoading} className="glass-input px-4 py-3 text-sm w-full" placeholder="Ensemble-01" />
                </div>
                <div className="form-group mb-0 relative group">
                  <label className="block font-mono text-[0.6rem] tracking-[0.25em] uppercase text-dim mb-3">Target Column (Optional)</label>
                  <input type="text" value={targetCol} onChange={(e) => setTargetCol(e.target.value)} disabled={actionLoading} className="glass-input px-4 py-3 text-sm w-full" placeholder="Auto-Detect if blank" />
                </div>
              </div>

              <div className="mb-8 p-4 border border-line bg-surface/20">
                <label className="block font-mono text-[0.6rem] tracking-[0.25em] uppercase text-dim mb-4">Training Mode</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="trainingMode"
                      value="supervised"
                      checked={trainingMode === 'supervised'}
                      onChange={(e) => setTrainingMode(e.target.value)}
                      disabled={actionLoading}
                      className="w-4 h-4"
                    />
                    <span className="font-light text-sm">
                      <span className="text-white">Supervised</span>
                      <span className="text-dim text-xs ml-2">(requires binary target column)</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="trainingMode"
                      value="unsupervised"
                      checked={trainingMode === 'unsupervised'}
                      onChange={(e) => setTrainingMode(e.target.value)}
                      disabled={actionLoading}
                      className="w-4 h-4"
                    />
                    <span className="font-light text-sm">
                      <span className="text-accent">Unsupervised</span>
                      <span className="text-dim text-xs ml-2">(ranks rows without labels)</span>
                    </span>
                  </label>
                </div>
              </div>

              <ProgressBar 
                isActive={actionLoading && progressType === 'train'} 
                label="Model Training in Progress"
                estimatedTime={estimatedTime}
              />

              <button onClick={executePipeline} disabled={actionLoading || files.length === 0} className="btn-primary w-full flex justify-center items-center py-4 text-sm tracking-widest">
                {actionLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'TRAIN MODEL'}
              </button>

            </div>

            {/* Train Results */}
            {trainingData && (
              <div className="glass-card p-8 border border-accent/20 bg-accent/5 fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif text-2xl font-light">Training Complete</h3>
                  <div className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-accent border border-accent/30 px-3 py-1 flex items-center gap-2"><CheckCircle2 className="w-3 h-3"/> Success</div>
                </div>
                <p className="text-dim font-light mb-8">{trainingData.message}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Accuracy</div>
                    <div className="font-serif text-3xl font-light text-white">{(trainingData.metrics.accuracy * 100).toFixed(1)}%</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">ROC AUC</div>
                    <div className="font-serif text-3xl font-light text-white">{(trainingData.metrics.roc_auc * 100).toFixed(1)}</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Precision</div>
                    <div className="font-serif text-3xl font-light text-white">{(trainingData.metrics.precision * 100).toFixed(1)}%</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Recall</div>
                    <div className="font-serif text-3xl font-light text-white">{(trainingData.metrics.recall * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">P@Top 10%</div>
                    <div className="font-serif text-3xl font-light text-white">{((trainingData.metrics.precision_at_10_percent || 0) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">P@Top 20%</div>
                    <div className="font-serif text-3xl font-light text-white">{((trainingData.metrics.precision_at_20_percent || 0) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Lift @10%</div>
                    <div className="font-serif text-3xl font-light text-white">{(trainingData.metrics.lift_at_10_percent || 0).toFixed(2)}x</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Validation</div>
                    <div className="text-sm font-light text-white pt-2">
                      {trainingData.metrics.validation_context?.strategy || trainingData.analysis?.validation_context?.strategy || 'unknown'}
                    </div>
                  </div>
                </div>

                {trainingData.analysis?.target_diagnostics && (
                  <div className="mt-8 grid lg:grid-cols-2 gap-6">
                    <div className="p-5 bg-black border border-line">
                      <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-accent mb-3">Target Audit</div>
                      <div className="space-y-2 text-sm text-light">
                        <p>Selected target: <span className="text-white">{trainingData.analysis.target_column}</span></p>
                        <p>Recommendation: <span className="text-white">{trainingData.analysis.target_diagnostics.recommendation}</span></p>
                        <p>Candidate columns: <span className="text-white">{trainingData.analysis.target_diagnostics.candidate_count}</span></p>
                        <p>Confidence gap: <span className="text-white">{(trainingData.analysis.target_diagnostics.score_gap || 0).toFixed(3)}</span></p>
                        <p>Validation ref: <span className="text-white">{trainingData.analysis.validation_context?.reference_column || 'none'}</span></p>
                      </div>
                    </div>
                    <div className="p-5 bg-black border border-line">
                      <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-accent mb-3">Feature Blueprint</div>
                      <div className="space-y-2 text-sm text-light">
                        <p>Engineered features: <span className="text-white">{trainingData.analysis.feature_blueprint?.n_engineered_features || 0}</span></p>
                        <p>Strategies:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(trainingData.analysis.feature_blueprint?.strategy_counts || {}).map(([strategy, count]) => (
                            <span key={strategy} className="tag text-[0.5rem] tracking-widest">{strategy}: {count}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── SCORE TAB ── */}
        {activeTab === 'score' && (
          <section className="fade-in space-y-8">
            <div className="glass-card p-8 border border-line bg-surface/30">
              <h3 className="font-serif text-2xl font-light mb-2">Score Prospects</h3>
              <p className="text-dim text-sm mb-6 font-light">Upload a CSV of leads to score against an existing model. They will be ranked by conversion probability.</p>
              
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
                onDragLeave={() => setIsHovering(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300 mb-6 ${isHovering ? 'border-accent bg-accent/5' : 'border-line hover:border-accent hover:bg-surface'} ${actionLoading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input type="file" ref={fileInputRef} className="hidden" multiple accept=".csv" onChange={handleChange} />
                <Activity className={`w-8 h-8 mb-4 ${isHovering ? 'text-accent' : 'text-dim'}`} />
                <span className="font-serif text-xl font-light mb-2 text-white">Drop leads CSV here</span>
                <span className="font-mono text-[0.6rem] tracking-[0.1em] text-dim">Enrich or batch score by selecting multiple files simultaneously</span>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mb-6">
                  {files.map((file, i) => (
                    <div key={i} className="flex justify-between items-center border border-line p-3 bg-surface">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon className="w-4 h-4 text-dim shrink-0" />
                        <span className="font-mono text-[0.7rem] truncate text-light">{file.name}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} disabled={actionLoading} className="text-dim hover:text-red-400 p-1">✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group mb-8 relative group w-full md:w-1/2">
                <label className="block font-mono text-[0.6rem] tracking-[0.25em] uppercase text-dim mb-3">Select Model</label>
                <label className="flex items-center gap-3 mb-3 px-3 py-2 border border-line bg-surface/60 hover:border-accent/40 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectModelFromList}
                    onChange={(e) => setSelectModelFromList(e.target.checked)}
                    disabled={actionLoading}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="text-xs font-light text-light">
                    Select model from trained model list
                  </span>
                </label>
                {selectModelFromList ? (
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    disabled={actionLoading}
                    className="glass-input bg-surface text-white border border-line px-4 py-3 text-sm w-full focus:border-accent"
                  >
                    {modelsArchive.length === 0 ? (
                      <option value={modelName} className="bg-black text-white">
                        No models loaded (using current value)
                      </option>
                    ) : (
                      modelsArchive.map((m) => (
                        <option key={m.model_name} value={m.model_name} className="bg-black text-white">
                          {m.model_name}
                        </option>
                      ))
                    )}
                  </select>
                ) : (
                  <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} disabled={actionLoading} className="glass-input px-4 py-3 text-sm w-full" placeholder="Ensemble-01" />
                )}
                <label className="flex items-center gap-3 mt-3 px-3 py-2 border border-line bg-surface/60 hover:border-accent/40 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSelectModel}
                    onChange={(e) => setAutoSelectModel(e.target.checked)}
                    disabled={actionLoading}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="text-xs font-light text-light">
                    Auto-match best model by scoring schema
                  </span>
                </label>
              </div>

              <ProgressBar 
                isActive={actionLoading && progressType === 'score'} 
                label="Scoring Leads in Progress"
                estimatedTime={estimatedTime}
              />

              <button onClick={executePipeline} disabled={actionLoading || files.length === 0} className="btn-primary w-full flex justify-center items-center py-4 text-sm tracking-widest bg-emerald-600/20 text-emerald-500 border-emerald-500/50 hover:bg-emerald-600/30">
                {actionLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'SCORE LEADS'}
              </button>
            </div>

            {/* Score Results Table */}
            {scoringData && (() => {
              const total = scoringData.results.length;
              
              // Dynamically build filter thresholds based on total rows
              const possibleThresholds = [100, 500, 1000, 5000, 10000, 50000];
              const topFilters = possibleThresholds.filter(n => n < total);
              
              // Determine filtered rows
              let filteredRows;
              let filterLabel;
              
              if (viewFilter === 'worst100') {
                filteredRows = [...scoringData.results].reverse().slice(0, 100);
                filterLabel = `Lowest ${Math.min(100, total)} of ${total}`;
              } else if (viewFilter.startsWith('top')) {
                const n = parseInt(viewFilter.replace('top', ''));
                filteredRows = scoringData.results.slice(0, n);
                filterLabel = `Top ${Math.min(n, total)} of ${total}`;
              } else {
                filteredRows = scoringData.results;
                filterLabel = `All ${total} rows`;
              }

              // Pagination
              const totalFiltered = filteredRows.length;
              const totalPages = Math.max(1, Math.ceil(totalFiltered / LEADS_PER_PAGE));
              const safePage = Math.min(currentPage, totalPages);
              const startIdx = (safePage - 1) * LEADS_PER_PAGE;
              const endIdx = Math.min(startIdx + LEADS_PER_PAGE, totalFiltered);
              const displayedRows = filteredRows.slice(startIdx, endIdx);

              return (
              <div className="glass-card border border-line overflow-hidden rounded-xl p-0 fade-in" style={{ maxWidth: 'none', margin: '0 -1rem' }}>
                <div className="p-6 border-b border-line bg-surface flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h3 className="font-serif text-xl font-light text-white mb-1">Ranked Matrix: {scoringData.model_name}</h3>
                    {scoringData.model_selection && (
                      <div className="mt-1 text-xs text-dim break-words [overflow-wrap:anywhere]">
                        {scoringData.model_selection.auto_selected
                          ? `Auto-selected model: ${scoringData.model_selection.selected_model}`
                          : `Manual model: ${scoringData.model_selection.selected_model || scoringData.model_name}`}
                        {scoringData.model_selection.ambiguous ? ' — Similar models detected, you can switch model name.' : ''}
                      </div>
                    )}
                    <span className="font-mono text-[0.55rem] tracking-[0.2em] text-accent uppercase">{scoringData.n_leads} total rows scored</span>
                    {scoringData.routing_summary && (
                      <div className="mt-2 text-xs text-dim">
                        routed {scoringData.routing_summary.segment_routed_rows} rows through segment models, {scoringData.routing_summary.base_routed_rows} through base model
                      </div>
                    )}
                    {scoringData.rank_tracking && (
                      <div className="mt-2 text-xs text-dim">
                        Comparing against previous model version from {new Date(scoringData.rank_tracking.baseline_created_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <button onClick={handleDownloadCSV} className="btn-primary flex items-center py-2 px-6 bg-accent/20 border-accent/40 text-accent hover:border-accent hover:bg-accent/30 text-xs">
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </button>
                </div>

                {/* Dual Score Summary + Action Distribution */}
                {scoringData.engagement_analysis && (
                  <div className="bg-black/40 border-b border-line px-6 py-4">
                    <div className="flex flex-wrap gap-6 items-start">
                      {/* Engagement Detection Status */}
                      <div className="flex-1 min-w-[200px]">
                        <div className="font-mono text-[0.55rem] tracking-[0.2em] text-dim uppercase mb-2">Engagement Signals Detected</div>
                        <div className="flex flex-wrap gap-2">
                          {scoringData.engagement_analysis.signals_found.map(sig => (
                            <span key={sig} className="tag text-[0.5rem] tracking-widest border-sky-500/40 text-sky-300">{sig}</span>
                          ))}
                          {scoringData.engagement_analysis.signals_found.length === 0 && (
                            <span className="text-xs text-dim">No engagement columns found in data</span>
                          )}
                        </div>
                        {scoringData.engagement_analysis.signals_missing.length > 0 && (
                          <div className="mt-2 text-[0.5rem] text-dim">
                            Missing: {scoringData.engagement_analysis.signals_missing.join(', ')}
                          </div>
                        )}
                      </div>
                      
                      {/* Action Distribution */}
                      {scoringData.action_summary && (
                        <div className="flex-1 min-w-[300px]">
                          <div className="font-mono text-[0.55rem] tracking-[0.2em] text-dim uppercase mb-2">Action Distribution</div>
                          <div className="flex flex-wrap gap-3">
                            {scoringData.action_summary['CLOSE NOW'] > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-400 text-lg">🟢</span>
                                <span className="font-mono text-sm text-white">{scoringData.action_summary['CLOSE NOW']}</span>
                                <span className="text-xs text-dim">Close Now</span>
                              </div>
                            )}
                            {scoringData.action_summary['NURTURE'] > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-yellow-400 text-lg">🟡</span>
                                <span className="font-mono text-sm text-white">{scoringData.action_summary['NURTURE']}</span>
                                <span className="text-xs text-dim">Nurture</span>
                              </div>
                            )}
                            {scoringData.action_summary['AUTO-SEQUENCE'] > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-orange-400 text-lg">🟠</span>
                                <span className="font-mono text-sm text-white">{scoringData.action_summary['AUTO-SEQUENCE']}</span>
                                <span className="text-xs text-dim">Auto-Sequence</span>
                              </div>
                            )}
                            {scoringData.action_summary['DEPRIORITIZE'] > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-red-400 text-lg">🔴</span>
                                <span className="font-mono text-sm text-white">{scoringData.action_summary['DEPRIORITIZE']}</span>
                                <span className="text-xs text-dim">Deprioritize</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* View Filter Bar */}
                <div className="bg-surface/50 border-b border-line px-6 py-3 flex justify-between items-center flex-wrap gap-4">
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => { setViewFilter('all'); setCurrentPage(1); }} className={`font-mono text-[0.55rem] tracking-[0.15em] uppercase px-4 py-1.5 border transition-colors ${viewFilter === 'all' ? 'border-accent text-accent bg-accent/10' : 'border-line text-dim hover:text-white hover:border-white'}`}>All Rows</button>
                    {topFilters.map(n => (
                      <button key={n} onClick={() => { setViewFilter(`top${n}`); setCurrentPage(1); }} className={`font-mono text-[0.55rem] tracking-[0.15em] uppercase px-4 py-1.5 border transition-colors ${viewFilter === `top${n}` ? 'border-accent text-accent bg-accent/10' : 'border-line text-dim hover:text-white hover:border-white'}`}>Top {n >= 1000 ? `${n/1000}K` : n}</button>
                    ))}
                    {total > 100 && <button onClick={() => { setViewFilter('worst100'); setCurrentPage(1); }} className={`font-mono text-[0.55rem] tracking-[0.15em] uppercase px-4 py-1.5 border transition-colors ${viewFilter === 'worst100' ? 'border-red-500 text-red-400 bg-red-500/10' : 'border-line text-dim hover:text-white hover:border-white'}`}>Worst 100</button>}
                  </div>
                  <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim">
                    Displaying {filterLabel}
                  </div>
                </div>

                {/* Pagination Top Bar */}
                {totalPages > 1 && (
                  <div className="bg-black/60 border-b border-line px-6 py-3 flex justify-between items-center flex-wrap gap-3">
                    <div className="font-mono text-[0.55rem] tracking-[0.15em] text-dim uppercase">
                      Showing {startIdx + 1}–{endIdx} of {totalFiltered} leads
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={safePage <= 1}
                        className={`font-mono text-[0.55rem] tracking-[0.12em] uppercase px-3 py-1.5 border transition-colors ${safePage <= 1 ? 'border-line/30 text-dim/30 cursor-not-allowed' : 'border-line text-dim hover:text-white hover:border-white'}`}
                      >
                        First
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className={`font-mono text-[0.55rem] tracking-[0.12em] uppercase px-4 py-1.5 border transition-colors ${safePage <= 1 ? 'border-line/30 text-dim/30 cursor-not-allowed' : 'border-line text-dim hover:text-white hover:border-white'}`}
                      >
                        ← Previous
                      </button>
                      <span className="font-mono text-[0.6rem] tracking-[0.1em] text-accent px-3">
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        className={`font-mono text-[0.55rem] tracking-[0.12em] uppercase px-4 py-1.5 border transition-colors ${safePage >= totalPages ? 'border-line/30 text-dim/30 cursor-not-allowed' : 'border-accent text-accent hover:bg-accent/10'}`}
                      >
                        Next →
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={safePage >= totalPages}
                        className={`font-mono text-[0.55rem] tracking-[0.12em] uppercase px-3 py-1.5 border transition-colors ${safePage >= totalPages ? 'border-line/30 text-dim/30 cursor-not-allowed' : 'border-line text-dim hover:text-white hover:border-white'}`}
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}

                {/* Responsive Card-Based Lead List */}
                <div className="divide-y divide-line/40">
                  {displayedRows.map((row, i) => {
                    const globalIdx = startIdx + i;
                    const originalRank = viewFilter === 'worst100' 
                      ? total - globalIdx 
                      : globalIdx + 1;
                    const profileScore = row.profile_score ?? row.score;
                    const engagementScore = row.engagement_score;
                    const hasEngagement = engagementScore !== null && engagementScore !== undefined;
                    return (
                    <div key={globalIdx} className="px-5 py-4 hover:bg-surface/40 transition-colors">
                      {/* Row 1: Rank + Scores + Action badge */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-3">
                        {/* Rank */}
                        <div className="font-serif text-2xl text-dim" style={{ minWidth: '60px' }}>#{originalRank}</div>
                        
                        {/* Profile Score */}
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-[0.55rem] tracking-[0.15em] uppercase text-dim">Profile</div>
                          <span className="font-mono text-base text-white">{profileScore.toFixed(1)}<span className="text-[0.6em] text-dim">%</span></span>
                          <div className="w-[60px] h-1 bg-line rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(profileScore, 100)}%` }}></div>
                          </div>
                        </div>

                        {/* Engagement Score */}
                        {hasEngagement && (
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-[0.55rem] tracking-[0.15em] uppercase text-dim">Engagement</div>
                            <span className="font-mono text-base text-white">{engagementScore.toFixed(1)}<span className="text-[0.6em] text-dim">%</span></span>
                            <div className="w-[60px] h-1 bg-line rounded-full overflow-hidden">
                              <div className={`h-full ${engagementScore >= 50 ? 'bg-sky-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(engagementScore, 100)}%` }}></div>
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
                            <span>{row.action_emoji}</span>
                            <span>{row.recommended_action}</span>
                          </span>
                        )}
                        {row.action_confidence && (
                          <span className={`tag text-[0.45rem] tracking-widest ${
                            row.action_confidence === 'high' ? 'border-emerald-500/30 text-emerald-300' :
                            row.action_confidence === 'medium' ? 'border-yellow-500/30 text-yellow-300' :
                            'border-dim/30 text-dim'
                          }`}>
                            {row.action_confidence} confidence
                          </span>
                        )}

                        {/* Route tag */}
                        <span className={`tag text-[0.45rem] tracking-widest ${
                          row.routing?.route_type === 'segment'
                            ? 'border-sky-500/40 text-sky-300'
                            : 'border-line text-dim'
                        }`}>
                          {row.routing?.route_type === 'segment' ? 'segment route' : 'base route'}
                        </span>
                      </div>

                      {/* Row 2: Factors + Engagement signals */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {row.top_drivers.map((drv, idx) => (
                          <span key={idx} className="tag text-[0.45rem] tracking-widest">{drv}</span>
                        ))}
                        {hasEngagement && row.top_engagement_signals?.length > 0 && (
                          <>
                            <span className="text-line mx-1">|</span>
                            {row.top_engagement_signals.slice(0, 2).map((sig, idx) => (
                              <span key={`eng-${idx}`} className="tag text-[0.45rem] tracking-widest border-sky-500/30 text-sky-300">{sig}</span>
                            ))}
                          </>
                        )}
                        {row.rationale?.top_negative?.length > 0 && (
                          <>
                            <span className="text-line mx-1">|</span>
                            {row.rationale.top_negative.slice(0, 2).map((item) => (
                              <span key={item.engineered_feature} className="tag text-[0.45rem] tracking-widest border-red-500/30 text-red-300">
                                drag: {item.label}
                              </span>
                            ))}
                          </>
                        )}
                      </div>

                      {/* Row 3: Rationale + Route details (collapsed) */}
                      {(row.rationale_summary || row.action_description || row.routing?.reason) && (
                        <div className="text-xs text-dim leading-relaxed">
                          {row.rationale_summary || row.action_description || ''}
                          {row.routing?.used_model && (
                            <span className="ml-2 text-[0.5rem] text-dim/70">
                              via {row.routing.used_model}
                              {row.routing?.matched_segment && ` · ${row.routing.matched_segment.dimension}=${row.routing.matched_segment.value}`}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Route Arbitration (rare, only shown when multiple candidates) */}
                      {row.routing?.candidates_considered?.length > 1 && (
                        <div className="mt-2 border border-line p-2 bg-black/60 text-xs">
                          <div className="font-mono text-[0.5rem] tracking-[0.16em] uppercase text-accent mb-1">Route Arbitration</div>
                          {row.routing.candidates_considered.slice(0, 3).map((candidate) => (
                            <div key={candidate.model_name} className="text-dim">
                              {candidate.model_name} | priority {candidate.priority_score.toFixed(2)} | rows {candidate.feedback_rows} | auc {candidate.roc_auc.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* Pagination Bottom Bar */}
                {totalPages > 1 && (
                  <div className="bg-black/60 border-t border-line px-6 py-4 flex justify-between items-center flex-wrap gap-3">
                    <div className="font-mono text-[0.55rem] tracking-[0.15em] text-dim uppercase">
                      Showing {startIdx + 1}–{endIdx} of {totalFiltered} leads · Page {safePage} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setCurrentPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={safePage <= 1}
                        className={`font-mono text-[0.55rem] tracking-[0.12em] uppercase px-3 py-1.5 border transition-colors ${safePage <= 1 ? 'border-line/30 text-dim/30 cursor-not-allowed' : 'border-line text-dim hover:text-white hover:border-white'}`}
                      >
                        First
                      </button>
                      <button
                        onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={safePage <= 1}
                        className={`font-mono text-[0.55rem] tracking-[0.12em] uppercase px-4 py-1.5 border transition-colors ${safePage <= 1 ? 'border-line/30 text-dim/30 cursor-not-allowed' : 'border-line text-dim hover:text-white hover:border-white'}`}
                      >
                        ← Previous
                      </button>
                      <span className="font-mono text-[0.6rem] tracking-[0.1em] text-accent px-3">
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={safePage >= totalPages}
                        className={`font-mono text-[0.55rem] tracking-[0.12em] uppercase px-4 py-1.5 border transition-colors ${safePage >= totalPages ? 'border-line/30 text-dim/30 cursor-not-allowed' : 'border-accent text-accent hover:bg-accent/10'}`}
                      >
                        Next →
                      </button>
                      <button
                        onClick={() => { setCurrentPage(totalPages); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={safePage >= totalPages}
                        className={`font-mono text-[0.55rem] tracking-[0.12em] uppercase px-3 py-1.5 border transition-colors ${safePage >= totalPages ? 'border-line/30 text-dim/30 cursor-not-allowed' : 'border-line text-dim hover:text-white hover:border-white'}`}
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}
          </section>
        )}

        {activeTab === 'feedback' && (
          <section className="fade-in space-y-8">
            <div className="glass-card p-8 border border-line bg-surface/30">
              <h3 className="font-serif text-2xl font-light mb-2">Submit Outcome Data</h3>
              <p className="text-dim text-sm mb-6 font-light">Upload a CSV containing the same lead fields used during scoring plus a binary outcome column. Lucida will match previously scored leads and improve future predictions.</p>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
                onDragLeave={() => setIsHovering(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300 mb-6 ${isHovering ? 'border-accent bg-accent/5' : 'border-line hover:border-accent hover:bg-surface'} ${actionLoading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input type="file" ref={fileInputRef} className="hidden" multiple={false} accept=".csv" onChange={handleChange} />
                <BrainCircuit className={`w-8 h-8 mb-4 ${isHovering ? 'text-accent' : 'text-dim'}`} />
                <span className="font-serif text-xl font-light mb-2 text-white">Drop feedback CSV here</span>
                <span className="font-mono text-[0.6rem] tracking-[0.1em] text-dim">Must include the same lead fields plus a binary win-loss style outcome column</span>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mb-6">
                  {files.map((file, i) => (
                    <div key={i} className="flex justify-between items-center border border-line p-3 bg-surface">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon className="w-4 h-4 text-dim shrink-0" />
                        <span className="font-mono text-[0.7rem] truncate text-light">{file.name}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} disabled={actionLoading} className="text-dim hover:text-red-400 p-1"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="form-group mb-0 relative group">
                  <label className="block font-mono text-[0.6rem] tracking-[0.25em] uppercase text-dim mb-3">Model Name</label>
                  <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} disabled={actionLoading} className="glass-input px-4 py-3 text-sm w-full" placeholder="Ensemble-01" />
                </div>
                <div className="form-group mb-0 relative group">
                  <label className="block font-mono text-[0.6rem] tracking-[0.25em] uppercase text-dim mb-3">Outcome Column (Optional)</label>
                  <input type="text" value={outcomeColumn} onChange={(e) => setOutcomeColumn(e.target.value)} disabled={actionLoading} className="glass-input px-4 py-3 text-sm w-full" placeholder="Auto-Detect if blank" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <label className="border border-line p-4 flex items-center justify-between gap-4 bg-black">
                  <div>
                    <div className="font-mono text-[0.55rem] tracking-[0.16em] uppercase text-accent mb-2">Auto Retrain</div>
                    <p className="text-sm text-dim">When policy thresholds are met, feedback upload will immediately create a new model version.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRetrainEnabled}
                    onChange={(e) => setAutoRetrainEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[#c8a96e]"
                  />
                </label>
                <div className="form-group mb-0 relative group">
                  <label className="block font-mono text-[0.6rem] tracking-[0.25em] uppercase text-dim mb-3">Auto Retrain Weight</label>
                  <input type="number" min="1" max="10" value={feedbackWeight} onChange={(e) => setFeedbackWeight(Number(e.target.value))} disabled={actionLoading} className="glass-input px-4 py-3 text-sm w-full" />
                </div>
              </div>

              <ProgressBar 
                isActive={actionLoading && progressType === 'feedback'} 
                label="Ingesting Feedback Signal"
                estimatedTime={estimatedTime}
              />

              <button onClick={executePipeline} disabled={actionLoading || files.length === 0} className="btn-primary w-full flex justify-center items-center py-4 text-sm tracking-widest">
                {actionLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'SUBMIT FEEDBACK'}
              </button>
            </div>

            {feedbackData && (
              <div className="glass-card p-8 border border-accent/20 bg-accent/5 fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif text-2xl font-light">Feedback Intelligence</h3>
                  <div className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-accent border border-accent/30 px-3 py-1 flex items-center gap-2"><CheckCircle2 className="w-3 h-3"/> Learned</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Matched</div>
                    <div className="font-serif text-3xl font-light text-white">{feedbackData.learning_signal.matched_rows}</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Accuracy</div>
                    <div className="font-serif text-3xl font-light text-white">{(feedbackData.learning_signal.feedback_accuracy * 100).toFixed(1)}%</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Precision</div>
                    <div className="font-serif text-3xl font-light text-white">{(feedbackData.learning_signal.feedback_precision * 100).toFixed(1)}%</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Recall</div>
                    <div className="font-serif text-3xl font-light text-white">{(feedbackData.learning_signal.feedback_recall * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="p-5 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-accent mb-3">Learning Signal</div>
                    <div className="space-y-2 text-sm text-light">
                      <p>Recommendation: <span className="text-white">{feedbackData.learning_signal.recommendation}</span></p>
                      <p>Policy action: <span className="text-white">{feedbackData.auto_retrain_policy?.should_auto_retrain ? 'auto retrain recommended' : 'hold current model'}</span></p>
                      <p>Outcome target: <span className="text-white">{feedbackData.learning_signal.target_column}</span></p>
                      <p>Actual positive rate: <span className="text-white">{(feedbackData.learning_signal.actual_positive_rate * 100).toFixed(1)}%</span></p>
                      <p>Avg score on actual wins: <span className="text-white">{feedbackData.learning_signal.avg_score_for_actual_wins.toFixed(1)}</span></p>
                      <p>Avg score on actual losses: <span className="text-white">{feedbackData.learning_signal.avg_score_for_actual_losses.toFixed(1)}</span></p>
                    </div>
                  </div>
                  <div className="p-5 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-accent mb-3">Top Misses</div>
                    <div className="space-y-3">
                      {(feedbackData.learning_signal.top_misses || []).length === 0 && (
                        <p className="text-sm text-dim">No major mismatches detected in this upload.</p>
                      )}
                      {(feedbackData.learning_signal.top_misses || []).map((miss, idx) => (
                        <div key={idx} className="border border-line p-3">
                          <div className="text-sm text-light">{miss.miss_type} at rank #{miss.rank_at_score_time}</div>
                          <div className="text-xs text-dim mt-1">Predicted {miss.predicted_score.toFixed(1)} vs actual {miss.actual_outcome}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {feedbackData.auto_retrain_policy && (
                  <div className="mt-6 p-5 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-accent mb-3">Auto Retrain Policy</div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2 text-sm text-light">
                        <p>Policy: <span className="text-white">{feedbackData.auto_retrain_policy.policy_name}</span></p>
                        <p>Decision: <span className="text-white">{feedbackData.auto_retrain_policy.should_auto_retrain ? 'triggered' : 'not triggered'}</span></p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(feedbackData.auto_retrain_policy.reasons || []).map((reason) => (
                          <span key={reason} className="tag text-[0.5rem] tracking-widest">{reason}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {feedbackData.auto_retrain_result && (
                  <div className="mt-6 p-5 bg-black border border-accent/30">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-accent mb-3">Auto Retrain Triggered</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Source</div>
                        <div className="text-sm font-light text-white">{feedbackData.auto_retrain_result.metrics.training_source}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Rows</div>
                        <div className="text-sm font-light text-white">{feedbackData.auto_retrain_result.metrics.feedback_rows}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Accuracy</div>
                        <div className="text-sm font-light text-white">{(feedbackData.auto_retrain_result.metrics.accuracy * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">ROC AUC</div>
                        <div className="text-sm font-light text-white">{(feedbackData.auto_retrain_result.metrics.roc_auc * 100).toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 border border-line p-5 bg-black">
                  <div className="grid md:grid-cols-[1fr,180px,auto] gap-4 items-end">
                    <div>
                      <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-accent mb-3">Adaptive Retrain</div>
                      <p className="text-sm text-dim leading-relaxed">Create a fresh model version directly from accumulated feedback events so ranking behavior starts learning from real outcomes.</p>
                    </div>
                    <div>
                      <label className="block font-mono text-[0.55rem] tracking-[0.16em] uppercase text-dim mb-2">Feedback Weight</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={feedbackWeight}
                        onChange={(e) => setFeedbackWeight(Number(e.target.value))}
                        className="glass-input px-4 py-3 text-sm w-full"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-3 md:w-[220px]">
                      <ProgressBar 
                        isActive={actionLoading && progressType === 'train'} 
                        label="Retraining Model from Feedback"
                        estimatedTime={estimatedTime}
                      />
                      <button onClick={() => { if (user?.tier !== 'pro') { setShowUpgradeModal(true); return; } handleRetrainFromFeedback(); }} disabled={actionLoading} className="btn-primary w-full flex justify-center items-center py-4 text-sm tracking-widest">
                        {actionLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'RETRAIN FROM FEEDBACK'}
                      </button>
                    </div>
                  </div>
                </div>

                {feedbackRetrainData && (
                  <div className="mt-6 p-5 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-accent mb-3">Feedback Retrain Result</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Source</div>
                        <div className="text-sm font-light text-white">{feedbackRetrainData.metrics.training_source}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Feedback Rows</div>
                        <div className="text-sm font-light text-white">{feedbackRetrainData.metrics.feedback_rows}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Accuracy</div>
                        <div className="text-sm font-light text-white">{(feedbackRetrainData.metrics.accuracy * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">ROC AUC</div>
                        <div className="text-sm font-light text-white">{(feedbackRetrainData.metrics.roc_auc * 100).toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedModelIntel?.feedback_summary && (
              <div className="glass-card p-8 border border-line bg-surface/30">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif text-2xl font-light">Feedback Timeline</h3>
                  <div className="font-mono text-[0.6rem] tracking-[0.18em] uppercase text-accent">
                    {selectedModelIntel.feedback_summary.retrain_readiness}
                  </div>
                </div>
                <div className="grid md:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Feedback Events</div>
                    <div className="font-serif text-3xl font-light text-white">{selectedModelIntel.feedback_summary.total_feedback_events}</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Last Feedback</div>
                    <div className="text-sm font-light text-white">{selectedModelIntel.feedback_summary.last_feedback_at ? new Date(selectedModelIntel.feedback_summary.last_feedback_at).toLocaleString() : 'None yet'}</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Recent Avg Score</div>
                    <div className="font-serif text-3xl font-light text-white">{selectedModelIntel.feedback_summary.avg_recent_predicted_score ?? 'NA'}</div>
                  </div>
                  <div className="p-4 bg-black border border-line">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-dim mb-2">Recent Win Rate</div>
                    <div className="font-serif text-3xl font-light text-white">
                      {selectedModelIntel.feedback_summary.recent_positive_rate !== null && selectedModelIntel.feedback_summary.recent_positive_rate !== undefined
                        ? `${(selectedModelIntel.feedback_summary.recent_positive_rate * 100).toFixed(1)}%`
                        : 'NA'}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {(selectedModelIntel.feedback_timeline || []).length === 0 && (
                    <p className="text-sm text-dim">No persisted feedback timeline yet for this model.</p>
                  )}
                  {(selectedModelIntel.feedback_timeline || []).map((item, idx) => (
                    <div key={`${item.feedback_at}-${idx}`} className="border border-line p-4 bg-black flex justify-between items-center gap-4 flex-wrap">
                      <div>
                        <div className="text-sm text-light">{new Date(item.feedback_at).toLocaleString()}</div>
                        <div className="text-xs text-dim mt-1">
                          actual {item.actual_outcome} | predicted {item.predicted_score?.toFixed?.(1) ?? item.predicted_score} | prior rank #{item.rank_at_score_time ?? 'NA'}
                        </div>
                      </div>
                      <span className={`tag text-[0.5rem] tracking-widest ${item.actual_outcome === 1 ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'}`}>
                        {item.actual_outcome === 1 ? 'won' : 'lost'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-accent mb-4">Segment Hotspots</div>
                  <div className="space-y-3">
                    {(selectedModelIntel.segment_hotspots || []).length === 0 && (
                      <p className="text-sm text-dim">No segment-level hotspot signal yet.</p>
                    )}
                    {(selectedModelIntel.segment_hotspots || []).map((item, idx) => (
                      <div key={`${item.dimension}-${item.segment}-${idx}`} className="border border-line p-4 bg-black flex justify-between items-center gap-4 flex-wrap">
                        <div>
                          <div className="text-sm text-light">{item.dimension}: {item.segment}</div>
                          <div className="text-xs text-dim mt-1">
                            samples {item.sample_count} | actual win {(item.actual_win_rate * 100).toFixed(1)}% | predicted {item.avg_predicted_score.toFixed(1)} | gap {item.drift_gap.toFixed(1)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`tag text-[0.5rem] tracking-widest ${
                            item.segment_readiness === 'segment_retrain_candidate'
                              ? 'border-red-500/40 text-red-300'
                              : item.segment_readiness === 'watch_segment'
                                ? 'border-amber-500/40 text-amber-300'
                                : 'border-emerald-500/40 text-emerald-300'
                          }`}>
                            {item.segment_readiness}
                          </span>
                          {item.segment_readiness !== 'stable' && (
                            <button
                              onClick={() => { if (user?.tier !== 'pro') { setShowUpgradeModal(true); return; } handleSegmentRetrain(item.dimension, item.segment); }}
                              disabled={actionLoading}
                              className="btn-outline px-4 py-2 text-[0.55rem]"
                            >
                              Build Segment Model
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {segmentRetrainData && (
                  <div className="mt-6 p-5 bg-black border border-accent/30">
                    <div className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-accent mb-3">Segment Retrain Result</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Model</div>
                        <div className="text-sm font-light text-white">{segmentRetrainData.model_name}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Segment</div>
                        <div className="text-sm font-light text-white">{segmentRetrainData.metrics.segment_dimension}: {segmentRetrainData.metrics.segment_value}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Accuracy</div>
                        <div className="text-sm font-light text-white">{(segmentRetrainData.metrics.accuracy * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">ROC AUC</div>
                        <div className="text-sm font-light text-white">{(segmentRetrainData.metrics.roc_auc * 100).toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── MODELS TAB ── */}
        {activeTab === 'models' && (
          <section className="fade-in">
            <div className="font-mono text-[0.65rem] tracking-[0.25em] uppercase text-dim flex items-center gap-4 mb-6"><div className="h-[1px] bg-line flex-1"></div>Historical Registry<div className="h-[1px] bg-line flex-1"></div></div>
            
            {modelsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <Loader className="w-8 h-8 text-accent animate-spin mb-4" />
                <div className="font-mono text-[0.7rem] tracking-[0.2em] uppercase text-dim animate-pulse">Querying Database Arrays...</div>
              </div>
            ) : modelsArchive.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-line">
                <Database className="w-10 h-10 text-dim mx-auto mb-4" />
                <h3 className="font-serif text-2xl font-light text-white mb-2">Registry Empty</h3>
                <p className="text-dim font-light text-sm max-w-md mx-auto">None of your predictive ensembles exist yet. Retrain a model to populate.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {modelsArchive.map((m, i) => (
                  <div key={i} className="bg-surface border border-line p-8 relative group hover:border-accent/40 transition-colors">
                    <button onClick={() => handleDeleteModel(m.model_name)} className="absolute top-4 right-4 text-dim hover:text-red-500 p-2 border border-transparent hover:border-red-500/50 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                    
                    <h4 className="font-serif text-2xl font-light text-white mb-2 break-words [overflow-wrap:anywhere]">{m.model_name}</h4>
                    <div className="font-mono text-[0.55rem] tracking-[0.1em] text-accent mb-8 uppercase">
                      {m.trained_at ? new Date(m.trained_at).toLocaleString() : 'Legacy Origin'}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 items-start [&>div]:min-w-0">
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Vectors</div>
                        <div className="text-sm font-light text-white break-words [overflow-wrap:anywhere]">{m.n_rows || 0}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Dimensions</div>
                        <div className="text-sm font-light text-white break-words [overflow-wrap:anywhere]">{m.n_cols || 0}</div>
                      </div>
                      {m.accuracy !== undefined && (
                        <div>
                          <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Accuracy</div>
                          <div className="text-sm font-light text-white break-words [overflow-wrap:anywhere]">{(m.accuracy * 100).toFixed(1)}%</div>
                        </div>
                      )}
                      {m.roc_auc !== undefined && (
                        <div>
                          <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">ROC AUC</div>
                          <div className="text-sm font-light text-white break-words [overflow-wrap:anywhere]">{(m.roc_auc * 100).toFixed(1)}%</div>
                        </div>
                      )}
                      {m.ranking_version && (
                        <div>
                          <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Rank Ver</div>
                          <div className="text-sm font-light text-white break-words [overflow-wrap:anywhere]">{m.ranking_version}</div>
                        </div>
                      )}
                      {m.target_recommendation && (
                        <div>
                          <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Target Audit</div>
                          <div className="text-sm font-light text-white break-words [overflow-wrap:anywhere]">{m.target_recommendation}</div>
                        </div>
                      )}
                      {m.feedback_summary?.retrain_readiness && (
                        <div>
                          <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Feedback</div>
                          <div className="text-sm font-light text-white break-words [overflow-wrap:anywhere]">{m.feedback_summary.retrain_readiness}</div>
                        </div>
                      )}
                      {m.feedback_summary?.total_feedback_events !== undefined && (
                        <div>
                          <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Feedback Rows</div>
                          <div className="text-sm font-light text-white break-words [overflow-wrap:anywhere]">{m.feedback_summary.total_feedback_events}</div>
                        </div>
                      )}
                      {m.segment_hotspots?.[0] && (
                        <div>
                          <div className="font-mono text-[0.55rem] tracking-[0.1em] text-dim uppercase mb-1">Hot Segment</div>
                          <div className="text-sm font-light text-white break-words [overflow-wrap:anywhere]">{m.segment_hotspots[0].dimension}: {m.segment_hotspots[0].segment}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

        {/* ── Cancel Plan Modal ── */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !actionLoading && setShowCancelModal(false)}></div>
            <div className="relative bg-surface border border-line p-8 max-w-md w-full shadow-2xl">
              <button 
                onClick={() => setShowCancelModal(false)} 
                disabled={actionLoading}
                className="absolute top-4 right-4 text-dim hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-2xl font-serif text-white mb-4">Cancel Subscription?</h2>
              <p className="text-sm text-dim leading-relaxed mb-6">
                Are you sure you want to cancel your Premium subscription? 
                <br /><br />
                As per our Refund & Cancellation Policy, this will stop all <strong>future</strong> billing. You will continue to have access to Premium features until the end of your current billing cycle.
              </p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowCancelModal(false)} 
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 border border-line text-sm font-mono tracking-widest text-light hover:text-white hover:border-white transition-colors uppercase"
                >
                  Keep Plan
                </button>
                <button 
                  onClick={handleCancelSubscription} 
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500/20 text-sm font-mono tracking-widest uppercase transition-colors flex justify-center items-center"
                >
                  {actionLoading ? <Loader className="w-4 h-4 animate-spin" /> : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
