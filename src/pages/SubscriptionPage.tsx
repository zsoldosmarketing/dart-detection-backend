import { useState, useEffect } from 'react';
import {
  CreditCard,
  Check,
  Crown,
  Zap,
  Star,
  Calendar,
  Gift,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';

interface SubscriptionState {
  id: string;
  user_id: string;
  status: string;
  plan: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  referral_discount_percent: number;
}

const plans = [
  {
    id: 'free',
    name: 'Ingyenes',
    price: 0,
    features: [
      'Alap gyakorlatok',
      'Bot elleni jatekok',
      'Alap statisztikak',
      '3 napi kihivas',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 1990,
    popular: true,
    features: [
      'Minden gyakorlat es program',
      'Korlatlan jatekok',
      'Reszletes statisztikak',
      'Minden kihivas',
      'Klubok es tornak',
      'Nincs reklam',
      'Prioritasos tamogatas',
    ],
  },
  {
    id: 'team',
    name: 'Csapat',
    price: 4990,
    features: [
      'Minden Pro funkcio',
      '5 felhasznalo',
      'Csapat statisztikak',
      'Sajat tornak',
      'API hozzaferes',
      'Dedikalt tamogatas',
    ],
  },
];

export function SubscriptionPage() {
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    }
  }, [user]);

  const fetchSubscription = async () => {
    if (!user) return;

    setIsLoading(true);

    const { data } = await supabase
      .from('subscription_state')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    setSubscription(data);
    setIsLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="success">Aktiv</Badge>;
      case 'trial': return <Badge variant="warning">Probaidoszak</Badge>;
      case 'cancelled': return <Badge variant="error">Lemondva</Badge>;
      case 'expired': return <Badge variant="error">Lejart</Badge>;
      default: return <Badge>Ingyenes</Badge>;
    }
  };

  const currentPlan = subscription?.plan || 'free';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 dark:bg-primary-500/20 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Elofizetes</h1>
          <p className="text-dark-500 dark:text-dark-400">Valaszd ki a szamodra megfelelo csomagot</p>
        </div>
      </div>

      {subscription && subscription.status !== 'free' && (
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-dark-900 dark:text-white">
                  Jelenlegi elofizetes
                </h3>
                {getStatusBadge(subscription.status)}
              </div>
              <p className="text-dark-500 mt-1">
                {plans.find(p => p.id === subscription.plan)?.name || 'Ingyenes'} csomag
              </p>
            </div>
            {subscription.referral_discount_percent > 0 && (
              <Badge variant="success" className="flex items-center gap-1">
                <Gift className="w-3 h-3" />
                {subscription.referral_discount_percent}% kedvezmeny
              </Badge>
            )}
          </div>

          {subscription.current_period_end && (
            <div className="mt-4 flex items-center gap-2 text-sm text-dark-500">
              <Calendar className="w-4 h-4" />
              <span>
                Kovetkezo szamlazas: {format(new Date(subscription.current_period_end), 'yyyy. MMM d.', { locale: hu })}
              </span>
            </div>
          )}

          {subscription.trial_ends_at && subscription.status === 'trial' && (
            <div className="mt-4 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning-500" />
              <span className="text-sm text-warning-700 dark:text-warning-400">
                Probaidoszak vege: {format(new Date(subscription.trial_ends_at), 'yyyy. MMM d.', { locale: hu })}
              </span>
            </div>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={clsx(
              'p-6 relative',
              plan.popular && 'border-2 border-primary-500',
              currentPlan === plan.id && 'ring-2 ring-primary-500'
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="primary" className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Nepszeru
                </Badge>
              </div>
            )}

            <div className="text-center mb-6">
              <div className={clsx(
                'w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center',
                plan.id === 'free' && 'bg-dark-100 dark:bg-dark-700',
                plan.id === 'pro' && 'bg-gradient-to-br from-primary-500 to-secondary-500',
                plan.id === 'team' && 'bg-gradient-to-br from-warning-500 to-amber-500'
              )}>
                {plan.id === 'free' && <Zap className="w-6 h-6 text-dark-500" />}
                {plan.id === 'pro' && <Crown className="w-6 h-6 text-white" />}
                {plan.id === 'team' && <Star className="w-6 h-6 text-white" />}
              </div>

              <h3 className="text-xl font-bold text-dark-900 dark:text-white">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-dark-900 dark:text-white">
                  {plan.price === 0 ? 'Ingyenes' : `${plan.price.toLocaleString()} Ft`}
                </span>
                {plan.price > 0 && (
                  <span className="text-dark-500 text-sm"> / ho</span>
                )}
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-dark-600 dark:text-dark-400">{feature}</span>
                </li>
              ))}
            </ul>

            {currentPlan === plan.id ? (
              <Button variant="outline" className="w-full" disabled>
                Jelenlegi csomag
              </Button>
            ) : (
              <Button
                variant={plan.popular ? 'primary' : 'outline'}
                className="w-full"
              >
                {plan.price === 0 ? 'Downgrade' : 'Valasztas'}
              </Button>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-dark-900 dark:text-white mb-4">
          Gyakori kerdesek
        </h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-dark-900 dark:text-white">
              Hogyan mondhatom le az elofizetesem?
            </h4>
            <p className="text-sm text-dark-500 mt-1">
              Az elofizetesed barmikor lemondhatod a beallitasok menuben. A lemondas utan az aktualis szamlazasi ciklus vegeig hasznalhatod a Pro funkciókat.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-dark-900 dark:text-white">
              Milyen fizetesi modokat fogadtok el?
            </h4>
            <p className="text-sm text-dark-500 mt-1">
              Bankkartyas fizetes (Visa, Mastercard) es PayPal. Minden fizetes biztonsagos SSL titkositassal tortenik.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-dark-900 dark:text-white">
              Van penzvisszateritesi garancia?
            </h4>
            <p className="text-sm text-dark-500 mt-1">
              Igen, 14 napos penzvisszateritesi garanciat biztositunk minden uj elofizetesre.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
