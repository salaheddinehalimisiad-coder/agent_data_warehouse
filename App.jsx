import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Settings, PanelRightClose, PanelRightOpen, Database, History, LayoutGrid, Bot, Terminal, X, Loader2, Download, FileText, BookOpen } from 'lucide-react';
import ConnectionModal from './ConnectionModal';
import ChatInterface from './ChatInterface';
import PipelineCanvas from './PipelineCanvas';
import LandingPage from './LandingPage';
import DocumentationPage from './DocumentationPage';

import ProcessDiagram from './ProcessDiagram';

const SidebarIcon = ({ icon: Icon, active, onClick, tooltip }) => (
  <button
    onClick={onClick}
    title={tooltip}
    className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200 group relative ${
      active ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
    }`}
  >
    <Icon size={20} />
    {active && (
      <motion.div 
        layoutId="sidebar-indicator" 
        className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
      />
    )}
  </button>
);

export default function App() {
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [view, setView] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  const [sqlCode, setSqlCode] = useState(null);
  const [etlCode, setEtlCode] = useState(null);
  const [criticReview, setCriticReview] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [pipelineState, setPipelineState] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const terminalRef = useRef(null);

  useEffect(() => {
    const sse = new EventSource('http://localhost:8000/api/pipeline-stream');
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setPipelineState(data);
        if (data.status === 'running') setShowTerminal(true);
        if (data.status === 'success' && data.etl_code_used) {
          setEtlCode(data.etl_code_used);
        }
        
        // Auto-scroll terminal
        if (terminalRef.current) {
           terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      } catch (e) { console.error('SSE Error', e); }
    };
    return () => sse.close();
  }, []);

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const resp = await fetch('http://localhost:8000/api/validate', { method: 'POST' });
      const data = await resp.json();
      if (data.status === 'success' || data.status === 'background') {
        setMessages(prev => [...prev, { role: 'bot', content: "✅ Modèle validé par l'humain ! PySpark est en cours de création en arrière-plan..." }]);
      } else {
        alert("Erreur de validation : " + data.message);
      }
    } catch (err) {
      alert("Erreur réseau de validation.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownloadFile = (content, filename) => {
    if (!content) return alert("Aucun code à exporter !");
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/export-pdf');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Rapport_Pipeline_Agentique.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Erreur réseau du rapport.");
    }
  };

  const handleNavigate = (newView) => {
    setView(newView);
  };

  if (view === 'dashboard') {
    return (
      <LandingPage 
        onNavigate={handleNavigate}
        onNewSession={async () => {
          try {
            const res = await fetch('http://localhost:8000/api/sessions/new', { method: 'POST' });
            const data = await res.json();
            setActiveSessionId(data.session_id);
          } catch (e) { console.error(e); }
          setView('canvas'); 
          setIsModalOpen(true); 
        }}
        onResumeSession={async (id) => {
          try {
            const res = await fetch('http://localhost:8000/api/sessions/resume', {
              method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({session_id: id})
            });
            const data = await res.json();
            if(data.status === 'success') {
              setSqlCode(data.sql_ddl);
              setEtlCode(data.etl_code);
              setMessages(data.messages || []);
              setActiveSessionId(id); 
              setView('canvas'); 
            }
          } catch (e) { console.error(e); }
        }}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#09090b] text-[#fafafa] font-sans overflow-hidden">
      <nav className="w-16 flex flex-col items-center py-6 border-r border-[#27272a] bg-[#09090b] z-20 shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center mb-8 shadow-[0_0_15px_rgba(99,102,241,0.4)] cursor-pointer">
          <Database size={20} className="text-white" />
        </div>

        <div className="flex flex-col gap-4">
          <SidebarIcon icon={LayoutGrid} active={view === 'dashboard'} onClick={() => setView('dashboard')} tooltip="Dashboard" />
          <SidebarIcon icon={Network} active={view === 'canvas'} onClick={() => setView('canvas')} tooltip="Pipeline Canvas" />
          <SidebarIcon icon={Database} active={view === 'sources'} onClick={() => setIsModalOpen(true)} tooltip="Connecteurs" />
          <SidebarIcon icon={BookOpen} active={view === 'documentation'} onClick={() => setView('documentation')} tooltip="Documentation Officielle" />
          <SidebarIcon icon={History} active={view === 'history'} onClick={() => setView('history')} tooltip="Historique" />
        </div>

        <div className="mt-auto">
          <SidebarIcon icon={Settings} tooltip="Paramètres" />
        </div>
      </nav>

      <main className="flex-1 relative overflow-hidden flex flex-col bg-[#09090b]">
        {view !== 'usecases' && (
          <header className="h-14 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-md flex items-center justify-between px-6 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-zinc-200">Data Integration Pipeline</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">Draft</span>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={() => handleDownloadFile(sqlCode, "schema_dw.sql")} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all border border-white/10 group">
                <Download size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" /> DDL SQL
              </button>
              <button onClick={() => handleDownloadFile(etlCode, "pipeline.py")} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all border border-white/10 group">
                <Download size={14} className="text-amber-400 group-hover:scale-110 transition-transform" /> PySpark
              </button>
              <button onClick={handleExportPdf} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all border border-emerald-500/20 ml-2 group">
                <FileText size={14} className="group-hover:scale-110 transition-transform" /> RAPPORT PDF
              </button>
              <button onClick={handleValidate} disabled={isValidating || !sqlCode} className="px-4 py-1.5 text-sm font-bold bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-sm ml-2">
                {isValidating ? "Génération..." : "Exécuter ETL (Valider)"}
              </button>
              <div className="w-px h-5 bg-[#27272a] mx-2"></div>
              <button onClick={() => setShowTerminal(!showTerminal)} className={`text-zinc-500 hover:text-indigo-400 transition-colors ${showTerminal ? 'text-indigo-400' : ''}`}>
                <Terminal size={18} />
              </button>
              <button onClick={() => setIsCopilotOpen(!isCopilotOpen)} className="p-2 text-zinc-400 hover:text-white hover:bg-[#27272a] rounded-lg transition-colors relative">
                <Bot size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border border-[#09090b]"></span>
              </button>
            </div>
          </header>
        )}

        <div className="flex-1 relative pattern-dots pattern-zinc-800 pattern-bg-[#09090b] pattern-size-4 pattern-opacity-40 overflow-hidden">
           {view === 'canvas' && <PipelineCanvas sqlCode={sqlCode} etlCode={etlCode} />}
           {view === 'documentation' && <DocumentationPage key="doc" />}
           {view === 'usecases' && (
             <div className="w-full h-full overflow-y-auto">
               <ProcessDiagram />
             </div>
           )}
           {(view !== 'canvas' && view !== 'dashboard' && view !== 'documentation' && view !== 'usecases') && <div className="absolute inset-0 flex items-center justify-center text-zinc-500">Page {view} en construction...</div>}

            {/* Live Terminal Panel */}
            <AnimatePresence>
              {view === 'canvas' && showTerminal && (
                <motion.div 
                  initial={{ y: 300, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 300, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute inset-x-0 bottom-0 h-64 bg-[#09090b]/95 backdrop-blur-xl border-t border-[#27272a] z-40 flex flex-col shadow-2xl"
                >
                   <div className="px-4 py-2 bg-[#18181b] flex items-center justify-between border-b border-[#27272a]">
                     <div className="flex items-center gap-2">
                       <Terminal size={14} className="text-zinc-400"/>
                       <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Build Output Terminal</span>
                       {pipelineState?.status === 'running' && <Loader2 className="animate-spin text-indigo-400 ml-2" size={14}/>}
                     </div>
                     <button onClick={() => setShowTerminal(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                   </div>
                   <div ref={terminalRef} className="flex-1 overflow-auto p-4 font-mono text-[13px] text-zinc-300 space-y-1.5 selection:bg-indigo-500/30">
                     {pipelineState?.logs?.map((logObj, i) => {
                       const msgText = logObj?.msg || '';
                       return (
                         <div key={i} className={`${msgText.toLowerCase().includes('erreur') ? 'text-rose-400' : ''} ${msgText.toLowerCase().includes('succès') || msgText.toLowerCase().includes('✅') ? 'text-emerald-400' : ''}`}>
                           <span className="text-zinc-600 mr-2">{'>'}</span>
                           <span className="text-zinc-500 mr-2 font-mono text-[10px]">[{logObj?.t}s]</span>
                           {msgText}
                         </div>
                       );
                     })}
                     {!pipelineState?.logs?.length && <div className="text-zinc-500 italic px-2">En attente des journaux de compilation du Data Warehouse...</div>}
                   </div>
                </motion.div>
              )}
            </AnimatePresence>

        </div>
      </main>

      <AnimatePresence initial={false}>
        {(isCopilotOpen && view === 'canvas') && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="h-full border-l border-[#27272a] bg-[#0c0c0e] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] shrink-0 flex flex-col overflow-hidden"
          >
            <div className="h-14 border-b border-[#27272a] flex items-center px-5 shrink-0 bg-[#09090b]">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-200">
                 <Bot size={18} className="text-indigo-400" /> AI Data Engineer
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative">
               <ChatInterface messages={messages} setMessages={setMessages} onUpdateSql={setSqlCode} onUpdateEtl={setEtlCode} onUpdateCritic={setCriticReview} sqlCode={sqlCode} etlCode={etlCode} criticReview={criticReview} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {isModalOpen && (
        <ConnectionModal 
          onClose={() => setIsModalOpen(false)} 
          onStartSuccess={(newSql, critic) => {
            setSqlCode(newSql);
            setCriticReview(critic);
            setEtlCode(null);
            setMessages(prev => [...prev, { role: 'bot', content: "🚀 Modèle généré. Consultez l'onglet Critique pour mon diagnostic." }]);
            setView('canvas');
            if (!isCopilotOpen) setIsCopilotOpen(true);
          }}
        />
      )}
    </div>
  );
}