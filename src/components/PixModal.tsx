import { useState } from 'react';
import { DollarSign, QrCode, Copy, Check, ArrowDownCircle, ArrowUpCircle, Info, Sparkles, Ticket, Gift, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction } from '../types';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onDeposit: (amount: number) => void;
  transactions: Transaction[];
  onAddTransaction: (transaction: Transaction) => void;
}

export default function PixModal({
  isOpen,
  onClose,
  balance,
  onDeposit,
  transactions,
  onAddTransaction,
}: PixModalProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'coupon'>('deposit');
  const [depositAmount, setDepositAmount] = useState('50');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [cpf, setCpf] = useState('');
  const [pixType, setPixType] = useState('cpf');
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponUsed, setCouponUsed] = useState(false);
  const [showStatusMessage, setShowStatusMessage] = useState<string | null>(null);
  const [showTestMessage, setShowTestMessage] = useState(false);
  const [testMessageType, setTestMessageType] = useState<'deposit' | 'withdraw' | null>(null);

  if (!isOpen) return null;

  const handleTestAction = (type: 'deposit' | 'withdraw') => {
    setTestMessageType(type);
    setShowTestMessage(true);
    setTimeout(() => setShowTestMessage(false), 3000);
  };

  const handleCouponSubmit = () => {
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-[#0a0b12] border border-[#1c1f32] rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
      >
        {/* Header */}
        <div className="p-5 bg-[#07080f] border-b border-[#1c1f32] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <DollarSign className="text-brand w-5 h-5" />
            <h3 className="font-extrabold text-lg text-white">Caixa</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-[#161826] p-1.5 rounded-lg transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#1c1f32] bg-[#07080f]/60 p-1">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-3 text-xs uppercase tracking-wider font-extrabold transition-all rounded-lg flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'deposit' 
                ? 'bg-[#151724] text-brand border border-[#23273e]' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4 text-brand" />
            Depositar
          </button>
          <button
            onClick={() => setActiveTab('coupon')}
            className={`flex-1 py-3 text-xs uppercase tracking-wider font-extrabold transition-all rounded-lg flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'coupon' 
                ? 'bg-[#151724] text-amber-400 border border-[#23273e]' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ticket className="w-4 h-4 text-amber-400" />
            Cupons
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-3 text-xs uppercase tracking-wider font-extrabold transition-all rounded-lg flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'withdraw' 
                ? 'bg-[#151724] text-indigo-400 border border-[#23273e]' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4 text-indigo-400" />
            Sacar
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 min-h-[300px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {/* Test message overlay */}
            {showTestMessage && (
              <motion.div
                key="test-msg"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-amber-400/10 border border-amber-400/30 p-4 rounded-xl text-xs flex items-start gap-2.5"
              >
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-amber-400 text-sm">Ambiente de Demonstração</h4>
                  <p className="mt-0.5 text-slate-300 leading-relaxed">
                    {testMessageType === 'deposit'
                      ? 'Depósitos estão desabilitados neste ambiente de demonstração. Nenhum valor será alterado em sua conta.'
                      : 'Saques estão desabilitados neste ambiente de demonstração. Nenhum valor será alterado em sua conta.'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Status message (coupon success) */}
            {showStatusMessage && !showTestMessage && (
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
            )}

            {/* TAB DEPOSITO */}
            {activeTab === 'deposit' && !showStatusMessage && !showTestMessage && (
              <motion.div
                key="deposit-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 flex-1 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 text-xs">Insira o valor do depósito:</span>
                    <span className="text-brand text-xs font-semibold">Mínimo R$ 5,00</span>
                  </div>
                  
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-500">R$</span>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-brand rounded-xl py-3.5 pl-11 pr-4 text-xl font-bold text-white focus:outline-none"
                      placeholder="0,00"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[20, 50, 100, 200].map((v) => (
                      <button key={v} onClick={() => setDepositAmount(v.toString())}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          depositAmount === v.toString()
                            ? 'bg-brand/10 border-brand text-brand font-black'
                            : 'bg-[#040508] border-[#1b1e2e] text-slate-400 hover:border-[#2a2f47] hover:text-white'
                        }`}>
                        + R${v}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-[#0d0e16] rounded-xl border border-[#1c1f32] flex gap-2 text-[10px] text-slate-400 leading-relaxed">
                    <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                    <p>Ambiente de demonstração — depósitos não processados. Nenhum valor real é movimentado.</p>
                  </div>
                </div>

                <button onClick={() => handleTestAction('deposit')}
                  className="w-full bg-brand hover:bg-[#00e074] text-slate-950 font-black py-3.5 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,135,0.15)] hover:scale-[1.01]">
                  <Sparkles className="w-4 h-4 inline mr-1" /> Depositar (Simulado)
                </button>
              </motion.div>
            )}

            {/* TAB CUPONS */}
            {activeTab === 'coupon' && !showStatusMessage && !showTestMessage && (
              <motion.div
                key="coupon-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 flex-1 flex flex-col justify-between"
              >
                <div>
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
                    <button onClick={handleCouponSubmit}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 rounded-xl text-xs transition-all cursor-pointer shrink-0 shadow-[0_0_10px_rgba(255,191,0,0.2)]"
                    >Resgatar</button>
                  </div>

                  {couponError && <p className="text-rose-400 text-[11px] mt-2">{couponError}</p>}

                  {balance < 0.50 && !couponUsed && (
                    <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-2">
                      <Ticket className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p>Você tem um <span className="text-amber-400 font-bold">cupom disponível</span>! Use <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">20REAIS</span> para ganhar R$ 20,00.</p>
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
                </div>
              </motion.div>
            )}

            {/* TAB SAQUE */}
            {activeTab === 'withdraw' && !showStatusMessage && !showTestMessage && (
              <motion.div
                key="withdraw-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3.5 flex-1 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-400 text-xs">Valor do Saque:</span>
                    <span className="text-indigo-400 text-xs font-semibold">Disponível: R$ {balance.toFixed(2)}</span>
                  </div>
                  
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-500">R$</span>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-indigo-500 rounded-xl py-3 pl-11 pr-4 text-lg font-bold text-white focus:outline-none"
                      placeholder="0,00"
                    />
                  </div>

                  <div className="mt-3.5">
                    <label className="block text-xs text-slate-400 mb-1">CPF de Titularidade:</label>
                    <input type="text" value={cpf} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 11) setCpf(val); }}
                      className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-indigo-500 rounded-xl py-2.5 px-3.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none"
                      placeholder="Ex: 12345678900 (apenas números)" />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {['cpf', 'celular', 'chave-aleatoria'].map((type) => (
                      <button key={type} onClick={() => setPixType(type)}
                        className={`py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer text-center capitalize ${
                          pixType === type ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-[#040508] border-[#1b1e2e] text-slate-400'
                        }`}>
                        {type.replace('-', ' ')}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs text-slate-400 mb-1">Chave Pix:</label>
                    <input type="text" value={pixKey} onChange={(e) => setPixKey(e.target.value)}
                      className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-indigo-500 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                      placeholder={pixType === 'cpf' ? 'Digite seu CPF' : pixType === 'celular' ? '(11) 99999-9999' : 'Chave aleatória'} />
                  </div>

                  <div className="mt-3 p-3 bg-[#0d0e16] rounded-xl border border-[#1c1f32] flex gap-2 text-[10px] text-slate-400 leading-relaxed">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <p>Ambiente de demonstração — saques não processados. Nenhum valor real é movimentado.</p>
                  </div>
                </div>

                <button onClick={() => handleTestAction('withdraw')}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(99,102,241,0.2)] hover:scale-[1.01]">
                  Solicitar Saque (Simulado)
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent transactions */}
          {transactions.length > 0 && !showTestMessage && (
            <div className="mt-5 border-t border-[#1b1e2e] pt-4">
              <h4 className="text-xs font-semibold text-slate-400 mb-2">Últimas transações:</h4>
              <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center bg-[#040508] p-2 rounded-lg text-xs border border-[#1c1e2f]">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                        tx.type === 'deposito' ? 'text-brand bg-brand/10' : 'text-indigo-400 bg-indigo-500/10'
                      }`}>
                        {tx.type === 'deposito' ? 'DEP' : 'SAQ'}
                      </span>
                      <span className="text-slate-300 font-mono">R$ {tx.amount.toFixed(2)}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{tx.date.split(',')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
