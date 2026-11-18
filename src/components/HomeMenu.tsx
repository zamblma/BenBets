import React from 'react';
import { motion } from 'motion/react';
import { Flame, Star, Dribbble, Sparkles, ShieldCheck, Zap, TrendingUp, Gamepad2, Cpu, Trophy } from 'lucide-react';
import OmnitrixLogo from './OmnitrixLogo';
import { ONLINE_WINDOW_MS, type LeaderboardEntry } from '../firebase/db';

interface HomeMenuProps {
  onSelect: (section: string) => void;
  leaderboard?: LeaderboardEntry[];
  currentUserId?: string;
}

const sections = [
  {
    id: 'Cassino',
    title: 'Jogos de Cassino',
    desc: 'Slots, Aviator, Blackjack, Roleta e Dados — todos com RNG auditado.',
    icon: Flame,
    accent: 'rgba(0,255,135,0.42)',
    glow: 'rgba(0,255,135,0.18)',
    iconBg: 'bg-brand/10 text-brand border border-brand/25',
    games: ['🎰 Slots', '📈 Aviator', '🃏 Blackjack', '🎡 Roleta', '🎲 Dados'],
    tag: 'Ativar Jogos',
    tagColor: 'text-brand',
    code: 'MOD-01',
  },
  {
    id: 'Colecionaveis',
    title: 'Colecionáveis & Gacha',
    desc: 'Abra pacotes e colecione personagens, cartas, skins e figurinhas com artes reais.',
    icon: Star,
    accent: 'rgba(234,179,8,0.42)',
    glow: 'rgba(234,179,8,0.16)',
    iconBg: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25',
    games: ['⭐ Anime', '🃏 Pokémon', '🔫 CS2', '🎤 K-pop', '🌍 Copa', '⚔️ LoL', '🗡️ Santuário Akali'],
    tag: 'Abrir Cápsulas',
    tagColor: 'text-yellow-400',
    code: 'MOD-02',
  },
  {
    id: 'Todos',
    title: 'Todos os Esportes',
    desc: 'Apostas esportivas com odds dinâmicas ao vivo e bônus de acumulada.',
    icon: Dribbble,
    accent: 'rgba(59,130,246,0.42)',
    glow: 'rgba(59,130,246,0.16)',
    iconBg: 'bg-blue-500/10 text-blue-400 border border-blue-500/25',
    games: ['⚽ Futebol', '🏀 Basquete', '🎾 Tênis', '🎮 E-Sports'],
    tag: 'Ver Confrontos',
    tagColor: 'text-blue-400',
    code: 'MOD-03',
  },
];

export default function HomeMenu({ onSelect, leaderboard = [], currentUserId }: HomeMenuProps) {
  const now = Date.now();
  const top3 = [...leaderboard]
    .sort((a, b) => (b.balance !== a.balance ? b.balance - a.balance : b.betsWon - a.betsWon))
    .slice(0, 3);
  const onlineCount = leaderboard.filter((e) => e.lastSeen > 0 && now - e.lastSeen < ONLINE_WINDOW_MS).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Hero Omnitrix HUD */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="omnitrix-panel rounded-2xl px-4 py-7 sm:py-10 relative overflow-hidden text-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,135,0.14),transparent_62%)] pointer-events-none" />
        <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent pointer-events-none" />

        {/* Decorative concentric HUD rings */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border border-brand/5 pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full border border-brand/[0.03] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-4">
            <OmnitrixLogo size="xl" animated />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/25 text-[10px] font-mono font-bold text-brand uppercase tracking-widest mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Sistema Omnitrix Online
          </div>

          <h2 className="text-2xl sm:text-4xl font-black font-display tracking-tight text-white mb-1.5">
            Ben<span className="text-brand drop-shadow-[0_0_16px_rgba(0,255,135,0.35)]">Bets</span>
          </h2>
          <p className="text-[11px] sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Central de demonstração interativa com cassino RNG, colecionáveis gacha conectados a APIs reais e sportsbook ao vivo.
          </p>

          {/* Status Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <span className="text-[10px] font-mono bg-[#07080f]/80 border border-brand/20 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-brand" /> RNG Auditado
            </span>
            <span className="text-[10px] font-mono bg-[#07080f]/80 border border-yellow-500/20 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-yellow-400" /> 7 Gachas com API
            </span>
            <span className="text-[10px] font-mono bg-[#07080f]/80 border border-emerald-500/20 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Lei 14.790/2023
            </span>
          </div>
        </div>
      </motion.div>

      {/* Section cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {sections.map((section, idx) => {
          const Icon = section.icon;
          return (
            <motion.button
              key={section.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              onClick={() => onSelect(section.id)}
              className="game-card relative p-4 sm:p-5 text-left cursor-pointer group flex flex-col justify-between"
              style={{ '--card-accent': section.accent, '--card-glow': section.glow } as React.CSSProperties}
            >
              <div className="game-card-corner" style={{ background: section.accent.replace('0.42', '0.07') }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3.5">
                  <div className={`${section.iconBg} p-2.5 sm:p-3 rounded-xl group-hover:scale-110 transition-transform shadow-lg`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-500 bg-[#07080f] border border-[#1d2134] px-2 py-0.5 rounded-md">
                    {section.code}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold font-display text-white mb-1">{section.title}</h3>
                <p className="text-[10px] sm:text-xs text-slate-400 mb-3.5 leading-relaxed">{section.desc}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {section.games.map((g, i) => (
                    <span key={i} className="text-[8px] sm:text-[9px] bg-[#07080f]/80 text-slate-300 px-2 py-0.5 rounded-md border border-white/10">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative z-10 flex items-center justify-between pt-2.5 border-t border-white/5 game-card-play">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" style={{ color: section.accent.replace('0.42', '1') }} />
                  <span className={`text-[9px] sm:text-[10px] ${section.tagColor} uppercase tracking-[0.12em] font-bold`}>{section.tag}</span>
                </div>
                <span className={`text-xs font-bold ${section.tagColor} group-hover:translate-x-1 transition-transform`}>→</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Live Leaderboard Preview */}
      {top3.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="omnitrix-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden"
        >
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand/55 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-brand/15 border border-brand/25 text-brand">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold font-display text-white flex items-center gap-2">
                  Top 3 Ao Vivo
                  <span className="text-[9px] font-mono font-bold text-brand bg-brand/10 border border-brand/25 px-2 py-0.5 rounded-full">
                    🟢 {onlineCount} online
                  </span>
                </h3>
              </div>
            </div>
            <button
              onClick={() => onSelect('Ranking')}
              className="text-[10px] sm:text-xs font-bold text-brand hover:underline cursor-pointer shrink-0"
            >
              Ver Ranking Completo →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {top3.map((entry, idx) => {
              const isMe = entry.uid === currentUserId;
              const isOnline = entry.lastSeen > 0 && now - entry.lastSeen < ONLINE_WINDOW_MS;
              const medalColor = idx === 0 ? 'text-brand' : idx === 1 ? 'text-cyan-300' : 'text-amber-400';
              return (
                <div
                  key={entry.uid}
                  className={`bg-[#06070d]/90 border rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 ${
                    isMe ? 'border-brand/45 shadow-[0_0_12px_rgba(0,255,135,0.12)]' : 'border-[#1a1d2e]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-mono font-black text-xs shrink-0 ${medalColor}`}>#{idx + 1}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-brand animate-pulse' : 'bg-slate-600'}`}
                      title={isOnline ? 'Online agora' : 'Offline'}
                    />
                    <span className="text-xs font-bold text-white truncate">{entry.displayName}</span>
                    {isMe && (
                      <span className="text-[7px] font-mono font-black bg-brand text-slate-950 px-1 rounded shrink-0">
                        VOCÊ
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-extrabold text-brand shrink-0">
                    R$ {entry.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Quick telemetry stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-3 gap-2 sm:gap-3"
      >
        {[
          { icon: Gamepad2, label: '5 Jogos', sub: 'Cassino RNG', color: 'text-brand', border: 'border-brand/15' },
          { icon: Zap, label: '6 Gachas', sub: 'APIs gratuitas', color: 'text-yellow-400', border: 'border-yellow-500/15' },
          { icon: TrendingUp, label: '4 Esportes', sub: 'Odds ao vivo', color: 'text-blue-400', border: 'border-blue-500/15' },
        ].map((stat, i) => (
          <div key={i} className={`omnitrix-card rounded-xl p-2.5 sm:p-3.5 text-center border ${stat.border}`}>
            <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color} mx-auto mb-1`} />
            <p className="text-[11px] sm:text-xs font-extrabold font-display text-white">{stat.label}</p>
            <p className="text-[8px] sm:text-[10px] text-slate-500 font-mono">{stat.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Footer notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="bg-[#0a0c14]/70 border border-brand/15 rounded-xl p-3 sm:p-3.5 text-center"
      >
        <div className="flex items-center justify-center gap-1.5 text-[9px] sm:text-xs text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand shrink-0" />
          <span>Ambiente 100% demonstrativo • Lei 14.790/2023 • Jogo Seguro</span>
        </div>
      </motion.div>
    </div>
  );
}
