import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { t } from '../../lib/i18n';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    if (type === 'recovery' && accessToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') || '',
      });
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('code')) {
        setIsValidToken(false);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('A jelszavak nem egyeznek.');
      return;
    }

    if (password.length < 6) {
      setError('A jelszonak legalabb 6 karakter hosszunak kell lennie.');
      return;
    }

    setIsLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError('Hiba tortent a jelszo visszaallitasakor. Kerem probald ujra.');
      setIsLoading(false);
    } else {
      setSuccess(true);
      setIsLoading(false);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    }
  };

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-dark-50 dark:bg-dark-900 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-dark-200 dark:border-dark-700 p-6 sm:p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-error-100 dark:bg-error-900/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-error-600 dark:text-error-400" />
            </div>
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
              Ervenytelen link
            </h2>
            <p className="text-dark-500 dark:text-dark-400 mb-6">
              Ez a jelszo visszaallitasi link ervenytelen vagy lejart.
            </p>
            <Link to="/forgot-password">
              <Button className="w-full">Uj link kerese</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-50 dark:bg-dark-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 mb-4">
            <Target className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">DartsTraining</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-2">{t('auth.reset_password')}</p>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-dark-200 dark:border-dark-700 p-6 sm:p-8">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-success-100 dark:bg-success-900/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success-600 dark:text-success-400" />
              </div>
              <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                Jelszo megvaltoztatva!
              </h2>
              <p className="text-dark-500 dark:text-dark-400">
                Atiranyitunk a bejelentkezesi oldalra...
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Uj jelszo"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  autoComplete="new-password"
                />

                <Input
                  label={t('auth.confirm_password')}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="********"
                  required
                  autoComplete="new-password"
                />

                <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                  Jelszo mentese
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
