import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User, Loader2, Zap, TrendingUp, Dumbbell, Target, Heart } from 'lucide-react';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import clsx from 'clsx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface AIChatPanelProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}

const QUICK_ACTIONS = [
  { label: 'Elemezd a játékomat', action: 'analyze', icon: TrendingUp },
  { label: 'Javasolj gyakorlatokat', action: 'suggest_drills', icon: Dumbbell },
  { label: 'Heti összefoglaló', action: 'weekly_summary', icon: Zap },
  { label: 'Edzésterv kérés', action: 'generate_plan', icon: Target },
  { label: 'Motiválj!', action: 'motivate', icon: Heart },
];

export function AIChatPanel({ conversationId, onConversationCreated }: AIChatPanelProps) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (conversationId) {
      loadHistory(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadHistory = async (convId: string) => {
    setIsLoadingHistory(true);
    const { data } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
    setIsLoadingHistory(false);
  };

  const sendMessage = async (messageText?: string, action?: string) => {
    const text = messageText || input.trim();
    if (!text && !action) return;
    if (isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: action ? QUICK_ACTIONS.find(q => q.action === action)?.label || text : text,
      created_at: new Date().toISOString(),
    };

    if (!action) setInput('');
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
          message: action ? undefined : text,
          conversation_id: conversationId,
          action: action || 'chat',
        }),
      });

      const data = await res.json();

      if (data.error) {
        const errMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Hiba: ${data.error}`,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errMsg]);
      } else {
        if (data.conversation_id && !conversationId) {
          onConversationCreated(data.conversation_id);
        }
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Kapcsolódási hiba. Kérlek próbáld újra.',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
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

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {isLoadingHistory ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-xl shadow-primary-500/30">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-success-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
            </div>
            <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-2">
              DartsCoach AI
            </h3>
            <p className="text-dark-500 dark:text-dark-400 text-sm max-w-sm mb-8 leading-relaxed">
              A személyes darts edződ. Elemzem a statisztikáidat, javaslatokat teszek és segítek célokat elérni.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_ACTIONS.map((qa) => {
                const Icon = qa.icon;
                return (
                  <button
                    key={qa.action}
                    onClick={() => sendMessage(qa.label, qa.action)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-left group"
                  >
                    <Icon className="w-4 h-4 text-primary-500 shrink-0" />
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                      {qa.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={clsx('flex gap-3 max-w-[90%]', msg.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
              >
                <div
                  className={clsx(
                    'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                    msg.role === 'user'
                      ? 'bg-primary-500'
                      : 'bg-gradient-to-br from-secondary-500 to-primary-600'
                  )}
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div
                  className={clsx(
                    'rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white rounded-tr-sm'
                      : 'bg-white dark:bg-dark-800 border border-dark-200/60 dark:border-dark-700/60 text-dark-800 dark:text-dark-100 rounded-tl-sm shadow-sm'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 max-w-[90%]">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-secondary-500 to-primary-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white dark:bg-dark-800 border border-dark-200/60 dark:border-dark-700/60 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5 items-center h-5">
                    <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {!isEmpty && (
        <div className="px-3 py-2 flex gap-2 overflow-x-auto border-t border-dark-100 dark:border-dark-800">
          {QUICK_ACTIONS.slice(0, 3).map((qa) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.action}
                onClick={() => sendMessage(qa.label, qa.action)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-xs font-medium text-dark-600 dark:text-dark-300 hover:text-primary-600 whitespace-nowrap disabled:opacity-50"
              >
                <Icon className="w-3 h-3" />
                {qa.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-4 border-t border-dark-200/50 dark:border-dark-700/50">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Írj az AI edzőnek..."
              rows={1}
              disabled={isLoading}
              className="w-full px-4 py-3 pr-4 bg-dark-50 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-2xl text-sm text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all leading-relaxed disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <Button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center p-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="text-center text-[10px] text-dark-400 dark:text-dark-600 mt-2">
          DartsCoach AI · Groq powered
        </p>
      </div>
    </div>
  );
}
