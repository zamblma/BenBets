import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Shield,
  Users,
  DollarSign,
  Settings,
  ArrowLeft,
  Search,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Wallet,
  Radio,
  Sparkles,
  ExternalLink,
  Save,
} from 'lucide-react';
import {
  subscribeToAllUsers,
  adminSetBalance,
  adminUpdateUserProfile,
  adminResetUser,
  ONLINE_WINDOW_MS,
  type AdminUserRecord,
  type LeaderboardEntry,
} from '../firebase/db';

interface AdminPanelProps {
  onBack: () => void;
  currentUser?: { uid: string; email: string | null; displayName: string | null } | null;
  currentBalance?: number;
  currentUserName?: string;
  fallbackLeaderboard?: LeaderboardEntry[];
  onSyncCurrentUserBalance?: (newBalance: number) => void;
}

type StatusFilter = 'all' | 'online' | 'offline';
type SortOption = 'balance' | 'recent' | 'bets' | 'name';

const SPORTS = [
  { id: 'futebol', label: 'Futebol' },
  { id: 'basquete', label: 'Basquete' },
  { id: 'tenis', label: 'Tênis' },
  { id: 'esports', label: 'E-Sports' },
];

const defaultOdds = { home: '1.50', draw: '3.50', away: '2.80' };

const FIRESTORE_ADMIN_RULE = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
  }
}`;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'BB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatPresence(lastSeen: number, now: number): { text: string; isOnline: boolean } {
  if (!lastSeen || lastSeen <= 0) return { text: 'Offline', isOnline: false };
  const diff = Math.max(0, now - lastSeen);
  if (diff < ONLINE_WINDOW_MS) return { text: 'Online agora', isOnline: true };
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return { text: `Ativo há ${mins}m`, isOnline: false };
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return { text: `Ativo há ${hours}h`, isOnline: false };
  const days = Math.floor(diff / 86400000);
  return { text: `Ativo há ${days}d`, isOnline: false };
}

function countCollectionTotal(items: any[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (typeof item?.quantity === 'number' && item.quantity > 0 ? item.quantity : 1), 0);
}

export default function AdminPanel({
  onBack,
  currentUser,
  currentBalance = 20,
  currentUserName,
  fallbackLeaderboard = [],
  onSyncCurrentUserBalance,
}: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [activeTab, setActiveTab] = useState<'usuarios' | 'odds'>('usuarios');

  const [firestoreUsers, setFirestoreUsers] = useState<AdminUserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('balance');
  const [now, setNow] = useState(() => Date.now());

  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [nameInputs, setNameInputs] = useState<Record<string, string>>({});
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [copiedRule, setCopiedRule] = useState(false);
  const [confirmWipeUid, setConfirmWipeUid] = useState<string | null>(null);

  const [odds, setOdds] = useState<Record<string, { home: string; draw: string; away: string }>>(() => {
    const saved = localStorage.getItem('adminOdds');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    return Object.fromEntries(SPORTS.map((s) => [s.id, { ...defaultOdds }]));
  });
  const [oddsSavedMsg, setOddsSavedMsg] = useState(false);

  // Periodic clock refresh for presence badges
  useEffect(() => {
    if (!authenticated) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [authenticated]);

  // Realtime Firestore users subscription
  useEffect(() => {
    if (!authenticated) return;
    setLoadingUsers(true);
    setFirestoreError(null);

    const unsub = subscribeToAllUsers(
      (records) => {
        setFirestoreUsers(records);
        setFirestoreError(null);
        setLoadingUsers(false);
        setBalanceInputs((prev) => {
          const next = { ...prev };
          for (const u of records) {
            if (next[u.uid] === undefined) {
              next[u.uid] = u.balance.toString();
            }
          }
          return next;
        });
        setNameInputs((prev) => {
          const next = { ...prev };
          for (const u of records) {
            if (next[u.uid] === undefined) {
              next[u.uid] = u.displayName;
            }
          }
          return next;
        });
      },
      (err: any) => {
        setLoadingUsers(false);
        setFirestoreError(err?.code === 'permission-denied' ? 'permission-denied' : err?.message || 'error');
      }
    );

    return () => unsub();
  }, [authenticated, retryNonce]);

  // Merge Firestore live records with fallbackLeaderboard and currentUser so list is always resilient
  const users = useMemo<AdminUserRecord[]>(() => {
    const map = new Map<string, AdminUserRecord>();
    for (const u of firestoreUsers) {
      map.set(u.uid, u);
    }

    for (const lb of fallbackLeaderboard) {
      if (!map.has(lb.uid)) {
        map.set(lb.uid, {
          uid: lb.uid,
          email: '',
          displayName: lb.displayName,
          balance: Number.isFinite(lb.balance) && lb.balance >= 0 ? lb.balance : 20,
          rawBalanceWasInvalid: false,
          createdAt: lb.createdAt,
          lastSeen: lb.lastSeen || 0,
          placedBets: [],
          transactions: [],
          pokemonCollection: [],
          worldCupCollection: [],
          kpopCollection: [],
          cs2Collection: [],
          animeCollection: [],
          genshinCollection: [],
          valorantCollection: [],
          totalCards: lb.totalCards || 0,
          uniqueCards: lb.uniqueCards || 0,
          betsWon: lb.betsWon || 0,
          biggestWin: lb.biggestWin || 0,
        });
      }
    }

    if (currentUser && !map.has(currentUser.uid)) {
      const fallbackName =
        currentUserName ||
        currentUser.displayName ||
        (currentUser.email ? currentUser.email.split('@')[0] : 'Agente');
      const safeBal = Number.isFinite(currentBalance) && currentBalance >= 0 ? currentBalance : 20;
      map.set(currentUser.uid, {
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName: fallbackName,
        balance: safeBal,
        rawBalanceWasInvalid: false,
        lastSeen: Date.now(),
        placedBets: [],
        transactions: [],
        pokemonCollection: [],
        worldCupCollection: [],
        kpopCollection: [],
        cs2Collection: [],
        animeCollection: [],
        genshinCollection: [],
        valorantCollection: [],
        totalCards: 0,
        uniqueCards: 0,
        betsWon: 0,
        biggestWin: 0,
      });
    }

    return Array.from(map.values());
  }, [firestoreUsers, fallbackLeaderboard, currentUser, currentUserName, currentBalance]);

  const summary = useMemo(() => {
    let onlineCount = 0;
    let totalBalance = 0;
    let totalBets = 0;
    let totalCards = 0;
    for (const u of users) {
      if (u.lastSeen > 0 && now - u.lastSeen < ONLINE_WINDOW_MS) onlineCount++;
      totalBalance += Number.isFinite(u.balance) ? u.balance : 0;
      totalBets += u.placedBets.length;
      totalCards += u.totalCards;
    }
    return { total: users.length, onlineCount, totalBalance, totalBets, totalCards };
  }, [users, now]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = users.filter((u) => {
      const online = u.lastSeen > 0 && now - u.lastSeen < ONLINE_WINDOW_MS;
      if (statusFilter === 'online' && !online) return false;
      if (statusFilter === 'offline' && online) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      if (sortBy === 'balance') return b.balance - a.balance;
      if (sortBy === 'bets') return b.placedBets.length - a.placedBets.length;
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName, 'pt-BR');
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [users, searchQuery, statusFilter, sortBy, now]);

  const showToastForUser = (uid: string, msg: string) => {
    setActionFeedback((prev) => ({ ...prev, [uid]: msg }));
    setTimeout(() => {
      setActionFeedback((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    }, 3000);
  };

  const handleLogin = () => {
    if (password === 'admin123') {
      setAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Senha incorreta');
    }
  };

  const applyNewBalance = async (uid: string, newBalance: number, feedbackLabel = 'Saldo atualizado!') => {
    if (!Number.isFinite(newBalance) || newBalance < 0) return;
    const cleanVal = Number(newBalance.toFixed(2));
    try {
      await adminSetBalance(uid, cleanVal);
      setBalanceInputs((prev) => ({ ...prev, [uid]: cleanVal.toString() }));
      setFirestoreUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, balance: cleanVal } : u)));
      if (currentUser && uid === currentUser.uid && onSyncCurrentUserBalance) {
        onSyncCurrentUserBalance(cleanVal);
      }
      showToastForUser(uid, feedbackLabel);
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        setFirestoreError('permission-denied');
        showToastForUser(uid, 'Erro: Regra do Firestore bloqueou escrita');
      } else {
        showToastForUser(uid, 'Erro ao atualizar saldo');
      }
    }
  };

  const handleSetBalance = async (uid: string, currentVal: number) => {
    const raw = balanceInputs[uid] !== undefined ? balanceInputs[uid] : currentVal.toString();
    const val = parseFloat(raw);
    if (!Number.isFinite(val) || val < 0) return;
    await applyNewBalance(uid, val);
  };

  const handleSaveName = async (uid: string, currentName: string) => {
    const draft = (nameInputs[uid] ?? currentName).trim();
    if (!draft) return;
    try {
      await adminUpdateUserProfile(uid, { displayName: draft });
      setFirestoreUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, displayName: draft } : u)));
      showToastForUser(uid, 'Nome atualizado!');
    } catch (err: any) {
      showToastForUser(uid, err?.code === 'permission-denied' ? 'Erro: permissão negada no Firestore' : 'Erro ao salvar nome');
    }
  };

  const handleResetUser = async (uid: string, clearCollections: boolean) => {
    try {
      await adminResetUser(uid, clearCollections);
      setBalanceInputs((prev) => ({ ...prev, [uid]: '20' }));
      setConfirmWipeUid(null);
      if (currentUser && uid === currentUser.uid && onSyncCurrentUserBalance) {
        onSyncCurrentUserBalance(20);
      }
      showToastForUser(uid, clearCollections ? 'Conta e coleções resetadas!' : 'Saldo restaurado para R$ 20!');
    } catch (err: any) {
      showToastForUser(uid, err?.code === 'permission-denied' ? 'Erro: permissão negada no Firestore' : 'Erro ao resetar conta');
    }
  };

  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid((cur) => (cur === uid ? null : cur)), 2000);
  };

  const handleCopyRule = () => {
    navigator.clipboard.writeText(FIRESTORE_ADMIN_RULE);
    setCopiedRule(true);
    setTimeout(() => setCopiedRule(false), 3000);
  };

  const handleOddsChange = (sportId: string, field: 'home' | 'draw' | 'away', value: string) => {
    setOdds((prev) => ({
      ...prev,
      [sportId]: { ...prev[sportId], [field]: value },
    }));
  };

  const handleSaveOdds = () => {
    localStorage.setItem('adminOdds', JSON.stringify(odds));
    setOddsSavedMsg(true);
    setTimeout(() => setOddsSavedMsg(false), 2500);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#06070d] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-[#0a0b12] border border-[#1b1e2e] rounded-2xl p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={onBack}
              className="text-xs text-slate-400 hover:text-brand flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </button>
          </div>
          <div className="flex justify-center mb-5">
            <div className="bg-brand/10 border border-brand/25 p-3 rounded-xl">
              <Shield className="w-8 h-8 text-brand" />
            </div>
          </div>
          <h2 className="text-lg font-extrabold text-white text-center mb-1">Painel Admin</h2>
          <p className="text-xs text-slate-400 text-center mb-6">Insira a senha para acessar o Firebase</p>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Senha"
            className="w-full bg-[#07080f] border border-[#1b1e2e] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/50 mb-3"
            autoFocus
          />
          {passwordError && <p className="text-rose-400 text-xs mb-3 text-center">{passwordError}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-brand hover:bg-[#00e074] text-slate-950 font-black py-3 rounded-xl text-sm transition-all cursor-pointer shadow-[0_0_12px_rgba(0,255,135,0.2)]"
          >
            Acessar Painel
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06070d] px-3 sm:px-4 py-5 sm:py-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="bg-[#0d0e16] border border-[#1b1e2e] p-2 rounded-xl hover:bg-[#151826] transition-colors cursor-pointer"
              title="Voltar para o site"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                Painel Admin Firebase
                <span className="inline-flex items-center gap-1 text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> TEMPO REAL
                </span>
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500">
                Gerenciamento completo de contas, saldos, apostas e coleções do Firebase
              </p>
            </div>
          </div>
          <button
            onClick={() => setRetryNonce((n) => n + 1)}
            className="bg-[#0d0e16] border border-[#1b1e2e] hover:border-brand/40 text-slate-300 hover:text-brand px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin text-brand' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-1.5">
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === 'usuarios'
                ? 'bg-[#151724] text-brand border border-[#23273e] shadow-[0_0_12px_rgba(0,255,135,0.08)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Usuários do Firebase ({users.length})
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Permission Warning Banner */}
            {firestoreError === 'permission-denied' && (
              <div className="bg-amber-500/10 border border-amber-500/35 rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h3 className="font-bold text-amber-200 text-sm">
                        Permissão do Firestore restrita no Firebase Console
                      </h3>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Para listar e editar todos os usuários do Firebase diretamente pelo Painel Admin, atualize a regra da coleção <code className="bg-black/40 px-1 rounded text-amber-300">users</code> para permitir leitura e escrita autenticadas.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href="https://console.firebase.google.com/project/benbets-bbd49/firestore/rules"
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-[#0a0c14] border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-500/10"
                    >
                      Abrir Firebase <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => setRetryNonce((n) => n + 1)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black cursor-pointer hover:bg-amber-400"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                </div>
                <div className="relative bg-[#06070d] border border-amber-500/25 rounded-xl p-3 font-mono text-[11px] text-amber-200">
                  <pre className="overflow-x-auto select-all">{FIRESTORE_ADMIN_RULE}</pre>
                  <button
                    type="button"
                    onClick={handleCopyRule}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-amber-500 text-slate-950 font-sans font-bold text-[10px] rounded-lg hover:bg-amber-400 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedRule ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedRule ? 'Copiado!' : 'Copiar Regra'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Overview KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                  <Users className="w-3 h-3 text-brand" /> Contas no Banco
                </div>
                <div className="text-lg font-black font-mono text-white mt-1">{summary.total}</div>
              </div>
              <div className="bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                  <Radio className="w-3 h-3 text-brand" /> Online Agora
                </div>
                <div className="text-lg font-black font-mono text-brand mt-1">{summary.onlineCount}</div>
              </div>
              <div className="bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-amber-400" /> Saldo Total
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-amber-300 mt-1 truncate">
                  R$ {summary.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" /> Apostas / Cartas
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-purple-300 mt-1">
                  {summary.totalBets} <span className="text-slate-600">/</span> {summary.totalCards}
                </div>
              </div>
            </div>

            {/* Search, Filter & Sort Toolbar */}
            <div className="bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-3 flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, e-mail ou UID do Firebase..."
                  className="w-full bg-[#06070d] border border-[#1b1e2e] rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/50"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all' as const, label: `Todos (${users.length})` },
                  { id: 'online' as const, label: `🟢 Online (${summary.onlineCount})` },
                  { id: 'offline' as const, label: `💤 Offline (${users.length - summary.onlineCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                      statusFilter === f.id
                        ? 'bg-brand/15 border-brand/50 text-brand'
                        : 'bg-[#06070d] border-[#1b1e2e] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-[#06070d] border border-[#1b1e2e] rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none focus:border-brand/50 cursor-pointer"
                >
                  <option value="balance">Maior Saldo</option>
                  <option value="recent">Mais Recentes</option>
                  <option value="bets">Mais Apostas</option>
                  <option value="name">Nome (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Users List */}
            <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-1">
              {filteredUsers.map((user) => {
                const presence = formatPresence(user.lastSeen, now);
                const isSelf = currentUser?.uid === user.uid;
                const isExpanded = expandedUid === user.uid;
                const currentInput = balanceInputs[user.uid] ?? user.balance.toString();
                const toastMsg = actionFeedback[user.uid];

                return (
                  <div
                    key={user.uid}
                    className={`bg-[#0a0b12] border rounded-2xl p-4 space-y-3 transition-colors ${
                      isSelf ? 'border-brand/40 shadow-[0_0_20px_rgba(0,255,135,0.08)]' : 'border-[#1b1e2e]'
                    }`}
                  >
                    {/* User Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-xl bg-[#06070d] border border-[#22273c] flex items-center justify-center font-black font-display text-sm text-white">
                            {getInitials(user.displayName)}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0b12] ${
                              presence.isOnline ? 'bg-brand animate-pulse' : 'bg-slate-600'
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-extrabold text-white truncate">{user.displayName}</p>
                            {isSelf && (
                              <span className="text-[8px] font-mono font-black bg-brand text-slate-950 px-1.5 py-0.5 rounded">
                                VOCÊ
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                                presence.isOnline
                                  ? 'bg-brand/10 border-brand/30 text-brand font-bold'
                                  : 'bg-[#06070d] border-[#1c2032] text-slate-400'
                              }`}
                            >
                              {presence.text}
                            </span>
                            {user.rawBalanceWasInvalid && (
                              <span className="text-[9px] font-mono bg-amber-500/15 border border-amber-500/35 text-amber-300 px-1.5 py-0.5 rounded">
                                Reparado de NaN
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {user.email || 'E-mail não registrado no documento'}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-[10px] text-slate-500 font-mono">
                            <button
                              type="button"
                              onClick={() => handleCopyUid(user.uid)}
                              className="inline-flex items-center gap-1 bg-[#06070d] border border-[#1b1e2e] hover:border-brand/40 px-1.5 py-0.5 rounded text-slate-400 hover:text-brand cursor-pointer transition-colors"
                              title="Copiar UID do Firebase"
                            >
                              <span>UID: {user.uid.slice(0, 10)}...</span>
                              {copiedUid === user.uid ? (
                                <Check className="w-2.5 h-2.5 text-brand" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                            <span>•</span>
                            <span>
                              Criado: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                        <div className="sm:text-right">
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">Saldo Atual</p>
                          <p className="text-base font-black font-mono text-brand">
                            R$ {user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                          <span>{user.betsWon}W/{user.placedBets.length}J</span>
                          <span>•</span>
                          <span>{user.totalCards} itens</span>
                          <span>•</span>
                          <span>{user.transactions.length} tx</span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Control Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-3 border-t border-[#1b1e2e]">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentInput}
                            onChange={(e) => setBalanceInputs((prev) => ({ ...prev, [user.uid]: e.target.value }))}
                            className="w-full bg-[#07080f] border border-[#1b1e2e] rounded-lg pl-8 pr-3 py-2 text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-brand/50"
                            placeholder="0.00"
                          />
                        </div>
                        <button
                          onClick={() => handleSetBalance(user.uid, user.balance)}
                          className="bg-brand/15 border border-brand/40 text-brand hover:bg-brand hover:text-slate-950 text-[10px] font-black px-3.5 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                        >
                          <DollarSign className="w-3 h-3 inline mr-0.5" />
                          Atualizar
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                          { label: '+20', delta: 20 },
                          { label: '+100', delta: 100 },
                          { label: '+500', delta: 500 },
                        ].map((btn) => (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={() => applyNewBalance(user.uid, user.balance + btn.delta, `Adicionado R$ ${btn.delta}!`)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#07080f] border border-[#1e2336] hover:border-brand/45 text-[10px] font-mono font-bold text-emerald-300 cursor-pointer transition-colors"
                          >
                            {btn.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => applyNewBalance(user.uid, 20, 'Definido para R$ 20,00!')}
                          className="px-2.5 py-1.5 rounded-lg bg-[#07080f] border border-[#1e2336] hover:border-amber-400/50 text-[10px] font-mono font-bold text-amber-300 cursor-pointer transition-colors"
                        >
                          R$ 20
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedUid(isExpanded ? null : user.uid);
                            setConfirmWipeUid(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#111524] border border-[#232942] hover:border-brand/40 text-[10px] font-bold text-slate-200 cursor-pointer flex items-center gap-1 ml-auto sm:ml-0"
                        >
                          <span>Detalhes</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {toastMsg && (
                      <div className="text-[11px] font-mono font-bold text-brand bg-brand/10 border border-brand/25 px-3 py-1.5 rounded-lg">
                        ✓ {toastMsg}
                      </div>
                    )}

                    {/* Expandable Account Inspector Drawer */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-[#1b1e2e] space-y-3 bg-[#06070d]/80 rounded-xl p-3">
                        {/* Edit Name */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <label className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
                            Nome do Jogador:
                          </label>
                          <div className="flex gap-2 flex-1">
                            <input
                              type="text"
                              value={nameInputs[user.uid] ?? user.displayName}
                              onChange={(e) => setNameInputs((prev) => ({ ...prev, [user.uid]: e.target.value }))}
                              className="flex-1 bg-[#0a0c14] border border-[#1d2134] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand/50"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveName(user.uid, user.displayName)}
                              className="px-3 py-1.5 rounded-lg bg-brand/15 border border-brand/35 text-brand text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-brand hover:text-slate-950 transition-colors"
                            >
                              <Save className="w-3 h-3" /> Salvar Nome
                            </button>
                          </div>
                        </div>

                        {/* Collections Summary */}
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                            Inventário de Coleções ({user.totalCards} itens • {user.uniqueCards} únicos)
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px] font-mono">
                            {[
                              { label: '🃏 Pokémon', val: countCollectionTotal(user.pokemonCollection) },
                              { label: '🌍 Copa', val: countCollectionTotal(user.worldCupCollection) },
                              { label: '🎤 K-pop', val: countCollectionTotal(user.kpopCollection) },
                              { label: '🔫 CS2', val: countCollectionTotal(user.cs2Collection) },
                              { label: '⭐ Anime', val: countCollectionTotal(user.animeCollection) },
                            ].map((col) => (
                              <div key={col.label} className="bg-[#0a0c14] border border-[#1a1d2d] rounded-lg px-2 py-1.5 flex justify-between">
                                <span className="text-slate-400">{col.label}</span>
                                <span className="text-white font-bold">{col.val}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recent Bets */}
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                            Últimas Apostas ({user.placedBets.length})
                          </div>
                          {user.placedBets.length === 0 ? (
                            <p className="text-[10px] text-slate-500 font-mono">Nenhuma aposta registrada nesta conta.</p>
                          ) : (
                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                              {user.placedBets.slice(0, 6).map((b, i) => (
                                <div
                                  key={b.id || i}
                                  className="bg-[#0a0c14] border border-[#1a1d2d] rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-[10px] font-mono"
                                >
                                  <div className="min-w-0 truncate">
                                    <span className="text-white font-bold">{b.matchName}</span>
                                    <span className="text-slate-500 ml-1.5">• {b.selectionName}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-slate-400">R$ {(Number.isFinite(b.stake) ? b.stake : 0).toFixed(2)}</span>
                                    <span
                                      className={`font-bold ${
                                        b.status === 'won'
                                          ? 'text-brand'
                                          : b.status === 'lost'
                                          ? 'text-rose-400'
                                          : 'text-amber-300'
                                      }`}
                                    >
                                      {b.status === 'won'
                                        ? `+R$ ${(Number.isFinite(b.potentialPayout) ? b.potentialPayout : 0).toFixed(2)}`
                                        : b.status === 'lost'
                                        ? 'PERDEU'
                                        : 'PENDENTE'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Danger / Reset Controls */}
                        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-white/5">
                          <span className="text-[10px] text-slate-500">
                            Ações administrativas rápidas na conta:
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleResetUser(user.uid, false)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/35 text-amber-300 hover:bg-amber-500/20 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" /> Resetar Saldo/Apostas
                            </button>

                            {confirmWipeUid === user.uid ? (
                              <button
                                type="button"
                                onClick={() => handleResetUser(user.uid, true)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer animate-pulse"
                              >
                                Confirmar Reset Total (Limpa Coleções)
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmWipeUid(user.uid)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/35 text-rose-300 hover:bg-rose-500/20 text-[10px] font-bold cursor-pointer"
                              >
                                Zerar Tudo + Coleções
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {!loadingUsers && filteredUsers.length === 0 && (
                <div className="bg-[#0a0b12] border border-[#1b1e2e] rounded-xl p-8 text-center">
                  <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Nenhum usuário encontrado com os filtros atuais</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Odds Tab */}
        {activeTab === 'odds' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
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
                    {(['home', 'draw', 'away'] as const).map((field) => (
                      <div key={field}>
                        <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                          {field === 'home' ? 'Casa' : field === 'draw' ? 'Empate' : 'Fora'}
                        </label>
                        <input
                          type="text"
                          value={odds[sport.id]?.[field] ?? ''}
                          onChange={(e) => handleOddsChange(sport.id, field, e.target.value)}
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
              {oddsSavedMsg ? '✓ Odds Salvas com Sucesso!' : 'Salvar Odds'}
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
