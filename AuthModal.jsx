import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Mail, User, ShieldCheck } from 'lucide-react';

// API backend configurable (Vite)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AuthModal({ isOpen, onClose, onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [step, setStep] = useState(1); // 1: Info, 2: Code verification
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleRegisterInit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, name: formData.name })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setStep(2);
      } else {
        alert(data.message || "Erreur lors de l'enregistrement de l'email.");
      }
    } catch (err) {
      alert("Erreur de connexion au serveur d'authentification.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           email: formData.email, 
           name: formData.name, 
           password: formData.password, 
           code: verificationCode 
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        onLogin(data.user);
      } else {
        alert(data.message || "Code de vérification incorrect.");
      }
    } catch (err) {
      alert("Erreur de validation du code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, password: formData.password })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          onLogin(data.user);
        } else {
          alert(data.message || "Erreur de connexion.");
        }
      } catch (err) {
        alert("Erreur de connexion au serveur.");
      } finally {
        setIsLoading(false);
      }
    } else {
      if (step === 1) await handleRegisterInit(e);
      else await handleRegisterVerify(e);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-md relative"
        >
          <div className="absolute top-4 right-4">
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="px-8 pt-10 pb-8">
            <div className="flex justify-center mb-6">
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                <ShieldCheck size={32} />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-center text-white mb-2">
              {isLogin ? 'Bienvenue !' : 'Créer un compte'}
            </h2>
            <p className="text-sm text-center text-zinc-400 mb-8">
              {isLogin ? 'Connectez-vous pour accéder à votre espace ETL' : 'Rejoignez la plateforme AUTOETL AI'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && step === 1 && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Nom complet</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      required
                      type="text"
                      className="w-full bg-[#18181b] border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                      placeholder="Jean Dupont"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {step === 1 ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Adresse mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input
                        required
                        type="email"
                        className="w-full bg-[#18181b] border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                        placeholder="jean@gmail.com"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Mot de passe</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input
                        required
                        type="password"
                        className="w-full bg-[#18181b] border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs text-center">
                    Un code de vérification à 6 chiffres a été envoyé à <strong>{formData.email}</strong>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider text-center">Code de vérification</label>
                    <input
                      required
                      type="text"
                      maxLength="6"
                      className="w-full bg-[#18181b] border border-zinc-800 rounded-lg py-3 text-center text-xl font-bold tracking-[0.5em] text-white focus:outline-none focus:border-emerald-500 transition-all placeholder-zinc-800"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-indigo-500/20 transition-all mt-4"
              >
                {isLoading ? 'Vérification en cours...' : (
                  isLogin ? 'Se connecter' : (step === 1 ? "S'inscrire" : "Confirmer l'inscription")
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors"
                type="button"
              >
                {isLogin ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
