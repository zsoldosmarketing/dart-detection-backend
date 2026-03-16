import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User, Loader2, Zap, TrendingUp, Dumbbell, Target, Heart, RefreshCw } from 'lucide-react';
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
  { label: 'Elemezd a játékomat', action: 'analyze', icon: TrendingUp, color: 'text-blue-500' },
  { label: 'Javasolj gyakorlatokat', action: 'suggest_drills', icon: Dumbbell, color: 'text-emerald-500' },
  { label: 'Heti összefoglaló', action: 'weekly_summary', icon: Zap, color: 'text-amber-500' },
  { label: 'Edzésterv kérés', action: 'generate_plan', icon: Target, color: 'text-rose-500' },
  { label: 'Motiválj!', action: 'motivate', icon: Heart, color: 'text-pink-500' },
];

const EXAMPLE_QUESTIONS = [
  'Szeretnék 65-ös átlagot elérni',
  'Min kellene fejlődnöm?',
  'Milyen kiszállókat gyakoroljak?',
  'Csináljunk edzéstervet a hétre',
];

export function AIChatPanel({ conversationId, onConversationCreated }: AIChatPanelProps) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isGreeting, setIsGreeting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const greetingFiredRef = useRef(false);

  useEffect(() => {
    if (conversationId) {
      loadHistory(conversationId);
      greetingFiredRef.current = true;
    } else {
      setMessages([]);
      greetingFiredRef.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId && !greetingFiredRef.current && user && messages.length === 0) {
      greetingFiredRef.current = true;
      sendGreeting();
    }
  }, [user, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    setIsGreeting(true);
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
        body: JSON.stringify({ action: 'greeting', context: 'ai_trainer' }),
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
        if (data.conversation_id) onConversationCreated(data.conversation_id);
      }
    } catch {
    } finally {
      setIsGreeting(false);
    }
  };

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

    const displayText = action ? QUICK_ACTIONS.find(q => q.action === action)?.label || text : text;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayText,
      created_at: new Date().toISOString(),
    };

    if (!action) setInput('');
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
          message: action ? undefined : text,
          conversation_id: conversationId,
          action: action || 'chat',
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Hiba: ${data.error}`,
          created_at: new Date().toISOString(),
        }]);
      } else {
        if (data.conversation_id && !conversationId) {
          onConversationCreated(data.conversation_id);
        }
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          created_at: new Date().toISOString(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Kapcsolódási hiba. Kérlek próbáld újra.',
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

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {isLoadingHistory ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : isGreeting && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-xl shadow-primary-500/30">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-success-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
            </div>
            <div className="flex gap-1.5 items-center mt-2">
              <span className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm text-dark-400 mt-3">Az edző ír...</p>
          </div>
        ) : !hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-xl shadow-primary-500/30">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-success-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
            </div>
            <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-2">DartsCoach AI</h3>
            <p className="text-dark-500 dark:text-dark-400 text-sm max-w-sm mb-2 leading-relaxed">
              Az autonóm személyes darts edződ. Elemzem a statisztikáidat, célokat állítok, edzésterveket készítek, és figyelek minden meccsedre.
            </p>
            <button
              onClick={sendGreeting}
              className="flex items-center gap-1.5 text-xs text-primary-500 hover:text-primary-600 mb-6"
            >
              <RefreshCw className="w-3 h-3" />
              Üdvözlés betöltése
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm mb-4">
              {QUICK_ACTIONS.map((qa) => {
                const Icon = qa.icon;
                return (
                  <button
                    key={qa.action}
                    onClick={() => sendMessage(qa.label, qa.action)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-left group"
                  >
                    <Icon className={clsx('w-4 h-4 shrink-0', qa.color)} />
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                      {qa.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="w-full max-w-sm">
              <p className="text-xs text-dark-400 dark:text-dark-600 mb-2 text-left font-medium">Vagy kérdezz szabadon:</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-3 py-1.5 rounded-full bg-dark-100 dark:bg-dark-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 text-xs text-dark-600 dark:text-dark-400 transition-colors border border-dark-200 dark:border-dark-700 hover:border-primary-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
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
                    'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                    msg.role === 'user'
                      ? 'bg-primary-500'
                      : 'bg-gradient-to-br from-primary-500 to-primary-700'
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
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0">
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

      {hasMessages && !isGreeting && (
        <div className="px-3 py-2 flex gap-2 overflow-x-auto border-t border-dark-100 dark:border-dark-800 shrink-0">
          {QUICK_ACTIONS.slice(0, 4).map((qa) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.action}
                onClick={() => sendMessage(qa.label, qa.action)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-xs font-medium text-dark-600 dark:text-dark-300 hover:text-primary-600 whitespace-nowrap disabled:opacity-50 shrink-0"
              >
                <Icon className={clsx('w-3 h-3', qa.color)} />
                {qa.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-4 border-t border-dark-200/50 dark:border-dark-700/50 shrink-0">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Írj az AI edzőnek... (pl. 'Szeretnék javítani a kiszállóimon')"
              rows={1}
              disabled={isLoading || isGreeting}
              className="w-full px-4 py-3 pr-4 bg-dark-50 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-2xl text-sm text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all leading-relaxed disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <Button
            onClick={() => sendMessage()}
            disabled={isLoading || isGreeting || !input.trim()}
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
          DartsCoach AI · Groq LLaMA 70B · Autonóm edző
        </p>
      </div>
    </div>
  );
}
