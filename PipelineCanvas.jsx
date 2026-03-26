import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, useNodesState, useEdgesState, MarkerType, Handle, Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Database, Bot, Sparkles, Server, Search, MessageSquare, Code, Wrench, Shield, Network } from 'lucide-react';

const PipelineNode = ({ data }) => {
  const Icon = data.icon;
  return (
    <div className={`px-4 py-3 shadow-xl rounded-xl border min-w-[220px] transition-transform flex flex-col items-center text-center ${data.active ? 'border-indigo-500 bg-[#18181b] shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'border-[#27272a] bg-[#18181b]/50 opacity-80'}`}>
      {data.type !== 'start' && <Handle type="target" position={Position.Top} className="w-4 h-1 rounded-sm bg-[#52525b] border-none" />}
      <div className={`p-3 rounded-full mb-2 flex items-center justify-center ${data.colorClass}`}>
        {Icon ? <Icon size={24} /> : <div className="w-6 h-6 bg-zinc-500/50 rounded-full" />}
      </div>
      <div className="text-sm font-bold text-white tracking-wide">{data.label}</div>
      <div className="text-[10px] text-zinc-500 uppercase mt-1 px-2">{data.desc}</div>
      {data.status === 'done' && <div className="mt-2 text-[10px] bg-emerald-500/20 text-emerald-400 px-2 rounded-full font-bold">✓ SUCCESS</div>}
      {data.status === 'processing' && <div className="mt-2 text-[10px] bg-indigo-500/20 text-indigo-400 px-2 rounded-full font-bold animate-pulse">Running...</div>}
      {data.type !== 'end' && <Handle type="source" position={Position.Bottom} className="w-4 h-1 rounded-sm bg-[#52525b] border-none" />}
      <Handle type="source" position={Position.Left} id="left" className="w-1 h-4 rounded-sm bg-[#52525b] border-none" />
      <Handle type="target" position={Position.Right} id="right" className="w-1 h-4 rounded-sm bg-[#52525b] border-none" />
    </div>
  );
};

const McdNode = ({ data }) => (
  <div className="bg-[#18181b] border border-indigo-500/50 shadow-lg rounded-lg overflow-hidden min-w-[180px]">
    <Handle type="target" position={Position.Top} />
    <div className="bg-gradient-to-r from-indigo-900 to-[#18181b] px-3 py-2 text-xs font-bold font-mono text-indigo-300 border-b border-[#27272a]">
      {data.label}
    </div>
    <div className="p-2 space-y-1 bg-[#09090b]">
      {data.columns.map((col, i) => (
        <div key={i} className="text-[10px] font-mono text-zinc-400 flex justify-between">
          <span>{col.name}</span>
          <span className="text-zinc-600">{col.type}</span>
        </div>
      ))}
    </div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const nodeTypes = {
  pipeline: PipelineNode,
  mcd: McdNode
};

export default function PipelineCanvas({ sqlCode, etlCode }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [viewMode, setViewMode] = useState('pipeline');

  useEffect(() => {
    if (viewMode === 'pipeline') {
      const activeStep = sqlCode ? (etlCode ? 'etl' : 'human') : 'source';
      
      const pNodes = [
        { id: 'n1', type: 'pipeline', position: { x: 400, y: 50 }, data: { label: 'Source Connectée', desc: 'Extraction métadonnées', icon: Database, colorClass: 'bg-emerald-500/20 text-emerald-400', active: true, status: 'done', type: 'start' } },
        { id: 'n2', type: 'pipeline', position: { x: 400, y: 220 }, data: { label: 'Agent Explorateur', desc: 'Analyse d\'entités virtuelles', icon: Search, colorClass: 'bg-blue-500/20 text-blue-400', active: true, status: activeStep !== 'source' ? 'done' : 'processing' } },
        { id: 'n3', type: 'pipeline', position: { x: 400, y: 390 }, data: { label: 'Agent Modélisateur', desc: 'Génération dimensionnelle', icon: Sparkles, colorClass: 'bg-indigo-500/20 text-indigo-400', active: activeStep !== 'source', status: activeStep !== 'source' ? 'done' : null } },
        { id: 'n4', type: 'pipeline', position: { x: 400, y: 560 }, data: { label: 'Agent Critique', desc: 'Vérification qualité DDL', icon: Shield, colorClass: 'bg-rose-500/20 text-rose-400', active: activeStep !== 'source', status: activeStep !== 'source' ? 'done' : null } },
        { id: 'n5', type: 'pipeline', position: { x: 400, y: 730 }, data: { label: 'Interface Humaine', desc: 'Boucle de validation', icon: MessageSquare, colorClass: 'bg-purple-500/20 text-purple-400', active: activeStep === 'human' || activeStep === 'etl', status: activeStep === 'etl' ? 'done' : (activeStep === 'human' ? 'processing' : null) } },
        { id: 'n6_1', type: 'pipeline', position: { x: 400, y: 900 }, data: { label: 'Extraction', desc: 'Lecture de la Source', icon: Database, colorClass: 'bg-cyan-500/20 text-cyan-400', active: activeStep === 'etl', status: activeStep === 'etl' ? 'done' : null } },
        { id: 'n6_2', type: 'pipeline', position: { x: 400, y: 1580 }, data: { label: 'Transformation', desc: 'Nettoyage & Cast (PySpark)', icon: Sparkles, colorClass: 'bg-cyan-500/20 text-cyan-400', active: activeStep === 'etl', status: activeStep === 'etl' ? 'processing' : null } },
        { id: 'n6_3', type: 'pipeline', position: { x: 400, y: 1240 }, data: { label: 'Modélisation', desc: 'Génération Étoile/Flocon', icon: Network, colorClass: 'bg-cyan-500/20 text-cyan-400', active: activeStep === 'etl', status: activeStep === 'etl' ? 'processing' : null } },
        { id: 'n6_4', type: 'pipeline', position: { x: 400, y: 1410 }, data: { label: 'Chargement (Load)', desc: 'Écriture MySQL Data Warehouse', icon: Database, colorClass: 'bg-cyan-500/20 text-cyan-400', active: activeStep === 'etl', status: activeStep === 'etl' ? 'processing' : null } },
        { id: 'n7', type: 'pipeline', position: { x: 100, y: 1070 }, data: { label: 'Agent Correcteur', desc: 'Boucle Try-Heal-Retry', icon: Wrench, colorClass: 'bg-yellow-500/20 text-yellow-500', active: activeStep === 'etl', status: null} },
        { id: 'n8', type: 'pipeline', position: { x: 400, y: 1580 }, data: { label: 'Data Warehouse', desc: 'Déploiement final', icon: Server, colorClass: 'bg-zinc-800 text-zinc-500', active: !!etlCode, type: 'end' } },
      ];

      const pEdges = [
        { id: 'e1-2', source: 'n1', target: 'n2', animated: activeStep === 'source' },
        { id: 'e2-3', source: 'n2', target: 'n3', animated: activeStep === 'source' },
        { id: 'e3-4', source: 'n3', target: 'n4', animated: activeStep !== 'source' },
        { id: 'e4-5', source: 'n4', target: 'n5', animated: activeStep !== 'source' },
        { id: 'e5-3', source: 'n5', target: 'n3', sourceHandle: 'left', targetHandle: 'left', type: 'step', style: { strokeDasharray: '5 5' }, label: 'Modification SQL' },
        { id: 'e5-6', source: 'n5', target: 'n6_1', animated: activeStep === 'etl', label: 'Validé' },
        { id: 'e61-62', source: 'n6_1', target: 'n6_2', animated: activeStep === 'etl' },
        { id: 'e62-63', source: 'n6_2', target: 'n6_3', animated: activeStep === 'etl' },
        { id: 'e63-64', source: 'n6_3', target: 'n6_4', animated: activeStep === 'etl' },
        { id: 'e6-7', source: 'n6_2', target: 'n7', sourceHandle: 'left', targetHandle: 'right', type: 'step', label: 'Erreur exécution', style: { stroke: '#eab308' } },
        { id: 'e7-6', source: 'n7', target: 'n6_2', sourceHandle: 'top', targetHandle: 'top', type: 'step', label: 'Correction (Retry)' },
        { id: 'e6-8', source: 'n6_4', target: 'n8', animated: !!etlCode }
      ];
      setNodes(pNodes);
      setEdges(pEdges.map(e => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed, color: e.style?.stroke || '#52525b' }, style: e.style || { stroke: '#52525b', strokeWidth: 2 } })));
    } 
    else if (viewMode === 'mcd') {
      if (!sqlCode) {
        setNodes([{ id: 'empty', position: { x: 200, y: 200 }, data: { label: 'Aucun modèle généré' }, style: { padding: 20, background: '#18181b', color: '#fff', border: '1px solid #27272a', borderRadius: 10 } }]);
        setEdges([]);
        return;
      }

      const mcdNodes = [];
      const mcdEdges = [];
      const tables = sqlCode.match(/CREATE TABLE( IF NOT EXISTS)?\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi) || [];
      
      let xOffset = 100;
      let yOffset = 100;
      
      tables.forEach((tStr, index) => {
        const tMatch = tStr.match(/CREATE TABLE(?: IF NOT EXISTS)?\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/i);
        if (!tMatch) return;
        const tName = tMatch[1];
        const tBody = tMatch[2];
        const columnLines = tBody.split(',\n').map(l => l.trim()).filter(l => l && !l.toUpperCase().startsWith('PRIMARY KEY') && !l.toUpperCase().startsWith('FOREIGN KEY') && !l.startsWith('--'));
        
        const cols = columnLines.map(line => {
          const parts = line.split(/\s+/);
          return { name: parts[0], type: parts[1] || 'UNKNOWN' };
        });

        const isFact = tName.toLowerCase().includes('fact');
        mcdNodes.push({
          id: `tbl-${tName}`,
          type: 'mcd',
          position: { x: isFact ? 400 : (xOffset % 800) + 100, y: isFact ? 300 : yOffset },
          data: { label: tName, columns: cols }
        });

        if (!isFact) {
          xOffset += 300;
          if (xOffset > 800) { xOffset = 50; yOffset += 250; }
        }

        const fkMatches = [...tBody.matchAll(/FOREIGN KEY\s*\([a-z_]+\)\s*REFERENCES\s*([a-zA-Z0-9_]+)/gi)];
        fkMatches.forEach(fk => {
          const targetTable = fk[1];
          mcdEdges.push({
            id: `fk-${tName}-${targetTable}`,
            source: `tbl-${tName}`,
            target: `tbl-${targetTable}`,
            animated: true,
            style: { stroke: '#6366f1', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }
          });
        });
      });

      setNodes(mcdNodes);
      setEdges(mcdEdges);
    }
  }, [viewMode, sqlCode, etlCode, setNodes, setEdges]);

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-6 left-6 z-10 flex gap-2 bg-[#09090b]/80 backdrop-blur-md p-1 rounded-lg border border-[#27272a] shadow-xl">
         <button 
           onClick={() => setViewMode('pipeline')}
           className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'pipeline' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-white'}`}
         >
           Global Pipeline
         </button>
         <button 
           onClick={() => setViewMode('mcd')}
           className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'mcd' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-white'}`}
         >
           Modèle Conceptuel (MCD)
         </button>
      </div>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView className="bg-transparent" minZoom={0.2}>
        <Background color="#27272a" gap={24} size={1.5} />
        <Controls className="bg-[#18181b] border-[#27272a] fill-zinc-400" />
      </ReactFlow>
    </div>
  );
}
