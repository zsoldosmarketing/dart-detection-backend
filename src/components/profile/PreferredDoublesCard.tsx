import { useState, useEffect, memo } from 'react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { t } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';

interface PreferredDoublesCardProps {
  userId: string;
  preferredDoubles: number[] | null;
}

export const PreferredDoublesCard = memo(function PreferredDoublesCard({ userId, preferredDoubles }: PreferredDoublesCardProps) {
  const [isEditingDoubles, setIsEditingDoubles] = useState(false);
  const [selectedDoubles, setSelectedDoubles] = useState<number[]>([]);

  useEffect(() => {
    if (preferredDoubles) {
      setSelectedDoubles(preferredDoubles);
    }
  }, [preferredDoubles]);

  const handleSaveDoubles = async () => {
    if (selectedDoubles.length === 0) return;

    try {
      const { error } = await supabase
        .from('user_profile')
        .update({ preferred_doubles: selectedDoubles })
        .eq('id', userId);

      if (error) throw error;

      setIsEditingDoubles(false);
      window.location.reload();
    } catch (error) {
      console.error('Error updating preferred doubles:', error);
    }
  };

  const toggleDouble = (num: number) => {
    setSelectedDoubles(prev => {
      if (prev.includes(num)) {
        return prev.filter(d => d !== num);
      } else {
        if (prev.length >= 10) {
          return [...prev.slice(1), num];
        }
        return [...prev, num];
      }
    });
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <CardTitle>{t('profile.preferred_doubles')}</CardTitle>
        {!isEditingDoubles && (
          <button
            onClick={() => setIsEditingDoubles(true)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            Szerkesztés
          </button>
        )}
      </div>
      <p className="text-sm text-dark-500 dark:text-dark-400 mt-1 mb-4">
        A checkout engine ezeket a duplakat preferalja
      </p>

      {isEditingDoubles ? (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => toggleDouble(num)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDoubles.includes(num)
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-600'
                }`}
              >
                D{num}
              </button>
            ))}
          </div>
          <p className="text-xs text-dark-500 dark:text-dark-400">
            Max 10 duplát választhatsz. A sorrend számít: az első 3 lesz a legfontosabb.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveDoubles}
              disabled={selectedDoubles.length === 0}
              className="flex-1"
            >
              Mentés
            </Button>
            <Button
              onClick={() => {
                setIsEditingDoubles(false);
                setSelectedDoubles((preferredDoubles as number[]) || [20, 16, 8]);
              }}
              variant="outline"
              className="flex-1"
            >
              Mégse
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {((preferredDoubles as number[]) || [20, 16, 8]).slice(0, 3).map((num: number) => (
            <Badge key={num} variant="primary" size="md">
              D{num}
            </Badge>
          ))}
          {((preferredDoubles as number[]) || []).length > 3 && (
            <Badge variant="secondary" size="md">
              +{((preferredDoubles as number[]) || []).length - 3} több
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
});
