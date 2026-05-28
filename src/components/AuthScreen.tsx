import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../firebase/config';
import { createUserData } from '../firebase/db';

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
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-tr from-brand to-emerald-400 text-slate-950 w-14 h-14 mx-auto rounded-2xl font-black text-xl flex items-center justify-center rotate-2 shadow-[0_0_20px_rgba(0,255,135,0.3)] mb-4">
            BB
          </div>
          <h1 className="text-2xl font-extrabold text-brand">BenBets</h1>
          <p className="text-slate-400 text-xs mt-1">Ambiente Demonstração Legal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0c0d14] border border-[#1c1e2d] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 text-center uppercase tracking-wider">
            {mode === 'login' ? 'Entrar' : 'Criar Conta'}
          </h2>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl text-center">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
                required
                className="w-full bg-[#07080f] border border-[#1b1e2e] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/50"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full bg-[#07080f] border border-[#1b1e2e] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/50"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="mín. 6 caracteres"
              required
              minLength={6}
              className="w-full bg-[#07080f] border border-[#1b1e2e] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-[#00e074] text-slate-950 font-black py-3 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50 shadow-[0_0_12px_rgba(0,255,135,0.2)]"
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
          </button>

          <p className="text-center text-[11px] text-slate-500">
            {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border border-[#1b1e2e] bg-[#07080f] checked:bg-brand checked:border-brand accent-brand cursor-pointer"
              />
              Lembrar de mim
            </label>

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
