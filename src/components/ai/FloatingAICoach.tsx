import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, User, Loader2, Minimize2, Maximize2, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
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

const CONTEXT_PROMPTS: Record<string, string> = {
  game: 'analyze',
  training: 'suggest_drills',
  dashboard: 'weekly_summary',
};

const CONTEXT_LABELS: Record<string, string> = {
  game: 'Meccs elemzés',
  training: 'Edzés javaslat',
  dashboard: 'Heti összefoglaló',
};

export function FloatingAICoach({ context }: FloatingAICoachProps) {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0 && user) {
      sendGreeting();
    }
    if (isOpen) setHasUnread(false);
  }, [isOpen]);

  const sendGreeting = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-ai`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'greeting', context }),
      });
      const data = await res.json();
      if (data.message) {
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          created_at: new Date().toISOString(),
        };
        setMessages([aiMsg]);
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
      content: msg || CONTEXT_LABELS[context || ''] || 'Elemzés',
      created_at: new Date().toISOString(),
    };

    setInput('');
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-ai`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: action ? undefined : msg,
          conversation_id: conversationId,
          action: action || 'chat',
          context,
        }),
      });

      const data = await res.json();
      if (data.conversation_id && !conversationId) setConversationId(data.conversation_id);

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message || data.error || 'Hiba történt.',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
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

  if (!user) return null;

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && !isMinimized && (
        <div className="w-80 md:w-96 bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-2xl shadow-2xl shadow-black/20 flex flex-col overflow-hidden animate-slide-up"
          style={{ height: '480px' }}>
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">DartsCoach AI</p>
              <p className="text-[10px] text-white/70">Személyes edződ · mindig itt vagyok</p>
            </div>
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

          {context && CONTEXT_PROMPTS[context] && messages.length <= 1 && (
            <div className="px-3 py-2 border-b border-dark-100 dark:border-dark-800 shrink-0">
              <button
                onClick={() => sendMessage(CONTEXT_LABELS[context], CONTEXT_PROMPTS[context])}
                disabled={isLoading}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-100 transition-colors disabled:opacity-50"
              >
                <span>{CONTEXT_LABELS[context]}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {isLoading && messages.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
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

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-xl shadow-primary-500/40 hover:shadow-primary-500/60 hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <Sparkles className="w-6 h-6 text-white" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-error-500 rounded-full border-2 border-white dark:border-dark-950 animate-pulse" />
          )}
        </button>
      )}
    </div>
  );
}
