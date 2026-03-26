import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  Monitor, Database, FileJson, Search, BrainCircuit, RefreshCw, 
  FileText, Server, Activity, ShieldAlert, Wrench, ChevronRight,
  MessageSquare, User, PlayCircle, Code, ArrowRight, CheckCircle2,
  Workflow, Cpu, Network, Bot
} from 'lucide-react';

const stepsData = [
  {
    id: 1,
    title: "Connexion Multi-Sources",
    subtitle: "ÉTAPE A : L'Acquisition",
    icon: <Monitor size={28} className="text-blue-400" />,
    color: "from-blue-600 to-cyan-500",
    shadow: "shadow-blue-500/20",
    border: "border-blue-500/30",
    bg: "bg-blue-950/20",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-300 leading-relaxed text-sm">
          Le processus débute par une interaction fluide où l'utilisateur sélectionne ses sources de données via une pop-up modale. La magie opère en coulisses avec une architecture adaptative capable d'ingérer n'importe quel format (Bases relationnelles MySQL/PostgreSQL, fichiers plats CSV/Excel, ou encore des flux d'API REST).
        </p>
        <div className="p-4 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
           <div className="flex flex-col items-center gap-2"><Database size={24} className="text-blue-500"/><span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">MySQL</span></div>
           <div className="w-12 h-px bg-zinc-800 relative"><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"></span></div>
           <div className="flex flex-col items-center gap-2"><FileText size={24} className="text-emerald-500"/><span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Fichiers</span></div>
           <div className="w-12 h-px bg-zinc-800 relative"><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"></span></div>
           <div className="flex flex-col items-center gap-2"><FileJson size={24} className="text-amber-500"/><span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">API</span></div>
        </div>
        <div className="text-xs text-blue-300/80 bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
          <strong>Innovation :</strong> Standardisation transparente par le "Common Connectivity Layer" avant même que l'IA ne touche la donnée sèche.
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: "Analyse Agentique & Modélisation Virtuelle",
    subtitle: "ÉTAPE B : Cognition IA",
    icon: <BrainCircuit size={28} className="text-purple-400" />,
    color: "from-purple-600 to-fuchsia-500",
    shadow: "shadow-purple-500/20",
    border: "border-purple-500/30",
    bg: "bg-purple-950/20",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-300 leading-relaxed text-sm">
          Une fois la source connectée, notre système déclenche deux agents jumeaux spécialisés. L'<strong>Agent Explorateur</strong> scanne le terrain (lecture seule des métadonnées, headers, schémas). Immédiatement après, l'<strong>Agent Modélisateur</strong> analyse la sémantique pour déduire logiquement l'architecture (Tables de Faits vs Tables de Dimensions).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center justify-center p-4 bg-[#09090b] rounded-xl border border-zinc-800 relative overflow-hidden group">
             <div className="absolute inset-0 bg-cyan-500/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500"></div>
             <Search size={24} className="text-cyan-400 mb-2" />
             <span className="text-[11px] font-black text-cyan-200 uppercase tracking-widest">1. Scan Métadonnées</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 bg-[#09090b] rounded-xl border border-zinc-800 relative overflow-hidden group">
             <div className="absolute inset-0 bg-purple-500/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 delay-100"></div>
             <Network size={24} className="text-purple-400 mb-2" />
             <span className="text-[11px] font-black text-purple-200 uppercase tracking-widest">2. Schéma en Étoile</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-400 p-3 bg-black/50 rounded-lg">
           <Code size={16} className="text-purple-400 shrink-0" />
           <p className="text-xs">Génération en mémoire de blocs SQL (DDL) temporaires et du graphe de dépendances.</p>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: "Conception Itérative (Human-in-the-Loop)",
    subtitle: "ÉTAPE C : Collaboration Homme/Machine",
    icon: <MessageSquare size={28} className="text-amber-400" />,
    color: "from-amber-600 to-orange-500",
    shadow: "shadow-amber-500/20",
    border: "border-amber-500/30",
    bg: "bg-amber-950/20",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-300 leading-relaxed text-sm">
          L'IA ne prend pas le contrôle absolu. Elle soumet son brouillon architectural à l'utilisateur via une interface de discussion conversationnelle (Chat). L'humain reste au centre de la validation : c'est un travail itératif à quatre mains.
        </p>
        <div className="space-y-3 p-4 bg-[#121215] rounded-xl border border-white/5">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex flex-col items-center justify-center shrink-0"><Bot size={16} className="text-amber-400"/></div>
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl rounded-tl-none p-3 text-xs text-zinc-300 shadow-lg">
               Voici le modèle SQL proposé pour isoler le temps de facturation. Qu'en pensez-vous ?
            </div>
          </div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex gap-3 flex-row-reverse"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex flex-col items-center justify-center shrink-0"><User size={16} className="text-emerald-400"/></div>
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl rounded-tr-none p-3 text-xs text-emerald-100 shadow-lg text-right">
               Parfait, mais ajoute une dimension géolocalisation pour les boutiques.
            </div>
          </motion.div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-4 text-amber-300 font-bold text-xs uppercase tracking-widest bg-amber-500/10 p-2 rounded-lg py-3">
          <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '3s' }} /> Boucle de Validation Continue
        </div>
      </div>
    )
  },
  {
    id: 4,
    title: "Déploiement du Data Warehouse",
    subtitle: "ÉTAPE D : L'Instanciation",
    icon: <Server size={28} className="text-indigo-400" />,
    color: "from-indigo-600 to-blue-500",
    shadow: "shadow-indigo-500/20",
    border: "border-indigo-500/30",
    bg: "bg-indigo-950/20",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-300 leading-relaxed text-sm">
          Après une révision (ou validation) réussie, le pipeline cristallise le modèle logique en un script DDL brut (Create Table, Foreign Keys, Indexs). Ce code est propagé vers le moteur de base de données pour construire physiquement l'entrepôt.
        </p>
        <div className="relative p-6 bg-gradient-to-br from-[#0c0f1a] to-black rounded-xl border border-indigo-500/30 overflow-hidden group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-indigo-500/0 opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-1000 blur-md"></div>
          <div className="relative z-10 flex items-center justify-evenly">
            <div className="flex flex-col items-center"><FileText size={40} className="text-blue-200 mb-2"/><span className="text-[10px] uppercase font-bold text-zinc-500">DDL Final formaté</span></div>
            <div className="h-0 w-16 border-t border-dashed border-indigo-500/50 relative text-indigo-400 flex justify-center"><ArrowRight className="absolute -top-3" size={24} /></div>
            <div className="flex flex-col items-center"><Server size={40} className="text-indigo-400 mb-2"/><span className="text-[10px] uppercase font-bold text-indigo-300">Exécution Physique</span></div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 5,
    title: "Automatisation ETL (PySpark)",
    subtitle: "ÉTAPE E : Gavage de la data",
    icon: <PlayCircle size={28} className="text-emerald-400" />,
    color: "from-emerald-600 to-teal-500",
    shadow: "shadow-emerald-500/20",
    border: "border-emerald-500/30",
    bg: "bg-emerald-950/20",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-300 leading-relaxed text-sm">
          L'entrepôt est vide. Il faut y injecter les données. L'IA génère en autonomie un complexe **script ETL PySpark / SQL**. Il va orchestrer l'Extraction depuis les systèmes hétérogènes initiaux, la Transformation (Type Casting, Trimming, Surrogation par Hashing) et le Chargement distribué massif en base.
        </p>
        <div className="bg-[#09090b] rounded-xl border border-emerald-500/20 p-4 font-mono text-[10px] text-zinc-400 shadow-inner relative overflow-hidden">
          <motion.div 
            initial={{ top: "-100%" }}
            animate={{ top: "200%" }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 w-full h-[50px] bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent pointer-events-none"
          ></motion.div>
          <div className="text-emerald-400 mb-2"># Multi-Exécution Agents générant PySpark</div>
          <div><span className="text-pink-500">df_ventes</span> = spark.read.csv("source.csv")</div>
          <div className="mt-1"><span className="text-blue-400">df_transformed</span> = df_ventes.withColumn(</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-amber-300">"sk_date"</span>, F.xxhash64("date_sale")</div>
          <div>)</div>
          <div className="mt-1">df_transformed.write.mode(<span className="text-amber-300">"append"</span>).format(<span className="text-amber-300">"jdbc"</span>)...</div>
        </div>
      </div>
    )
  },
  {
    id: 6,
    title: "Maintenance & Self-Healing",
    subtitle: "ÉTAPE F : L'IA Auto-Correctrice",
    icon: <ShieldAlert size={28} className="text-rose-400" />,
    color: "from-rose-600 to-red-500",
    shadow: "shadow-rose-500/20",
    border: "border-rose-500/30",
    bg: "bg-rose-950/20",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-300 leading-relaxed text-sm">
          Dans le pipeline ETL traditionnel, lorsqu'une erreur SQL se produit (dérive de type, table inexistante, contrainte violée), le processus crash indéfiniment. Notre architecture LangGraph implémente **l'Agent Correcteur (Healer)**.
        </p>
        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-3 bg-zinc-900/50 p-3 rounded-lg border border-rose-500/20">
              <ShieldAlert size={20} className="text-rose-500 shrink-0" />
              <p className="text-[11px] text-zinc-300"><span className="text-rose-400 font-bold">Crash Log Monitoré :</span> L'Exception d'exécution remonte directement au serveur central.</p>
           </div>
           <div className="flex justify-center"><ArrowRight size={16} className="text-zinc-600 rotate-90" /></div>
           <div className="flex items-center gap-3 bg-zinc-900/50 p-3 rounded-lg border border-amber-500/20">
              <Wrench size={20} className="text-amber-500 shrink-0" />
              <p className="text-[11px] text-zinc-300"><span className="text-amber-400 font-bold">Agent Correcteur :</span> Analyse la pile d'erreur, réécrit le segment de code défectueux.</p>
           </div>
           <div className="flex justify-center"><ArrowRight size={16} className="text-zinc-600 rotate-90" /></div>
           <div className="flex items-center gap-3 bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/30">
              <RefreshCw size={20} className="text-indigo-400 shrink-0" />
              <p className="text-[11px] font-black text-indigo-300 uppercase tracking-wide">Boucle TRY-HEAL-RETRY (Relance automatique)</p>
           </div>
        </div>
      </div>
    )
  }
];


const TimelineStep = ({ step, index }) => {
  const isEven = index % 2 !== 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={`flex flex-col md:flex-row w-full mb-16 relative ${isEven ? 'md:flex-row-reverse' : ''}`}
    >
      {/* Center Line Dot */}
      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-4 w-12 h-12 rounded-full border-[4px] border-[#09090b] z-20 items-center justify-center bg-zinc-900 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center ${step.shadow} shadow-lg`}>
          <span className="text-white font-black text-xs">{step.id}</span>
        </div>
      </div>

      {/* Content Box */}
      <div className={`w-full md:w-[45%] ${isEven ? 'md:pl-10' : 'md:pr-10'} relative z-10`}>
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className={`h-full ${step.bg} border ${step.border} backdrop-blur-md rounded-2xl p-6 lg:p-8 shadow-2xl relative overflow-hidden`}
        >
          {/* Background Glow */}
          <div className={`absolute top-0 ${isEven ? 'left-0' : 'right-0'} w-40 h-40 bg-gradient-to-br ${step.color} opacity-10 blur-3xl rounded-full`}></div>
          
          <div className="flex items-center gap-4 mb-2 relative z-10">
             <div className={`w-14 h-14 rounded-2xl bg-[#09090b]/80 border ${step.border} flex items-center justify-center shadow-inner`}>
                {step.icon}
             </div>
             <div>
                <h4 className="text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">{step.subtitle}</h4>
                <h3 className="text-xl md:text-2xl font-bold text-white mt-1 leading-tight">{step.title}</h3>
             </div>
          </div>
          
          <div className="mt-6 relative z-10">
            {step.content}
          </div>
        </motion.div>
      </div>

      {/* Spacer for the other side */}
      <div className="hidden md:block w-full md:w-[45%]"></div>
      
    </motion.div>
  );
};

export default function ProcessDiagram() {
  const { scrollYProgress } = useScroll();
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div className="w-full min-h-screen bg-[#040508] relative overflow-hidden flex justify-center py-20 px-6 lg:px-12 selection:bg-indigo-500/30">
      
      {/* Giant Ambient Background Blobs */}
      <div className="absolute top-[10%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[60%] right-[10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[80%] left-[30%] w-[60vw] h-[60vw] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl w-full relative z-10">
        
        {/* Header Title Section */}
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-24 lg:mb-32"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-6">
            <Workflow size={14} /> Intelligence Artificielle Étape par Étape
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-zinc-400 tracking-tighter mb-6 relative">
             Processus de Conception <br className="hidden md:block"/>
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">Data Warehouse</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            Découvrez en détail le fonctionnement interne de nos 5 Agents Locaux capables d'architecturer, dialoguer, compiler et exécuter des pipelines analytiques robustes.
          </p>
        </motion.div>

        {/* Timeline Container */}
        <div className="relative">
          {/* Vertical Base Line (Hidden on Mobile) */}
          <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-4 bottom-0 w-[2px] bg-zinc-800 rounded-full" />
          
          {/* Animated Glow Line on Scroll */}
          <motion.div 
            className="hidden md:block absolute left-1/2 -translate-x-1/2 top-4 bottom-0 w-[2px] bg-gradient-to-b from-indigo-500 via-purple-500 to-emerald-500 origin-top rounded-full shadow-[0_0_15px_rgba(99,102,241,0.8)]"
            style={{ scaleY }}
          />

          {/* Render all Steps */}
          {stepsData.map((step, index) => (
            <TimelineStep key={step.id} step={step} index={index} />
          ))}

        </div>

        {/* Massive Footer Matrix */}
        <motion.div 
           initial={{ opacity: 0 }}
           whileInView={{ opacity: 1 }}
           viewport={{ once: true }}
           transition={{ duration: 1, delay: 0.5 }}
           className="mt-32 w-full p-8 rounded-3xl bg-black border border-zinc-800 shadow-[inset_0_4px_30px_rgba(0,0,0,0.5)] flex flex-col items-center"
        >
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.3em] mb-8">Le Socle Technologique</h4>
          <div className="flex flex-wrap justify-center gap-4 lg:gap-12 w-full">
            <div className="flex flex-col items-center gap-2"><div className="w-12 h-12 rounded-full border border-indigo-500/30 flex items-center justify-center bg-indigo-500/10 text-indigo-400"><Cpu size={24}/></div><span className="text-[10px] uppercase font-bold text-zinc-400 mt-2">LLM Engine</span><span className="text-xs font-mono text-zinc-500">Gemini / Zhipu</span></div>
            <div className="flex flex-col items-center gap-2"><div className="w-12 h-12 rounded-full border border-purple-500/30 flex items-center justify-center bg-purple-500/10 text-purple-400"><Network size={24}/></div><span className="text-[10px] uppercase font-bold text-zinc-400 mt-2">State Machine</span><span className="text-xs font-mono text-zinc-500">LangGraph (Graph)</span></div>
            <div className="flex flex-col items-center gap-2"><div className="w-12 h-12 rounded-full border border-emerald-500/30 flex items-center justify-center bg-emerald-500/10 text-emerald-400"><Activity size={24}/></div><span className="text-[10px] uppercase font-bold text-zinc-400 mt-2">Structure Back</span><span className="text-xs font-mono text-zinc-500">FastAPI</span></div>
            <div className="flex flex-col items-center gap-2"><div className="w-12 h-12 rounded-full border border-amber-500/30 flex items-center justify-center bg-amber-500/10 text-amber-400"><Database size={24}/></div><span className="text-[10px] uppercase font-bold text-zinc-400 mt-2">Data Process</span><span className="text-xs font-mono text-zinc-500">PySpark / SQLAlchemy</span></div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
