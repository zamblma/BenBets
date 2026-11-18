import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Trophy, Crown, Medal, Search, Sparkles, Radio, Users, Flame, Gem, Target } from 'lucide-react';
import { ONLINE_WINDOW_MS, ACTIVE_24H_MS, type LeaderboardEntry } from '../firebase/db';

type RankingCategory = 'balance' | 'collector' | 'wins';
type ActivityFilter = 'all' | 'online' | '24h';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId: string;
  loading?: boolean;
}

function getOmnitrixTitle(rank: number, balance: number): { label: string; color: string } {
  if (rank === 1 || balance >= 1000) return { label: 'Portador Supremo', color: 'text-brand' };
  if (rank <= 3 || balance >= 250) return { label: 'Mestre Encanador', color: 'text-yellow-400' };
  if (rank <= 10 || balance >= 75) return { label: 'Guardião Galvaniano', color: 'text-cyan-400' };
  return { label: 'Agente de Campo', color: 'text-slate-300' };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'BB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatLastSeen(lastSeen: number, now: number): { text: string; isOnline: boolean; isRecent24h: boolean } {
  if (!lastSeen || lastSeen <= 0) {
    return { text: 'Offline', isOnline: false, isRecent24h: false };
  }
  const diff = Math.max(0, now - lastSeen);
  if (diff < ONLINE_WINDOW_MS) {
    return { text: 'Online agora', isOnline: true, isRecent24h: true };
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 60) {
    return { text: `Ativo há ${mins} min`, isOnline: false, isRecent24h: true };
  }
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) {
    return { text: `Ativo há ${hours}h`, isOnline: false, isRecent24h: true };
  }
  const days = Math.floor(diff / 86400000);
  return { text: `Ativo há ${days}d`, isOnline: false, isRecent24h: false };
}

function sortByCategory(list: LeaderboardEntry[], category: RankingCategory): LeaderboardEntry[] {
  return [...list].sort((a, b) => {
    if (category === 'balance') {
      if (b.balance !== a.balance) return b.balance - a.balance;
      return b.betsWon - a.betsWon;
    }
    if (category === 'collector') {
      if (b.totalCards !== a.totalCards) return b.totalCards - a.totalCards;
      return b.uniqueCards - a.uniqueCards;
    }
    if (b.betsWon !== a.betsWon) return b.betsWon - a.betsWon;
    return b.biggestWin - a.biggestWin;
  });
}

function formatScore(entry: LeaderboardEntry, category: RankingCategory): string {
  if (category === 'balance') {
    return `R$ ${entry.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (category === 'collector') {
    return `${entry.totalCards} itens`;
  }
  return `${entry.betsWon} vitória${entry.betsWon === 1 ? '' : 's'}`;
}

export default function Leaderboard({ entries, currentUserId, loading = false }: LeaderboardProps) {
  const [category, setCategory] = useState<RankingCategory>('balance');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [pulseLive, setPulseLive] = useState(false);

  // Refresh presence labels every 15s even without new Firestore snapshots
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Subtle visual pulse when realtime snapshot arrives
  useEffect(() => {
    setPulseLive(true);
    const t = setTimeout(() => setPulseLive(false), 900);
    return () => clearTimeout(t);
  }, [entries]);

  const counts = useMemo(() => {
    let online = 0;
    let active24h = 0;
    for (const e of entries) {
      if (e.lastSeen > 0) {
        const diff = Math.max(0, now - e.lastSeen);
        if (diff < ONLINE_WINDOW_MS) online++;
        if (diff < ACTIVE_24H_MS) active24h++;
      }
    }
    return { total: entries.length, online, active24h };
  }, [entries, now]);

  const activityFiltered = useMemo(() => {
    return entries.filter((e) => {
      if (activityFilter === 'all') return true;
      if (!e.lastSeen || e.lastSeen <= 0) return false;
      const diff = Math.max(0, now - e.lastSeen);
      if (activityFilter === 'online') return diff < ONLINE_WINDOW_MS;
      return diff < ACTIVE_24H_MS;
    });
  }, [entries, activityFilter, now]);

  const ranked = useMemo(() => sortByCategory(activityFiltered, category), [activityFiltered, category]);

  const globalRankedForUser = useMemo(() => sortByCategory(entries, category), [entries, category]);
  const myIndex = globalRankedForUser.findIndex((e) => e.uid === currentUserId);
  const myEntry = myIndex >= 0 ? globalRankedForUser[myIndex] : null;
  const aboveEntry = myIndex > 0 ? globalRankedForUser[myIndex - 1] : null;

  const displayedList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter((e) => e.displayName.toLowerCase().includes(q));
  }, [ranked, searchQuery]);

  const showPodium = searchQuery.trim() === '' && ranked.length >= 1;
  const top3 = showPodium ? ranked.slice(0, 3) : [];
  const restOfList = showPodium ? ranked.slice(3) : displayedList;

  const getGapText = () => {
    if (!myEntry) return '';
    if (myIndex === 0) return 'Você lidera o ranking!';
    if (!aboveEntry) return '';
    if (category === 'balance') {
      const diff = Math.max(0.01, aboveEntry.balance - myEntry.balance);
      return `Faltam R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para #${myIndex}`;
    }
    if (category === 'collector') {
      const diff = Math.max(1, aboveEntry.totalCards - myEntry.totalCards);
      return `Faltam ${diff} item${diff > 1 ? 'ns' : ''} para #${myIndex}`;
    }
    const diff = Math.max(1, aboveEntry.betsWon - myEntry.betsWon);
    return `Faltam ${diff} vitória${diff > 1 ? 's' : ''} para #${myIndex}`;
  };

  const myTitle = myEntry ? getOmnitrixTitle(myIndex + 1, myEntry.balance) : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header Panel */}
      <div className="omnitrix-panel relative overflow-hidden p-4 sm:p-5 rounded-2xl border-brand/25">
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,255,135,0.12),transparent_60%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-brand/15 p-2.5 sm:p-3 rounded-xl border border-brand/30 text-brand shadow-[0_0_16px_rgba(0,255,135,0.2)]">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold font-display text-white text-base sm:text-lg">
                  Ranking Omnitrix
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border transition-all ${
                    pulseLive
                      ? 'bg-brand text-slate-950 border-brand shadow-[0_0_12px_rgba(0,255,135,0.6)]'
                      : 'bg-brand/10 text-brand border-brand/30'
                  }`}
                >
                  <Radio className="w-3 h-3 animate-pulse" />
                  AO VIVO
                </span>
              </div>
              <p className="text-slate-400 text-[10px] sm:text-xs mt-0.5">
                Classificação sincronizada em tempo real via Firebase • {counts.online} online agora
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="bg-[#06070d] border border-[#1d2236] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-brand" />
              <span className="text-white font-bold">{counts.total}</span>
              <span className="text-slate-500 text-[10px]">agentes</span>
            </div>
          </div>
        </div>
      </div>

      {/* User Personal Rank Banner */}
      {myEntry && myTitle && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="omnitrix-card rounded-2xl p-3.5 sm:p-4 border-brand/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand/15 border border-brand/40 flex flex-col items-center justify-center shrink-0">
              <span className="text-[8px] font-mono uppercase text-brand/80 leading-none">Pos</span>
              <span className="text-base font-black font-mono text-brand leading-tight">#{myIndex + 1}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-extrabold text-white truncate">{myEntry.displayName}</span>
                <span className="text-[9px] font-mono font-bold bg-brand/15 text-brand border border-brand/30 px-1.5 py-0.5 rounded">
                  VOCÊ
                </span>
                <span className={`text-[10px] font-mono font-bold ${myTitle.color}`}>
                  • {myTitle.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-brand shrink-0" />
                {getGapText()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:text-right border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
            <div>
              <span className="block text-[9px] uppercase font-mono text-slate-500">Pontuação</span>
              <span className="text-sm sm:text-base font-black font-mono text-brand">
                {formatScore(myEntry, category)}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Category Switchers */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'balance' as const, label: 'Maior Saldo', icon: Flame, color: 'text-brand' },
          { id: 'collector' as const, label: 'Colecionadores', icon: Gem, color: 'text-purple-400' },
          { id: 'wins' as const, label: 'Mais Vitórias', icon: Target, color: 'text-amber-400' },
        ].map((cat) => {
          const Icon = cat.icon;
          const active = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`py-2.5 px-2 sm:px-3 rounded-xl text-[10px] sm:text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                active
                  ? 'bg-brand text-slate-950 border-brand font-extrabold shadow-[0_0_16px_rgba(0,255,135,0.28)]'
                  : 'bg-[#0a0c14] text-slate-300 border-[#1a1d2d] hover:border-brand/35'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-slate-950' : cat.color}`} />
              <span className="truncate">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Activity Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between bg-[#080a12] border border-[#1a1c2a] rounded-xl p-2.5">
        <div className="flex gap-1.5 flex-wrap">
          {[
            { id: 'all' as const, label: `Todos (${counts.total})` },
            { id: 'online' as const, label: `🟢 Online Agora (${counts.online})` },
            { id: '24h' as const, label: `⚡ Ativos 24h (${counts.active24h})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActivityFilter(f.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                activityFilter === f.id
                  ? 'bg-brand/15 border-brand/45 text-brand'
                  : 'bg-[#06070d] border-[#1a1d2d] text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-48">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar jogador..."
            className="w-full bg-[#06070d] border border-[#1a1d2d] rounded-lg text-xs text-slate-200 placeholder-slate-600 pl-8 pr-3 py-1.5 focus:outline-none focus:border-brand/45"
          />
        </div>
      </div>

      {loading ? (
        <div className="omnitrix-card rounded-2xl p-10 text-center">
          <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-mono text-slate-400">Sincronizando ranking ao vivo...</p>
        </div>
      ) : ranked.length === 0 ? (
        <div className="omnitrix-card rounded-2xl p-10 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">
            {activityFilter === 'online'
              ? 'Nenhum outro jogador online neste momento'
              : 'Nenhum jogador encontrado neste filtro'}
          </p>
          {activityFilter !== 'all' && (
            <button
              onClick={() => setActivityFilter('all')}
              className="text-xs font-bold text-brand hover:underline cursor-pointer"
            >
              Ver todos os jogadores ({counts.total})
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top 3 Podium */}
          {showPodium && top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {top3.map((entry, idx) => {
                const pos = idx + 1;
                const isMe = entry.uid === currentUserId;
                const status = formatLastSeen(entry.lastSeen, now);
                const podiumStyle =
                  pos === 1
                    ? 'border-brand/50 bg-gradient-to-b from-brand/15 via-[#0c101b] to-[#070910] shadow-[0_0_28px_rgba(0,255,135,0.16)] holo-foil sm:order-2'
                    : pos === 2
                    ? 'border-cyan-400/40 bg-gradient-to-b from-cyan-500/10 via-[#0c101b] to-[#070910] sm:order-1'
                    : 'border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-[#0c101b] to-[#070910] sm:order-3';

                const badgeColor =
                  pos === 1 ? 'text-brand' : pos === 2 ? 'text-cyan-300' : 'text-amber-400';

                return (
                  <motion.div
                    key={entry.uid}
                    layout="position"
                    className={`rounded-2xl border p-4 text-center relative overflow-hidden ${podiumStyle} ${
                      isMe ? 'ring-1 ring-brand/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-black font-mono flex items-center gap-1 ${badgeColor}`}>
                        {pos === 1 ? <Crown className="w-4 h-4" /> : <Medal className="w-4 h-4" />}
                        #{pos}
                      </span>
                      <span
                        className={`text-[9px] font-mono flex items-center gap-1 ${
                          status.isOnline ? 'text-brand font-bold' : 'text-slate-500'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            status.isOnline ? 'bg-brand animate-pulse' : 'bg-slate-600'
                          }`}
                        />
                        {status.text}
                      </span>
                    </div>

                    <div className="w-12 h-12 rounded-2xl mx-auto mb-2 bg-[#06070d] border border-white/10 flex items-center justify-center font-black font-display text-sm text-white relative">
                      {getInitials(entry.displayName)}
                      {isMe && (
                        <span className="absolute -bottom-1.5 bg-brand text-slate-950 text-[7px] font-black px-1.5 rounded-full">
                          VOCÊ
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-extrabold text-white truncate">{entry.displayName}</h4>
                    <p className={`text-base font-black font-mono mt-1 ${badgeColor}`}>
                      {formatScore(entry, category)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">
                      {entry.uniqueCards} únicas • {entry.betsWon}W/{entry.totalBets}J
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Remaining Ranked List */}
          {restOfList.length > 0 && (
            <div className="space-y-2">
              {restOfList.map((entry) => {
                const pos = ranked.findIndex((r) => r.uid === entry.uid) + 1;
                const isMe = entry.uid === currentUserId;
                const status = formatLastSeen(entry.lastSeen, now);

                return (
                  <motion.div
                    key={entry.uid}
                    layout="position"
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      isMe
                        ? 'bg-brand/10 border-brand/45 shadow-[0_0_18px_rgba(0,255,135,0.12)]'
                        : 'bg-[#090b13] border-[#1a1d2e] hover:border-brand/25'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 text-center font-mono font-black text-xs shrink-0 ${
                          pos <= 3 ? 'text-brand' : 'text-slate-400'
                        }`}
                      >
                        #{pos}
                      </span>

                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-[#06070d] border border-[#1f2438] flex items-center justify-center text-xs font-bold text-slate-200">
                          {getInitials(entry.displayName)}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#090b13] ${
                            status.isOnline ? 'bg-brand animate-pulse' : status.isRecent24h ? 'bg-amber-400' : 'bg-slate-600'
                          }`}
                          title={status.text}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-white truncate">
                            {entry.displayName}
                          </span>
                          {isMe && (
                            <span className="text-[8px] font-mono font-black bg-brand text-slate-950 px-1.5 py-0.2 rounded">
                              VOCÊ
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          <span className={status.isOnline ? 'text-brand' : ''}>{status.text}</span>
                          <span>•</span>
                          <span>{entry.totalCards} cartas</span>
                          <span>•</span>
                          <span>{entry.betsWon} vitórias</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-black font-mono text-brand">
                        {formatScore(entry, category)}
                      </span>
                      {category !== 'balance' && (
                        <span className="block text-[9px] font-mono text-slate-500">
                          R$ {entry.balance.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
