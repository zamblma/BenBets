import { motion } from 'motion/react';
import { Gift, Check, ChevronRight, Star } from 'lucide-react';
import { DAILY_MISSIONS } from '../firebase/db';

interface DailyMissionsProps {
  userId: string;
  missions: Record<string, { current: number; completed: boolean; claimed: boolean; date: string }>;
  onClaim: (missionId: string) => void;
}

export default function DailyMissions({ userId, missions, onClaim }: DailyMissionsProps) {
  return (
    <div className="bg-[#0a0b12] border border-[#1b1e2e] rounded-2xl overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.45)]">
      <div className="bg-gradient-to-r from-amber-600/20 via-amber-500/10 to-transparent border-b border-[#1b1e2e] p-4 flex items-center gap-3">
        <div className="p-2 bg-amber-500/20 rounded-xl">
          <Star className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="font-extrabold text-white text-base">Missões Diárias 🎯</h3>
          <p className="text-[10px] text-slate-400 font-medium">Complete missões e ganhe recompensas</p>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        {DAILY_MISSIONS.map((mission, index) => {
          const progress = missions[mission.id];
          const current = progress?.current ?? 0;
          const completed = progress?.completed ?? false;
          const claimed = progress?.claimed ?? false;
          const isInProgress = !completed && !claimed;

          return (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className={`relative bg-[#0d0e16] border rounded-xl p-3.5 transition-all ${
                claimed
                  ? 'border-emerald-500/20 bg-emerald-950/5'
                  : completed
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-[#1c1f2f] hover:border-[#2a2e47]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">{mission.icon}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className={`font-bold text-sm ${claimed ? 'text-emerald-400' : 'text-white'}`}>
                        {mission.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{mission.desc}</p>
                    </div>

                    <div className="shrink-0">
                      {claimed ? (
                        <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                          <Check className="w-4 h-4" />
                          Concluído
                        </div>
                      ) : completed ? (
                        <button
                          onClick={() => onClaim(mission.id)}
                          className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-[11px] px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,191,0,0.2)] hover:shadow-[0_0_18px_rgba(255,191,0,0.35)]"
                        >
                          <Gift className="w-3.5 h-3.5" />
                          Reivindicar
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isInProgress && (
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Progresso</span>
                        <span className="text-slate-300 font-bold font-mono">
                          {current}/{mission.target}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#040508] rounded-full overflow-hidden border border-[#1a1c2a]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((current / mission.target) * 100, 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className={`h-full rounded-full ${
                            current >= mission.target
                              ? 'bg-amber-400'
                              : 'bg-gradient-to-r from-amber-600 to-amber-400'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {claimed && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-500/70">
                      <Gift className="w-3 h-3" />
                      <span>+{mission.reward} BB Coins</span>
                    </div>
                  )}

                  {completed && !claimed && (
                    <div className="mt-2 flex items-center gap-1 text-amber-400/80 text-[10px] font-medium">
                      <Star className="w-3 h-3" />
                      <span>Pronto para resgatar +{mission.reward} BB Coins</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
