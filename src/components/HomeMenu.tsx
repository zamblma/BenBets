import React from 'react';
import { motion } from 'motion/react';
import {
  Flame,
  Star,
  Dribbble,
  Sparkles,
  ShieldCheck,
  Zap,
  TrendingUp,
  Gamepad2,
  Cpu,
  Trophy,
  ArrowRight,
  Crown,
  Radio,
} from 'lucide-react';
import OmnitrixLogo from './OmnitrixLogo';
import { ONLINE_WINDOW_MS, type LeaderboardEntry } from '../firebase/db';

interface HomeMenuProps {
  onSelect: (section: string) => void;
  onQuickLaunch?: (section: 'Cassino' | 'Colecionaveis', gameId: string) => void;
  leaderboard?: LeaderboardEntry[];
  currentUserId?: string;
  liveMatchesCount?: number;
}

const QUICK_LAUNCH_ITEMS: Array<{
  section: 'Cassino' | 'Colecionaveis';
  id: string;
  label: string;
  sub: string;
  emoji: string;
  tone: string;
}> = [
  {
    section: 'Colecionaveis',
    id: 'Anime',
    label: 'Mudae Anime',
    sub: '129k+ Pool Ao Vivo',
    emoji: '🤖',
    tone: 'border-purple-500/35 hover:border-purple-400/70 bg-purple-500/10 text-purple-200',
  },
  {
    section: 'Cassino',
    id: 'aviator',
    label: 'Aviator Crash',
    sub: 'Multiplicador Real',
    emoji: '✈️',
    tone: 'border-cyan-500/35 hover:border-cyan-400/70 bg-cyan-500/10 text-cyan-200',
  },
  {
    section: 'Cassino',
    id: 'mines',
    label: 'Mines Omnitrix',
    sub: 'RTP 98% • 5×5',
    emoji: '💎',
    tone: 'border-emerald-500/35 hover:border-brand/70 bg-brand/10 text-emerald-200',
  },
  {
    section: 'Cassino',
    id: 'fortunetiger',
    label: 'Fortune Tiger',
    sub: 'Turbo • Max 80×',
    emoji: '🐯',
    tone: 'border-amber-500/35 hover:border-amber-400/70 bg-amber-500/10 text-amber-200',
  },
  {
    section: 'Colecionaveis',
    id: 'Pokemon',
    label: 'Pokémon TCG',
    sub: 'Cartas & Coleções',
    emoji: '🃏',
    tone: 'border-yellow-500/35 hover:border-yellow-400/70 bg-yellow-500/10 text-yellow-200',
  },
  {
    section: 'Colecionaveis',
    id: 'CS2',
    label: 'CS2 Cases',
    sub: 'Float & StatTrak™',
    emoji: '🔫',
    tone: 'border-orange-500/35 hover:border-orange-400/70 bg-orange-500/10 text-orange-200',
  },
];

const sections = [
  {
    id: 'Cassino',
    title: 'Jogos de Cassino',
    desc: 'Mines, Aviator Crash, Fortune Tiger, Plinko, Double, Basquete Street, Pênaltis e mesas clássicas.',
    icon: Flame,
    accent: 'rgba(0,255,135,0.45)',
    glow: 'rgba(0,255,135,0.2)',
    iconBg: 'bg-brand/15 text-brand border border-brand/30',
    games: ['💎 Mines', '✈️ Aviator', '🐯 Tiger', '🟣 Plinko', '🏀 Basquete', '+5'],
    tag: 'Entrar no Cassino',
    tagColor: 'text-brand',
    pill: '10 Jogos',
  },
  {
    id: 'Colecionaveis',
    title: 'Colecionáveis & Gacha',
    desc: 'Genshin Impact, VALORANT Skins, Mudae Multiplayer, Pokémon TCG, CS2 Cases, K-pop, Copa 2026 e LoL.',
    icon: Star,
    accent: 'rgba(168,85,247,0.45)',
    glow: 'rgba(168,85,247,0.2)',
    iconBg: 'bg-purple-500/15 text-purple-300 border border-purple-400/30',
    games: ['✦ Genshin', '🎯 Valorant', '🤖 Mudae', '🃏 Pokémon', '🔫 CS2', '+4'],
    tag: 'Abrir Coleções',
    tagColor: 'text-purple-300',
    pill: '9 Gachas',
  },
  {
    id: 'Todos',
    title: 'Sportsbook ao Vivo',
    desc: 'Jogos reais de futebol brasileiro e NHL com placares ao vivo, odds dinâmicas e bônus de acumulada.',
    icon: Dribbble,
    accent: 'rgba(56,189,248,0.45)',
    glow: 'rgba(56,189,248,0.18)',
    iconBg: 'bg-sky-500/15 text-sky-300 border border-sky-400/30',
    games: ['⚽ Futebol', '🏒 NHL', '🏀 Basquete', '🎮 E-Sports', '🥊 MMA', '+2'],
    tag: 'Ver Confrontos',
    tagColor: 'text-sky-300',
    pill: '7 Esportes',
  },
];

export default function HomeMenu({
  onSelect,
  onQuickLaunch,
  leaderboard = [],
  currentUserId,
  liveMatchesCount = 0,
}: HomeMenuProps) {
  const now = Date.now();
  const top3 = [...leaderboard]
    .sort((a, b) => (b.balance !== a.balance ? b.balance - a.balance : b.betsWon - a.betsWon))
    .slice(0, 3);
  const topBalance = Math.max(1, top3[0]?.balance || 1);
  const onlineCount = Math.max(
    1,
    leaderboard.filter((e) => e.lastSeen > 0 && now - e.lastSeen < ONLINE_WINDOW_MS).length
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Hero Omnitrix Command Center */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="omnitrix-panel rounded-2xl p-5 sm:p-7 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,255,135,0.14),transparent_58%),radial-gradient(ellipse_at_bottom_right,rgba(56,189,248,0.08),transparent_55%)] pointer-events-none" />
        <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-brand/75 to-transparent pointer-events-none" />
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border border-brand/10 pointer-events-none" />
        <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full border border-brand/[0.06] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-5 text-center md:text-left">
          <div className="shrink-0">
            <OmnitrixLogo size="xl" animated />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand/12 border border-brand/30 text-[10px] font-mono font-bold text-brand uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                {onlineCount} {onlineCount === 1 ? 'jogador online' : 'jogadores online'}
              </span>
              {liveMatchesCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/35 text-[10px] font-mono font-bold text-rose-300">
                  <Radio className="w-3 h-3 animate-pulse" />
                  {liveMatchesCount} jogos ao vivo
                </span>
              )}
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
                <ShieldCheck className="w-3 h-3 text-brand" /> Lei 14.790/2023
              </span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight text-white leading-tight">
                Ben<span className="text-brand drop-shadow-[0_0_18px_rgba(0,255,135,0.38)]">Bets</span>{' '}
                <span className="text-sm sm:text-base font-mono font-bold text-slate-400 align-middle">
                  HUD 2.0
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300/90 max-w-xl mt-1 leading-relaxed">
                Cassino RNG de alta velocidade, colecionáveis gacha conectados a APIs oficiais e sportsbook ao vivo com chat multiplayer.
              </p>
            </div>

            {/* Direct Action CTAs */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
              <button
                type="button"
                onClick={() => onSelect('Cassino')}
                className="px-4 py-2.5 rounded-xl bg-brand hover:bg-[#19ff96] text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_22px_rgba(0,255,135,0.28)] hover:shadow-[0_0_28px_rgba(0,255,135,0.45)] flex items-center gap-1.5"
              >
                <Flame className="w-4 h-4" />
                <span>Jogar Cassino</span>
              </button>
              <button
                type="button"
                onClick={() => onSelect('Colecionaveis')}
                className="px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/45 text-purple-100 font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-purple-300" />
                <span>Abrir Gachas</span>
              </button>
              <button
                type="button"
                onClick={() => onSelect('Todos')}
                className="px-4 py-2.5 rounded-xl bg-[#0c101c] hover:bg-[#141a2e] border border-sky-400/35 text-sky-200 font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Dribbble className="w-4 h-4 text-sky-400" />
                <span>Esportes</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Launch Strip — 1-Click Direct to Top Games */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-brand" />
            Acesso Rápido • Mais Jogados
          </p>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">1 clique direto no jogo</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {QUICK_LAUNCH_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (onQuickLaunch) onQuickLaunch(item.section, item.id);
                else onSelect(item.section);
              }}
              className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer group flex items-center gap-2.5 ${item.tone}`}
            >
              <span className="text-xl sm:text-2xl shrink-0 group-hover:scale-110 transition-transform">
                {item.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-white truncate leading-tight">{item.label}</p>
                <p className="text-[9px] font-mono opacity-80 truncate mt-0.5">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {sections.map((section, idx) => {
          const Icon = section.icon;
          return (
            <motion.button
              key={section.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              onClick={() => onSelect(section.id)}
              className="game-card relative p-4 sm:p-5 text-left cursor-pointer group flex flex-col justify-between"
              style={{ '--card-accent': section.accent, '--card-glow': section.glow } as React.CSSProperties}
            >
              <div className="game-card-corner" style={{ background: section.accent.replace('0.45', '0.09') }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className={`${section.iconBg} p-2.5 rounded-xl group-hover:scale-110 transition-transform shadow-lg`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-300 bg-[#070912] border border-white/10 px-2 py-0.5 rounded-full">
                    {section.pill}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold font-display text-white mb-1">
                  {section.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mb-3.5 leading-relaxed">
                  {section.desc}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {section.games.map((g, i) => (
                    <span
                      key={i}
                      className="text-[9px] bg-[#060810]/90 text-slate-300 px-2 py-0.5 rounded-md border border-white/10"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative z-10 flex items-center justify-between pt-2.5 border-t border-white/5 game-card-play">
                <span className={`text-[10px] ${section.tagColor} uppercase tracking-[0.12em] font-extrabold`}>
                  {section.tag}
                </span>
                <ArrowRight className={`w-4 h-4 ${section.tagColor} group-hover:translate-x-1 transition-transform`} />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Live Leaderboard Podium Preview */}
      {top3.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="omnitrix-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden"
        >
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand/55 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300 shrink-0">
                <Crown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-extrabold font-display text-white flex items-center gap-2 flex-wrap">
                  Pódio em Tempo Real
                  <span className="text-[9px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                    {leaderboard.length} {leaderboard.length === 1 ? 'jogador' : 'jogadores'}
                  </span>
                </h3>
              </div>
            </div>
            <button
              onClick={() => onSelect('Ranking')}
              className="text-[11px] font-bold text-brand hover:underline cursor-pointer shrink-0 flex items-center gap-1"
            >
              <span>Ranking Completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {top3.map((entry, idx) => {
              const isMe = entry.uid === currentUserId;
              const isOnline = entry.lastSeen > 0 && now - entry.lastSeen < ONLINE_WINDOW_MS;
              const pct = Math.max(12, Math.min(100, Math.round((entry.balance / topBalance) * 100)));
              const podiumStyle =
                idx === 0
                  ? { medal: '🥇', border: 'border-amber-400/45 bg-amber-500/[0.06]', bar: 'bg-amber-400', text: 'text-amber-300' }
                  : idx === 1
                    ? { medal: '🥈', border: 'border-slate-400/35 bg-slate-400/[0.04]', bar: 'bg-cyan-400', text: 'text-cyan-300' }
                    : { medal: '🥉', border: 'border-orange-400/30 bg-orange-500/[0.04]', bar: 'bg-orange-400', text: 'text-orange-300' };

              return (
                <div
                  key={entry.uid}
                  className={`rounded-xl px-3 py-2.5 border space-y-2 ${
                    isMe ? 'border-brand/60 bg-brand/[0.08] shadow-[0_0_16px_rgba(0,255,135,0.12)]' : podiumStyle.border
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">{podiumStyle.medal}</span>
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
                    <span className={`text-xs font-mono font-black shrink-0 ${idx === 0 ? 'text-brand' : podiumStyle.text}`}>
                      R$ {entry.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-black/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${idx === 0 ? 'bg-brand' : podiumStyle.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Telemetry Highlights */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Gamepad2, label: '10 Jogos', sub: 'Cassino RNG', color: 'text-brand', border: 'border-brand/20' },
          { icon: Cpu, label: '7 Gachas', sub: 'APIs oficiais', color: 'text-purple-300', border: 'border-purple-500/20' },
          { icon: TrendingUp, label: '7 Esportes', sub: 'Odds ao vivo', color: 'text-sky-400', border: 'border-sky-500/20' },
        ].map((stat, i) => (
          <div key={i} className={`omnitrix-card rounded-xl p-2.5 sm:p-3.5 text-center border ${stat.border}`}>
            <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color} mx-auto mb-1`} />
            <p className="text-[11px] sm:text-xs font-extrabold font-display text-white">{stat.label}</p>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono">{stat.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
