import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { t } from '../../lib/i18n';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError('Hiba tortent. Kerem probald ujra.');
      setIsLoading(false);
    } else {
      setSuccess(true);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-50 dark:bg-dark-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 mb-4">
            <Target className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">DartsTraining</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-2">{t('auth.forgot_password')}</p>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-dark-200 dark:border-dark-700 p-6 sm:p-8">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-success-100 dark:bg-success-900/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success-600 dark:text-success-400" />
              </div>
              <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                Email elkuldve!
              </h2>
              <p className="text-dark-500 dark:text-dark-400 mb-6">
                Ellenorizd az email fiokod es kovesd a jelszo visszaallitasi utasitasokat.
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Vissza a bejelentkezeshez
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
                </div>
              )}

              <p className="text-dark-600 dark:text-dark-400 mb-6">
                Add meg az email cimedet es kuldunk egy linket a jelszo visszaallitasahoz.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label={t('auth.email')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                  autoComplete="email"
                />

                <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                  Jelszo visszaallitas
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Vissza a bejelentkezeshez
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
