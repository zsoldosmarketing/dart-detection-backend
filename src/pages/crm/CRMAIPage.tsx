import { useState, useEffect } from 'react';
import { Sparkles, Key, Brain, Settings, BarChart3, MessageSquare, Users, Clock, Save, Eye, EyeOff, AlertCircle, CheckCircle, RefreshCw, Loader2, Zap, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

const GROQ_MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'LLaMA 3.3 70B Versatile', desc: 'Legjobb minőség, ajánlott' },
  { value: 'llama-3.1-8b-instant', label: 'LLaMA 3.1 8B Instant', desc: 'Gyors, alacsony latencia' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', desc: 'Nagy kontextusablak (32k)' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B', desc: 'Google modell, kiegyensúlyozott' },
];

interface AIConfig {
  groq_api_key: string;
  groq_model: string;
  ai_system_prompt: string;
  ai_enabled: boolean;
  ai_max_messages_per_day: number;
}

interface ConvStats {
  total_conversations: number;
  total_messages: number;
  active_users: number;
}

interface RecentConv {
  id: string;
  user_id: string;
  title: string;
  last_message_at: string;
  msg_count: number;
}

export function CRMAIPage() {
  const [config, setConfig] = useState<AIConfig>({
    groq_api_key: '',
    groq_model: 'llama-3.3-70b-versatile',
    ai_system_prompt: '',
    ai_enabled: true,
    ai_max_messages_per_day: 50,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [stats, setStats] = useState<ConvStats>({ total_conversations: 0, total_messages: 0, active_users: 0 });
  const [recentConvs, setRecentConvs] = useState<RecentConv[]>([]);
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<Record<string, { role: string; content: string; created_at: string }[]>>({});
  const [activeSection, setActiveSection] = useState<'config' | 'stats' | 'conversations'>('config');

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('key, value_json')
      .in('key', ['groq_api_key', 'groq_model', 'ai_system_prompt', 'ai_enabled', 'ai_max_messages_per_day']);

    if (data) {
      const map: Record<string, unknown> = {};
      data.forEach((item: { key: string; value_json: unknown }) => {
        try {
          map[item.key] = typeof item.value_json === 'string' ? JSON.parse(item.value_json) : item.value_json;
        } catch {
          map[item.key] = item.value_json;
        }
      });
      setConfig({
        groq_api_key: (map.groq_api_key as string) || '',
        groq_model: (map.groq_model as string) || 'llama-3.3-70b-versatile',
        ai_system_prompt: (map.ai_system_prompt as string) || '',
        ai_enabled: map.ai_enabled !== false,
        ai_max_messages_per_day: (map.ai_max_messages_per_day as number) || 50,
      });
    }
    setIsLoading(false);
  };

  const fetchStats = async () => {
    const [convsRes, msgsRes] = await Promise.all([
      supabase.from('ai_conversations').select('id, user_id, title, last_message_at'),
      supabase.from('ai_messages').select('id, created_at'),
    ]);

    const convs = convsRes.data || [];
    const msgs = msgsRes.data || [];
    const uniqueUsers = new Set(convs.map((c: { user_id: string }) => c.user_id));

    setStats({
      total_conversations: convs.length,
      total_messages: msgs.length,
      active_users: uniqueUsers.size,
    });

    const convMap: Record<string, number> = {};
    for (const conv of convs) {
      const { count } = await supabase.from('ai_messages').select('*', { count: 'exact', head: true }).eq('conversation_id', conv.id);
      convMap[conv.id] = count || 0;
    }

    setRecentConvs(
      convs
        .sort((a: { last_message_at: string }, b: { last_message_at: string }) =>
          new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        )
        .slice(0, 20)
        .map((c: { id: string; user_id: string; title: string; last_message_at: string }) => ({
          id: c.id,
          user_id: c.user_id,
          title: c.title,
          last_message_at: c.last_message_at,
          msg_count: convMap[c.id] || 0,
        }))
    );
  };

  const saveConfig = async () => {
    setIsSaving(true);
    setSavedOk(false);
    const updates = [
      { key: 'groq_api_key', value_json: JSON.stringify(config.groq_api_key) },
      { key: 'groq_model', value_json: JSON.stringify(config.groq_model) },
      { key: 'ai_system_prompt', value_json: JSON.stringify(config.ai_system_prompt) },
      { key: 'ai_enabled', value_json: JSON.stringify(config.ai_enabled) },
      { key: 'ai_max_messages_per_day', value_json: JSON.stringify(config.ai_max_messages_per_day) },
    ];
    for (const u of updates) {
      await supabase.from('app_config').update({ value_json: u.value_json }).eq('key', u.key);
    }
    setSavedOk(true);
    setIsSaving(false);
    setTimeout(() => setSavedOk(false), 3000);
  };

  const testConnection = async () => {
    if (!config.groq_api_key) {
      setTestResult({ ok: false, msg: 'Adj meg egy API kulcsot!' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.groq_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.groq_model,
          messages: [{ role: 'user', content: 'Mondj egy szót magyarul.' }],
          max_tokens: 10,
        }),
      });
      if (res.ok) {
        setTestResult({ ok: true, msg: 'Kapcsolat sikeres! Az API kulcs érvényes.' });
      } else {
        const err = await res.json();
        setTestResult({ ok: false, msg: err.error?.message || 'Érvénytelen API kulcs.' });
      }
    } catch {
      setTestResult({ ok: false, msg: 'Hálózati hiba a kapcsolat tesztelése közben.' });
    }
    setIsTesting(false);
  };

  const loadConvMessages = async (convId: string) => {
    if (convMessages[convId]) {
      setExpandedConv(expandedConv === convId ? null : convId);
      return;
    }
    const { data } = await supabase
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(20);
    if (data) {
      setConvMessages(prev => ({ ...prev, [convId]: data }));
    }
    setExpandedConv(convId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white">AI Edző Rendszer</h1>
            <p className="text-dark-500 text-sm">Groq API integráció és AI coach konfiguráció</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${config.ai_enabled ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' : 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400'}`}>
            <span className={`w-2 h-2 rounded-full ${config.ai_enabled ? 'bg-success-500 animate-pulse' : 'bg-error-500'}`} />
            {config.ai_enabled ? 'AI Aktív' : 'AI Kikapcsolva'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: MessageSquare, label: 'Összes chat', value: stats.total_conversations, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' },
          { icon: Zap, label: 'Összes üzenet', value: stats.total_messages, color: 'text-secondary-600 bg-secondary-50 dark:bg-secondary-900/20' },
          { icon: Users, label: 'Aktív felhasználók', value: stats.active_users, color: 'text-success-600 bg-success-50 dark:bg-success-900/20' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} padding="sm">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-dark-500">{stat.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-1 p-1 bg-dark-100 dark:bg-dark-800 rounded-xl">
        {[
          { id: 'config', label: 'Konfiguráció', icon: Settings },
          { id: 'stats', label: 'Statisztikák', icon: BarChart3 },
          { id: 'conversations', label: 'Beszélgetések', icon: MessageSquare },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id as typeof activeSection)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
              activeSection === id
                ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-white shadow-sm'
                : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeSection === 'config' && (
        <div className="space-y-4">
          <Card>
            <CardTitle className="flex items-center gap-2 mb-4">
              <Key className="w-4 h-4" />
              Groq API Beállítások
            </CardTitle>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                  API Kulcs *
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={config.groq_api_key}
                      onChange={(e) => setConfig(prev => ({ ...prev, groq_api_key: e.target.value }))}
                      placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-dark-800 border border-dark-300 dark:border-dark-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={testConnection}
                    isLoading={isTesting}
                    leftIcon={<Zap className="w-4 h-4" />}
                  >
                    Teszt
                  </Button>
                </div>
                {testResult && (
                  <div className={`flex items-center gap-2 mt-2 text-sm px-3 py-2 rounded-lg ${testResult.ok ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400' : 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400'}`}>
                    {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {testResult.msg}
                  </div>
                )}
                <p className="text-xs text-dark-400 mt-1">
                  Groq API kulcsot a <span className="font-mono">console.groq.com</span> oldalon szerezhetsz.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                  AI Modell
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {GROQ_MODELS.map((model) => (
                    <button
                      key={model.value}
                      onClick={() => setConfig(prev => ({ ...prev, groq_model: model.value }))}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        config.groq_model === model.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-dark-200 dark:border-dark-700 hover:border-primary-300'
                      }`}
                    >
                      <p className={`text-sm font-medium ${config.groq_model === model.value ? 'text-primary-700 dark:text-primary-300' : 'text-dark-700 dark:text-dark-300'}`}>
                        {model.label}
                      </p>
                      <p className="text-xs text-dark-500 mt-0.5">{model.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-dark-800 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-dark-700 dark:text-dark-300">AI Edző aktív</p>
                  <p className="text-xs text-dark-500">Engedélyezi a játékosok számára az AI chatbotot</p>
                </div>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, ai_enabled: !prev.ai_enabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${config.ai_enabled ? 'bg-success-500' : 'bg-dark-300 dark:bg-dark-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.ai_enabled ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                  Max. üzenetek / nap (felhasználónként)
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={config.ai_max_messages_per_day}
                  onChange={(e) => setConfig(prev => ({ ...prev, ai_max_messages_per_day: parseInt(e.target.value) || 50 }))}
                  className="w-32 px-4 py-2.5 bg-white dark:bg-dark-800 border border-dark-300 dark:border-dark-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4" />
              AI Rendszerprompt
            </CardTitle>
            <div className="space-y-3">
              <p className="text-sm text-dark-500 dark:text-dark-400">
                Ez az utasítás határozza meg az AI edző személyiségét, hangnemét és viselkedését.
              </p>
              <textarea
                value={config.ai_system_prompt}
                onChange={(e) => setConfig(prev => ({ ...prev, ai_system_prompt: e.target.value }))}
                rows={8}
                className="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-dark-300 dark:border-dark-600 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none font-mono leading-relaxed"
                placeholder="Írd be az AI edző rendszerpromptját..."
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-dark-400">{config.ai_system_prompt.length} karakter</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    ai_system_prompt: 'Te egy profi darts edző és személyes trainer vagy a DartsTraining platformon. A neved DartsCoach AI. Mindig magyarul válaszolj. Légy meleg, professzionális és motiváló. Elemezd a statisztikákat és adj konkrét, adatvezérelt tanácsokat.',
                  }))}
                >
                  Visszaállítás alapértelmezettre
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            {savedOk && (
              <div className="flex items-center gap-2 text-success-600 text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Mentve!
              </div>
            )}
            <Button
              onClick={saveConfig}
              isLoading={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Beállítások mentése
            </Button>
          </div>
        </div>
      )}

      {activeSection === 'stats' && (
        <div className="space-y-4">
          <Card>
            <CardTitle className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4" />
              Használati statisztikák
            </CardTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Összes chat szál', value: stats.total_conversations, icon: MessageSquare },
                { label: 'Összes üzenet', value: stats.total_messages, icon: Zap },
                { label: 'AI felhasználó', value: stats.active_users, icon: Users },
                { label: 'Átl. üzenet/chat', value: stats.total_conversations > 0 ? (stats.total_messages / stats.total_conversations).toFixed(1) : '0', icon: TrendingUp },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="p-4 bg-dark-50 dark:bg-dark-800 rounded-xl">
                  <Icon className="w-5 h-5 text-primary-500 mb-2" />
                  <p className="text-2xl font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                  <p className="text-xs text-dark-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4" />
              Aktív modell
            </CardTitle>
            <div className="flex items-center gap-4 p-4 bg-dark-50 dark:bg-dark-800 rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-dark-900 dark:text-white">{config.groq_model}</p>
                <p className="text-sm text-dark-500">
                  {GROQ_MODELS.find(m => m.value === config.groq_model)?.desc || 'Groq modell'}
                </p>
              </div>
              <Badge variant={config.ai_enabled ? 'success' : 'error'} className="ml-auto">
                {config.ai_enabled ? 'Aktív' : 'Kikapcsolva'}
              </Badge>
            </div>
          </Card>
        </div>
      )}

      {activeSection === 'conversations' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Legutóbbi beszélgetések ({recentConvs.length})
            </CardTitle>
            <button
              onClick={fetchStats}
              className="text-dark-400 hover:text-dark-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {recentConvs.length === 0 ? (
            <div className="text-center py-10 text-dark-500">
              <MessageSquare className="w-10 h-10 text-dark-300 mx-auto mb-3" />
              <p>Még nincsenek AI beszélgetések.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentConvs.map((conv) => (
                <div key={conv.id} className="border border-dark-200 dark:border-dark-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => loadConvMessages(conv.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark-900 dark:text-white truncate">{conv.title}</p>
                        <div className="flex items-center gap-3 text-xs text-dark-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(conv.last_message_at), 'MMM d. HH:mm', { locale: hu })}
                          </span>
                          <span>{conv.msg_count} üzenet</span>
                        </div>
                      </div>
                    </div>
                    {expandedConv === conv.id ? (
                      <ChevronUp className="w-4 h-4 text-dark-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-dark-400 shrink-0" />
                    )}
                  </button>
                  {expandedConv === conv.id && convMessages[conv.id] && (
                    <div className="border-t border-dark-200 dark:border-dark-700 p-3 space-y-2 bg-dark-50/50 dark:bg-dark-800/50 max-h-64 overflow-y-auto">
                      {convMessages[conv.id].map((msg, i) => (
                        <div
                          key={i}
                          className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                          <div className={`px-3 py-2 rounded-xl text-xs max-w-[80%] ${
                            msg.role === 'user'
                              ? 'bg-primary-500 text-white rounded-tr-sm'
                              : 'bg-white dark:bg-dark-700 border border-dark-200 dark:border-dark-600 text-dark-700 dark:text-dark-300 rounded-tl-sm'
                          }`}>
                            <p className="whitespace-pre-wrap line-clamp-4">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
