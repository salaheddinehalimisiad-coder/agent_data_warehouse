import React from 'react';
import { Book, Table as TableIcon, Key, Link as LinkIcon, FileText, Database, ArrowRight } from 'lucide-react';

export default function DataCatalog({ logicalModel }) {
  if (!logicalModel || !logicalModel.tables || logicalModel.tables.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#09090b]">
        <div className="text-center text-zinc-500">
          <Book size={48} className="mx-auto mb-4 opacity-30" />
          <h2 className="text-xl font-bold mb-2">Catalogue Vide</h2>
          <p className="text-sm">Générez un modèle dans l'onglet "Connecteurs" pour le documenter ici.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#050505] text-white p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="mb-12 border-b border-zinc-800 pb-8 flex items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Book size={32} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-3">Catalogue de Données (IA)</h1>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Documentation automatique générée par l'agent modélisateur. Explorez chaque entité, son périmètre fonctionnel et sa traçabilité (Lineage).
            </p>
          </div>
        </div>

        {/* Introduction */}
        {logicalModel.reasoning && (
          <div className="mb-12 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
             <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2"><FileText size={16}/> Note de Cadrage de l'IA</h3>
             <p className="text-zinc-300 leading-relaxed italic border-l-2 border-indigo-500 pl-4">{logicalModel.reasoning}</p>
          </div>
        )}

        {/* Tables */}
        <div className="space-y-12">
          {logicalModel.tables.map((table, i) => {
             const isFact = table.type === 'FAIT';
             return (
               <div key={i} className="rounded-2xl border border-zinc-800 overflow-hidden bg-[#0c0c0e] shadow-2xl relative">
                  {/* Glowing top line */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${isFact ? 'from-indigo-500 to-blue-500' : 'from-emerald-500 to-teal-500'}`}></div>
                  
                  {/* Table Header */}
                  <div className="p-6 border-b border-zinc-800 bg-[#12121a]">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           {isFact ? <Database className="text-indigo-400" size={24}/> : <TableIcon className="text-emerald-400" size={24}/>}
                           <h2 className="text-2xl font-bold tracking-tight">{table.name}</h2>
                           <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${isFact ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                             {table.type}
                           </span>
                        </div>
                        <p className="text-zinc-400">{table.description || "Aucune description générée."}</p>
                      </div>
                    </div>
                  </div>

                  {/* Columns List */}
                  <div className="p-0">
                    <table className="w-full text-left border-collapse">
                       <thead>
                         <tr className="bg-zinc-900/40 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                           <th className="px-6 py-4 border-b border-zinc-800">Nom Technique</th>
                           <th className="px-6 py-4 border-b border-zinc-800">Description Métier</th>
                           <th className="px-6 py-4 border-b border-zinc-800">Type SQL</th>
                           <th className="px-6 py-4 border-b border-zinc-800">Lineage Source</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-zinc-800/60">
                         {table.columns.map((col, j) => (
                           <tr key={j} className="hover:bg-zinc-800/20 transition-colors group">
                             <td className="px-6 py-4">
                               <div className="flex items-center gap-2">
                                  {col.is_primary_key && <Key size={14} className="text-amber-400 shrink-0" title="Primary Key"/>}
                                  {col.is_foreign_key && <LinkIcon size={14} className="text-indigo-400 shrink-0" title={`Foreign Key vers ${col.references}`}/>}
                                  <span className={`font-mono text-sm ${col.is_primary_key ? 'text-amber-400 font-bold' : col.is_foreign_key ? 'text-indigo-400 font-semibold' : 'text-zinc-300'}`}>
                                    {col.name}
                                  </span>
                               </div>
                             </td>
                             <td className="px-6 py-4">
                               <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors leading-relaxed">
                                 {col.description || "-"}
                               </p>
                             </td>
                             <td className="px-6 py-4">
                               <span className="font-mono text-xs text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 inline-block">
                                 {col.type}
                               </span>
                             </td>
                             <td className="px-6 py-4">
                               <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                  {col.source_column && col.source_column !== 'N/A' ? (
                                    <>
                                      <ArrowRight size={14} className="text-emerald-500" />
                                      <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                                        {col.source_column}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-zinc-600 italic">Surrogate IA</span>
                                  )}
                               </div>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                    </table>
                  </div>
               </div>
             )
          })}
        </div>
      </div>
    </div>
  );
}
