import React, { useState, useEffect } from 'react';
import { Play, Database, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DataExplorer({ logicalModel, user, activeSessionId }) {
  const defaultTable = logicalModel?.tables?.[0]?.name || "data_warehouse";
  const [query, setQuery] = useState(`SELECT * FROM ${defaultTable} LIMIT 10;`);

  useEffect(() => {
    if (logicalModel?.tables?.[0]?.name) {
      setQuery(`SELECT * FROM ${logicalModel.tables[0].name} LIMIT 10;`);
    }
  }, [logicalModel]);
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [finalQuery, setFinalQuery] = useState(null);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const dbConfigStr = localStorage.getItem('last_db_config');
      let dbConfig = {};
      if (dbConfigStr) {
        dbConfig = JSON.parse(dbConfigStr);
      }

      const response = await fetch('http://localhost:8000/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          dw_host: dbConfig.host || "127.0.0.1",
          dw_port: parseInt(dbConfig.port) || 3306,
          dw_user: dbConfig.user || "root",
          dw_password: dbConfig.password || "",
          dw_database: "data_warehouse",
          session_id: activeSessionId
        }),
      });
      const resData = await response.json();
      
      if (resData.status === 'success') {
        setColumns(resData.columns);
        setData(resData.data);
        setFinalQuery(resData.final_query);
      } else {
        setError(resData.message);
      }
    } catch (err) {
      setError("Erreur réseau : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c0e] text-zinc-300 p-6 overflow-hidden">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
          <Database className="text-indigo-400" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Explorateur SQL Sécurisé</h1>
          <p className="text-xs text-zinc-500">Exécutez vos requêtes SELECT sur le Data Warehouse finalisé.</p>
        </div>
      </div>

      <div className="flex-none bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg p-4 mb-4 relative group">
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          <button 
            onClick={handleExecute}
            disabled={loading || !query.trim().toLowerCase().startsWith('select')}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(99,102,241,0.3)]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {loading ? "Exécution..." : "Exécuter (Limit 100)"}
          </button>
        </div>
        
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-[#0c0c0e] border border-[#27272a] rounded-lg p-4 text-emerald-400 font-mono text-sm resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all h-32"
          placeholder="Entrez votre requête SQL (ex: SELECT * FROM fact_ventes)..."
          spellCheck="false"
        />
        {finalQuery && (
          <p className="text-[10px] text-zinc-500 mt-2 font-mono truncate">
            <span className="text-zinc-600">Recherche finale :</span> {finalQuery}
          </p>
        )}
        {!query.trim().toLowerCase().startsWith('select') && query.trim() !== '' && (
          <p className="text-rose-400 text-xs mt-2 flex items-center gap-1"><AlertCircle size={12}/> Seules les requêtes SELECT sont autorisées.</p>
        )}
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3 shadow-lg">
          <AlertCircle size={18} className="shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </motion.div>
      )}

      <div className="flex-1 overflow-hidden border border-[#27272a] rounded-xl bg-[#09090b] shadow-inner flex flex-col relative">
        {data.length === 0 && !loading && !error ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
             <Database size={48} className="mb-4 opacity-50" />
             <p className="text-sm font-medium">Aucune donnée à afficher</p>
             <p className="text-xs mt-1 text-zinc-500">Exécutez une requête pour voir les résultats ici.</p>
           </div>
        ) : (
          <div className="overflow-auto w-full h-full">
            <table className="w-full text-xs text-left">
              <thead className="text-zinc-400 uppercase bg-[#18181b] sticky top-0 z-10 shadow-md border-b border-[#27272a]">
                <tr>
                  {columns.map((col, i) => (
                    <th key={i} className="px-4 py-3 font-semibold tracking-wider border-r border-[#27272a]/50 last:border-0 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]/40 text-zinc-300 font-mono">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-indigo-500/5 transition-colors">
                    {columns.map((col, j) => (
                      <td key={j} className="px-4 py-2.5 border-r border-[#27272a]/30 last:border-0 truncate max-w-xs" title={String(row[col])}>
                        {row[col] === null ? <span className="text-zinc-600 italic">NULL</span> : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.length > 0 && (
            <div className="bg-[#18181b] px-4 py-2 text-[10px] text-zinc-500 border-t border-[#27272a] flex justify-between">
                <span>Total: {data.length} lignes renvoyées</span>
                <span>Opération en lecture seule (Safe Mode)</span>
            </div>
        )}
      </div>
    </div>
  );
}
