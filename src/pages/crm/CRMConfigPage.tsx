import { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertCircle, Check, Server, Globe } from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { t } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { getApiUrl } from '../../lib/dartDetectionApi';

interface ConfigItem {
  id: string;
  key: string;
  value_json: unknown;
  type: string;
  description_key: string | null;
}

const CONFIG_CATEGORIES = {
  features: {
    label: 'Feature Flags',
    keys: [
      'STRIPE_ENABLED',
      'TOKEN_ECONOMY_ENABLED',
      'CAMERA_EVIDENCE_ENABLED',
      'BACKGROUND_PUSH_ENABLED',
      'EMAIL_NUDGE_ENABLED',
      'LEADERBOARDS_ENABLED',
      'DISPUTE_SYSTEM_ENABLED',
    ],
  },
  darts: {
    label: 'Darts Engine',
    keys: [
      'DEFAULT_X01_SCORE',
      'ALLOWED_X01_SCORES',
      'UNDO_LIMIT_PER_LEG',
      'UNDO_REQUIRES_CONFIRMATION',
      'RECONNECT_GRACE_SECONDS',
      'FORFEIT_AFTER_INACTIVE_SECONDS',
    ],
  },
  tournament: {
    label: 'Tournament',
    keys: [
      'MIN_TOURNAMENT_HOST_SKILL',
      'TOURNAMENT_MIN_PLAYERS',
      'TOURNAMENT_MAX_PLAYERS',
      'TOURNAMENT_INVITE_TIMEOUT_SECONDS',
    ],
  },
  engagement: {
    label: 'Engagement / Nudges',
    keys: [
      'INACTIVITY_NUDGE_DAYS',
      'STREAK_NUDGE_MILESTONES',
      'WEAK_DOUBLES_THRESHOLD',
      'WEAK_CHECKOUT_THRESHOLD',
      'NUDGE_COOLDOWN_HOURS',
    ],
  },
  limits: {
    label: 'Limits / Abuse Prevention',
    keys: [
      'MAX_INVITES_PER_HOUR',
      'MAX_ADMIN_PUSH_PER_DAY',
      'MAX_IMAGE_UPLOAD_MB',
      'MAX_NOTIF_BODY_LENGTH',
    ],
  },
  tokens: {
    label: 'Token Economy (Inactive)',
    keys: [
      'PLATFORM_FEE_PERCENT',
      'MIN_ENTRY_FEE_TOKENS',
      'MAX_ENTRY_FEE_TOKENS',
    ],
  },
};

export function CRMConfigPage() {
  const { user } = useAuthStore();
  const { getBackendUrl, setBackendUrlOverride, getBackendUrlOverride } = useConfigStore();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState('');
  const [backendSwitchSuccess, setBackendSwitchSuccess] = useState(false);

  useEffect(() => {
    fetchConfigs();
    const override = getBackendUrlOverride();
    if (override) {
      setBackendUrlInput(override);
    }
  }, []);

  async function fetchConfigs() {
    setIsLoading(true);
    const { data } = await supabase.from('app_config').select('*').order('key');
    if (data) {
      setConfigs(data);
      const values: Record<string, unknown> = {};
      data.forEach((c) => {
        values[c.key] = c.value_json;
      });
      setEditedValues(values);
    }
    setIsLoading(false);
  }

  const handleValueChange = (key: string, value: unknown) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);

    for (const config of configs) {
      const newValue = editedValues[config.key];
      if (JSON.stringify(newValue) !== JSON.stringify(config.value_json)) {
        await supabase
          .from('app_config')
          .update({
            value_json: newValue,
            updated_by_user_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('key', config.key);

        await supabase.from('audit_log').insert({
          user_id: user.id,
          action: 'config_update',
          entity_type: 'app_config',
          entity_id: config.id,
          old_value: { value: config.value_json },
          new_value: { value: newValue },
        });
      }
    }

    await fetchConfigs();
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const getConfigByKey = (key: string) => configs.find((c) => c.key === key);

  const handleBackendSwitch = (mode: 'local' | 'production' | 'custom') => {
    if (mode === 'local') {
      setBackendUrlOverride('http://localhost:8000');
      setBackendUrlInput('http://localhost:8000');
    } else if (mode === 'production') {
      setBackendUrlOverride(null);
      setBackendUrlInput('');
    } else if (mode === 'custom' && backendUrlInput) {
      setBackendUrlOverride(backendUrlInput);
    }
    setBackendSwitchSuccess(true);
    setTimeout(() => setBackendSwitchSuccess(false), 2000);
  };

  const currentBackendUrl = getApiUrl();
  const hasOverride = getBackendUrlOverride() !== null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            {t('crm.config')}
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Platform konfiguracio es feature flagek kezelese
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={fetchConfigs}
          >
            Frissites
          </Button>
          <Button
            leftIcon={saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            onClick={handleSave}
            isLoading={isSaving}
            variant={saveSuccess ? 'secondary' : 'primary'}
          >
            {saveSuccess ? 'Mentve' : t('common.save')}
          </Button>
        </div>
      </div>

      <Card className="bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          Backend URL Override (Admin)
        </CardTitle>
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-dark-500" />
            <span className="font-medium text-dark-700 dark:text-dark-300">Aktív backend:</span>
            <code className="px-2 py-1 bg-dark-100 dark:bg-dark-800 rounded text-xs font-mono">
              {currentBackendUrl}
            </code>
            {hasOverride && (
              <Badge variant="warning" size="sm">OVERRIDE AKTÍV</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={!hasOverride ? 'primary' : 'outline'}
              leftIcon={<Globe className="w-4 h-4" />}
              onClick={() => handleBackendSwitch('production')}
            >
              Production (.env)
            </Button>
            <Button
              size="sm"
              variant={hasOverride && currentBackendUrl.includes('localhost') ? 'primary' : 'outline'}
              leftIcon={<Server className="w-4 h-4" />}
              onClick={() => handleBackendSwitch('local')}
            >
              Local (localhost:8000)
            </Button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={backendUrlInput}
              onChange={(e) => setBackendUrlInput(e.target.value)}
              placeholder="https://custom-backend.com"
              className="flex-1 px-3 py-2 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBackendSwitch('custom')}
              disabled={!backendUrlInput}
            >
              {backendSwitchSuccess ? <Check className="w-4 h-4" /> : 'Set Custom'}
            </Button>
          </div>

          <div className="text-xs text-dark-500 dark:text-dark-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Az override localStorage-ban tárolódik, csak ezen a böngészőn érvényes.
              Production-re váltáshoz használd a "Production (.env)" gombot.
            </span>
          </div>
        </div>
      </Card>

      {Object.entries(CONFIG_CATEGORIES).map(([categoryKey, category]) => (
        <Card key={categoryKey}>
          <CardTitle>{category.label}</CardTitle>
          <div className="mt-4 space-y-4">
            {category.keys.map((key) => {
              const config = getConfigByKey(key);
              if (!config) return null;

              return (
                <ConfigRow
                  key={key}
                  config={config}
                  value={editedValues[key]}
                  onChange={(v) => handleValueChange(key, v)}
                />
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

interface ConfigRowProps {
  config: ConfigItem;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ConfigRow({ config, value, onChange }: ConfigRowProps) {
  const renderInput = () => {
    switch (config.type) {
      case 'boolean':
        return (
          <button
            onClick={() => onChange(!value)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              value ? 'bg-primary-600' : 'bg-dark-300 dark:bg-dark-600'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                value ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        );

      case 'number':
        return (
          <input
            type="number"
            value={typeof value === 'number' ? value : Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-32 px-3 py-1.5 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        );

      case 'json':
        return (
          <input
            type="text"
            value={JSON.stringify(value)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
              }
            }}
            className="flex-1 px-3 py-1.5 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        );

      default:
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        );
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-dark-100 dark:border-dark-700 last:border-0">
      <div className="flex-1">
        <p className="font-medium text-dark-900 dark:text-white font-mono text-sm">
          {config.key}
        </p>
        {config.description_key && (
          <p className="text-xs text-dark-500 mt-0.5">{t(config.description_key)}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="default" size="sm">
          {config.type}
        </Badge>
        {renderInput()}
      </div>
    </div>
  );
}
