import { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Trophy,
  Ticket,
  Gift,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Coins
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';

interface TokenAccount {
  id: string;
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

interface TokenTransaction {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export function WalletPage() {
  const { user } = useAuthStore();
  const [account, setAccount] = useState<TokenAccount | null>(null);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;

    setIsLoading(true);

    const { data: accountData } = await supabase
      .from('token_accounts')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    setAccount(accountData);

    const { data: txData } = await supabase
      .from('token_ledger')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setTransactions(txData || []);
    setIsLoading(false);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownRight className="w-4 h-4" />;
      case 'withdrawal': return <ArrowUpRight className="w-4 h-4" />;
      case 'entry_fee': return <Ticket className="w-4 h-4" />;
      case 'prize': return <Trophy className="w-4 h-4" />;
      case 'bonus': return <Gift className="w-4 h-4" />;
      case 'refund': return <ArrowDownRight className="w-4 h-4" />;
      default: return <Coins className="w-4 h-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'Befizetés';
      case 'withdrawal': return 'Kivétel';
      case 'entry_fee': return 'Nevezési díj';
      case 'prize': return 'Nyeremény';
      case 'platform_fee': return 'Platform díj';
      case 'burn': return 'Égetés';
      case 'refund': return 'Visszatérítés';
      case 'bonus': return 'Bónusz';
      default: return type;
    }
  };

  const getTransactionColor = (amount: number) => {
    return amount > 0 ? 'text-success-500' : 'text-error-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-warning-500/10 dark:bg-warning-500/20 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-warning-600 dark:text-warning-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Penztarca</h1>
          <p className="text-dark-500 dark:text-dark-400">Token egyenleg es tranzakciok</p>
        </div>
      </div>

      <Card className="p-6 bg-gradient-to-br from-warning-500 to-amber-600 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-warning-100 text-sm">Egyenleg</p>
            <p className="text-4xl font-bold mt-1">{account?.balance || 0}</p>
            <p className="text-warning-100 text-sm mt-1">token</p>
          </div>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <Coins className="w-8 h-8" />
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <p className="text-sm text-dark-500">Összesen szerzett</p>
              <p className="text-xl font-bold text-dark-900 dark:text-white">
                +{account?.lifetime_earned || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-error-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-error-500" />
            </div>
            <div>
              <p className="text-sm text-dark-500">Összesen elköltött</p>
              <p className="text-xl font-bold text-dark-900 dark:text-white">
                -{account?.lifetime_spent || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-dark-200 dark:border-dark-700">
          <h3 className="font-semibold text-dark-900 dark:text-white">Tranzakcio tortenet</h3>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-12 h-12 text-dark-400 mx-auto mb-4" />
            <p className="text-dark-500">Meg nincs tranzakciod.</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-200 dark:divide-dark-700">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    tx.amount > 0 ? 'bg-success-500/10 text-success-500' : 'bg-error-500/10 text-error-500'
                  )}>
                    {getTransactionIcon(tx.transaction_type)}
                  </div>
                  <div>
                    <p className="font-medium text-dark-900 dark:text-white">
                      {getTransactionLabel(tx.transaction_type)}
                    </p>
                    <p className="text-sm text-dark-500">
                      {tx.description || format(new Date(tx.created_at), 'MMM d, HH:mm', { locale: hu })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={clsx('font-bold', getTransactionColor(tx.amount))}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </p>
                  <p className="text-xs text-dark-400">
                    Egyenleg: {tx.balance_after}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
