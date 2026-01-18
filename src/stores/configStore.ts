import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface ConfigState {
  config: Record<string, unknown>;
  isLoading: boolean;
  fetchConfig: () => Promise<void>;
  getConfig: <T>(key: string, defaultValue: T) => T;
  updateConfig: (key: string, value: unknown) => Promise<{ error: Error | null }>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: {},
  isLoading: true,

  fetchConfig: async () => {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value_json');

    if (!error && data) {
      const configMap: Record<string, unknown> = {};
      data.forEach((item) => {
        configMap[item.key] = item.value_json;
      });
      set({ config: configMap, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  getConfig: <T>(key: string, defaultValue: T): T => {
    const { config } = get();
    const value = config[key];
    if (value === undefined) return defaultValue;

    if (typeof defaultValue === 'boolean') {
      return (value === true || value === 'true') as T;
    }
    if (typeof defaultValue === 'number') {
      return Number(value) as T;
    }
    return value as T;
  },

  updateConfig: async (key: string, value: unknown) => {
    const { error } = await supabase
      .from('app_config')
      .update({ value_json: value, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (!error) {
      set((state) => ({
        config: { ...state.config, [key]: value },
      }));
    }

    return { error };
  },
}));
