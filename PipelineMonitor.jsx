import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, XCircle, Clock, Loader, ChevronDown, ChevronUp, Bell, BellOff, X, Activity } from 'lucide-react';

const STATUS_CONFIG = {
  idle:    { color: 'text-slate-500',  bg: 'bg-slate-800',   border: 'border-slate-700', icon: Clock,       pulse: false },
  running: { color: 'text-blue-400',   bg: 'bg-blue-900/30', border: 'border-blue-500',  icon: Loader,      pulse: true  },
  success: { color: 'text-emerald-400',bg: 'bg-emerald-900/20',border:'border-emerald-500',icon: CheckCircle, pulse: false },
  failed:  { color: 'text-red-400',    bg: 'bg-red-900/20',  border: 'border-red-500',   icon: XCircle,     pulse: false },
};

function VerticalStageNode({ stage, isLast }) {
  const cfg = STATUS_CONFIG[stage.status] || STATUS_CONFIG.idle;
  const Icon = cfg.icon;
  return (
    <div className="relative flex flex-col items-start w-full">
      <div className="flex items-start gap-4 z-10 relative">
        <div className={`mt-1 relative flex items-center justify-center w-8 h-8 rounded-full border shadow-sm transition-all duration-500 ${cfg.bg} ${cfg.border} shrink-0`}>
          {cfg.pulse && (
            <span className="absolute inset-0 rounded-full border border-blue-400 animate-ping opacity-30"></span>
          )}
          <Icon size={14} className={`${cfg.color} ${cfg.pulse ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex flex-col flex-1 pb-6">
          <span className={`text-sm font-bold ${cfg.color} tracking-wide`}>
            {stage.label}
          </span>
          {stage.detail && (
            <span className="text-xs text-slate-400 mt-1 leading-relaxed max-w-[180px]">
              {stage.detail}
            </span>
          )}
          <span className={`text-[10px] uppercase tracking-widest font-black mt-1 ${cfg.color} opacity-60`}>
            {stage.status}
          </span>
        </div>
      </div>
      {!isLast && (
        <div className={`absolute left-4 top-8 bottom-0 w-[2px] -ml-[1px] transition-colors duration-700 ${
          stage.status === 'success' ? 'bg-emerald-500/50' :
          stage.status === 'failed'  ? 'bg-red-500/50' :
          stage.status === 'running' ? 'bg-blue-500/50' : 'bg-slate-700'
        }`} />
      )}
    </div>
  );
}

export default function PipelineMonitor({ isVisible, onClose, onSuccess }) {
  const [pipelineData, setPipelineData] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [notifGranted, setNotifGranted] = useState(Notification.permission === 'granted');
  const eventSourceRef = useRef(null);
  const prevStatusRef  = useRef(null);
  const logsEndRef     = useRef(null);

  // Connexion SSE
  useEffect(() => {
    const es = new EventSource('http://127.0.0.1:8000/api/pipeline-stream');
    eventSourceRef.current = es;

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        setPipelineData(data);

        if (data.status !== prevStatusRef.current) {
          prevStatusRef.current = data.status;
          if (data.status === 'success') {
            if (notifGranted) {
              new Notification('✅ ETL Réussi !', { body: 'Le Data Warehouse MySQL a été mis à jour avec succès.', icon: '/favicon.ico' });
            }
            if (onSuccess && data.etl_code_used) {
              onSuccess(data.etl_code_used);
            }
          } else if (data.status === 'failed') {
            if (notifGranted) {
              new Notification('❌ ETL Échoué', { body: 'Le pipeline ETL a rencontré une erreur. Vérifiez les logs.', icon: '/favicon.ico' });
            }
          }
        }
      } catch {}
    };

    es.onerror = () => {
      setTimeout(() => { if (eventSourceRef.current) eventSourceRef.current.close(); }, 3000);
    };

    return () => es.close();
  }, [notifGranted]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pipelineData?.logs, showLogs]);

  const requestNotifPermission = async () => {
    const perm = await Notification.requestPermission();
    setNotifGranted(perm === 'granted');
  };

  const getDuration = () => {
    if (!pipelineData?.started_at) return null;
    const end = pipelineData.ended_at || (Date.now() / 1000);
    const secs = Math.round(end - pipelineData.started_at);
    return secs >= 60 ? `${Math.floor(secs/60)}m ${secs%60}s` : `${secs}s`;
  };

  const overallStatus = pipelineData?.status || 'idle';
  const stages        = pipelineData?.stages || [];
  const logs          = pipelineData?.logs   || [];
  const duration      = getDuration();

  return (
    <div style={{ display: isVisible ? 'flex' : 'none' }} className="w-72 bg-slate-900 border-r border-slate-800 flex-col h-full shadow-2xl relative z-20 transition-all">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/80 backdrop-blur-xl">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Activity size={16} className={
            overallStatus === 'running' ? "text-blue-400 animate-pulse" : 
            overallStatus === 'success' ? "text-emerald-400" :
            overallStatus === 'failed' ? "text-red-400" : "text-slate-500"
          } />
          Pipeline ETL
        </h2>
        <div className="flex items-center gap-2">
           <button onClick={notifGranted ? null : requestNotifPermission} title="Notifications" className={`transition-colors ${notifGranted ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}>
             {notifGranted ? <Bell size={14} /> : <BellOff size={14} />}
           </button>
           <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 bg-slate-800 rounded-md transition-colors hover:bg-slate-700">
             <X size={14} />
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700">
        
        <div className="mb-6 flex items-center justify-between pb-4 border-b border-slate-800/50">
           <div>
             <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
               overallStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
               overallStatus === 'failed'  ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
               overallStatus === 'running' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                             'bg-slate-800 text-slate-400 border border-slate-700'
             }`}>
               {overallStatus.toUpperCase()}
             </span>
           </div>
           {duration && (
             <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">{duration}</span>
           )}
        </div>

        <div className="flex flex-col relative">
          {stages.map((stage, i) => (
            <VerticalStageNode key={stage.id} stage={stage} isLast={i === stages.length - 1} />
          ))}
        </div>

        <div className="mt-8 border-t border-slate-800/50 pt-4">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:bg-slate-800"
          >
            <span>Journaux d'exécution (Logs)</span>
            {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          {showLogs && (
            <div className="mt-2 bg-slate-950 border border-slate-800 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[10px] sm:text-xs">
              {logs.length === 0 ? (
                <span className="text-slate-600">Aucun évènement journalisé.</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-slate-300 leading-normal mb-1">
                    <span className="text-emerald-500/50 flex-shrink-0">[{log.t}s]</span>
                    <span className="text-slate-300">{log.msg}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
