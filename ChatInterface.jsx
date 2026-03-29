import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Code, Sparkles, Loader2, Bot, Shield, Database, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const FormattedMessage = ({ content }) => {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="text-[13px] leading-relaxed break-words space-y-2">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const lang = lines[0].trim().match(/^[a-z]+$/i) ? lines[0].trim() : 'code';
          const code = lines[0].trim().match(/^[a-z]+$/i) ? lines.slice(1).join('\n') : lines.join('\n');
          return (
            <div key={index} className="my-2 rounded-md overflow-hidden border border-[#27272a] bg-[#09090b]">
              <div className="bg-[#18181b] px-3 py-1.5 text-[10px] text-zinc-500 uppercase tracking-widest font-mono flex items-center justify-between">
                <span>{lang}</span>
              </div>
              <pre className="m-0 p-3 text-zinc-300 font-mono text-[11px] overflow-auto whitespace-pre-wrap">
                {code}
              </pre>
            </div>
          );
        }
        
        // Handling normal text to support basic bold and lists
        const lines = part.split('\n');
        return (
          <div key={index} className="space-y-1">
            {lines.map((l, i) => {
              const text = l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
              if (l.trim().startsWith('* ') || l.trim().startsWith('- ')) {
                return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: text.substring(2) }}></li>;
              }
              if (l.match(/^\d+\.\s/)) {
                return <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: text.replace(/^\d+\.\s/, '') }}></li>;
              }
              return <p key={i} dangerouslySetInnerHTML={{ __html: text }}></p>;
            })}
          </div>
        );
      })}
    </div>
  );
};

export default function ChatInterface({ messages, setMessages, onUpdateSql, onUpdateEtl, onUpdateCritic, sqlCode, etlCode, criticReview, activeSessionId }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // chat, critic, sql, etl
  const messagesEndRef = useRef(null);
  const [copied, setCopied] = useState(null);

  const handleCopy = (text, type) => {
    if (!text) text = '';
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, activeTab]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);
    setActiveTab('chat');

    try {
      const resp = await fetch(`http://localhost:8000/api/chat?session_id=${activeSessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, context: activeTab === 'etl' ? 'etl' : 'sql' })
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: 'bot', content: data.reply || "Modèle mis à jour." }]);
      if (data.sql_ddl) onUpdateSql(data.sql_ddl);
      if (data.etl_code) onUpdateEtl(data.etl_code);
      if (data.critic_review) onUpdateCritic(data.critic_review);

    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: "⚠️ Erreur orchestrateur.", isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c0e]">
      
      <div className="flex p-2 gap-1 border-b border-[#27272a] bg-[#09090b] shrink-0 overflow-x-auto text-nowrap scrollbar-hide">
        <button onClick={() => setActiveTab('chat')} className={`px-3 py-1.5 min-w-[max-content] text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${activeTab === 'chat' ? 'bg-[#18181b] text-indigo-400 shadow-sm border border-[#27272a]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#18181b]/50'}`}>
          <MessageSquare size={14}/> Copilot IA
        </button>
        <button onClick={() => setActiveTab('critic')} className={`px-3 py-1.5 min-w-[max-content] text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${activeTab === 'critic' ? 'bg-[#18181b] text-rose-400 shadow-sm border border-[#27272a]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#18181b]/50'}`}>
          <Shield size={14}/> Critique
        </button>
        <button onClick={() => setActiveTab('sql')} className={`px-3 py-1.5 min-w-[max-content] text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${activeTab === 'sql' ? 'bg-[#18181b] text-indigo-400 shadow-sm border border-[#27272a]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#18181b]/50'}`}>
          <Database size={14}/> DDL
        </button>
        <button onClick={() => setActiveTab('etl')} className={`px-3 py-1.5 min-w-[max-content] text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${activeTab === 'etl' ? 'bg-[#18181b] text-indigo-400 shadow-sm border border-[#27272a]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#18181b]/50'}`}>
          <Code size={14}/> Pentaho
        </button>
      </div>

      {activeTab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-60 px-4 text-center">
                 <Bot size={40} className="mb-4 text-zinc-700" />
                 <p className="text-sm font-medium">Je suis l'Architecte IA.</p>
                 <p className="text-xs mt-2">Validez, critiquez ou modifiez le pipeline généré.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[90%] p-3 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-sm' : msg.isError ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl rounded-tl-sm' : 'bg-[#18181b] border border-[#27272a] text-zinc-200 rounded-2xl rounded-tl-sm'}`}>
                      <FormattedMessage content={msg.content} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center text-zinc-500 px-2 py-4">
                 <Loader2 size={14} className="animate-spin text-indigo-500" /> <span className="text-xs font-medium">Analyse en cours...</span>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-[#09090b] border-t border-[#27272a] shrink-0">
            <form onSubmit={handleSend} className="relative">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }} disabled={isLoading} placeholder="Posez une question..." rows={1} className="w-full bg-[#18181b] text-sm text-zinc-200 border border-[#27272a] rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none" style={{ fieldSizing: 'content' }} />
              <button type="submit" disabled={!input.trim() || isLoading} className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:bg-zinc-800 hover:bg-indigo-500">
                <Send size={14} />
              </button>
            </form>
          </div>
        </>
      )}

      {activeTab === 'critic' && (
        <div className="flex-1 overflow-auto p-4 bg-[#09090b] border-t border-[#27272a] text-sm text-zinc-300 leading-relaxed font-sans relative">
           {criticReview ? (
             <div className="space-y-4">
                <FormattedMessage content={criticReview} />
                <button 
                  type="button"
                  onClick={() => {
                    const fixPrompt = "Peux-tu appliquer ces remarques et corriger le script SQL ?\n\nRETOUR CRITIQUE :\n" + criticReview;
                    setInput(fixPrompt);
                    onUpdateCritic(null); // Clear critique after taking action
                    setActiveTab('chat');
                    setMessages(prev => [...prev, { role: 'bot', content: "D'accord, je transfère ces critiques à mon module de correction. Je m'en occupe immédiatement !" }]);
                  }}
                  className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg font-bold text-xs transition-colors"
                >
                  <Bot size={14} /> Demander au Copilot IA de corriger
                </button>
             </div>
           ) : <div className="text-zinc-600 flex flex-col items-center justify-center h-40 gap-3 border border-dashed border-zinc-800 rounded-xl">
                 <Shield size={24} className="opacity-20" />
                 <span>Aucune critique en attente.</span>
               </div>}
        </div>
      )}

      {activeTab === 'sql' && (
        <div className="flex-1 overflow-auto bg-[#09090b] border-t border-[#27272a] relative">
           <button onClick={() => handleCopy(sqlCode, 'sql')} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all z-10 flex items-center gap-2 text-xs font-bold border border-white/10 backdrop-blur-md">
             {copied === 'sql' ? <><Check size={14} className="text-emerald-400" /> Copié</> : <><Copy size={14} /> Copier le code</>}
           </button>
           <SyntaxHighlighter
             language="sql"
             style={vscDarkPlus}
             customStyle={{ margin: 0, padding: '3rem 1rem 1rem 1rem', background: 'transparent', fontSize: '13px' }}
             wrapLines={true}
           >
             {sqlCode || "-- Aucun modèle SQL"}
           </SyntaxHighlighter>
        </div>
      )}

      {activeTab === 'etl' && (
        <div className="flex-1 overflow-auto bg-[#09090b] border-t border-[#27272a] relative">
           <div className="absolute top-4 right-4 flex gap-2 z-10">
             <button onClick={() => handleCopy(etlCode, 'etl')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all flex items-center gap-2 text-xs font-bold border border-white/10 backdrop-blur-md">
               {copied === 'etl' ? <><Check size={14} className="text-emerald-400" /> Copié</> : <><Copy size={14} /> Copier le code</>}
             </button>
           </div>
           <SyntaxHighlighter
             language="xml"
             style={vscDarkPlus}
             customStyle={{ margin: 0, padding: '3rem 1rem 1rem 1rem', background: 'transparent', fontSize: '13px' }}
             wrapLines={true}
           >
             {etlCode || "<!-- Aucun fichier .ktr généré -->"}
           </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}