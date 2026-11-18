import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../firebase/config';
import { createUserData } from '../firebase/db';
import OmnitrixLogo from './OmnitrixLogo';

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await createUserData(cred.user.uid, email, name);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      const msg = err.code === 'auth/user-not-found' ? 'Usuário não encontrado'
        : err.code === 'auth/wrong-password' ? 'Senha incorreta'
        : err.code === 'auth/email-already-in-use' ? 'Email já cadastrado'
        : err.code === 'auth/invalid-credential' ? 'Email ou senha inválidos'
        : err.code === 'auth/weak-password' ? 'Senha deve ter pelo menos 6 caracteres'
        : 'Erro ao autenticar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-brand/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <OmnitrixLogo size="lg" animated />
          </div>
          <h1 className="text-2xl font-black font-display tracking-tight text-white">
            Ben<span className="text-brand">Bets</span>
          </h1>
          <p className="text-slate-400 text-[11px] font-mono mt-1 uppercase tracking-widest">
            Ambiente Demonstração • Lei 14.790/2023
          </p>
        </div>

        <form onSubmit={handleSubmit} className="omnitrix-panel rounded-2xl p-6 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />

          {/* Mode tabs */}
          <div className="grid grid-cols-2 gap-1.5 bg-[#06070d] p-1 rounded-xl border border-[#1b1e2e]">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-brand text-slate-950 shadow-[0_0_14px_rgba(0,255,135,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-brand text-slate-950 shadow-[0_0_14px_rgba(0,255,135,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl text-center">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5">Nome</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
                required
                className="w-full bg-[#06070d] border border-[#1b1e2e] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/60"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full bg-[#06070d] border border-[#1b1e2e] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/60"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="mín. 6 caracteres"
              required
              minLength={6}
              className="w-full bg-[#06070d] border border-[#1b1e2e] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/60"
            />
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border border-[#1b1e2e] bg-[#06070d] checked:bg-brand checked:border-brand accent-brand cursor-pointer"
              />
              Lembrar de mim
            </label>
            {mode === 'register' && (
              <span className="text-[10px] font-mono text-brand font-bold">+ R$ 20,00 bônus</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-[#00e074] text-slate-950 font-black py-3.5 rounded-xl text-sm uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 shadow-[0_0_18px_rgba(0,255,135,0.28)] hover:shadow-[0_0_26px_rgba(0,255,135,0.45)]"
          >
            {loading ? 'Autenticando...' : mode === 'login' ? 'Ativar Conta' : 'Criar Conta Grátis'}
          </button>

          <p className="text-center text-[11px] text-slate-500 pt-1">
            {mode === 'login' ? 'Ainda não tem conta?' : 'Já possui uma conta?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-brand hover:underline cursor-pointer font-bold"
            >
              {mode === 'login' ? 'Cadastre-se' : 'Fazer login'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
