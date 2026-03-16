import React, { useState } from 'react';
import { Copy, Terminal, Database, Sparkles } from 'lucide-react';

export default function ModelVisualizer({ code, etlCode }) {
  const [activeTab, setActiveTab] = useState('sql');

  const handleCopy = () => {
    const textToCopy = activeTab === 'sql' ? code : etlCode;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      alert("Code copié !");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E] rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
      
      {/* Tab bar type IDE */}
      <div className="flex items-center justify-between bg-[#252526] border-b border-[#333333] pr-4">
        <div className="flex items-center">
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-5 py-3 border-r border-[#333333] transition-colors focus:outline-none ${activeTab === 'sql' ? 'bg-[#1E1E1E] text-slate-100 border-t-2 border-t-blue-500' : 'text-slate-500 hover:text-slate-300 hover:bg-[#2a2a2b]'}`}
          >
            <Database size={16} className={`${activeTab === 'sql' ? 'text-blue-400' : ''}`} />
            <span className="text-xs font-semibold uppercase tracking-wider">Modèle Logique (SQL)</span>
          </button>

          {etlCode && (
            <button
              onClick={() => setActiveTab('etl')}
              className={`flex items-center gap-2 px-5 py-3 border-r border-[#333333] transition-colors focus:outline-none ${activeTab === 'etl' ? 'bg-[#1E1E1E] text-slate-100 border-t-2 border-t-emerald-500' : 'text-slate-500 hover:text-slate-300 hover:bg-[#2a2a2b]'}`}
            >
              <Sparkles size={16} className={`${activeTab === 'etl' ? 'text-emerald-400' : ''}`} />
              <span className="text-xs font-semibold uppercase tracking-wider">Script PySpark (ETL)</span>
            </button>
          )}
        </div>
        
        <button onClick={handleCopy} className="text-slate-500 hover:text-slate-300 transition-colors p-2 hover:bg-[#333] rounded">
          <Copy size={16} />
        </button>
      </div>

      {/* Zone de code */}
      <div className="flex-1 overflow-auto p-4 relative font-mono text-sm leading-relaxed">
        {activeTab === 'sql' ? (
          <pre className="text-blue-300">
            <code>
              {code || "-- En attente de l'Agent Modélisateur..."}
            </code>
          </pre>
        ) : (
          <pre className="text-emerald-300 whitespace-pre-wrap">
            <code>
              {etlCode}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}