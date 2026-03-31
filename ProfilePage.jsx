import React from 'react';
import { User, Mail, ShieldCheck, History, Calendar, Clock, Database, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

// API backend configurable (Vite)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ProfilePage({ user, onLogout, onResumeSession }) {
  const [history, setHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/api/sessions?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => {
        setHistory(data.sessions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : 'Récent';

  return (
    <div className="flex-1 h-screen bg-[#09090b] overflow-y-auto w-full custom-scrollbar selection:bg-indigo-500/30">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-black text-white mb-8 tracking-tight flex items-center gap-3">
          <User className="text-indigo-400" size={32} /> Mon Profil Client
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="col-span-1">
            <div className="bg-[#141416] border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              
              <div className="flex items-center gap-4 mb-6 mt-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <User size={32} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white capitalize">{user.name || 'Utilisateur'}</h2>
                  <p className="text-sm font-medium text-emerald-400 flex items-center gap-1.5 mt-1">
                    <ShieldCheck size={14} /> {user.role || 'Data Engineer'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Mail size={16} />
                  <span className="text-sm">{user.email || 'jean@entreprise.com'}</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-400">
                  <Calendar size={16} />
                  <span className="text-sm">Membre depuis: {joinDate}</span>
                </div>
              </div>

              <button 
                onClick={onLogout}
                className="w-full mt-8 bg-zinc-800 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-400 border border-zinc-700 hover:border-rose-500/30 py-2.5 rounded-lg text-sm font-bold transition-all"
              >
                Se Déconnecter
              </button>
            </div>
          </div>

          {/* History Section */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <History size={20} className="text-zinc-400" /> Historique des pipelines ETL
            </h3>
            
            <div className="space-y-4">
              {loading ? (
                <div className="text-zinc-500 animate-pulse text-sm">Chargement de votre historique...</div>
              ) : history.length === 0 ? (
                <div className="text-zinc-600 border border-dashed border-zinc-800 p-8 rounded-xl text-center">
                   Aucun pipeline exécuté pour le moment.
                </div>
              ) : (
                history.map((hist, i) => {
                  const date = new Date(hist.updated_at);
                  return (
                    <motion.div 
                      key={hist.id}
                      onClick={() => onResumeSession(hist.id)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-[#141416] border border-zinc-800 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-[#18181b] transition-all group cursor-pointer shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <CheckCircle2 size={16} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-indigo-300">Run {hist.name}</h4>
                            <span className="text-xs text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                              <Clock size={10} /> {date.toLocaleDateString()} à {date.toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-1 rounded-md border border-zinc-700">
                          {hist.id.substring(0,8)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-zinc-300 bg-[#09090b] p-3 rounded-lg border border-zinc-800/50">
                        <Database size={14} className="text-zinc-500" />
                        <span>Identifiant de session: <strong className="text-indigo-400 ml-1">{hist.id}</strong></span>
                        <div className="flex-1"></div>
                        <span className="text-xs text-zinc-500 group-hover:text-indigo-400 transition-colors flex items-center">
                          Ouvrir ce pipeline <ChevronRight size={12} className="ml-1" />
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
