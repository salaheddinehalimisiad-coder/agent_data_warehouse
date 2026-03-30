import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow, Background, Controls, useNodesState, useEdgesState, MarkerType,
  Handle, Position, ReactFlowProvider, useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Database, Sparkles, Server, Search, MessageSquare, Wrench, Shield,
  Network, CheckCircle2, Activity, X, Settings, Loader2, AlertTriangle, RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────
//  NODE: TABLE (MCD)
// ─────────────────────────────────────────────
const TableNode = ({ data }) => {
  return (
    <div className={`px-4 py-3 rounded-2xl border flex flex-col min-w-[220px] shadow-2xl relative transition-all duration-500 hover:scale-105 ${
      data.isFact ? 'bg-[#181820] border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.25)]' : 'bg-[#141a18] border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
    }`}>
      <Handle type="target" position={Position.Top} className="!opacity-0" id="t-top" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" id="s-bottom" />
      <Handle type="target" position={Position.Left} className="!opacity-0" id="t-left" />
      <Handle type="source" position={Position.Right} className="!opacity-0" id="s-right" />
      
      <div className={`text-[11px] font-black tracking-widest uppercase mb-3 pb-2 border-b flex justify-between items-center ${
        data.isFact ? 'text-indigo-400 border-indigo-500/30' : 'text-emerald-400 border-emerald-500/30'
      }`}>
        {data.label} <Database size={14} />
      </div>
      <div className="flex flex-col gap-1.5 overflow-hidden">
        {data.cols.map((col, idx) => {
          let colColor = "text-zinc-400";
          if (col.toLowerCase().includes("primary") || col.toLowerCase().includes(" pk") || col.includes("_pk") || col.includes("_id") || col.includes("_sk")) colColor = "text-amber-400";
          if (col.toLowerCase().includes("foreign") || col.toLowerCase().includes(" fk") || col.includes("_fk") || col.toLowerCase().includes("references")) colColor = "text-purple-400";
          
          let parts = col.split(/\s+/);
          let name = parts[0];
          let type = parts.slice(1).join(' ').substring(0, 15);
          if (type.length === 15) type += '...';
          
          return (
             <div key={idx} className={`text-[10px] font-mono flex justify-between ${colColor}`}>
                <span className="font-semibold truncate mr-4">{name}</span>
                <span className="opacity-60 truncate">{type}</span>
             </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  NODE: GLOBAL PIPELINE STEP (bidirectional handles)
// ─────────────────────────────────────────────
const PipelineNode = ({ data, selected }) => {
  const Icon = data.icon;
  const isProcessing = data.status === 'processing';
  const isDone = data.status === 'done';
  const isFailed = data.status === 'failed';

  return (
    <div
      className={`px-5 py-4 shadow-2xl rounded-2xl border min-w-[240px] max-w-[240px] flex flex-col items-center text-center transition-all duration-700 cursor-pointer
        ${selected
          ? 'border-indigo-400 bg-[#1e1e24] shadow-[0_0_40px_rgba(99,102,241,0.4)] scale-105 z-10'
          : isProcessing
            ? 'border-indigo-500/60 bg-[#121216] shadow-[0_0_30px_rgba(99,102,241,0.3)] ring-2 ring-indigo-500/30'
            : isDone
              ? 'border-emerald-500/50 bg-[#14201a] shadow-[0_0_20px_rgba(16,185,129,0.2)]'
              : isFailed
                ? 'border-rose-500/60 bg-[#251010] shadow-[0_0_30px_rgba(244,63,94,0.3)] ring-2 ring-rose-500/30'
                : data.active
                  ? 'border-zinc-700 bg-[#18181b] hover:border-indigo-500/40 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] shadow-none'
                  : 'border-[#27272a] bg-[#18181b]/50 opacity-30 shadow-none'
        }`}
    >
      <Handle type="target" position={Position.Top}    id="t-top"    className="!opacity-0" />
      <Handle type="source" position={Position.Top}    id="s-top"    className="!opacity-0" />
      <Handle type="target" position={Position.Bottom} id="t-bottom" className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className="!opacity-0" />
      <Handle type="target" position={Position.Left}   id="t-left"   className="!opacity-0" />
      <Handle type="source" position={Position.Left}   id="s-left"   className="!opacity-0" />
      <Handle type="target" position={Position.Right}  id="t-right"  className="!opacity-0" />
      <Handle type="source" position={Position.Right}  id="s-right"  className="!opacity-0" />

      <div className={`p-4 rounded-2xl mb-4 relative transition-all duration-700 
        ${isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : isProcessing ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : isFailed ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : data.colorClass} 
        ${isProcessing ? 'animate-pulse shadow-[0_0_25px_currentColor]' : ''}
        ${isDone ? 'shadow-[0_0_15px_rgba(16,185,129,0.2)]' : ''}`}>
        {Icon ? <Icon size={30} /> : null}
      </div>

      <div className={`text-[13px] font-black tracking-wider leading-tight transition-colors duration-700 
        ${isProcessing ? 'text-indigo-400' : isDone ? 'text-emerald-400' : isFailed ? 'text-rose-400' : 'text-zinc-200'}`}>
        {data.label.toUpperCase()}
      </div>
      <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-[0.1em] mt-2 leading-relaxed">{data.desc}</div>

      {isDone && (
        <div className="mt-4 text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full font-black tracking-[0.15em] flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <CheckCircle2 size={10} /> TERMINÉ
        </div>
      )}
      {isProcessing && (
        <div className="mt-4 text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-4 py-1.5 rounded-full font-black tracking-[0.15em] flex items-center gap-1.5 animate-pulse">
          <Loader2 size={10} className="animate-spin" /> EN COURS...
        </div>
      )}
      {isFailed && (
        <div className="mt-4 text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-1.5 rounded-full font-black tracking-[0.15em] flex items-center gap-1.5">
          <AlertTriangle size={10} /> ÉCHEC
        </div>
      )}
    </div>
  );
};

const nodeTypes = { pipeline: PipelineNode, table: TableNode };

function FlowArea({ sqlCode, etlCode, pipelineState }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [viewMode, setViewMode] = useState('pipeline');
  const [bottomProgress, setBottomProgress] = useState(0);
  const { fitView } = useReactFlow();
  const hasFittedView = useRef(false);

  useEffect(() => {
      hasFittedView.current = false;
  }, [viewMode]);

  // Animation logic for bottom row
  useEffect(() => {
     let isComplete = false;
     if (pipelineState) {
         const logs = pipelineState.logs || [];
         const logText = logs.map(l=>l.msg).join(' ');
         const stageStatus = (sid) => pipelineState.stages?.find(x => x.id === sid)?.status || 'idle';
         isComplete = logText.includes('opérationnel') || logText.includes('terminé') || stageStatus('etl_exec') === 'done';
     }
     
     if (isComplete && bottomProgress < 5) {
         const timer = setTimeout(() => {
             setBottomProgress(p => p + 1);
         }, 800);
         return () => clearTimeout(timer);
     }
     if (!isComplete && bottomProgress > 0) {
         setBottomProgress(0);
     }
  }, [pipelineState, bottomProgress]);

  const getS = (id) => {
    const logs = pipelineState?.logs || [];
    const logText = logs.map(l => l.msg).join(' ');
    
    const stageStatus = (sid) => pipelineState?.stages?.find(x => x.id === sid)?.status || 'idle';
    
    // 1. TOP ROW: Static if sqlCode exists
    if (sqlCode) {
       if (['explorer', 'modeler'].includes(id)) return 'done';
       
       const cStatus = stageStatus('critic');
       if (id === 'critic') {
           if (etlCode || cStatus === 'success' || cStatus === 'done') return 'done';
           return cStatus;
       }
       
       const hStatus = stageStatus('human');
       if (id === 'human') {
           if (etlCode || hStatus === 'success' || hStatus === 'done') return 'done';
           return sqlCode ? 'processing' : 'idle';
       }
    }

    // 2. BOTTOM ROW: Strict Fallback on Logs with Sequential Animation
    if (etlCode) {
       // If bottom sequence is active, use progress to animate
       if (bottomProgress > 0) {
           if (id === 'etl_gen') return 'done';
           if (id === 'etl_exec') return bottomProgress >= 1 ? 'done' : 'processing';
           if (id === 'dwh_load') return bottomProgress >= 2 ? 'done' : (bottomProgress === 1 ? 'processing' : 'idle');
           if (id === 'dwh_serve') return bottomProgress >= 3 ? 'done' : (bottomProgress === 2 ? 'processing' : 'idle');
           if (id === 'bi_output') return bottomProgress >= 4 ? 'done' : (bottomProgress === 3 ? 'processing' : 'idle');
       }

       // Otherwise evaluate live
       if (id === 'etl_gen') return stageStatus('etl_gen');
       if (id === 'etl_exec') {
           const s = stageStatus('etl_exec');
           if (s === 'failed') return 'failed';
           return s;
       }
       if (id === 'dwh_load') return logText.includes('DWH') ? 'processing' : 'idle';
       if (id === 'dwh_serve') return logText.includes('Serveur') ? 'processing' : 'idle';
       return 'idle';
    }
    
    // Evaluate if something failed high-level
    if (pipelineState?.status === 'failed') {
        const failedStage = pipelineState.stages?.find(s => s.status === 'failed');
        if (failedStage && failedStage.id === id) return 'failed';
    }

    return 'idle';
  };

  useEffect(() => {
    if (viewMode === 'mcd') {
      if (!sqlCode) {
         setNodes([{ id: 'empty', position: { x: 400, y: 300 }, data: { label: 'Aucun Modèle Généré', cols: [] }, type: 'table' }]);
         setEdges([]);
         return;
      }
      
      // Bug fix #7 : Regex SQL plus robuste.
      // En exigeant que le ");" de clôture soit sur sa propre ligne (précédé d'un saut de ligne),
      // on évite que la regex s'arrête sur un ";" interne à une contrainte inline
      // (ex : CHECK(...), COMMENT '...;'). Le LLM génère toujours le DDL sur plusieurs lignes.
      const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(`"]+|`[^`]+`|"[^"]+")\s*\(([\s\S]*?)\n\s*\)\s*;/gi;
      const mcdNodes = [];
      const mcdEdges = [];
      const dims = [];
      let fact = null;

      let match;
      while ((match = tableRegex.exec(sqlCode)) !== null) {
          const tableName = match[1].replace(/`/g, '');
          const content = match[2];
          const lines = content.split('\n')
            .map(c => c.trim().replace(/,$/, ''))
            .filter(c => c && !c.toUpperCase().startsWith('FOREIGN') && !c.toUpperCase().startsWith('PRIMARY') && !c.toUpperCase().startsWith('KEY') && !c.toUpperCase().startsWith('CONSTRAINT'));
          
          const isFact = tableName.toLowerCase().includes('fact') || tableName.toLowerCase().includes('fait');
          if (isFact) fact = { id: tableName, cols: lines, isFact };
          else dims.push({ id: tableName, cols: lines, isFact });
      }

      if (fact) {
          mcdNodes.push({
              id: fact.id, type: 'table', position: { x: 500, y: 350 }, data: { label: fact.id, cols: fact.cols, isFact: true }
          });
          
          const radius = 350;
          const totalDims = dims.length;
          
          dims.forEach((d, i) => {
              const angle = (i / totalDims) * 2 * Math.PI;
              const x = 500 + radius * Math.cos(angle);
              const y = 350 + radius * Math.sin(angle);
              mcdNodes.push({
                  id: d.id, type: 'table', position: { x, y }, data: { label: d.id, cols: d.cols, isFact: false }
              });
              
              mcdEdges.push({
                  id: `e-${fact.id}-${d.id}`, source: fact.id, target: d.id,
                  type: 'straight', animated: true,
                  style: { stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '4 4' },
              });
          });
      } else if (dims.length > 0) {
          dims.forEach((d, i) => {
              mcdNodes.push({id: d.id, type: 'table', position: { x: 100 + i*280, y: 150 }, data: { label: d.id, cols: d.cols, isFact: false }});
          });
      }

      setNodes(mcdNodes);
      setEdges(mcdEdges);
      setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
    }
    else if (viewMode === 'pipeline') {
      const col = [100, 420, 740, 1060, 1380];
      const rowY1 = 80;
      const rowY2 = 420;

      const s = {
        exp: getS('explorer'), mod: getS('modeler'), crt: getS('critic'), 
        hum: getS('human'), egn: getS('etl_gen'), exe: getS('etl_exec'), 
        dwh: getS('dwh_load'), srv: getS('dwh_serve'), bi: getS('bi_output')
      };

      const pNodes = [
        { id: 'n1', type: 'pipeline', position: { x: col[0], y: rowY1 }, data: { label: 'Source Connectée', desc: 'Extraction Métadonnées', icon: Database, colorClass: 'bg-emerald-500/10 text-emerald-400', active: true, status: 'done' } },
        { id: 'n2', type: 'pipeline', position: { x: col[1], y: rowY1 }, data: { label: 'Agent Explorateur', desc: 'Analyse des entités', icon: Search, colorClass: 'bg-blue-500/10 text-blue-400', active: true, status: 'done' } },
        { id: 'n3', type: 'pipeline', position: { x: col[2], y: rowY1 }, data: { label: 'Modélisateur MCD', desc: 'Génération Schéma Étoile', icon: Sparkles, colorClass: 'bg-indigo-500/10 text-indigo-400', active: true, status: 'done' } },
        { id: 'n4', type: 'pipeline', position: { x: col[3], y: rowY1 }, data: { label: 'Agent Critique', desc: 'Audit Qualité DDL', icon: Shield, colorClass: 'bg-rose-500/10 text-rose-400', active: true, status: s.crt } },
        { id: 'n5', type: 'pipeline', position: { x: col[4], y: rowY1 }, data: { label: 'Validation Humaine', desc: 'Ajustements & Approbation', icon: MessageSquare, colorClass: 'bg-purple-500/10 text-purple-400', active: true, status: s.hum } },

        { id: 'n6_1', type: 'pipeline', position: { x: col[4], y: rowY2 }, data: { label: 'Extraction ETL', desc: 'Lecture Source (Pentaho)', icon: Database, colorClass: 'bg-cyan-500/10 text-cyan-400', active: s.hum==='done', status: s.egn } },
        { id: 'n6_2', type: 'pipeline', position: { x: col[3], y: rowY2 }, data: { label: 'Transformations', desc: 'Mapping & Steps Pentaho', icon: Sparkles, colorClass: 'bg-cyan-300/10 text-cyan-400', active: s.egn==='done', status: s.exe } },
        { id: 'n6_3', type: 'pipeline', position: { x: col[2], y: rowY2 }, data: { label: 'Chargement DWH', desc: 'Dim & Faits → MySQL', icon: Network, colorClass: 'bg-cyan-300/10 text-cyan-400', active: s.exe==='done'||s.exe==='processing', status: s.dwh } },
        { id: 'n6_4', type: 'pipeline', position: { x: col[1], y: rowY2 }, data: { label: 'Serveur DWH', desc: 'MySQL / Postgres Database', icon: Database, colorClass: 'bg-indigo-500/10 text-indigo-400', active: s.dwh==='done', status: s.srv } },
        { id: 'n8',   type: 'pipeline', position: { x: col[0], y: rowY2 }, data: { label: 'Plateforme BI', desc: 'Power BI / Metabase / PDF', icon: Server, colorClass: 'bg-emerald-500/10 text-emerald-400', active: s.srv==='done', status: s.bi } },
      ];

      setNodes(pNodes.map(n => ({ ...n, draggable: false })));

      const getEdgeStyle = (sourceSt, targetSt) => {
        if (targetSt === 'failed') return { stroke: '#f43f5e', strokeWidth: 4, filter: 'drop-shadow(0 0 10px #f43f5e)' };
        if (targetSt === 'processing') return { stroke: '#3b82f6', strokeWidth: 6, strokeDasharray: '10 5', animationDuration: '3s', filter: 'drop-shadow(0 0 15px #3b82f6)' };
        if (sourceSt === 'done') return { stroke: '#3b82f6', strokeWidth: 4, filter: 'drop-shadow(0 0 10px #3b82f6)' };
        return { stroke: '#27272a', strokeWidth: 2.5 };
      };

      const pEdges = [
        { id: 'e1-2',  source:'n1', target:'n2', sourceHandle:'s-right', targetHandle:'t-left', animated: true, style: getEdgeStyle('done', 'done') },
        { id: 'e2-3',  source:'n2', target:'n3', sourceHandle:'s-right', targetHandle:'t-left', animated: true, style: getEdgeStyle('done', 'done') },
        { id: 'e3-4',  source:'n3', target:'n4', sourceHandle:'s-right', targetHandle:'t-left', animated: s.crt==='processing', style: getEdgeStyle('done', s.crt) },
        { id: 'e4-5',  source:'n4', target:'n5', sourceHandle:'s-right', targetHandle:'t-left', animated: s.hum==='processing', style: getEdgeStyle(s.crt, s.hum) },
        { id: 'e5-61', source:'n5', target:'n6_1', sourceHandle:'s-bottom', targetHandle:'t-top', animated: s.egn==='processing', style: getEdgeStyle(s.hum, s.egn), type: 'smoothstep' },
        { id: 'e61-62',source:'n6_1', target:'n6_2', sourceHandle:'s-left', targetHandle:'t-right', animated: s.exe==='processing', style: getEdgeStyle(s.egn, s.exe) },
        { id: 'e62-63',source:'n6_2', target:'n6_3', sourceHandle:'s-left', targetHandle:'t-right', animated: s.dwh==='processing', style: getEdgeStyle(s.exe, s.dwh) },
        { id: 'e63-64',source:'n6_3', target:'n6_4', sourceHandle:'s-left', targetHandle:'t-right', animated: s.srv==='processing', style: getEdgeStyle(s.dwh, s.srv) },
        { id: 'e64-8', source:'n6_4', target:'n8',   sourceHandle:'s-left', targetHandle:'t-right', animated: s.bi==='processing', style: getEdgeStyle(s.srv, s.bi) },
      ];

      setEdges(pEdges.map(e => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed, color: e.style.stroke, width: 24, height: 24 } })));
      
      if (!hasFittedView.current) {
         hasFittedView.current = true;
         setTimeout(() => {
            fitView({ padding: 0.15, maxZoom: 0.8, duration: 800 });
         }, 100);
      }
    }
  // Bug fix #6 : onNodesChange, onEdgesChange et fitView sont des fonctions instables :
  // elles sont recréées à chaque render par useReactFlow/useNodesState.
  // Les inclure dans les dépendances déclenchait une boucle infinie de re-renders
  // dès que le pipeline émettait des événements SSE. On les exclut explicitement.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, sqlCode, etlCode, pipelineState, bottomProgress]);

  const isFailed = pipelineState?.status === 'failed';

  return (
    <div className="w-full h-full relative bg-[#09090b]">
       <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 bg-[#121214]/98 backdrop-blur-xl p-1.5 rounded-2xl border border-zinc-800 shadow-2xl">
          <button onClick={() => setViewMode('pipeline')} className={`px-6 py-2.5 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all ${viewMode === 'pipeline' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-lg' : 'text-zinc-500 hover:text-white'}`}>Process Architecture</button>
          <button onClick={() => setViewMode('mcd')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all ${viewMode === 'mcd' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-lg' : 'text-zinc-500 hover:text-white'}`}>Star Schema (MCD)</button>
       </div>

       <AnimatePresence>
         {isFailed && (
           <motion.div 
             initial={{ opacity: 0, y: -20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -20 }}
             className="absolute top-24 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-6"
           >
             <div className="bg-rose-500/10 backdrop-blur-md border border-rose-500/30 p-4 rounded-xl flex items-start gap-4 shadow-[0_10px_40px_rgba(244,63,94,0.15)]">
               <div className="p-3 bg-rose-500/20 rounded-lg text-rose-400">
                 <AlertTriangle size={24} />
               </div>
               <div className="flex-1">
                 <h3 className="text-sm font-bold text-rose-300 uppercase tracking-widest mb-1">Erreur Critique de l'Agentique</h3>
                 <p className="text-xs text-rose-200/70 leading-relaxed mb-4">
                   {pipelineState?.error || "Le pipeline a rencontré une défaillance inattendue. L'agent ne peut pas poursuivre la génération du flux Pentaho."}
                 </p>
                 <button 
                  onClick={() => {
                    // Bug fix #11 : L'utilisateur est averti que le rechargement efface
                    // toute la session (LangGraph MemorySaver est volatile).
                    // Cela évite une perte de travail non intentionnelle.
                    if (window.confirm('Cette action va recharger la page et effacer toute la session IA en cours (pipeline, modèles, messages). Continuer ?')) {
                      window.location.reload();
                    }
                  }}
                  className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-rose-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
                 >
                   <RefreshCcw size={12} /> Redémarrer le système
                 </button>
               </div>
               <button className="text-zinc-500 hover:text-white"><X size={16} /></button>
             </div>
           </motion.div>
         )}
       </AnimatePresence>

       <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} proOptions={{hideAttribution:true}} minZoom={0.05} nodesDraggable={false}>
          <Background color="#1c1c25" gap={30} size={1} />
       </ReactFlow>
    </div>
  );
}

export default function PipelineCanvas(props) {
  return <ReactFlowProvider><FlowArea {...props} /></ReactFlowProvider>;
}
