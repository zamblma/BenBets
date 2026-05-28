import React from 'react';
import { ShieldCheck, Landmark, DollarSign, Globe, HeartHandshake, AlertTriangle, FileText, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface ApostasInfoProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApostasInfo({ isOpen, onClose }: ApostasInfoProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-xs transition-opacity">
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-lg h-full bg-[#0a0b12] border-l border-[#1c1f32] shadow-2xl overflow-y-auto text-slate-100 flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#1c1f32] flex justify-between items-center bg-[#07080f]">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-brand w-6 h-6 animate-pulse" />
            <h2 className="text-xl font-extrabold tracking-tight text-white font-sans">
              Regulamentação de Apostas no Brasil
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-[#161826] p-2 rounded-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Intro Alert */}
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-200 text-sm leading-relaxed">
            <AlertTriangle className="text-amber-400 shrink-0 w-5 h-5" />
            <div>
              <p className="font-extrabold text-amber-300">Atenção ao iGaming Nacional</p>
              <p className="mt-1 text-slate-300">
                O setor de apostas de quota fixa ("Bets") mudou drasticamente. A partir de 2025, operar no mercado brasileiro sem a devida conformidade com a Secretaria de Prêmios e Apostas (SPA/MF) é considerado contravenção penal severa.
              </p>
            </div>
          </div>

          {/* Pillars of Law */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand" />
              Requisitos Legais Operacionais
            </h3>

            {/* Pillar 1 */}
            <div className="bg-[#0b0c13] p-4 rounded-xl border border-[#1b1e2e]/80 hover:border-brand/20 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="bg-brand/10 p-2 rounded-lg border border-brand/20">
                  <Landmark className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white">Licenciamento SPA/MF</h4>
                  <p className="text-slate-400 text-xs">Taxa de Outorga de R$ 30 milhões</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                A outorga tem validade de **5 anos** para exploração de até três marcas comerciais por CNPJ autorizado. Além disso, a empresa deve obrigatoriamente estar constituída no Brasil, possuindo pelo menos um sócio brasileiro com 20% do capital social.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-[#0b0c13] p-4 rounded-xl border border-[#1b1e2e]/80 hover:border-brand/20 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="bg-brand/10 p-2 rounded-lg border border-brand/20">
                  <Globe className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white">Extensão de Domínio Obrigatória</h4>
                  <p className="text-slate-400 text-xs text-brand font-bold">Obrigatório sufixo `.bet.br`</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                A SPA/MF determinou que todas as casas licenciadas devem usar exclusivamente a extensão de internet **.bet.br**. Provedores de internet bloqueiam todas as plataformas ativas no território nacional que operam em domínios comuns como `.com` ou `.org` sem licença.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-[#0b0c13] p-4 rounded-xl border border-[#1b1e2e]/80 hover:border-brand/20 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="bg-brand/10 p-2 rounded-lg border border-brand/20">
                  <DollarSign className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white">Tributação Especial (GGR & Prêmios)</h4>
                  <p className="text-slate-400 text-xs">Impostos para Operador e Apostador</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                **Operadoras**: Imposto de **12%** sobre o GGR (Gross Gaming Revenue – arrecadação bruta subtraindo o bônus de premiações pagas aos jogadores).<br />
                **Apostadores**: Imposto de Renda de **15%** cobrado anualmente sobre o ganho líquido que exceder a isenção da tabela do IR (retido na fonte em alguns casos).
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="bg-[#0b0c13] p-4 rounded-xl border border-[#1b1e2e]/80 hover:border-brand/20 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="bg-brand/10 p-2 rounded-lg border border-brand/20">
                  <HeartHandshake className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white">Políticas de Jogo Responsável</h4>
                  <p className="text-slate-400 text-xs">Segurança Social e Financeira</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                Estão terminantemente proibidos pagamentos com **cartões de crédito, dinheiro físico, criptoativos, boletos ou cheques**, visando prevenir o superendividamento. A única transação imediata autorizada é o **Pix** de contas correntes de mesma titularidade (CPF idêntico).
              </p>
            </div>
          </div>

          {/* Verification requirements */}
          <div className="bg-[#121422] p-4 rounded-xl border border-[#21253d] space-y-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-brand" />
              Requisitos Técnicos dos Sistemas (SLA/SPA)
            </h4>
            <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
              <li>Certificação de software emitida por laboratórios credenciados (GLI, BMM Testlabs).</li>
              <li>Integração em tempo real de dados de apostas com a plataforma fiscalizadora do Ministério da Fazenda.</li>
              <li>Sistemas robustos de verificação de identidade baseados em biometria e consulta ao CPF (KYC - Know Your Customer).</li>
              <li>Prevenção à Lavagem de Dinheiro através de alertas automatizados de transações suspeitas.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1c1f32] bg-[#07080f] text-center">
          <p className="text-xs text-slate-450">
            Este painel serve como demonstrativo pedagógico do cenário legal brasileiro. 
            Apenas aposte com moderação. Jogo proibido para menores de 18 anos.
          </p>
          <button 
            onClick={onClose}
            className="mt-4 w-full bg-brand hover:bg-[#00e074] text-slate-950 font-black py-3 px-4 rounded-xl transition-all shadow-[0_0_12px_rgba(0,255,135,0.15)] cursor-pointer text-sm uppercase tracking-wider"
          >
            Entendi, voltar ao site
          </button>
        </div>
      </motion.div>
    </div>
  );
}
