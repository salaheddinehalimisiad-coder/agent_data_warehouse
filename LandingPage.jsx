import React, { useState, useEffect } from 'react';
import { 
  Network, Search, Shield, Zap, Database, ArrowRight, Terminal, 
  Cloud, HardDrive, Activity, Globe, Cpu, BrainCircuit, Blocks,
  BarChart4, ArrowUpRight, CheckCircle2, Workflow, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// API backend configurable (Vite)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
};

export default function LandingPage({ onResumeSession, onNewSession, onNavigate, user, onAuthOpen }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('explorer');

  useEffect(() => {
    const url = user ? `${API_URL}/api/sessions?user_id=${user.id}` : `${API_URL}/api/sessions`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setSessions(data.sessions || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erreur chargement historiques", err);
        setLoading(false);
      });
  }, [user]);

  const filtered = sessions.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search));

  const agents = {
    explorer: { icon: Search, title: "Agent Explorateur", desc: "Scanne instantanément vos sources de données, identifie les schémas existants et extrait les métadonnées de dizaines de bases SQL, NoSQL ou CSV sans effort humain.", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    modeler: { icon: Network, title: "Agent Modélisateur", desc: "Construit une architecture dimensionnelle parfaite (Flocon/Étoile). Conçoit les tables de faits et les dimensions avec une précision d'architecte data senior.", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    critic: { icon: BrainCircuit, title: "Agent Critique", desc: "Il doute de tout. Cet agent audite le schéma généré, corrige les relations manquantes, optimise les clés primaires et garantit l'intégrité référentielle absolue.", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    healer: { icon: Zap, title: "Agent Correcteur", desc: "Tolérance aux pannes native. Si le script ETL plante en base de données de production, le Healer analyse les logs SQL et réécrit son code automatiquement.", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" }
  };

  return (
    <div className="relative w-full h-full bg-[#000000] text-[#fafafa] flex flex-col items-center overflow-x-hidden overflow-y-auto selection:bg-indigo-500/30 font-sans">
      
      {/* Background Ambience Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 w-[200%] md:w-full -translate-x-1/2 h-full bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:80px_80px] opacity-40 [mask-image:radial-gradient(ellipse_80%_100%_at_50%_0%,#000_20%,transparent_100%)]"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[200px]"></div>
        <div className="absolute top-[40%] right-[-20%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[180px]"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[150px]"></div>
      </div>

      {/* 1. Header Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 w-full border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => onNavigate('dashboard')}>
            <img src="/logo.png" alt="AUTOETL AI" className="h-16 md:h-20 lg:h-24 w-auto object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-105 transition-transform duration-300" />
          </div>
          <div className="hidden lg:flex items-center gap-10 text-sm font-semibold text-zinc-400">
            <a href="#" className="hover:text-white transition-colors" onClick={e => e.preventDefault()}>Plateforme IA</a>
            <a href="#" className="hover:text-white transition-colors" onClick={e => { e.preventDefault(); onNavigate('documentation'); }}>Documentation Officielle</a>
            <a href="#" className="hover:text-white transition-colors" onClick={e => { e.preventDefault(); onNavigate('usecases'); }}>Cas d'utilisation</a>
          </div>
          <div className="flex items-center gap-6">
            {user ? (
              <button onClick={() => onNavigate('profile')} className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors hidden sm:block">Mon Profil</button>
            ) : (
              <button onClick={onAuthOpen} className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors hidden sm:block">Se connecter</button>
            )}
            <button 
              onClick={user ? onNewSession : onAuthOpen} 
              className="text-sm font-bold bg-white text-black px-6 py-2.5 rounded-full hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              Sélectionner source
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-48 pb-32 flex flex-col items-center">
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="w-full flex flex-col items-center text-center">
          
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-semibold mb-8 backdrop-blur-md">
            <BrainCircuit size={16} className="text-indigo-400" />
            <span>Propulsé par Google Gemini 1.5 Flash</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          </motion.div>

          <motion.h1 variants={fadeInUp} className="text-6xl sm:text-7xl md:text-8xl lg:text-[100px] font-black tracking-tighter leading-[0.95] mb-8 max-w-5xl">
            Where your data <br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-500/50">
              becomes clear ROI.
            </span>
          </motion.h1>

          <motion.p variants={fadeInUp} className="text-xl md:text-2xl text-zinc-400 max-w-3xl mb-14 font-medium leading-relaxed">
            Être vu par vos utilisateurs n'est plus suffisant. Transformez instantanément vos bases brutes en un Data Warehouse optimisé grâce à nos ingénieurs IA autonomes.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-6 w-full justify-center">
            <button 
              onClick={user ? onNewSession : onAuthOpen}
              className="group relative flex items-center justify-center gap-3 w-full sm:w-auto px-10 py-5 bg-white text-black rounded-full font-bold text-lg hover:scale-[1.02] transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_80px_rgba(255,255,255,0.5)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
              <Database size={22} className="group-hover:-translate-y-0.5 transition-transform text-indigo-600" />
              Sélectionner source
              <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="flex items-center justify-center gap-3 w-full sm:w-auto px-10 py-5 bg-[#121214] hover:bg-[#18181b] text-white rounded-full font-bold text-lg border border-white/10 transition-colors">
              <Terminal size={22} className="text-zinc-400" />
              Explore the Platform
            </button>
          </motion.div>
        </motion.div>
      </main>

      {/* 3. Social Proof / Marquee */}
      <section className="relative z-10 w-full border-y border-white/5 bg-white/[0.01] py-10 overflow-hidden">
        <div className="absolute left-0 top-0 w-32 h-full bg-gradient-to-r from-black to-transparent z-10"></div>
        <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-black to-transparent z-10"></div>
        <div className="flex whitespace-nowrap opacity-40">
          <motion.div 
            animate={{ x: [0, -1000] }} 
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="flex items-center gap-24 text-2xl font-black text-zinc-500 uppercase tracking-widest px-12"
          >
            <span>Cloudflare</span>
            <span>Samsung</span>
            <span>ZoomInfo</span>
            <span>Roche</span>
            <span>Hertz</span>
            <span>Stripe</span>
            <span>Google Cloud</span>
            <span>Databricks</span>
            <span>Cloudflare</span>
            <span>Samsung</span>
            <span>ZoomInfo</span>
            <span>Roche</span>
            <span>Hertz</span>
            <span>Stripe</span>
          </motion.div>
        </div>
      </section>

      {/* 4. Feature Section 1: Massive Visualization */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-6 py-40">
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeInUp}
          className="text-center mb-24"
        >
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">Being seen isn't enough.<br/>Will you be chosen?</h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">Optimize your pipeline visibility, reach ready data structures, and outperform traditional ETL workflows.</p>
        </motion.div>

        {/* Huge Advanced SVG/CSS Visualization */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}
          className="w-full relative h-[600px] rounded-3xl border border-white/10 bg-[#07070a] overflow-hidden shadow-2xl shadow-indigo-500/5 group"
        >
          {/* Top header mockup */}
          <div className="h-14 border-b border-white/10 bg-[#0f0f13] flex items-center justify-between px-6">
            <div className="flex gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-white/20"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-white/20"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-white/20"></div>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-zinc-500 tracking-wider">
              <span className="text-indigo-400">PIPELINE MONITORING</span>
              <span>JOURNEY TRACKING</span>
              <span>ROI ANALYSIS</span>
            </div>
          </div>
          
          {/* Inside the screen */}
          <div className="absolute inset-x-0 bottom-0 top-14 p-10 flex flex-col justify-end">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.1),transparent_50%)]"></div>
            
            {/* Massive Glowing Area Chart */}
            <div className="relative w-full h-80 flex items-end justify-between px-10">
              {/* Background grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between border-t border-white/5 pt-10 px-10 pointer-events-none">
                <div className="w-full h-px bg-white/5"></div>
                <div className="w-full h-px bg-white/5"></div>
                <div className="w-full h-px bg-white/5"></div>
                <div className="w-full h-px bg-white/10"></div>
              </div>

              {/* Data lines */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(99,102,241,0.5)" />
                    <stop offset="100%" stopColor="rgba(99,102,241,0.0)" />
                  </linearGradient>
                  <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(52,211,153,0.4)" />
                    <stop offset="100%" stopColor="rgba(52,211,153,0.0)" />
                  </linearGradient>
                </defs>
                <motion.path 
                  initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }} transition={{ duration: 2, ease: "easeOut" }} viewport={{ once: true }}
                  d="M 50,250 C 150,250 200,180 300,180 C 400,180 450,220 550,150 C 650,80 700,120 800,90 C 900,60 950,40 1050,40 L 1050,300 L 50,300 Z" 
                  fill="url(#grad2)" 
                />
                <motion.path 
                  initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 2, ease: "easeOut", delay: 0.5 }} viewport={{ once: true }}
                  d="M 50,250 C 150,250 200,180 300,180 C 400,180 450,220 550,150 C 650,80 700,120 800,90 C 900,60 950,40 1050,40" 
                  fill="none" stroke="#6ee7b7" strokeWidth="3" strokeLinecap="round" 
                />
                <motion.path 
                  initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }} transition={{ duration: 2.5, ease: "easeOut" }} viewport={{ once: true }}
                  d="M 50,280 C 200,280 250,200 400,150 C 500,110 550,180 650,120 C 750,60 850,20 1050,10 L 1050,300 L 50,300 Z" 
                  fill="url(#grad1)" 
                />
                <motion.path 
                  initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 2.5, ease: "easeOut", delay: 0.5 }} viewport={{ once: true }}
                  d="M 50,280 C 200,280 250,200 400,150 C 500,110 550,180 650,120 C 750,60 850,20 1050,10" 
                  fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" 
                />
                <circle cx="1050" cy="10" r="6" fill="#fff" className="animate-pulse" />
              </svg>
              
              {/* Overlay Float Card */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 2.5 }} viewport={{ once: true }}
                className="absolute top-10 right-20 bg-[#121214]/90 backdrop-blur-md border border-indigo-500/30 p-5 rounded-2xl shadow-2xl flex flex-col gap-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <BarChart4 size={20} className="text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-400">AI ROI IMPACT</p>
                    <p className="text-2xl font-black text-white">+ 412 %</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold mt-2 bg-emerald-400/10 px-2 py-1 rounded w-fit">
                  <ArrowUpRight size={14} /> Exceeding benchmarks
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 5. Feature Section 2: Interactive Bento Grid for the 4 Agents */}
      <section className="relative z-10 w-full bg-zinc-950 py-32 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-black mb-6">Seize your data advantage.</h2>
            <p className="text-xl text-zinc-400 max-w-2xl">Outmaneuver competitors with an automated multi-agent architecture. Four specialized AI entities work chronologically to unite all your tools.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Left: Agent Selection */}
            <div className="flex flex-col gap-4">
              {Object.entries(agents).map(([key, agent]) => {
                const Icon = agent.icon;
                const isActive = activeTab === key;
                return (
                  <div 
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`p-6 rounded-2xl cursor-pointer transition-all duration-300 border ${
                      isActive ? `bg-[#121214] border-white/20 shadow-xl shadow-black/50` : `bg-transparent border-transparent hover:bg-white/5`
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${isActive ? agent.bg : 'bg-zinc-900'} ${isActive ? agent.border : 'border-zinc-800'} border`}>
                        <Icon size={24} className={isActive ? agent.color : 'text-zinc-500'} />
                      </div>
                      <div>
                        <h3 className={`text-xl font-bold mb-2 ${isActive ? 'text-white' : 'text-zinc-500'}`}>{agent.title}</h3>
                        <p className={`text-sm leading-relaxed ${isActive ? 'text-zinc-300' : 'text-zinc-600'}`}>{agent.desc}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: Dynamic Visualizer */}
            <div className="w-full h-[500px] bg-[#09090b] rounded-3xl border border-white/10 p-8 relative flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
              <AnimatePresence mode="wait">
                {activeTab === 'explorer' && (
                  <motion.div key="explorer" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.1)_0,transparent_60%)]"></div>
                    <Search size={80} className="text-emerald-500/50 mb-8 blur-[2px]" />
                    <div className="flex gap-4 mb-8">
                       {[Database, Cloud, HardDrive, Globe].map((Ic, i) => (
                          <motion.div key={i} animate={{ y: [0, -10, 0] }} transition={{ duration: 2, delay: i*0.2, repeat: Infinity }} className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Ic size={24} className="text-emerald-400"/>
                          </motion.div>
                       ))}
                    </div>
                    <div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2, repeat: Infinity }} className="h-full bg-emerald-500"></motion.div>
                    </div>
                    <p className="mt-4 font-mono text-emerald-400 text-sm">Scanning 213M+ parameters...</p>
                  </motion.div>
                )}
                {activeTab === 'modeler' && (
                  <motion.div key="modeler" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0,transparent_60%)]"></div>
                    <Network size={80} className="text-blue-500/50 mb-8 absolute" />
                    <div className="grid grid-cols-3 gap-6 relative z-10">
                      <div className="w-24 h-24 bg-blue-500/20 rounded-xl border border-blue-500/40 backdrop-blur-md flex flex-col items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                        <Blocks size={24} className="text-blue-300 mb-2"/>
                        <span className="text-[10px] uppercase font-bold text-blue-200">Fact Table</span>
                      </div>
                      <div className="w-24 h-24 bg-[#121214] rounded-xl border border-zinc-700 flex flex-col items-center justify-center translate-y-12">
                        <span className="text-[10px] uppercase font-bold text-zinc-500">Dim User</span>
                      </div>
                      <div className="w-24 h-24 bg-[#121214] rounded-xl border border-zinc-700 flex flex-col items-center justify-center -translate-y-12">
                        <span className="text-[10px] uppercase font-bold text-zinc-500">Dim Time</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'critic' && (
                  <motion.div key="critic" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1)_0,transparent_60%)]"></div>
                    <div className="w-64 bg-[#18181b] border border-purple-500/30 rounded-lg p-4 shadow-2xl relative z-10">
                      <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                        <Shield className="text-purple-400" size={16}/>
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Critic Report</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm"><CheckCircle2 size={16} className="text-emerald-500"/> Relation 1:N Valid</div>
                        <div className="flex items-center gap-2 text-sm"><CheckCircle2 size={16} className="text-emerald-500"/> PK/FK Constrain</div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, repeat: Infinity, repeatType: "reverse", duration: 1 }} className="flex items-center gap-2 text-sm"><Network size={16} className="text-purple-500"/> Optimizing indexes...</motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'healer' && (
                  <motion.div key="healer" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.1)_0,transparent_60%)]"></div>
                    <Zap size={100} className="text-rose-500/30 absolute animate-ping" />
                    <div className="relative z-10 text-center">
                      <div className="inline-flex flex-col items-center p-6 bg-black/60 rounded-2xl border border-rose-500/30 backdrop-blur-xl">
                        <Terminal size={32} className="text-rose-400 mb-4" />
                        <span className="font-mono text-xs text-rose-300 mb-2">Error 1064 (42000): Syntax SQL</span>
                        <div className="h-px w-full bg-white/10 my-2"></div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex items-center gap-2 text-emerald-400 text-sm font-bold mt-2">
                          <CheckCircle2 size={16} /> Auto-Fixed by Healer AI
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Section Complete & Connected */}
      <section className="relative w-full py-40 border-b border-white/10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-sm font-black text-indigo-500 tracking-[0.3em] uppercase mb-4">Complete and Connected AI Leadership</h2>
          <h3 className="text-5xl md:text-7xl font-black mb-12 max-w-4xl mx-auto leading-tight">Act faster with united teams in one place.</h3>
          
          <div className="relative w-full h-96 mt-20 flex items-center justify-center">
             {/* Center AI Brain */}
             <div className="w-32 h-32 bg-white flex items-center justify-center rounded-3xl shadow-[0_0_80px_rgba(255,255,255,0.4)] z-20 relative">
               <Cpu size={48} className="text-black" />
               <div className="absolute inset-0 border-2 border-white rounded-3xl animate-ping opacity-20"></div>
             </div>

             {/* Connecting lines and nodes */}
             <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
               <motion.path d="M 100,200 C 300,200 400,200 500,200" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="5,5" />
               <motion.path d="M 1100,200 C 900,200 800,200 700,200" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="5,5" />
             </svg>

             {/* Satellites */}
             <div className="absolute left-10 md:left-40 top-1/2 -translate-y-1/2 flex flex-col gap-12 z-20">
                <div className="w-16 h-16 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg">MySQL</div>
                <div className="w-16 h-16 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg">API</div>
                <div className="w-16 h-16 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg">CSV</div>
             </div>

             <div className="absolute right-10 md:right-40 top-1/2 -translate-y-1/2 z-20">
                <div className="px-8 py-6 bg-gradient-to-br from-indigo-600 to-purple-800 rounded-2xl shadow-2xl border border-indigo-400/50 flex flex-col items-center">
                   <Database size={32} className="text-white mb-2" />
                   <span className="font-black text-lg">Data Warehouse</span>
                   <span className="text-xs text-indigo-200 mt-1 uppercase tracking-widest">Ready for BI</span>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* 7. Actual Dashboard / History Section Embedded */}
      <section className="relative z-10 w-full bg-[#030303] py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
            <div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Unleash your pipelines.</h2>
              <p className="text-xl text-zinc-400">See exactly how AI sees you, optimize with clear direction.</p>
            </div>
            
            <div className="relative w-full md:w-96">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
               <input 
                 type="text" 
                 placeholder="Rechercher par nom, ID..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full bg-[#121214] border border-white/10 text-white rounded-full pl-12 pr-4 py-4 text-base font-medium focus:border-indigo-500 focus:bg-[#18181b] outline-none transition-all placeholder:text-zinc-600 shadow-inner"
               />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({length: 6}).map((_, i) => (
                <div key={i} className="h-48 rounded-3xl bg-[#0a0a0c] animate-pulse border border-white/5"></div>
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-32 text-center bg-[#0a0a0c] rounded-3xl border border-white/5 flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <Workflow size={32} className="text-zinc-500" />
                </div>
                <p className="font-black text-3xl mb-3 text-white">No active environments</p>
                <p className="text-zinc-500 text-lg font-medium max-w-md mx-auto">It's quiet in here. Click the button above to start your first Agentic ETL process.</p>
              </div>
            ) : (
              <AnimatePresence>
                {filtered.map((session, i) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    key={session.id}
                    onClick={() => onResumeSession(session.id)}
                    className="group p-8 rounded-3xl border border-white/10 bg-[#0a0a0c] hover:bg-[#121214] hover:border-indigo-500/50 hover:shadow-[0_0_40px_rgba(99,102,241,0.15)] transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[220px]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-duration-500" />
                    
                    <div className="flex items-start justify-between mb-4 relative z-10">
                      <div className="p-3 bg-[#18181b] rounded-2xl text-white group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300 border border-white/5">
                        <Database size={24} />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-black transition-colors duration-300">
                        <ArrowUpRight size={18} />
                      </div>
                    </div>
                    
                    <div className="relative z-10 mt-auto">
                      <h4 className="font-black text-2xl mb-2 text-white group-hover:text-indigo-200 transition-colors truncate">{session.name}</h4>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-zinc-500 bg-black/50 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">ID: {session.id.substring(0,8)}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-xs font-semibold text-zinc-400">{new Date(session.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </section>

      {/* 8. Huge Footer CTA */}
      <section className="w-full py-40 border-t border-white/10 relative overflow-hidden flex flex-col items-center justify-center text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(99,102,241,0.2)_0,transparent_60%)]"></div>
        <h2 className="text-5xl md:text-8xl font-black mb-10 relative z-10 tracking-tight">Ready to move <br/>first?</h2>
        <button 
          onClick={user ? onNewSession : onAuthOpen}
          className="relative z-10 px-12 py-6 bg-white text-black rounded-full font-black text-xl hover:scale-105 transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)] flex items-center gap-4"
        >
          Commencer maintenant
          <ArrowRight size={24} />
        </button>
      </section>

      {/* 9. Minimal Dark Footer */}
      <footer className="w-full border-t border-white/5 bg-black py-16 text-center text-zinc-600 text-sm font-medium">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-6 md:mb-0">
            <Database size={20} className="text-zinc-500" />
            <span className="font-bold text-lg text-zinc-400">AgentDW</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Enterprise</a>
            <a href="#" className="hover:text-white transition-colors">© 2026 AI Data Engineer</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
