import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, Users, DollarSign, Settings, ArrowLeft } from 'lucide-react';
import { getAllUsers, adminSetBalance } from '../firebase/db';

interface AdminPanelProps {
  onBack: () => void;
}

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  balance: number;
  createdAt: string;
}

const SPORTS = [
  { id: 'futebol', label: 'Futebol' },
  { id: 'basquete', label: 'Basquete' },
  { id: 'tenis', label: 'Tênis' },
  { id: 'esports', label: 'E-Sports' },
];

const defaultOdds = { home: '1.50', draw: '3.50', away: '2.80' };

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [activeTab, setActiveTab] = useState<'usuarios' | 'odds'>('usuarios');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [odds, setOdds] = useState<Record<string, { home: string; draw: string; away: string }>>(() => {
    const saved = localStorage.getItem('adminOdds');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return Object.fromEntries(SPORTS.map(s => [s.id, { ...defaultOdds }]));
  });

  useEffect(() => {
    if (!authenticated) return;
    setLoadingUsers(true);
    getAllUsers().then(data => {
      setUsers(data as UserData[]);
      const inputs: Record<string, string> = {};
      for (const u of data) {
        inputs[u.uid] = (u as UserData).balance?.toString() || '0';
      }
      setBalanceInputs(inputs);
    }).finally(() => setLoadingUsers(false));
  }, [authenticated]);

  const handleLogin = () => {
    if (password === 'admin123') {
      setAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Senha incorreta');
    }
  };

  const handleSetBalance = async (uid: string) => {
    const val = parseFloat(balanceInputs[uid]);
    if (isNaN(val)) return;
    await adminSetBalance(uid, val);
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, balance: val } : u));
  };

  const handleOddsChange = (sportId: string, field: 'home' | 'draw' | 'away', value: string) => {
    setOdds(prev => ({
      ...prev,
      [sportId]: { ...prev[sportId], [field]: value },
    }));
  };

  const handleSaveOdds = () => {
    localStorage.setItem('adminOdds', JSON.stringify(odds));
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#06070d] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-[#0a0b12] border border-[#1b1e2e] rounded-2xl p-8"
        >
          <div className="flex justify-center mb-6">
            <div className="bg-brand/10 p-3 rounded-xl">
              <Shield className="w-8 h-8 text-brand" />
            </div>
          </div>
          <h2 className="text-lg font-extrabold text-white text-center mb-1">Painel Admin</h2>
          <p className="text-xs text-slate-400 text-center mb-6">Insira a senha para acessar</p>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Senha"
            className="w-full bg-[#07080f] border border-[#1b1e2e] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/50 mb-3"
            autoFocus
          />
          {passwordError && (
            <p className="text-rose-400 text-xs mb-3 text-center">{passwordError}</p>
          )}
          <button
            onClick={handleLogin}
            className="w-full bg-brand hover:bg-[#00e074] text-slate-950 font-black py-3 rounded-xl text-sm transition-all cursor-pointer shadow-[0_0_12px_rgba(0,255,135,0.2)]"
          >
            Acessar
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06070d] px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="bg-[#0d0e16] border border-[#1b1e2e] p-2 rounded-xl hover:bg-[#151826] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-white">Painel Admin</h1>
              <p className="text-[10px] text-slate-500">Gerenciamento do sistema</p>
            </div>
          </div>
          <Shield className="w-5 h-5 text-brand" />
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-1.5">
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === 'usuarios'
                ? 'bg-[#151724] text-brand border border-[#23273e] shadow-[0_0_12px_rgba(0,255,135,0.08)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Usuários
          </button>
          <button
            onClick={() => setActiveTab('odds')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === 'odds'
                ? 'bg-[#151724] text-brand border border-[#23273e] shadow-[0_0_12px_rgba(0,255,135,0.08)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Odds dos Esportes
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'usuarios' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-200">
                Usuários {!loadingUsers && <span className="text-slate-500 font-mono">({users.length})</span>}
              </h2>
              {loadingUsers && (
                <span className="text-[10px] text-slate-500 animate-pulse">Carregando...</span>
              )}
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {users.map((user, idx) => (
                <motion.div
                  key={user.uid}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">
                        {user.displayName || 'Sem nome'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <p className="text-[10px] text-slate-600 mt-1">
                        Criado em: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider">Saldo</p>
                        <p className="text-sm font-bold text-brand">
                          R$ {(user.balance ?? 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1b1e2e]">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">R$</span>
                      <input
                        type="number"
                        value={balanceInputs[user.uid] ?? ''}
                        onChange={e => setBalanceInputs(prev => ({ ...prev, [user.uid]: e.target.value }))}
                        className="w-full bg-[#07080f] border border-[#1b1e2e] rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand/50"
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      onClick={() => handleSetBalance(user.uid)}
                      className="bg-brand/10 border border-brand/30 text-brand hover:bg-brand/20 text-[10px] font-bold px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                    >
                      <DollarSign className="w-3 h-3 inline mr-1" />
                      Atualizar
                    </button>
                  </div>
                </motion.div>
              ))}
              {!loadingUsers && users.length === 0 && (
                <div className="bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-8 text-center">
                  <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Nenhum usuário encontrado</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Odds Tab */}
        {activeTab === 'odds' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <p className="text-[11px] text-slate-400">
              Edite as odds padrão para cada esporte. Os valores serão usados como base para novas partidas.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SPORTS.map((sport, idx) => (
                <motion.div
                  key={sport.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-4"
                >
                  <h3 className="text-sm font-bold text-white mb-3">{sport.label}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(['home', 'draw', 'away'] as const).map(field => (
                      <div key={field}>
                        <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                          {field === 'home' ? 'Casa' : field === 'draw' ? 'Empate' : 'Fora'}
                        </label>
                        <input
                          type="text"
                          value={odds[sport.id]?.[field] ?? ''}
                          onChange={e => handleOddsChange(sport.id, field, e.target.value)}
                          className="w-full bg-[#07080f] border border-[#1b1e2e] rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand/50"
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSaveOdds}
              className="w-full bg-brand hover:bg-[#00e074] text-slate-950 font-black py-3.5 rounded-xl text-sm transition-all cursor-pointer shadow-[0_0_15px_rgba(0,255,135,0.15)]"
            >
              Salvar Odds
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
