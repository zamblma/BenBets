import { motion } from 'motion/react';
import { Flame, Star, Dribbble, Sparkles, ShieldCheck, Gamepad2 } from 'lucide-react';

interface HomeMenuProps {
  onSelect: (section: string) => void;
}

const sections = [
  {
    id: 'Cassino',
    title: 'Jogos de Cassino',
    desc: 'Slots, Aviator, Blackjack, Roleta e Dados — todos com RNG auditado.',
    icon: Flame,
    color: 'from-emerald-500/20 to-emerald-900/10',
    border: 'border-emerald-500/30',
    glow: 'rgba(0,255,135,0.12)',
    iconBg: 'bg-emerald-500/10 text-brand',
    games: '🎰 Slots • 📈 Aviator • 🃏 Blackjack • 🎡 Roleta • 🎲 Dados',
  },
  {
    id: 'Colecionaveis',
    title: 'Colecionáveis & Gacha',
    desc: 'Abra pacotes e colecione personagens, cartas, skins e muito mais.',
    icon: Star,
    color: 'from-yellow-500/20 to-yellow-900/10',
    border: 'border-yellow-500/30',
    glow: 'rgba(255,200,0,0.12)',
    iconBg: 'bg-yellow-500/10 text-yellow-400',
    games: '⭐ Anime Gacha • 🃏 Pokémon TCG • ⚔️ Baús LoL • 🔫 CS2 Cases • 🎤 K-pop • 🌍 Copa',
  },
  {
    id: 'Todos',
    title: 'Todos os Esportes',
    desc: 'Apostas esportivas com odds dinâmicas ao vivo em várias modalidades.',
    icon: Dribbble,
    color: 'from-blue-500/20 to-blue-900/10',
    border: 'border-blue-500/30',
    glow: 'rgba(59,130,246,0.12)',
    iconBg: 'bg-blue-500/10 text-blue-400',
    games: '⚽ Futebol • 🏀 Basquete • 🎾 Tênis • 🎮 E-Sports',
  },
];

export default function HomeMenu({ onSelect }: HomeMenuProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-4 sm:py-8"
      >
        <div className="bg-gradient-to-tr from-brand to-emerald-400 text-slate-950 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl font-black text-lg sm:text-2xl font-display leading-none rotate-2 shadow-[0_0_30px_rgba(0,255,135,0.3)] mx-auto mb-2 sm:mb-4 flex items-center justify-center">
          BB
        </div>
        <h2 className="text-lg sm:text-2xl font-extrabold text-white mb-1 sm:mb-2">BenBets</h2>
        <p className="text-[10px] sm:text-sm text-slate-400 max-w-md mx-auto">
          Ambiente de demonstração • Plataforma de entretenimento com cassino, colecionáveis e apostas esportivas.
        </p>
      </motion.div>

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
              className={`bg-gradient-to-b ${section.color} border ${section.border} rounded-xl sm:rounded-2xl p-3 sm:p-5 text-left cursor-pointer group hover:scale-[1.02] transition-all`}
              style={{ boxShadow: `0 0 20px ${section.glow}` }}
            >
              <div className={`${section.iconBg} p-2 sm:p-3 rounded-lg sm:rounded-xl w-fit mb-2 sm:mb-3 group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-white mb-0.5 sm:mb-1">{section.title}</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 mb-2 sm:mb-3">{section.desc}</p>
              <div className="flex items-center gap-1 text-[8px] sm:text-[10px] text-slate-500 flex-wrap">
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand shrink-0" />
                <span>{section.games}</span>
              </div>
              <div className="mt-2 sm:mt-3 flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-brand group-hover:gap-2 transition-all">
                <span>Acessar</span>
                <span>→</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
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