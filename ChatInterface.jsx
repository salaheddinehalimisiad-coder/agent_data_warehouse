// Fichier : components/ChatInterface.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Send, CheckCircle, Bot, User, Loader2 } from 'lucide-react';

export default function ChatInterface({ messages, setMessages, onUpdateSql }) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll vers le bas
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    
    const userMsg = inputValue;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await response.json();
      
      // On met à jour le chat avec la réponse
      setMessages(prev => [...prev, { role: 'bot', content: "C'est fait ! Le modèle a été mis à jour avec vos instructions." }]);
      
      // On met à jour l'éditeur central avec le nouveau code SQL
      if (data.sql_ddl) {
          onUpdateSql(data.sql_ddl);
      }
    } catch (error) {
      console.error("Erreur chat:", error);
      setMessages(prev => [...prev, { role: 'bot', content: "Erreur de communication avec l'agent." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://127.0.0.1:8000/api/validate', { method: 'POST' });
      const data = await response.json();
      
      if (data.status === 'success') {
        setMessages(prev => [...prev, { role: 'bot', content: "✅ Succès ! Code ETL PySpark généré." }]);
        alert("🎉 Succès : " + data.message);
        if (data.etl_code_used) {
            onUpdateSql("-- Code PySpark ETL Généré :\n\n" + data.etl_code_used);
        }
      } else if (data.status === 'background') {
        setMessages(prev => [...prev, { role: 'bot', content: "🚀 Génération ETL lancée en arrière-plan ! Suivez la progression sur le widget inférieur." }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', content: "❌ Échec de l'ETL." }]);
        alert("⚠️ Problème : " + data.error);
      }
    } catch (error) {
      alert("Erreur d'exécution de la requête réseau : " + error.message + ". Vérifiez que le serveur est bien démarré.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Zone des messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
            <Bot size={48} className="mb-4" />
            <p className="text-sm">En attente de vos instructions...</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-800'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
              <Loader2 size={16} className="animate-spin text-blue-400" />
            </div>
          </div>
        )}
      </div>

      {/* Zone de saisie et Validation */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Modifier le modèle (ex: Ajoute une table Temps...)"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
          <button type="submit" className="absolute right-2 p-2 text-blue-400 hover:text-blue-300 transition-colors">
            <Send size={20} />
          </button>
        </form>

        <button 
          onClick={handleValidate}
          disabled={isLoading}
          className="w-full py-3 px-4 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
        >
          <CheckCircle size={18} className="group-hover:scale-110 transition-transform" />
          Valider le modèle et lancer l'ETL
        </button>
      </div>
    </div>
  );
}