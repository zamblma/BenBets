import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  AlertCircle,
} from 'lucide-react';
import type { LiveChatMessage, LeaderboardEntry } from '../firebase/db';
import type { PlacedBet } from '../types';
import { useSound } from '../hooks/useSound';

interface LiveChatProps {
  messages: LiveChatMessage[];
  currentUserId: string;
  currentUserName: string;
  onlineCount: number;
  onlineUids: string[];
  leaderboard?: LeaderboardEntry[];
  placedBets?: PlacedBet[];
  permissionError?: boolean;
  onSendMessage: (text: string, extra?: { kind?: 'text' | 'win'; badgeText?: string }) => Promise<boolean>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  compactHeightClass?: string;
  hideCollapseButton?: boolean;
}

const AVATAR_COLORS = [
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  'bg-purple-500/20 text-purple-300 border-purple-500/40',
  'bg-amber-500/20 text-amber-300 border-amber-500/40',
  'bg-rose-500/20 text-rose-300 border-rose-500/40',
  'bg-sky-500/20 text-sky-300 border-sky-500/40',
];

const QUICK_PHRASES = ['🔥 Boa!', '🚀 Lua!', '💎 Que sorte!', '⚽ Gol!', '🤝 GG'];

function getAvatarTone(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'BG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatMessageTime(ts: number): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function LiveChat({
  messages,
  currentUserId,
  onlineCount,
  onlineUids,
  leaderboard = [],
  placedBets = [],
  permissionError = false,
  onSendMessage,
  onDeleteMessage,
  compactHeightClass = 'h-[360px] lg:h-[380px]',
  hideCollapseButton = false,
}: LiveChatProps) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [chatMuted, setChatMuted] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const prevLenRef = useRef(messages.length);
  const { play } = useSound();

  const onlineSet = useMemo(() => new Set(onlineUids), [onlineUids]);

  const rankByUid = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...leaderboard].sort((a, b) =>
      b.balance !== a.balance ? b.balance - a.balance : b.betsWon - a.betsWon
    );
    sorted.slice(0, 3).forEach((entry, idx) => {
      map.set(entry.uid, idx + 1);
    });
    return map;
  }, [leaderboard]);

  const latestWonBet = useMemo(
    () => placedBets.find((b) => b.status === 'won' && b.potentialPayout > 0) || null,
    [placedBets]
  );

  // Auto-scroll & subtle sound ping on new remote message
  useEffect(() => {
    const prevLen = prevLenRef.current;
    prevLenRef.current = messages.length;

    if (messages.length > prevLen) {
      const last = messages[messages.length - 1];
      if (last && last.uid !== currentUserId && !chatMuted) {
        play('tick');
      }
      if (stickToBottomRef.current && listRef.current) {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages, currentUserId, chatMuted, play]);

  useEffect(() => {
    if (!collapsed && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [collapsed]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 72;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const ok = await onSendMessage(trimmed);
      if (ok) {
        setInputText('');
        stickToBottomRef.current = true;
        play('click');
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
          }
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleQuickSend = async (phrase: string) => {
    if (sending) return;
    setSending(true);
    try {
      const ok = await onSendMessage(phrase);
      if (ok) {
        stickToBottomRef.current = true;
        play('click');
      }
    } finally {
      setSending(false);
    }
  };

  const handleShareWin = async () => {
    if (!latestWonBet || sending) return;
    setSending(true);
    try {
      const oddsStr =
        typeof latestWonBet.odds === 'number' && latestWonBet.odds > 0
          ? ` (@${latestWonBet.odds.toFixed(2)})`
          : '';
      const text = `Acabei de ganhar R$ ${latestWonBet.potentialPayout.toFixed(2)} em ${latestWonBet.matchName}${oddsStr}!`;
      const badgeText = `+R$ ${latestWonBet.potentialPayout.toFixed(2)}${oddsStr}`;
      const ok = await onSendMessage(text, { kind: 'win', badgeText });
      if (ok) {
        stickToBottomRef.current = true;
        play('win');
      }
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (msgId: string) => {
    if (deletingId) return;
    setDeletingId(msgId);
    try {
      await onDeleteMessage(msgId);
      play('click');
    } finally {
      setDeletingId(null);
    }
  };

  const effectiveHeightClass = collapsed ? 'h-auto' : compactHeightClass;

  return (
    <div className={`omnitrix-panel rounded-2xl overflow-hidden flex flex-col relative ${effectiveHeightClass}`}>
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[#1b1e2e] bg-[#07080f] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-brand/15 border border-brand/25 text-brand shrink-0">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold font-display text-white uppercase tracking-wider truncate">
                Chat Ao Vivo
              </h3>
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold bg-brand/10 border border-brand/25 text-brand px-1.5 py-0.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                {Math.max(1, onlineCount)} online
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setChatMuted((v) => !v)}
            className="p-1.5 rounded-lg bg-[#0c0e17] border border-[#1d2133] text-slate-400 hover:text-brand hover:border-brand/35 transition-colors cursor-pointer"
            title={chatMuted ? 'Ativar som do chat' : 'Silenciar som do chat'}
          >
            {chatMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-brand" />}
          </button>
          {!hideCollapseButton && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="p-1.5 rounded-lg bg-[#0c0e17] border border-[#1d2133] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={collapsed ? 'Expandir chat' : 'Minimizar chat'}
            >
              {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Permission warning fallback if Firestore rules block */}
          {permissionError && (
            <div className="mx-3 mt-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-[10px] text-amber-200 flex items-center gap-2 shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Regras do Firebase limitaram a leitura global do chat. Suas mensagens continuam visíveis para você.</span>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2 min-h-0"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4 text-slate-500 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-700 stroke-[1.5]" />
                <p className="text-xs leading-relaxed">
                  Nenhuma mensagem ainda.<br />
                  Mande um salve para os jogadores online!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.uid === currentUserId;
                const isOnline = isMe || onlineSet.has(msg.uid);
                const topRank = rankByUid.get(msg.uid);
                const isWin = msg.kind === 'win';
                const medal = topRank === 1 ? '🥇' : topRank === 2 ? '🥈' : topRank === 3 ? '🥉' : null;

                return (
                  <div
                    key={msg.id}
                    className={`rounded-xl px-2.5 py-2 border transition-colors ${
                      isWin
                        ? 'bg-gradient-to-r from-brand/10 via-emerald-950/20 to-[#0a0d16] border-brand/35'
                        : isMe
                          ? 'bg-[#101522] border-brand/25'
                          : 'bg-[#080a12] border-[#181c2c]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Avatar */}
                      <div className="relative shrink-0 mt-0.5">
                        <div
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[10px] font-mono font-black ${getAvatarTone(
                            msg.uid
                          )}`}
                        >
                          {getInitials(msg.userName)}
                        </div>
                        {isOnline && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand border border-[#080a12]"
                            title="Online agora"
                          />
                        )}
                      </div>

                      {/* Message Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {medal && (
                              <span className="text-[11px] leading-none shrink-0" title={`Top #${topRank}`}>
                                {medal}
                              </span>
                            )}
                            <span className={`text-[11px] font-bold truncate ${isMe ? 'text-brand' : 'text-slate-200'}`}>
                              {msg.userName}
                            </span>
                            {isMe && (
                              <span className="text-[7px] font-mono font-black bg-brand/20 text-brand border border-brand/30 px-1 rounded shrink-0">
                                VOCÊ
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-mono text-slate-500">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                            {isMe && (
                              <button
                                type="button"
                                disabled={deletingId === msg.id}
                                onClick={() => handleDelete(msg.id)}
                                className="text-slate-600 hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-40"
                                title="Apagar mensagem"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {isWin && msg.badgeText && (
                          <div className="inline-flex items-center gap-1 mt-1 mb-0.5 text-[9px] font-mono font-bold bg-brand/15 border border-brand/35 text-brand px-1.5 py-0.5 rounded-md">
                            <Trophy className="w-2.5 h-2.5" />
                            <span>{msg.badgeText}</span>
                          </div>
                        )}

                        <p className="text-xs text-slate-200 leading-snug break-words mt-0.5">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Reactions + Share Latest Win */}
          <div className="px-3 pt-2 pb-1.5 border-t border-[#141726] bg-[#070910] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            {latestWonBet && (
              <button
                type="button"
                disabled={sending}
                onClick={handleShareWin}
                className="px-2 py-1 rounded-lg bg-brand/15 hover:bg-brand/25 border border-brand/35 text-brand text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all shrink-0 flex items-center gap-1 disabled:opacity-50"
                title="Divulgar sua última vitória no chat"
              >
                <Trophy className="w-3 h-3" />
                <span>Compartilhar Vitória</span>
              </button>
            )}
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                disabled={sending}
                onClick={() => handleQuickSend(phrase)}
                className="px-2 py-1 rounded-lg bg-[#0d101b] hover:bg-[#161b2d] border border-[#1d2236] hover:border-brand/35 text-slate-300 text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-all shrink-0 disabled:opacity-50"
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSubmit} className="p-2.5 pt-1.5 bg-[#070910] flex items-center gap-2 shrink-0">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                maxLength={220}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Conversar com os jogadores..."
                className="w-full bg-[#04050a] border border-[#1f2438] focus:border-brand/60 rounded-xl px-3 py-2 text-base sm:text-xs text-white placeholder-slate-500 outline-none transition-colors"
              />
              {inputText.length > 160 && (
                <span className="absolute right-2.5 bottom-1 text-[8px] font-mono text-slate-500 pointer-events-none">
                  {inputText.length}/220
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="px-3 py-2 rounded-xl bg-brand hover:bg-[#00e074] disabled:bg-[#181b28] disabled:text-slate-500 text-slate-950 font-black text-xs cursor-pointer transition-all flex items-center justify-center gap-1 shrink-0 min-h-[38px] min-w-[42px]"
              title="Enviar mensagem"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
