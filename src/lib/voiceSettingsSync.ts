import { supabase } from './supabase';
import { getLocale } from './i18n';
import type { RecognitionMode } from './voiceRecognition';

export interface VoiceSettings {
  voice_enabled: boolean;
  voice_id: string;
  voice_name?: string;
  voice_lang?: string;
  volume: number;
  language: string;
  recognition_mode: RecognitionMode;
  min_confidence: number;
}

class VoiceSettingsSyncService {
  private syncInProgress = false;
  private listeners: Array<(settings: VoiceSettings) => void> = [];

  async loadSettings(): Promise<VoiceSettings | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return this.getDefaultSettings();
      }

      const { data, error } = await supabase
        .from('voice_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[VoiceSettingsSync] Betöltési hiba:', error);
        return this.getDefaultSettings();
      }

      if (!data) {
        const defaultSettings = this.getDefaultSettings();
        await this.saveSettings(defaultSettings);
        return defaultSettings;
      }

      console.log('[VoiceSettingsSync] Beállítások betöltve:', data);
      return data as VoiceSettings;
    } catch (error) {
      console.error('[VoiceSettingsSync] Betöltési kivétel:', error);
      return this.getDefaultSettings();
    }
  }

  async saveSettings(settings: Partial<VoiceSettings>): Promise<boolean> {
    if (this.syncInProgress) {
      return false;
    }

    try {
      this.syncInProgress = true;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        this.saveToLocalStorage(settings);
        return true;
      }

      const { error } = await supabase
        .from('voice_settings')
        .upsert({
          user_id: user.id,
          ...settings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('[VoiceSettingsSync] Mentési hiba:', error);
        this.saveToLocalStorage(settings);
        return false;
      }

      console.log('[VoiceSettingsSync] Beállítások mentve:', settings);
      this.saveToLocalStorage(settings);
      this.notifyListeners(settings as VoiceSettings);
      return true;
    } catch (error) {
      console.error('[VoiceSettingsSync] Mentési kivétel:', error);
      this.saveToLocalStorage(settings);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  private saveToLocalStorage(settings: Partial<VoiceSettings>) {
    if (typeof window === 'undefined') return;

    if (settings.voice_enabled !== undefined) {
      localStorage.setItem('voiceEnabled', String(settings.voice_enabled));
    }
    if (settings.voice_id !== undefined) {
      localStorage.setItem('voiceId', settings.voice_id);
    }
    if (settings.volume !== undefined) {
      localStorage.setItem('voiceVolume', String(settings.volume));
    }
    if (settings.language !== undefined) {
      localStorage.setItem('voiceLanguage', settings.language);
    }
    if (settings.recognition_mode !== undefined) {
      localStorage.setItem('voiceRecognitionMode', settings.recognition_mode);
    }
    if (settings.min_confidence !== undefined) {
      localStorage.setItem('voiceMinConfidence', String(settings.min_confidence));
    }
  }

  private getDefaultSettings(): VoiceSettings {
    if (typeof window !== 'undefined') {
      localStorage.setItem('force-hungarian-locale', 'true');
      localStorage.setItem('app-locale', 'hu');
    }
    return {
      voice_enabled: false,
      voice_id: 'default',
      volume: 0.85,
      language: 'hu-HU',
      recognition_mode: 'balanced',
      min_confidence: 0.6
    };
  }

  onSettingsChange(callback: (settings: VoiceSettings) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(settings: VoiceSettings) {
    this.listeners.forEach(cb => cb(settings));
  }

  subscribeToChanges() {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const channel = supabase
        .channel('voice_settings_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'voice_settings',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          console.log('[VoiceSettingsSync] Változás észlelve:', payload);
          if (payload.new && typeof payload.new === 'object') {
            this.notifyListeners(payload.new as VoiceSettings);
          }
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    });
  }
}

export const voiceSettingsSync = new VoiceSettingsSyncService();
