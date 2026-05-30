import { motion } from 'motion/react';
import { Flame, Star, Dribbble, Sparkles, ShieldCheck, Zap, TrendingUp, Gamepad2 } from 'lucide-react';

interface HomeMenuProps {
  onSelect: (section: string) => void;
}

const sections = [
  {
    id: 'Cassino',
    title: 'Jogos de Cassino',
    desc: 'Slots, Aviator, Blackjack, Roleta e Dados — todos com RNG auditado.',
    icon: Flame,
    accent: 'rgba(0,255,135,0.4)',
    glow: 'rgba(0,255,135,0.15)',
    iconBg: 'bg-emerald-500/10 text-brand',
    games: ['🎰 Slots', '📈 Aviator', '🃏 Blackjack', '🎡 Roleta', '🎲 Dados'],
    tag: 'Jogar',
    tagColor: 'text-brand',
  },
  {
    id: 'Colecionaveis',
    title: 'Colecionáveis & Gacha',
    desc: 'Abra pacotes e colecione personagens, cartas, skins e muito mais.',
    icon: Star,
    accent: 'rgba(234,179,8,0.4)',
    glow: 'rgba(234,179,8,0.15)',
    iconBg: 'bg-yellow-500/10 text-yellow-400',
    games: ['⭐ Anime', '🃏 Pokémon', '🔫 CS2', '🎤 K-pop', '🌍 Copa', '⚔️ LoL'],
    tag: 'Colecionar',
    tagColor: 'text-yellow-400',
  },
  {
    id: 'Todos',
    title: 'Todos os Esportes',
    desc: 'Apostas esportivas com odds dinâmicas ao vivo em várias modalidades.',
    icon: Dribbble,
    accent: 'rgba(59,130,246,0.4)',
    glow: 'rgba(59,130,246,0.15)',
    iconBg: 'bg-blue-500/10 text-blue-400',
    games: ['⚽ Futebol', '🏀 Basquete', '🎾 Tênis', '🎮 E-Sports'],
    tag: 'Apostar',
    tagColor: 'text-blue-400',
  },
];

export default function HomeMenu({ onSelect }: HomeMenuProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-6 sm:py-10 relative"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,135,0.06),transparent_60%)] pointer-events-none" />
        <div className="relative z-10">
          <div className="bg-gradient-to-tr from-brand to-emerald-400 text-slate-950 w-14 h-14 sm:w-18 sm:h-18 rounded-2xl font-black text-xl sm:text-3xl font-display leading-none rotate-2 shadow-[0_0_40px_rgba(0,255,135,0.35)] mx-auto mb-3 sm:mb-5 flex items-center justify-center">
            BB
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-white mb-1 sm:mb-2">BenBets</h2>
          <p className="text-[10px] sm:text-sm text-slate-400 max-w-md mx-auto">
            Ambiente de demonstração • Cassino, colecionáveis e apostas esportivas.
          </p>
        </div>
      </motion.div>

      {/* Section cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {sections.map((section, idx) => {
          const Icon = section.icon;
          return (
            <motion.button
              key={section.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => onSelect(section.id)}
              className="game-card relative p-4 sm:p-6 text-left cursor-pointer group"
              style={{ '--card-accent': section.accent, '--card-glow': section.glow } as React.CSSProperties}
            >
              <div className="game-card-corner" style={{ background: section.accent.replace('0.4', '0.05') }} />
              <div className="relative z-10">
                <div className={`${section.iconBg} p-2.5 sm:p-3.5 rounded-xl w-fit mb-3 sm:mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                  <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-white mb-1">{section.title}</h3>
                <p className="text-[10px] sm:text-xs text-slate-400 mb-3 sm:mb-4 leading-relaxed">{section.desc}</p>
                <div className="flex flex-wrap gap-1.5 mb-3 sm:mb-4">
                  {section.games.map((g, i) => (
                    <span key={i} className="text-[8px] sm:text-[9px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5">{g}</span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 game-card-play">
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" style={{ color: section.accent.replace('0.4', '1') }} />
                  <span className={`text-[9px] sm:text-[10px] ${section.tagColor} uppercase tracking-[0.12em] font-bold`}>{section.tag} →</span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Quick stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-2 sm:gap-3"
      >
        {[
          { icon: Gamepad2, label: '5 Jogos', sub: 'de cassino', color: 'text-brand' },
          { icon: Zap, label: '6 Gachas', sub: 'colecionáveis', color: 'text-yellow-400' },
          { icon: TrendingUp, label: '4 Esportes', sub: 'apostas ao vivo', color: 'text-blue-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-xl p-2.5 sm:p-3 text-center">
            <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color} mx-auto mb-1`} />
            <p className="text-[10px] sm:text-xs font-bold text-white">{stat.label}</p>
            <p className="text-[8px] sm:text-[9px] text-slate-500">{stat.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Footer notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-xl p-3 sm:p-4 text-center"
      >
        <div className="flex items-center justify-center gap-1.5 text-[9px] sm:text-xs text-slate-400">
          <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 text-brand" />
          <span>Ambiente 100% demonstrativo • Lei 14.790/2023 • Jogo Seguro</span>
        </div>
      </motion.div>
    </div>
  );
}
