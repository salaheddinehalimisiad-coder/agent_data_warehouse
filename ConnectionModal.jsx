import React, { useState, useRef } from 'react';
import { X, FileText, Server, ChevronDown, ChevronUp, Loader2, Upload, Search, AlertCircle } from 'lucide-react';

export default function ConnectionModal({ onClose, onStartSuccess }) {
  // --- Source config ---
  const [sourceType] = useState('csv');
  const [filePath, setFilePath] = useState('ventes.csv');

  // --- Target DW MySQL config ---
  const [dwHost, setDwHost]         = useState('127.0.0.1');
  const [dwPort, setDwPort]         = useState('3306');
  const [dwUser, setDwUser]         = useState('root');
  const [dwPassword, setDwPassword] = useState('23102802Sd;');
  const [dwDatabase, setDwDatabase] = useState('data_warehouse');
  const [showDwConfig, setShowDwConfig] = useState(true);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isUploading, setIsUploading]   = useState(false);
  const [errorMsg, setErrorMsg]         = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch('http://127.0.0.1:8000/api/upload-csv', {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();
      if (data.status === 'success') {
        setFilePath(data.file_path);
      } else {
        setErrorMsg("Erreur lors de l'envoi du fichier CSV.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erreur de communication avec le serveur local. Le backend est-il lancé ?");
    } finally {
      setIsUploading(false);
    }
  };

  const formatErrorMsg = (msg) => {
      const str = String(msg || "");
      if (str.includes("ollama.com") || str.includes("502") || str.includes("connectex")) {
          return "Le service d'Intelligence Artificielle local (Ollama) n'arrive pas à joindre le registre distant pour télécharger ou vérifier le modèle 'glm-5:cloud'. Veuillez vérifier que votre service Ollama est actif et dispose d'une connexion internet, ou changez de modèle.";
      }
      return str;
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    setIsConnecting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type:       sourceType,
          file_path:         filePath || null,
          dw_host:     dwHost,
          dw_port:     parseInt(dwPort) || 3306,
          dw_user:     dwUser,
          dw_password: dwPassword,
          dw_database: dwDatabase,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = data.detail
          ? (Array.isArray(data.detail)
              ? data.detail.map(d => `${d.loc?.join('.')}: ${d.msg}`).join('\n')
              : JSON.stringify(data.detail))
          : data.message || `Erreur HTTP ${response.status}`;
          
        setErrorMsg(formatErrorMsg(detail));
        return;
      }

      if (data.status === 'waiting_for_review') {
        onStartSuccess(data.sql_ddl, data.critic_review);
        onClose();
      } else {
        setErrorMsg(formatErrorMsg(data.message || JSON.stringify(data)));
      }
    } catch (error) {
      console.error("Erreur de connexion détaillée:", error);
      setErrorMsg(`Impossible de joindre le serveur API local (Erreur: ${error.message}). Assurez-vous que le backend (api/server.py) est bien démarré sur le port 8000.`);
    } finally {
      setIsConnecting(false);
    }
  };

  const inputClass = "w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all";
  const labelClass = "block text-xs font-medium text-slate-400 mb-1";

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-slate-950/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">Connexion de Source</h2>
            <p className="text-xs text-slate-400 mt-0.5">Agent Data Warehouse — Configuration CSV</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex gap-3 items-start animate-in slide-in-from-top-2">
              <div className="text-rose-400 mt-0.5"><AlertCircle size={18} /></div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-rose-400">Échec de la connexion</h3>
                <p className="text-xs text-rose-300/80 mt-1.5 leading-relaxed">{errorMsg}</p>
              </div>
              <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-400/50 hover:text-rose-300"><X size={14}/></button>
            </div>
          )}

          {/* === Section 1 : Source de données === */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-blue-500/20">1</div>
              <p className="text-sm font-semibold text-slate-200">Source de données</p>
            </div>

            <div className="flex gap-2 p-1 bg-slate-950 rounded-lg">
              <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium bg-slate-800 text-emerald-400 shadow-sm">
                <FileText size={14} /> Fichier CSV Uniquement
              </div>
            </div>

            <div className="animate-in slide-in-from-right duration-300">
              <label className={labelClass}>Fichier source CSV</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={filePath}
                    readOnly
                    placeholder="Aucun fichier sélectionné"
                    className={`${inputClass} bg-slate-900/50 cursor-default pr-10`}
                  />
                  <FileText size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-2 text-xs font-semibold transition-all hover:border-slate-500 whitespace-nowrap"
                >
                  {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Parcourir
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden"
                />
              </div>
              {filePath && (
                <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center gap-1">
                  <Upload size={10} /> Fichier sélectionné : {filePath.split(/[\\/]/).pop()}
                </p>
              )}
            </div>
          </div>

          {/* === Section 2 : Data Warehouse MySQL cible === */}
          <div className="border border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setShowDwConfig(!showDwConfig)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-emerald-500/20">2</div>
                <div className="flex items-center gap-2">
                  <Server size={14} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-slate-200">Data Warehouse MySQL cible</span>
                </div>
              </div>
              {showDwConfig ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {showDwConfig && (
              <div className="p-4 space-y-3 bg-slate-900/40 animate-in slide-in-from-top duration-300">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelClass}>Hôte</label>
                    <input type="text" value={dwHost} onChange={(e) => setDwHost(e.target.value)} placeholder="127.0.0.1" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Port</label>
                    <input type="text" value={dwPort} onChange={(e) => setDwPort(e.target.value)} placeholder="3306" className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Utilisateur</label>
                    <input type="text" value={dwUser} onChange={(e) => setDwUser(e.target.value)} placeholder="root" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Mot de passe</label>
                    <input type="password" value={dwPassword} onChange={(e) => setDwPassword(e.target.value)} placeholder="••••••••" className={inputClass} autoComplete="current-password" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Base de données cible</label>
                  <input type="text" value={dwDatabase} onChange={(e) => setDwDatabase(e.target.value)} placeholder="data_warehouse" className={inputClass} />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <form onSubmit={handleConnect}>
            <button
              type="submit"
              disabled={isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 active:scale-95 transform"
            >
              {isConnecting
                ? <><Loader2 size={20} className="animate-spin" /> EXTRATION EN COURS...</>
                : <><Server size={20} /> INITIALISER LE PIPELINE</>
              }
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}