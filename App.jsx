import React, { useState } from 'react';
import ConnectionModal from './ConnectionModal';
import ChatInterface from './ChatInterface';
import ModelVisualizer from './ModelVisualizer';
import PipelineMonitor from './PipelineMonitor';
import { Database, LayoutDashboard, Settings, X, RefreshCw, Server, PlayCircle, Plus, Activity } from 'lucide-react';

export default function App() {
  const [isModalOpen, setIsModalOpen]   = useState(true);
  const [sqlCode, setSqlCode]           = useState("-- Le code DDL généré apparaîtra ici...");
  const [etlCode, setEtlCode]           = useState(null);
  const [messages, setMessages]         = useState([]);
  const [activePanel, setActivePanel]   = useState('pipeline'); // Open by default or dashboard

  const togglePanel = (panel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
      
      {/* Sidebar */}
      <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 gap-8">
        <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-500/20">
          <Database size={24} />
        </div>

        <button
          title="Tableau de bord DW"
          onClick={() => togglePanel('dashboard')}
          className={`p-2 rounded-lg transition-all ${activePanel === 'dashboard' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'} cursor-pointer`}
        >
          <LayoutDashboard size={24} />
        </button>

        <button
          title="Lancer Pipeline CSV"
          onClick={() => { setIsModalOpen(true); setActivePanel('pipeline'); }}
          className="p-2 rounded-lg transition-all text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer shadow-sm shadow-emerald-500/10"
        >
          <PlayCircle size={24} />
        </button>

        <button
          title="Progression ETL"
          onClick={() => togglePanel('pipeline')}
          className={`p-2 rounded-lg transition-all ${activePanel === 'pipeline' ? 'bg-blue-600/20 text-blue-400 shadow-md shadow-blue-500/10' : 'text-slate-500 hover:text-slate-300'} cursor-pointer`}
        >
          <Activity size={24} />
        </button>

        <button
          title="Paramètres / Reconnecter"
          onClick={() => togglePanel('settings')}
          className={`p-2 rounded-lg transition-all mt-auto ${activePanel === 'settings' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'} cursor-pointer`}
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Panneau latéral contextuel */}
      {activePanel === 'dashboard' && (
        <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Server size={16} className="text-blue-400" />
              Tableau de Bord DW
            </h2>
            <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            {/* Statut DW */}
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Statut</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-sm text-emerald-400 font-medium">Backend opérationnel</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Port 8000 · SQLite local</p>
            </div>

            {/* Schéma courant */}
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider">Schéma Actuel</p>
              {sqlCode && !sqlCode.startsWith('--') ? (
                <div className="space-y-2">
                  {sqlCode.match(/CREATE TABLE\s+(\w+)/gi)?.map((t, i) => {
                    const name = t.replace(/CREATE TABLE\s+/i, '');
                    const isFactTable = name.toLowerCase().startsWith('fact');
                    return (
                      <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${isFactTable ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                        <Database size={12} />
                        {name}
                        <span className="ml-auto text-slate-500">{isFactTable ? 'Faits' : 'Dim'}</span>
                      </div>
                    );
                  }) ?? <p className="text-xs text-slate-500">Aucun schéma généré</p>}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Connectez une source pour voir le schéma.</p>
              )}
            </div>

            {/* Actions rapides */}
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider">Actions Rapides</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setActivePanel(null); setIsModalOpen(true); }}
                  className="w-full flex items-center gap-2 text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 px-3 py-2.5 rounded-lg transition-all font-semibold"
                >
                  <Plus size={14} />
                  Nouveau Pipeline CSV
                </button>
                <button
                  onClick={() => { setActivePanel(null); setIsModalOpen(true); }}
                  className="w-full flex items-center gap-2 text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 px-3 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw size={12} />
                  Changer de source
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activePanel === 'settings' && (
        <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Settings size={16} className="text-blue-400" />
              Paramètres
            </h2>
            <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider">Connexion</p>
              <button
                onClick={() => { setActivePanel(null); setIsModalOpen(true); }}
                className="w-full flex items-center justify-center gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors font-medium"
              >
                <Database size={12} />
                Nouvelle connexion source
              </button>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider">Modèle IA</p>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span>Gemini 2.5 Flash</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Orchestration via LangGraph</p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider">À propos</p>
              <p className="text-xs text-slate-400">Agent DW — v1.0</p>
              <p className="text-xs text-slate-500 mt-1">Architecture multi-agents (Explorer · Modeler · ETL · Healer)</p>
            </div>
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex overflow-hidden">
        
        <div className="w-1/3 min-w-[380px] bg-slate-900/50 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-wide text-slate-100">
              Agent Modélisateur
            </h1>
            <span className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              En ligne
            </span>
          </div>
          <ChatInterface messages={messages} setMessages={setMessages} onUpdateSql={setSqlCode} />
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {sqlCode === "-- Le code DDL généré apparaîtra ici..." ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
                <PlayCircle size={40} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Bienvenue dans l'Agent Data Warehouse</h2>
              <p className="text-slate-400 max-w-md mb-8">
                Prêt à automatiser votre ETL ? Choisissez un fichier CSV pour commencer la modélisation et l'intégration de vos données.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95"
              >
                <Plus size={24} />
                Lancer Nouveau Pipeline CSV
              </button>
            </div>
          ) : (
            <ModelVisualizer code={sqlCode} etlCode={etlCode} />
          )}
        </div>

      </div>

      {isModalOpen && (
        <ConnectionModal 
          onClose={() => setIsModalOpen(false)} 
          onStartSuccess={(newSql) => {
            setSqlCode(newSql);
            setEtlCode(null);
            setMessages(prev => [...prev, { 
              role: 'bot', 
              content: "🚀 Le modèle logique a été généré avec succès ! \n\nVous pouvez le modifier via le chat ou cliquer sur le bouton vert ci-dessous pour lancer l'intégration (ETL) dans votre base MySQL." 
            }]);
          }}
        />
      )}

      {/* Pipeline Monitor Panel */}
      <PipelineMonitor
        isVisible={activePanel === 'pipeline'}
        onClose={() => setActivePanel(null)}
        onSuccess={(code) => setEtlCode(code)}
      />
    </div>
  );
}

