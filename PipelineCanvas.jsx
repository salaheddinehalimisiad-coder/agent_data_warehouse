import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow, Background, Controls, useNodesState, useEdgesState, MarkerType,
  Handle, Position, ReactFlowProvider, useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Database, Sparkles, Server, Search, MessageSquare, Wrench, Shield,
  Network, CheckCircle2, Activity, X, Settings, Key, Link, GitBranch,
  Hash, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────
//  NODE: GLOBAL PIPELINE STEP (fixed, un-draggable)
// ─────────────────────────────────────────────
const PipelineNode = ({ data, selected }) => {
  const Icon = data.icon;
  return (
    <div
      className={`px-5 py-4 shadow-2xl rounded-2xl border min-w-[230px] max-w-[230px] flex flex-col items-center text-center transition-all duration-300 cursor-pointer
        ${selected
          ? 'border-indigo-400 bg-[#1e1e24] shadow-[0_0_30px_rgba(99,102,241,0.5)] scale-105 z-10'
          : data.active
            ? 'border-indigo-500/40 bg-[#18181b] hover:border-indigo-400/80 hover:shadow-[0_0_20px_rgba(99,102,241,0.25)]'
            : 'border-[#27272a] bg-[#18181b]/50 opacity-50'
        }`}
    >
      {data.handles?.includes('top')    && <Handle type="target" position={Position.Top}    id="top"    className="!w-6 !h-1.5 !rounded-full !bg-zinc-700 !border-none" />}
      {data.handles?.includes('bottom') && <Handle type="source" position={Position.Bottom} id="bottom" className="!w-6 !h-1.5 !rounded-full !bg-zinc-700 !border-none" />}
      {data.handles?.includes('left')   && <Handle type="target" position={Position.Left}   id="left"   className="!w-1.5 !h-6 !rounded-full !bg-zinc-700 !border-none" />}
      {data.handles?.includes('right')  && <Handle type="source" position={Position.Right}  id="right"  className="!w-1.5 !h-6 !rounded-full !bg-zinc-700 !border-none" />}

      <div className={`p-3.5 rounded-2xl mb-3 relative ${data.colorClass}`}>
        {Icon ? <Icon size={28} /> : null}
        {data.status === 'processing' && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
          </span>
        )}
      </div>

      <div className="text-sm font-black text-white tracking-wide leading-tight">{data.label}</div>
      <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mt-1.5">{data.desc}</div>

      {data.status === 'done' && (
        <div className="mt-3 text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold flex items-center gap-1">
          <CheckCircle2 size={10} /> TERMINÉ
        </div>
      )}
      {data.status === 'processing' && (
        <div className="mt-3 text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full font-bold flex items-center gap-1 animate-pulse">
          <Activity size={10} /> EN COURS
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
//  NODE: MCD TABLE  (draggable, 4 handles)
// ─────────────────────────────────────────────
const McdNode = ({ data, selected }) => (
  <div
    className={`bg-[#18181b] border-2 shadow-2xl rounded-xl overflow-hidden transition-all duration-200 min-w-[190px] cursor-pointer
      ${data.isFact
        ? 'border-amber-500 shadow-amber-500/20 scale-110 z-20'
        : selected
          ? 'border-indigo-400 shadow-indigo-500/30 z-10'
          : 'border-[#3a3a4a] hover:border-indigo-500/70'
      }`}
  >
    {/* 4 handles for flexible routing */}
    <Handle type="target"  position={Position.Top}    id="top"    className="!w-3 !h-3 !rounded-full !bg-indigo-500 !border-2 !border-[#18181b]" />
    <Handle type="source"  position={Position.Bottom} id="bottom" className="!w-3 !h-3 !rounded-full !bg-indigo-500 !border-2 !border-[#18181b]" />
    <Handle type="target"  position={Position.Right}  id="right"  className="!w-3 !h-3 !rounded-full !bg-indigo-500 !border-2 !border-[#18181b]" />
    <Handle type="source"  position={Position.Left}   id="left"   className="!w-3 !h-3 !rounded-full !bg-indigo-500 !border-2 !border-[#18181b]" />

    {/* Header */}
    <div className={`px-4 py-2.5 text-xs font-black tracking-widest uppercase flex items-center gap-2
      ${data.isFact
        ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white border-b border-amber-700'
        : 'bg-gradient-to-r from-[#1e1e2e] to-[#18181b] text-indigo-300 border-b border-[#27272a]'
      }`}
    >
      {data.isFact
        ? <Activity size={12} className="shrink-0" />
        : <Database size={12} className="shrink-0" />
      }
      {data.label}
    </div>

    {/* Columns */}
    <div className="px-3 py-2 space-y-1 bg-[#0d0d14]">
      {data.columns.map((col, i) => {
        const isPK  = col.name?.toLowerCase().startsWith('id_') || col.name?.toLowerCase().endsWith('_id') || i === 0;
        const isFK  = col.name?.toLowerCase().endsWith('_id') && i !== 0;
        return (
          <div key={i} className="flex items-center justify-between gap-3 py-0.5 border-b border-zinc-800/60 last:border-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {isPK && !isFK && <Key size={9} className="text-amber-400 shrink-0" />}
              {isFK && <Link size={9} className="text-indigo-400 shrink-0" />}
              {!isPK && !isFK && <span className="w-2" />}
              <span className="text-[10px] font-mono text-zinc-300 truncate">{col.name}</span>
            </div>
            <span className={`text-[9px] font-mono font-bold shrink-0
              ${col.type?.includes('INT') ? 'text-cyan-500'
                : col.type?.includes('VARCHAR') || col.type?.includes('TEXT') ? 'text-emerald-500'
                : col.type?.includes('DATE') || col.type?.includes('TIME') ? 'text-purple-400'
                : col.type?.includes('DECIMAL') || col.type?.includes('FLOAT') ? 'text-amber-400'
                : 'text-zinc-500'
              }`}
            >
              {col.type || '?'}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

const nodeTypes = { pipeline: PipelineNode, mcd: McdNode };

// ─────────────────────────────────────────────
//  STEP DETAILS PANEL  (appears on node click)
// ─────────────────────────────────────────────
const pipelineStepDetails = {
  n1: {
    title: 'Source Connectée',
    description: "L'Agent Explorateur se connecte à la source CSV/SQL/NoSQL et en extrait automatiquement les métadonnées : colonnes, types, cardinalités, valeurs nulles.",
    outputs: ['Schéma brut (colonnes + types)', 'Profil statistique', 'Distribution des valeurs'],
    techStack: 'Pandas / SQLAlchemy / PyMongo',
    logs: '> Détection du format : CSV (UTF-8)\n> 39 colonnes détectées\n> Clé primaire probable: id_transaction\n> Aucune valeur NULL critique\n> Prêt.',
  },
  n2: {
    title: 'Agent Explorateur IA',
    description: "Utilise Gemini 1.5 Flash pour analyser les données, identifier les entités métier (produit, client, lieu, temps) et classifier les colonnes en dimensions et mesures.",
    outputs: ['Liste des entités virtuelles', 'Mappages dimension/mesure', 'Propositons de tables'],
    techStack: 'Google Gemini 1.5 Flash + LangGraph',
    logs: '> Entité identifiée: Date (annee, mois, jour_semaine)\n> Entité identifiée: Produit (marque, categorie)\n> Entité identifiée: Client (segment, region)\n> 5 tables de dimension proposées\n> Prêt.',
  },
  n3: {
    title: 'Agent Modélisateur (MCD)',
    description: "Génère automatiquement un schéma en étoile (Star Schema) ou en flocon (Snowflake) en SQL DDL, avec des clés de substitution (SK), des relations FK bien définies.",
    outputs: ['Fichier DDL (CREATE TABLE)', 'Schéma en étoile MCD', 'Index et contraintes FK'],
    techStack: 'Google Gemini + Jinja2 Templates',
    logs: '> Table fact_ventes générée (13 colonnes)\n> dim_produit générée (8 colonnes)\n> dim_client générée (9 colonnes)\n> dim_temps générée (7 colonnes)\n> Clés étrangères définies\n> DDL SQL écrit.',
  },
  n4: {
    title: 'Agent Critique IA',
    description: "Audit la qualité du schéma DDL : détecte les FKs manquantes, les types incohérents, les colonnes redondantes et propose des correctifs avant la validation humaine.",
    outputs: ['Rapport qualité JSON', 'Liste des anomalies', 'DDL corrigé'],
    techStack: 'Gemini Flash (reasoning mode)',
    logs: '> ✅ Intégrité référentielle : OK\n> ⚠️ code_postal: recommande VARCHAR au lieu de INT\n> ✅ Clés substituts : présentes\n> ✅ Topologie en étoile : validée\n> Score qualité : 94/100',
  },
  n5: {
    title: 'Validation Humaine',
    description: "Affiche le schéma SQL à l'ingénieur data pour révision. Ce dernier peut demander des modifications via le chatbot IA ou valider pour déclencher le pipeline PySpark.",
    outputs: ['DDL validé', 'Boucle critique évituelle', 'Déclenchement ETL'],
    techStack: 'Interface React + WebSocket',
    logs: '> Attente validation humaine...\n> Modifications reçues: "Changer VARCHAR(50) en VARCHAR(255) pour email"\n> Modèle re-généré\n> Validation finale: ✅ Approuvé',
  },
  n6_1: {
    title: 'Extraction ETL',
    description: "L'Agent ETL lit la source originale (CSV ou DB) via PySpark et crée un DataFrame avec les validations de schéma et le casting automatique des types.",
    outputs: ['DataFrame Spark', 'Rapport types castés', 'Comptage de lignes'],
    techStack: 'PySpark 3.x / SparkSession',
    logs: '> Session Spark initialisée\n> Lecture: ventes.csv → 200 lignes\n> Types castés: DateType, FloatType, IntegerType\n> DataFrame validé.',
  },
  n6_2: {
    title: 'Transformations PySpark',
    description: "Applique le pipeline de transformation complet : nettoyage, enrichissement, déduplication, jointures enrichissantes et dérivation des clés de substitution (SK).",
    outputs: ['DataFrame transformé', 'Colonnes SK ajoutées', 'Rapport déduplication'],
    techStack: 'PySpark Functions + Window Functions',
    logs: '> Nettoyage virgules superflues\n> SK dim_temps: hash(date_vente)\n> SK dim_produit: hash(reference_produit)\n> 0 doublons détectés\n> Transformation: SUCCESS',
  },
  n6_3: {
    title: 'Chargement Dim & Faits',
    description: "Écrit les tables de dimension puis la table de faits dans le Data Warehouse cible (MySQL/Postgres) en utilisant le pattern SCD Type 1 ou Upsert.",
    outputs: ['Tables DIM créées', 'Table FACT insérée', 'Temps de chargement'],
    techStack: 'PySpark write JDBC + MySQL',
    logs: '> INSERT dim_produit: 20 lignes\n> INSERT dim_client: 15 lignes\n> INSERT dim_temps: 730 jours\n> INSERT fact_ventes: 200 lignes\n> Durée totale: 12.4s',
  },
  n6_4: {
    title: 'Serveur Data Warehouse',
    description: "La base de données relationnelle cible (MySQL, PostgreSQL ou Redshift) stocke le schéma en étoile et expose les données à tout outil BI.",
    outputs: ['Base DWH peuplée', 'Endpoint de connexion', 'Prêt pour Tableau / PowerBI'],
    techStack: 'MySQL 8.x / PostgreSQL 15',
    logs: '> Connexion DWH: jdbc:mysql://localhost/data_warehouse\n> fact_ventes: 200 rows OK\n> Indexes fact créés\n> Data Warehouse PRÊT.',
  },
  n7: {
    title: 'Agent Healer (Auto-Réparation)',
    description: "En cas d'exception lors de l'exécution PySpark (JDBC timeout, type mismatch...), capture l'erreur, l'analyse avec Gemini et réécrit automatiquement le code corrigé.",
    outputs: ['Code PySpark corrige', "Rapport d'erreur", 'Statut retry'],
    techStack: 'Gemini Flash + Try/Heal/Retry Loop',
    logs: '> EXCEPTION: JDBC timeout\n> Analyse erreur par IA...\n> Correction: connexion timeout=60s\n> Retry exécution...\n> SUCCESS au 2ème essai',
  },
  n8: {
    title: 'Plateforme BI (Sortie Finale)',
    description: "Le Data Warehouse est prêt pour Tableau, Power BI, Metabase ou Grafana pour des dashboards analytiques en temps réel.",
    outputs: ['Endpoint JDBC/ODBC', 'Données consolidées', 'ROI mesurable'],
    techStack: 'Tableau / Power BI / Metabase',
    logs: '> Connecteur Tableau: jdbc:mysql://...\n> 200 transactions disponibles\n> Temps moyen de requête: < 50ms\n> Pipeline: COMPLET OK',
  },
};

function StepDetailsPanel({ node, onClose }) {
  if (!node) return null;
  const details = pipelineStepDetails[node.id];
  if (!details) return null;

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute left-6 top-24 bottom-6 w-[380px] flex flex-col bg-[#18181b]/98 backdrop-blur-2xl border border-[#333338] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.7)] z-30 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#27272a] flex items-start justify-between bg-[#141416] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Settings size={18} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">{details.title}</h3>
            <span className="text-[10px] font-mono text-zinc-500">ÉTAPE PIPELINE · {node.id}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-white shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">

        {/* Description */}
        <div>
          <h4 className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
            <Info size={10} /> Description
          </h4>
          <p className="text-sm text-zinc-300 leading-relaxed bg-[#0d0d14] px-4 py-3 rounded-xl border border-[#27272a]">
            {details.description}
          </p>
        </div>

        {/* Outputs */}
        <div>
          <h4 className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
            <GitBranch size={10} /> Sorties (Outputs)
          </h4>
          <div className="space-y-1.5">
            {details.outputs.map((o, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-zinc-300 bg-[#0d0d14] px-3 py-2 rounded-lg border border-[#27272a]">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                {o}
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div>
          <h4 className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
            <Hash size={10} /> Stack Technique
          </h4>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-lg inline-block">
            {details.techStack}
          </span>
        </div>

        {/* Logs Terminal */}
        <div>
          <h4 className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
            <Activity size={10} /> Logs / Output
          </h4>
          <pre className="text-[10px] font-mono text-emerald-400 bg-[#050508] px-4 py-3 rounded-xl border border-[#1a1a2a] leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {details.logs}
          </pre>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  MAIN FLOW COMPONENT
// ─────────────────────────────────────────────
function FlowArea({ sqlCode, etlCode }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [viewMode, setViewMode] = useState('pipeline');
  const [selectedNode, setSelectedNode] = useState(null);
  const { fitView } = useReactFlow();

  const onNodeClick = useCallback((_, node) => {
    if (viewMode === 'pipeline') setSelectedNode(prev => prev?.id === node.id ? null : node);
  }, [viewMode]);

  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  useEffect(() => {
    setSelectedNode(null);

    // ════════════════════════════════
    //  1. PIPELINE HORIZONTAL en S
    // ════════════════════════════════
    if (viewMode === 'pipeline') {
      const as = sqlCode ? (etlCode ? 'etl' : 'human') : 'source';

      const rowY1 = 80;
      const rowY2 = 400;
      const col = [80, 380, 680, 980, 1280];

      const pNodes = [
        // ── ROW 1: Source → Agents → Humain ──
        { id: 'n1',   draggable: false, selectable: true, type: 'pipeline', position: { x: col[0], y: rowY1 },
          data: { label: 'Source Connectée',     desc: 'Extraction Métadonnées',       icon: Database,       colorClass: 'bg-emerald-500/20 text-emerald-400', active: true,                             status: 'done',                 handles: ['right'] } },
        { id: 'n2',   draggable: false, selectable: true, type: 'pipeline', position: { x: col[1], y: rowY1 },
          data: { label: 'Agent Explorateur',    desc: 'Analyse des entités',           icon: Search,         colorClass: 'bg-blue-500/20 text-blue-400',       active: true,                             status: as !== 'source' ? 'done' : 'processing', handles: ['left', 'right'] } },
        { id: 'n3',   draggable: false, selectable: true, type: 'pipeline', position: { x: col[2], y: rowY1 },
          data: { label: 'Modélisateur MCD',     desc: 'Génération Schéma Étoile',      icon: Sparkles,       colorClass: 'bg-indigo-500/20 text-indigo-400',   active: as !== 'source',                  status: as !== 'source' ? 'done' : null,         handles: ['left', 'right'] } },
        { id: 'n4',   draggable: false, selectable: true, type: 'pipeline', position: { x: col[3], y: rowY1 },
          data: { label: 'Agent Critique',       desc: 'Audit Qualité DDL',             icon: Shield,         colorClass: 'bg-rose-500/20 text-rose-400',       active: as !== 'source',                  status: as !== 'source' ? 'done' : null,         handles: ['left', 'right'] } },
        { id: 'n5',   draggable: false, selectable: true, type: 'pipeline', position: { x: col[4], y: rowY1 },
          data: { label: 'Validation Humaine',   desc: 'Ajustements & Approbation',     icon: MessageSquare,  colorClass: 'bg-purple-500/20 text-purple-400',   active: as === 'human' || as === 'etl',    status: as === 'etl' ? 'done' : (as === 'human' ? 'processing' : null), handles: ['left', 'bottom'] } },

        // ── ROW 2: ETL Droite → Gauche ──
        { id: 'n6_1', draggable: false, selectable: true, type: 'pipeline', position: { x: col[4], y: rowY2 },
          data: { label: 'Extraction ETL',       desc: 'Lecture Source (PySpark)',       icon: Database,       colorClass: 'bg-cyan-500/20 text-cyan-400',       active: as === 'etl',                     status: as === 'etl' ? 'done' : null,            handles: ['top', 'left'] } },
        { id: 'n6_2', draggable: false, selectable: true, type: 'pipeline', position: { x: col[3], y: rowY2 },
          data: { label: 'Transformations',      desc: 'Nettoyage & Cast PySpark',       icon: Sparkles,       colorClass: 'bg-cyan-500/20 text-cyan-400',       active: as === 'etl',                     status: as === 'etl' ? 'processing' : null,      handles: ['right', 'left', 'bottom'] } },
        { id: 'n6_3', draggable: false, selectable: true, type: 'pipeline', position: { x: col[2], y: rowY2 },
          data: { label: 'Chargement DWH',       desc: 'Dim & Faits → MySQL',            icon: Network,        colorClass: 'bg-cyan-500/20 text-cyan-400',       active: as === 'etl',                     status: as === 'etl' ? 'processing' : null,      handles: ['right', 'left'] } },
        { id: 'n6_4', draggable: false, selectable: true, type: 'pipeline', position: { x: col[1], y: rowY2 },
          data: { label: 'Serveur DWH',          desc: 'MySQL / Postgres Database',      icon: Database,       colorClass: 'bg-zinc-700 text-zinc-300',           active: as === 'etl',                     status: as === 'etl' ? 'processing' : null,      handles: ['right', 'left'] } },
        { id: 'n8',   draggable: false, selectable: true, type: 'pipeline', position: { x: col[0], y: rowY2 },
          data: { label: 'Plateforme BI',        desc: 'Tableau / Power BI / Metabase',  icon: Server,         colorClass: 'bg-[#18181b] text-white',             active: !!etlCode,                        status: null,                                    handles: ['right'] } },

        // ── Agent Healer (sous Transformation) ──
        { id: 'n7', draggable: false, selectable: true, type: 'pipeline', position: { x: col[3], y: rowY2 + 280 },
          data: { label: 'Agent Healer',         desc: 'Auto-Réparation Try/Retry',      icon: Wrench,         colorClass: 'bg-yellow-500/20 text-yellow-400',   active: as === 'etl',                     status: null,                                    handles: ['top'] } },
      ];

      const eS  = { stroke: '#3f3f47', strokeWidth: 2.5 };
      const eA  = { stroke: '#6366f1', strokeWidth: 3 };
      const eET = { stroke: '#22d3ee', strokeWidth: 3 };
      const eW  = { stroke: '#eab308', strokeWidth: 2, strokeDasharray: '5 5' };

      const pEdges = [
        { id: 'e1-2',  source:'n1',   target:'n2',   sourceHandle:'right',  targetHandle:'left',  animated: as==='source', style:as==='source'?eA:eS },
        { id: 'e2-3',  source:'n2',   target:'n3',   sourceHandle:'right',  targetHandle:'left',  animated: as==='source', style:as==='source'?eA:eS },
        { id: 'e3-4',  source:'n3',   target:'n4',   sourceHandle:'right',  targetHandle:'left',  animated: as!=='source', style:as!=='source'?eA:eS },
        { id: 'e4-5',  source:'n4',   target:'n5',   sourceHandle:'right',  targetHandle:'left',  animated: as!=='source', style:as!=='source'?eA:eS },
        { id: 'e5-61', source:'n5',   target:'n6_1', sourceHandle:'bottom', targetHandle:'top',   animated: as==='etl',    style:as==='etl'?eET:eS, type:'smoothstep', label:'Validé ✓', labelStyle:{fill:'#22d3ee',fontWeight:700,fontSize:10} },
        { id: 'e61-62',source:'n6_1', target:'n6_2', sourceHandle:'left',   targetHandle:'right', animated: as==='etl',    style:as==='etl'?eET:eS },
        { id: 'e62-63',source:'n6_2', target:'n6_3', sourceHandle:'left',   targetHandle:'right', animated: as==='etl',    style:as==='etl'?eET:eS },
        { id: 'e63-64',source:'n6_3', target:'n6_4', sourceHandle:'left',   targetHandle:'right', animated: as==='etl',    style:as==='etl'?eET:eS },
        { id: 'e64-8', source:'n6_4', target:'n8',   sourceHandle:'left',   targetHandle:'right', animated: !!etlCode,     style:!!etlCode?eET:eS },
        { id: 'e62-7', source:'n6_2', target:'n7',   sourceHandle:'bottom', targetHandle:'top',   animated: false,         style:eW, type:'smoothstep', label:'Si Exception', labelStyle:{fill:'#eab308',fontWeight:700,fontSize:10} },
      ];

      setNodes(pNodes);
      setEdges(pEdges.map(e => ({
        ...e,
        markerEnd: { type: MarkerType.ArrowClosed, color: e.style?.stroke || '#3f3f47', width: 18, height: 18 }
      })));
    }

    // ════════════════════════════════
    //  2. MODÈLE CONCEPTUEL (MCD)
    // ════════════════════════════════
    else if (viewMode === 'mcd') {
      if (!sqlCode) {
        setNodes([{
          id: 'empty', draggable: false,
          position: { x: 300, y: 300 },
          data: { label: 'Aucun modèle généré — Connectez une source d\'abord.' },
          style: { padding: 30, background: '#18181b', color: '#6b7280', border: '2px dashed #3f3f47', borderRadius: 12, fontSize: 14 }
        }]);
        setEdges([]);
      } else {
        buildMcd(sqlCode, setNodes, setEdges);
      }
    }

    setTimeout(() => fitView({ padding: 0.18, duration: 700 }), 120);
  }, [viewMode, sqlCode, etlCode, setNodes, setEdges, fitView]);

  return (
    <div className="w-full h-full relative">
      {/* TABS */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 bg-[#18181b]/98 backdrop-blur-xl p-1.5 rounded-2xl border border-[#27272a] shadow-2xl">
        {[
          { id: 'pipeline', label: 'Architecture Globale', color: 'indigo' },
          { id: 'mcd',      label: 'Modèle Conceptuel (MCD)', color: 'amber' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setViewMode(tab.id)}
            className={`px-6 py-2.5 rounded-xl text-sm font-black tracking-wide transition-all duration-200
              ${viewMode === tab.id
                ? tab.color === 'indigo'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 shadow-lg'
                  : 'bg-amber-600/20 text-amber-400 border border-amber-500/50 shadow-lg'
                : 'text-zinc-500 hover:text-white border border-transparent'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Step Details Panel */}
      <AnimatePresence>
        {selectedNode && viewMode === 'pipeline' && (
          <StepDetailsPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        )}
      </AnimatePresence>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={viewMode === 'mcd'}
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.05}
        maxZoom={3}
        className="bg-[#09090b]"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1c1c25" gap={30} size={1.5} />
        <Controls className="!bg-[#18181b] !border-[#27272a] !rounded-xl overflow-hidden" />
      </ReactFlow>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
//  MCD BUILDER  — Parse SQL DDL → Star Schema visual layout
// ────────────────────────────────────────────────────────────────
function buildMcd(sqlCode, setNodes, setEdges) {
  const tableReg = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+`?(\w+)`?\s*\(([\s\S]*?)\);/gi;
  const fkReg    = /FOREIGN KEY\s*\(`?(\w+)`?\)\s*REFERENCES\s*`?(\w+)`?/gi;

  const tables = [];
  let m;
  while ((m = tableReg.exec(sqlCode)) !== null) {
    const name  = m[1];
    const body  = m[2];

    const cols  = body.split(/,\s*\n/)
      .map(l => l.trim())
      .filter(l => l && !l.toUpperCase().startsWith('PRIMARY KEY') && !l.toUpperCase().startsWith('FOREIGN KEY') && !l.startsWith('--'))
      .map(l => {
        const parts = l.replace(/`/g, '').split(/\s+/);
        return { name: parts[0], type: parts[1] || '?' };
      })
      .filter(c => c.name && c.name !== ')');

    const fks = [];
    let fk;
    const bodyFkReg = /FOREIGN KEY\s*\(`?(\w+)`?\)\s*REFERENCES\s*`?(\w+)`?/gi;
    while ((fk = bodyFkReg.exec(body)) !== null) {
      fks.push({ col: fk[1], refTable: fk[2] });
    }

    const isFact = name.toLowerCase().includes('fact');
    tables.push({ name, cols, isFact, fks });
  }

  const factTbl = tables.find(t => t.isFact);
  const dimTbls = tables.filter(t => !t.isFact);

  const CX = 700, CY = 420;
  const R = 420; // Cercle parfait pour un espacement égal

  const mcdNodes = [];

  // Fact at center
  if (factTbl) {
    mcdNodes.push({
      id: `tbl-${factTbl.name}`, type: 'mcd', draggable: true,
      position: { x: CX - 95, y: CY - 120 },
      data: { label: factTbl.name, columns: factTbl.cols, isFact: true }
    });
  }

  // Dims in a star circularly distributed
  dimTbls.forEach((dim, i) => {
    const angle = (i / dimTbls.length) * 2 * Math.PI - Math.PI / 6;
    mcdNodes.push({
      id: `tbl-${dim.name}`, type: 'mcd', draggable: true,
      position: { x: CX + R * Math.cos(angle) - 95, y: CY + R * Math.sin(angle) - 60 },
      data: { label: dim.name, columns: dim.cols, isFact: false }
    });
  });

  // Edges from FK relationships (mauve dotted lines)
  const mcdEdges = [];
  tables.forEach(t => {
    t.fks.forEach((fk, fi) => {
      // Decide best source / target handles based on relative position
      const srcNode = mcdNodes.find(n => n.id === `tbl-${t.name}`);
      const tgtNode = mcdNodes.find(n => n.id === `tbl-${fk.refTable}`);
      if (!srcNode || !tgtNode) return;

      const dx = tgtNode.position.x - srcNode.position.x;
      const dy = tgtNode.position.y - srcNode.position.y;
      const srcH = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
      const tgtH = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'left' : 'right') : (dy > 0 ? 'top' : 'bottom');

      mcdEdges.push({
        id: `fk-${t.name}-${fk.refTable}-${fi}`,
        source: `tbl-${t.name}`,
        target: `tbl-${fk.refTable}`,
        sourceHandle: srcH,
        targetHandle: tgtH,
        type: 'default',
        animated: true,
        label: fk.col,
        labelStyle: { fill: '#a78bfa', fontWeight: 700, fontSize: 10 },
        labelBgStyle: { fill: '#18181b', fillOpacity: 0.9 },
        style: { stroke: '#a78bfa', strokeWidth: 2.5, strokeDasharray: '5 5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa', width: 16, height: 16 }
      });
    });
  });

  setNodes(mcdNodes);
  setEdges(mcdEdges);
}

// ─────────────────────────────────────────────
//  PROVIDER WRAPPER
// ─────────────────────────────────────────────
export default function PipelineCanvasWithProvider(props) {
  return (
    <ReactFlowProvider>
      <FlowArea {...props} />
    </ReactFlowProvider>
  );
}
