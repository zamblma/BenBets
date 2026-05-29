import { useState } from 'react';
import { Ticket, Gift, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction } from '../types';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onDeposit: (amount: number) => void;
  onAddTransaction: (transaction: Transaction) => void;
}

export default function PixModal({
  isOpen,
  onClose,
  balance,
  onDeposit,
  onAddTransaction,
}: PixModalProps) {
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponUsed, setCouponUsed] = useState(false);
  const [showStatusMessage, setShowStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-[#0a0b12] border border-[#1c1f32] rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
      >
        <div className="p-5 bg-[#07080f] border-b border-[#1c1f32] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Ticket className="text-amber-400 w-5 h-5" />
            <h3 className="font-extrabold text-lg text-white">Cupom de Recarga</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-[#161826] p-1.5 rounded-lg transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {showStatusMessage ? (
              <motion.div 
                key="status"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-brand/5 border border-brand/20 p-4 rounded-xl text-xs flex items-start gap-2.5 shadow-[0_0_12px_rgba(0,255,135,0.15)]"
              >
                <div className="p-1 bg-brand text-slate-950 rounded-full shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm">Cupom Resgatado</h4>
                  <p className="mt-0.5 text-slate-300 leading-relaxed">{showStatusMessage}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="coupon-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Gift className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-bold text-slate-200">Resgatar Cupom</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                    placeholder="Digite o código do cupom"
                    className="flex-1 bg-[#040508] border border-[#1b1e2e] focus:border-amber-500 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none uppercase tracking-wider"
                  />
                  <button
                    onClick={() => {
                      const code = couponInput.trim();
                      setCouponError('');

                      if (!code) { setCouponError('Digite um código de cupom.'); return; }

                      if (code === '20REAIS') {
                        if (couponUsed) { setCouponError('Este cupom já foi usado.'); return; }
                        if (balance >= 0.50) { setCouponError('Seu saldo precisa estar abaixo de R$ 0,50 para usar este cupom.'); return; }

                        onDeposit(20);
                        const newTx: Transaction = {
                          id: `tx-${Math.random().toString(36).substr(2, 9)}`,
                          type: 'deposito',
                          amount: 20,
                          status: 'concluido',
                          date: new Date().toLocaleString('pt-BR'),
                        };
                        onAddTransaction(newTx);
                        setCouponUsed(true);
                        setCouponInput('');
                        setShowStatusMessage('Cupom 20REAIS resgatado com sucesso! R$ 20,00 adicionados à sua conta.');
                        setTimeout(() => setShowStatusMessage(null), 3500);
                      } else {
                        setCouponError('Cupom inválido ou expirado.');
                      }
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 rounded-xl text-xs transition-all cursor-pointer shrink-0 shadow-[0_0_10px_rgba(255,191,0,0.2)]"
                  >
                    Resgatar
                  </button>
                </div>

                {couponError && (
                  <p className="text-rose-400 text-[11px] mt-2">{couponError}</p>
                )}

                {balance < 0.50 && !couponUsed && (
                  <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-2">
                    <Ticket className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p>Você tem um <span className="text-amber-400 font-bold">cupom disponível</span>! Use o código <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">20REAIS</span> para ganhar R$ 20,00 gratuitamente.</p>
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Cupons disponíveis</h4>
                  <div className="bg-[#0d0e16] rounded-xl p-4 border border-[#1c1f32]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-amber-400 text-sm">20REAIS</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">Válido para saldos abaixo de R$ 0,50</p>
                      </div>
                      <div className="bg-amber-500/10 px-2 py-1 rounded text-amber-400 text-[10px] font-bold">
                        {couponUsed ? 'Usado' : 'Disponível'}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
