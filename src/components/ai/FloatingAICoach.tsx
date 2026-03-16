import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Send, Bot, User, Loader2, Minimize2, Maximize2,
  ChevronRight, Bell
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { aiCoachService } from '../../lib/aiCoachService';
import clsx from 'clsx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface FloatingAICoachProps {
  context?: string;
}

const CONTEXT_ACTIONS: Record<string, { action: string; label: string }> = {
  game: { action: 'analyze', label: 'Meccs elemzés' },
  training: { action: 'suggest_drills', label: 'Edzési javaslat' },
  dashboard: { action: 'weekly_summary', label: 'Heti összefoglaló' },
  statistics: { action: 'analyze', label: 'Statisztika elemzés' },
  tournament: { action: 'motivate', label: 'Torna tipp' },
  profile: { action: 'weekly_summary', label: 'Fejlődési áttekintés' },
  general: { action: 'analyze', label: 'Gyors elemzés' },
};

const PROACTIVE_NUDGES: Record<string, string> = {
  game: 'Kész a meccsre? Az edződ tud segíteni a mai stratégiában!',
  training: 'Jó edzést! Kérdezd az edződöt melyik drillt érdemes ma csinálni.',
  dashboard: 'Az edződ figyeli a fejlődésedet — szeretnél egy gyors áttekintést?',
  statistics: 'Látom a statisztikáidat — szeretnél egy részletes elemzést?',
  tournament: 'Tornán vagy? Segíthetek a stratégiában és a mentális felkészüléssel!',
  profile: 'Nézed a profilodat? Megmutatom hol fejlődhetsz a legtöbbet!',
  general: 'Miben segíthetek ma? Kérdezz bármit a darts edző-tól!',
};

const PROACTIVE_DELAY_MS = 90000;

export function FloatingAICoach({ context }: FloatingAICoachProps) {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [proactiveMessage, setProactiveMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const greetingFiredRef = useRef(false);
  const proactiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextRef = useRef(context);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
    const channel = supabase
      .channel(`ai-insights-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_insights',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        setUnreadCount(prev => prev + 1);
        if (!isOpen) {
          setProactiveMessage('Az AI edződ új elemzést írt neked!');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || isOpen) return;
    if (proactiveTimerRef.current) clearTimeout(proactiveTimerRef.current);

    proactiveTimerRef.current = setTimeout(async () => {
      const ctx = contextRef.current;
      if (!ctx || isOpen) return;
      const nudge = PROACTIVE_NUDGES[ctx];
      if (nudge) setProactiveMessage(nudge);
    }, PROACTIVE_DELAY_MS);

    return () => {
      if (proactiveTimerRef.current) clearTimeout(proactiveTimerRef.current);
    };
  }, [context, user?.id, isOpen]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const count = await aiCoachService.getUnreadInsightsCount(user.id);
    setUnreadCount(count);
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setProactiveMessage(null);
      if (messages.length === 0 && !greetingFiredRef.current && user) {
        greetingFiredRef.current = true;
        sendGreeting();
      }
    }
  }, [isOpen]);

  const getValidToken = async (): Promise<string | null> => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    if (session.expires_at && session.expires_at * 1000 < Date.now() + 10000) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session;
    }
    return session?.access_token ?? null;
  };

  const sendGreeting = async () => {
    setIsLoading(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-ai`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'greeting', context, locale: localStorage.getItem('app-locale') || 'hu' }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          created_at: new Date().toISOString(),
        }]);
        if (data.conversation_id) setConversationId(data.conversation_id);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (text?: string, action?: string) => {
    const msg = text || input.trim();
    if (!msg && !action) return;
    if (isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: action ? CONTEXT_ACTIONS[context || '']?.label || msg : msg,
      created_at: new Date().toISOString(),
    };

    setInput('');
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const token = await getValidToken();
      if (!token) throw new Error('No session');
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-ai`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          message: action ? undefined : msg,
          conversation_id: conversationId,
          action: action || 'chat',
          context,
          locale: localStorage.getItem('app-locale') || 'hu',
        }),
      });

      const data = await res.json();
      if (data.conversation_id && !conversationId) setConversationId(data.conversation_id);

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message || data.error || 'Hiba történt.',
        created_at: new Date().toISOString(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Kapcsolódási hiba.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setProactiveMessage(null);
    if (unreadCount > 0 && user) {
      setUnreadCount(0);
      aiCoachService.markAllInsightsRead(user.id);
    }
  };

  if (!user) return null;

  const contextAction = context ? CONTEXT_ACTIONS[context] : null;
  const hasUnread = unreadCount > 0 || !!proactiveMessage;

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && !isMinimized && (
        <div
          className="w-80 md:w-96 bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-2xl shadow-2xl shadow-black/20 flex flex-col overflow-hidden animate-slide-up"
          style={{ height: '500px' }}
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">DartsCoach AI</p>
              <p className="text-[10px] text-white/70">Autonóm személyes edző · mindig itt vagyok</p>
            </div>
            {unreadCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full">
                <Bell className="w-3 h-3 text-white" />
                <span className="text-[10px] text-white font-bold">{unreadCount}</span>
              </div>
            )}
            <button
              onClick={() => setIsMinimized(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {contextAction && messages.length <= 1 && (
            <div className="px-3 py-2 border-b border-dark-100 dark:border-dark-800 shrink-0">
              <button
                onClick={() => sendMessage(undefined, contextAction.action)}
                disabled={isLoading}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-100 transition-colors disabled:opacity-50"
              >
                <span>{contextAction.label}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {isLoading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-xs text-dark-400">Az edző elemzi az adataidat...</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={clsx('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : '')}
                  >
                    <div className={clsx(
                      'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-1',
                      msg.role === 'user' ? 'bg-primary-500' : 'bg-gradient-to-br from-primary-500 to-primary-700'
                    )}>
                      {msg.role === 'user' ? (
                        <User className="w-3 h-3 text-white" />
                      ) : (
                        <Bot className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className={clsx(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary-500 text-white rounded-tr-sm'
                        : 'bg-dark-50 dark:bg-dark-800 text-dark-800 dark:text-dark-100 rounded-tl-sm border border-dark-200/50 dark:border-dark-700/50'
                    )}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && messages.length > 0 && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800 border border-dark-200/50 dark:border-dark-700/50 rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="p-3 border-t border-dark-200/50 dark:border-dark-700/50 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Kérdezz az edzőtől..."
                rows={1}
                disabled={isLoading}
                className="flex-1 px-3 py-2 bg-dark-50 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-xl text-xs text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:opacity-50 leading-relaxed"
                style={{ minHeight: '36px', maxHeight: '80px' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
                className="w-9 h-9 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-40 flex items-center justify-center transition-colors shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && isMinimized && (
        <div className="flex items-center gap-3 bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-2xl shadow-xl px-4 py-2.5 animate-slide-up">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-dark-800 dark:text-white">DartsCoach AI</span>
          <button
            onClick={() => setIsMinimized(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-400 hover:text-error-600 hover:bg-error-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!isOpen && proactiveMessage && (
        <div
          className="max-w-xs bg-white dark:bg-dark-900 border border-primary-200 dark:border-primary-800 rounded-2xl shadow-xl px-4 py-3 animate-slide-up cursor-pointer"
          onClick={handleOpen}
        >
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-0.5">DartsCoach AI</p>
              <p className="text-xs text-dark-700 dark:text-dark-300 leading-relaxed">{proactiveMessage}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setProactiveMessage(null); }}
              className="w-5 h-5 rounded flex items-center justify-center text-dark-400 hover:text-dark-600 shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button
          onClick={handleOpen}
          className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-xl shadow-primary-500/40 hover:shadow-primary-500/60 hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <Sparkles className="w-6 h-6 text-white" />
          {hasUnread && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-dark-950">
              {unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : '!'}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
