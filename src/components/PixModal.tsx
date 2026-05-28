import React, { useState } from 'react';
import { DollarSign, QrCode, Copy, Check, Upload, ArrowDownCircle, ArrowUpCircle, Info, Sparkles, Loader2, Ticket, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction } from '../types';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => boolean; // returns success if balance was sufficient
  transactions: Transaction[];
  onAddTransaction: (transaction: Transaction) => void;
}

export default function PixModal({
  isOpen,
  onClose,
  balance,
  onDeposit,
  onWithdraw,
  transactions,
  onAddTransaction,
}: PixModalProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'coupon'>('deposit');
  const [depositAmount, setDepositAmount] = useState<string>('50');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [pixKey, setPixKey] = useState<string>('');
  const [cpf, setCpf] = useState<string>('');
  const [pixType, setPixType] = useState<string>('cpf');
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponUsed, setCouponUsed] = useState(false);
  
  // Simulated steps
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedPixCode, setGeneratedPixCode] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState<boolean>(false);
  const [showStatusMessage, setShowStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePresetDeposit = (amount: number) => {
    setDepositAmount(amount.toString());
    setGeneratedPixCode(null);
  };

  const handleGenerateDepositPix = () => {
    const value = parseFloat(depositAmount);
    if (isNaN(value) || value < 5) {
      alert('O valor mínimo de depósito simulado é R$ 5,00.');
      return;
    }

    setIsGenerating(true);
    setGeneratedPixCode(null);

    setTimeout(() => {
      setIsGenerating(false);
      setGeneratedPixCode(
        `00020101021126620014br.gov.bcb.pix0140site-de-apostas-pix-regulamentado-30m@arena.bet.br5204000053039865405${value.toFixed(2)}5802BR5915ARENABEST_LTDA6009SAO_PAULO62070503***6304`
      );
    }, 800);
  };

  const handleCopyCode = () => {
    if (!generatedPixCode) return;
    navigator.clipboard.writeText(generatedPixCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSimulatePayment = () => {
    const value = parseFloat(depositAmount);
    if (isNaN(value)) return;

    onDeposit(value);
    
    const newTx: Transaction = {
      id: `tx-${Math.random().toString(36).substr(2, 9)}`,
      type: 'deposito',
      amount: value,
      status: 'concluido',
      date: new Date().toLocaleString('pt-BR'),
    };
    onAddTransaction(newTx);
    
    // Reset state & show success
    setShowStatusMessage(`Depósito de R$ ${value.toFixed(2)} compensado com sucesso via Pix Instantâneo.`);
    setGeneratedPixCode(null);
    setDepositAmount('50');
    setTimeout(() => setShowStatusMessage(null), 3000);
  };

  const handleRequestWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(withdrawAmount);
    if (isNaN(value) || value < 10) {
      alert('O valor mínimo para saque é R$ 10,00.');
      return;
    }

    if (value > balance) {
      alert('Saldo insuficiente para realizar este saque.');
      return;
    }

    if (!cpf || cpf.length < 11) {
      alert('Favor preencher um CPF válido de 11 dígitos para verificação do titular.');
      return;
    }

    if (!pixKey) {
      alert('Favor digitar sua Chave Pix.');
      return;
    }

    setIsProcessingWithdraw(true);

    // Simulate central bank and KYC checks mandated by Law 14.790/2023
    setTimeout(() => {
      const success = onWithdraw(value);
      setIsProcessingWithdraw(false);

      if (success) {
        const newTx: Transaction = {
          id: `tx-${Math.random().toString(36).substr(2, 9)}`,
          type: 'saque',
          amount: value,
          status: 'concluido',
          date: new Date().toLocaleString('pt-BR'),
          pixKey: pixKey,
        };
        onAddTransaction(newTx);
        
        setShowStatusMessage(`Saque de R$ ${value.toFixed(2)} enviado à sua conta com sucesso! Liquidação bancária concluída.`);
        setWithdrawAmount('');
        setCpf('');
        setPixKey('');
        setTimeout(() => setShowStatusMessage(null), 3500);
      } else {
        alert('Falha interna ao processar saque. Verifique seu saldo.');
      }
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-[#0a0b12] border border-[#1c1f32] rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-slate-100 animate-in fade-in"
      >
        {/* Header */}
        <div className="p-5 bg-[#07080f] border-b border-[#1c1f32] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <DollarSign className="text-brand w-5 h-5 shadow-[0_0_10px_rgba(0,255,135,0.25)]" />
            <h3 className="font-extrabold text-lg text-white font-sans">Caixa Regulamento Pix</h3>
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
            onClick={() => { setActiveTab('deposit'); setGeneratedPixCode(null); }}
            className={`flex-1 py-3 text-xs uppercase tracking-wider font-extrabold transition-all rounded-lg flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'deposit' 
                ? 'bg-[#151724] text-brand border border-[#23273e]' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4 text-brand animate-pulse" />
            Depositar
          </button>
          <button
            onClick={() => { setActiveTab('coupon'); }}
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
            onClick={() => { setActiveTab('withdraw'); }}
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
            {showStatusMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-brand/5 border border-brand/20 text-brand p-4 rounded-xl text-xs space-y-2 mb-4 flex items-start gap-2.5 shadow-[0_0_12px_rgba(0,255,135,0.15)]"
              >
                <div className="p-1 bg-brand text-slate-950 rounded-full shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm">Transação Concluída</h4>
                  <p className="mt-0.5 text-slate-300 leading-relaxed">{showStatusMessage}</p>
                </div>
              </motion.div>
            )}

            {/* TAB DEPOSITO */}
            {activeTab === 'deposit' && !showStatusMessage && (
              <motion.div
                key="deposit-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 flex-1 flex flex-col justify-between animate-in fade-in"
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 text-xs">Insira o valor do depósito:</span>
                    <span className="text-brand text-xs font-semibold">Mínimo R$ 5,00</span>
                  </div>
                  
                  {/* Currency input */}
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-500">R$</span>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => {
                        setDepositAmount(e.target.value);
                        setGeneratedPixCode(null);
                      }}
                      className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-brand rounded-xl py-3.5 pl-11 pr-4 text-xl font-bold text-white focus:outline-none"
                      placeholder="0,00"
                    />
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[20, 50, 100, 200].map((v) => (
                      <button
                        key={v}
                        onClick={() => handlePresetDeposit(v)}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          depositAmount === v.toString()
                            ? 'bg-brand/10 border-brand text-brand font-black'
                            : 'bg-[#040508] border-[#1b1e2e] text-slate-400 hover:border-[#2a2f47] hover:text-white'
                        }`}
                      >
                        + R${v}
                      </button>
                    ))}
                  </div>

                  {/* Regulatory Info */}
                  <div className="mt-4 p-3 bg-[#0d0e16] rounded-xl border border-[#1c1f32] flex gap-2 text-[10px] text-slate-400 leading-relaxed">
                    <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                    <p>
                      Conforme regulamento do Coaf e SPA/MF, os depósitos devem ser efetuados apenas por PIX originados de contas de mesma titularidade (mesmo CPF). Não aceitamos depósitos de terceiros ou cartões corporativos.
                    </p>
                  </div>
                </div>

                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Loader2 className="w-8 h-8 text-brand animate-spin" />
                    <span className="text-xs text-slate-400 mt-2">Criptografando chave Pix oficial...</span>
                  </div>
                ) : generatedPixCode ? (
                  <div className="bg-[#05060a] p-4 rounded-xl border border-[#1b1e2e] space-y-3 mt-4">
                    <div className="flex items-center justify-center bg-white p-3 rounded-lg w-32 h-32 mx-auto">
                      <QrCode className="w-full h-full text-slate-900" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Escaneie o QR Code acima ou use o código:</p>
                    </div>
                    <div className="flex items-center gap-2 bg-[#090a10] p-2 rounded-lg border border-[#1c1e2f]">
                      <input
                        type="text"
                        readOnly
                        value={generatedPixCode.substring(0, 36) + '...'}
                        className="bg-transparent text-xs text-slate-405 font-mono flex-1 focus:outline-none"
                      />
                      <button
                        onClick={handleCopyCode}
                        className="bg-brand hover:bg-[#00e074] text-slate-950 p-2 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Copiar Código Pix"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <button
                      onClick={handleSimulatePayment}
                      className="w-full bg-brand hover:bg-[#00e074] text-slate-950 font-black py-3 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(0,255,135,0.2)] hover:scale-[1.01]"
                    >
                      <Sparkles className="w-4 h-4 text-slate-950 animate-pulse" /> Confirmar Pagamento Simulado
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateDepositPix}
                    disabled={parseFloat(depositAmount) < 5 || !depositAmount}
                    className="w-full bg-brand hover:bg-[#00e074] disabled:bg-[#151724] disabled:text-[#383d5a] disabled:border-none disabled:cursor-not-allowed text-slate-950 font-black py-3.5 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider mt-5 shadow-[0_0_15px_rgba(0,255,135,0.15)] hover:scale-[1.01]"
                  >
                    Gerar Copia e Cola Pix
                  </button>
                )}
              </motion.div>
            )}

            {/* TAB CUPONS */}
            {activeTab === 'coupon' && !showStatusMessage && (
              <motion.div
                key="coupon-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 flex-1 flex flex-col justify-between animate-in fade-in"
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
                </div>
              </motion.div>
            )}

            {/* TAB SAQUE */}
            {activeTab === 'withdraw' && !showStatusMessage && (
              <motion.form
                key="withdraw-tab"
                onSubmit={handleRequestWithdraw}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3.5 flex-1 flex flex-col justify-between animate-in fade-in"
              >
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-400 text-xs">Valor do Saque:</span>
                    <span className="text-indigo-400 text-xs font-semibold">Disponível: R$ {balance.toFixed(2)}</span>
                  </div>
                  
                  {/* Currency input */}
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-500">R$</span>
                    <input
                      type="number"
                      required
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-indigo-500 rounded-xl py-3 pl-11 pr-4 text-lg font-bold text-white focus:outline-none"
                      placeholder="0,00"
                    />
                  </div>

                  {/* CPF Input - Law 14.790 dictates payments exclusively paid to same CPF account */}
                  <div className="mt-3.5">
                    <label className="block text-xs text-slate-400 mb-1">CPF de Titularidade Obrigatório:</label>
                    <input
                      type="text"
                      required
                      value={cpf}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 11) setCpf(val);
                      }}
                      className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-indigo-505 rounded-xl py-2.5 px-3.5 text-xs font-mono text-white placeholder-slate-650 focus:outline-none"
                      placeholder="Ex: 12345678900 (apenas números)"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">O CPF inserido deve pertencer à conta bancária de recebimento.</span>
                  </div>

                  {/* Pix Key Selection */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {['cpf', 'celular', 'chave-aleatoria'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPixType(type)}
                        className={`py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer text-center capitalize ${
                          pixType === type
                            ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                            : 'bg-[#040508] border-[#1b1e2e] text-slate-400'
                        }`}
                      >
                        {type.replace('-', ' ')}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs text-slate-400 mb-1">Insira a sua Chave Pix correspondente:</label>
                    <input
                      type="text"
                      required
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-indigo-505 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-650 focus:outline-none"
                      placeholder={pixType === 'cpf' ? 'Digite seu CPF (com pontos/traço)' : pixType === 'celular' ? 'Ex: (11) 99999-9999' : 'Chave Pix'}
                    />
                  </div>
                </div>

                {isProcessingWithdraw ? (
                  <div className="flex flex-col items-center justify-center py-5">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <span className="text-xs text-slate-400 mt-2.5 text-center">
                      Comunicando ao Banco Central & Receita Federal... <br />
                      <small className="text-slate-505 block mt-0.5">Validando compliance tributário e titularidade.</small>
                    </span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={parseFloat(withdrawAmount) < 10 || !withdrawAmount || parseFloat(withdrawAmount) > balance || !cpf || !pixKey}
                    className="w-full bg-indigo-600 disabled:bg-[#151724] disabled:text-[#383d5a] disabled:border-none disabled:cursor-not-allowed hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider mt-5 shadow-[0_0_12px_rgba(99,102,241,0.2)] hover:scale-[1.01]"
                  >
                    Solicitar Saque Imediato
                  </button>
                )}
              </motion.form>
            )}
          </AnimatePresence>

          {/* Bottom simulated records list */}
          {transactions.length > 0 && (
            <div className="mt-5 border-t border-[#1b1e2e] pt-4">
              <h4 className="text-xs font-semibold text-slate-400 mb-2">Últimas transações de caixa:</h4>
              <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center bg-[#040508] p-2 rounded-lg text-xs border border-[#1c1e2f]">
                    <div className="flex items-center gap-2">
                      {tx.type === 'deposito' ? (
                        <span className="text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded text-[10px]">DEP</span>
                      ) : (
                        <span className="text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded text-[10px]">SAQ</span>
                      )}
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
