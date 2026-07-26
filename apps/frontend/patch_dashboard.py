import os

file_path = r"c:\Users\Basavaraj\Desktop\lucidav\lucidaship.v4\apps\frontend\src\pages\Dashboard.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add imports
imports_target = "import { LogOut, UploadCloud, Database, Download, CheckCircle2, Trash2, AlertCircle, Loader, File as FileIcon, Target, Activity, X, BrainCircuit } from 'lucide-react';\nimport ProgressBar from '../components/ProgressBar';"
imports_replacement = """import { LogOut, UploadCloud, Database, Download, CheckCircle2, Trash2, AlertCircle, Loader, File as FileIcon, Target, Activity, X, BrainCircuit } from 'lucide-react';
import ProgressBar from '../components/ProgressBar';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';"""
content = content.replace(imports_target, imports_replacement)

# 2. Loading state
loading_target = """  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="font-mono text-[0.7rem] tracking-[0.25em] uppercase text-accent animate-pulse">Initializing Interface...</div>
    </div>
  );"""
loading_replacement = """  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none"></div>
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        className="w-16 h-16 border-[3px] border-white/5 border-t-blue-500 rounded-full mb-8 relative z-10"
      ></motion.div>
      <motion.div 
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="font-mono text-[0.65rem] tracking-[0.25em] uppercase text-blue-400 relative z-10"
      >
        Initializing Workspace...
      </motion.div>
    </div>
  );"""
content = content.replace(loading_target, loading_replacement)

# 3. Tabs
tabs_target = """        {/* ── Tabs ── */}
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
        </div>"""
tabs_replacement = """        {/* ── Tabs ── */}
        <div className="flex border border-white/10 bg-white/[0.02] p-1.5 mb-8 rounded-xl relative z-10">
          {[
            { id: 'train', icon: Target, label: 'Train Model' },
            { id: 'score', icon: Activity, label: 'Score Leads' },
            { id: 'models', icon: Database, label: 'Registry' },
            { id: 'feedback', icon: BrainCircuit, label: 'Feedback Loop' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex-1 py-4 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-all duration-300 rounded-lg flex items-center justify-center gap-2 relative ${activeTab === tab.id ? 'text-blue-400 bg-white/5 shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'}`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-500' : ''}`} /> 
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1/2 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
              )}
            </button>
          ))}
        </div>"""
content = content.replace(tabs_target, tabs_replacement)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied.")
