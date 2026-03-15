import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Check, X, Target } from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface PlayerProfile {
  id: string;
  name: string;
  description: string | null;
  dart_weight: string | null;
  dart_brand: string | null;
  dart_model: string | null;
  flight_shape: string | null;
  shaft_length: string | null;
  is_default: boolean;
  stats: {
    games_played: number;
    avg_score: number;
    checkout_rate: number;
  };
}

const FLIGHT_SHAPES = ['Standard', 'Slim', 'Kite', 'Pear', 'Vortex', 'No.2', 'No.6'];
const SHAFT_LENGTHS = ['Extra Short', 'Short', 'Medium', 'Long', 'Extra Long'];

export function PlayerProfilesPage() {
  const { user } = useAuthStore();
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dart_weight: '',
    dart_brand: '',
    dart_model: '',
    flight_shape: '',
    shaft_length: '',
  });

  useEffect(() => {
    if (user) {
      fetchProfiles();
    }
  }, [user]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('player_profiles')
      .select('*')
      .eq('user_id', user?.id)
      .order('is_default', { ascending: false });

    if (data) {
      setProfiles(data);
    }
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!user || !formData.name.trim()) return;

    const { data, error } = await supabase
      .from('player_profiles')
      .insert({
        user_id: user.id,
        name: formData.name.trim(),
        description: formData.description || null,
        dart_weight: formData.dart_weight || null,
        dart_brand: formData.dart_brand || null,
        dart_model: formData.dart_model || null,
        flight_shape: formData.flight_shape || null,
        shaft_length: formData.shaft_length || null,
        is_default: profiles.length === 0,
      })
      .select()
      .single();

    if (!error && data) {
      setProfiles([...profiles, data]);
      setShowCreateForm(false);
      resetForm();
    }
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase
      .from('player_profiles')
      .update({
        name: formData.name.trim(),
        description: formData.description || null,
        dart_weight: formData.dart_weight || null,
        dart_brand: formData.dart_brand || null,
        dart_model: formData.dart_model || null,
        flight_shape: formData.flight_shape || null,
        shaft_length: formData.shaft_length || null,
      })
      .eq('id', id);

    if (!error) {
      setProfiles(profiles.map((p) => (p.id === id ? { ...p, ...formData } : p)));
      setEditingId(null);
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('player_profiles')
      .delete()
      .eq('id', id);

    if (!error) {
      setProfiles(profiles.filter((p) => p.id !== id));
    }
  };

  const handleSetDefault = async (id: string) => {
    await supabase
      .from('player_profiles')
      .update({ is_default: false })
      .eq('user_id', user?.id);

    await supabase
      .from('player_profiles')
      .update({ is_default: true })
      .eq('id', id);

    setProfiles(profiles.map((p) => ({ ...p, is_default: p.id === id })));
  };

  const startEdit = (profile: PlayerProfile) => {
    setEditingId(profile.id);
    setFormData({
      name: profile.name,
      description: profile.description || '',
      dart_weight: profile.dart_weight || '',
      dart_brand: profile.dart_brand || '',
      dart_model: profile.dart_model || '',
      flight_shape: profile.flight_shape || '',
      shaft_length: profile.shaft_length || '',
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      dart_weight: '',
      dart_brand: '',
      dart_model: '',
      flight_shape: '',
      shaft_length: '',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Darts profilok</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Különböző dart felszerelésekhez különböző profilok
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateForm(true)}>
          Új profil
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardTitle>Új profil létrehozása</CardTitle>
          <div className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Profil neve"
                placeholder="pl. Verseny darts"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <Input
                label="Leírás"
                placeholder="pl. 24g tungsten"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Input
                label="Dart súlya"
                placeholder="pl. 24g"
                value={formData.dart_weight}
                onChange={(e) => setFormData({ ...formData, dart_weight: e.target.value })}
              />
              <Input
                label="Marka"
                placeholder="pl. Target, Winmau"
                value={formData.dart_brand}
                onChange={(e) => setFormData({ ...formData, dart_brand: e.target.value })}
              />
              <Input
                label="Modell"
                placeholder="pl. Phil Taylor Gen 6"
                value={formData.dart_model}
                onChange={(e) => setFormData({ ...formData, dart_model: e.target.value })}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Flight forma
                </label>
                <div className="flex flex-wrap gap-2">
                  {FLIGHT_SHAPES.map((shape) => (
                    <button
                      key={shape}
                      onClick={() => setFormData({ ...formData, flight_shape: shape })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        formData.flight_shape === shape
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Shaft hossz
                </label>
                <div className="flex flex-wrap gap-2">
                  {SHAFT_LENGTHS.map((length) => (
                    <button
                      key={length}
                      onClick={() => setFormData({ ...formData, shaft_length: length })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        formData.shaft_length === length
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      {length}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => { setShowCreateForm(false); resetForm(); }}>
                Mégse
              </Button>
              <Button onClick={handleCreate} disabled={!formData.name.trim()}>
                Létrehozás
              </Button>
            </div>
          </div>
        </Card>
      )}

      {profiles.length === 0 && !showCreateForm ? (
        <Card className="text-center py-12">
          <Target className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Meg nincs profilod</h3>
          <p className="text-dark-500 dark:text-dark-400 mt-1 mb-4">
            Hozz létre profilokat különböző darts felszereléseidhez
          </p>
          <Button onClick={() => setShowCreateForm(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Első profil létrehozása
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {profiles.map((profile) => (
            <Card key={profile.id} className={profile.is_default ? 'ring-2 ring-primary-500' : ''}>
              {editingId === profile.id ? (
                <div className="space-y-4">
                  <Input
                    label="Profil neve"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <Input
                    label="Leírás"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      label="Suly"
                      value={formData.dart_weight}
                      onChange={(e) => setFormData({ ...formData, dart_weight: e.target.value })}
                    />
                    <Input
                      label="Marka"
                      value={formData.dart_brand}
                      onChange={(e) => setFormData({ ...formData, dart_brand: e.target.value })}
                    />
                    <Input
                      label="Modell"
                      value={formData.dart_model}
                      onChange={(e) => setFormData({ ...formData, dart_model: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); resetForm(); }}>
                      <X className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={() => handleUpdate(profile.id)}>
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-dark-900 dark:text-white">{profile.name}</h3>
                        {profile.is_default && <Badge variant="primary" size="sm">Alapertelmezett</Badge>}
                      </div>
                      {profile.description && (
                        <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">{profile.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(profile)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(profile.id)}
                        className="text-error-500 hover:text-error-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    {profile.dart_weight && (
                      <div>
                        <span className="text-dark-500 dark:text-dark-400">Suly:</span>{' '}
                        <span className="text-dark-900 dark:text-white">{profile.dart_weight}</span>
                      </div>
                    )}
                    {profile.dart_brand && (
                      <div>
                        <span className="text-dark-500 dark:text-dark-400">Marka:</span>{' '}
                        <span className="text-dark-900 dark:text-white">{profile.dart_brand}</span>
                      </div>
                    )}
                    {profile.dart_model && (
                      <div>
                        <span className="text-dark-500 dark:text-dark-400">Modell:</span>{' '}
                        <span className="text-dark-900 dark:text-white">{profile.dart_model}</span>
                      </div>
                    )}
                    {profile.flight_shape && (
                      <div>
                        <span className="text-dark-500 dark:text-dark-400">Flight:</span>{' '}
                        <span className="text-dark-900 dark:text-white">{profile.flight_shape}</span>
                      </div>
                    )}
                    {profile.shaft_length && (
                      <div>
                        <span className="text-dark-500 dark:text-dark-400">Shaft:</span>{' '}
                        <span className="text-dark-900 dark:text-white">{profile.shaft_length}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-dark-100 dark:border-dark-700">
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <p className="text-dark-500 dark:text-dark-400">Játékok</p>
                        <p className="font-semibold text-dark-900 dark:text-white">{profile.stats?.games_played || 0}</p>
                      </div>
                      <div>
                        <p className="text-dark-500 dark:text-dark-400">Átlag</p>
                        <p className="font-semibold text-dark-900 dark:text-white">{profile.stats?.avg_score?.toFixed(1) || '0.0'}</p>
                      </div>
                      <div>
                        <p className="text-dark-500 dark:text-dark-400">Checkout %</p>
                        <p className="font-semibold text-dark-900 dark:text-white">{profile.stats?.checkout_rate?.toFixed(0) || '0'}%</p>
                      </div>
                    </div>
                  </div>

                  {!profile.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-4"
                      onClick={() => handleSetDefault(profile.id)}
                    >
                      Beállítás alapértelmezettként
                    </Button>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
