import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { t } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signUp } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('A jelszavak nem egyeznek');
      return;
    }

    if (password.length < 6) {
      setError('A jelszónak legalább 6 karakter hosszúnak kell lennie');
      return;
    }

    if (username.length < 3) {
      setError('A felhasználónévnek legalább 3 karakter hosszúnak kell lennie');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('A felhasználónév csak betűket, számokat és aláhúzást tartalmazhat');
      return;
    }

    setIsLoading(true);

    try {
      const { data: existingUser } = await supabase
        .from('user_profile')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (existingUser) {
        setError('Ez a felhasználónév már foglalt. Válassz egy másikat!');
        setIsLoading(false);
        return;
      }

      const { error: signUpError } = await signUp(email, password, username);

      if (signUpError) {
        console.error('SignUp error:', signUpError);

        if (signUpError.message.includes('timeout')) {
          setError('Kapcsolódási hiba. Ellenőrizd az internetkapcsolatot.');
        } else if (signUpError.message.includes('already registered') || signUpError.message.includes('User already registered')) {
          setError('Ez az email cím már regisztrálva van. Jelentkezz be vagy használj másik email címet!');
        } else if (signUpError.message.includes('duplicate') || signUpError.message.includes('unique') || signUpError.message.includes('user_profile_username_key')) {
          setError('Ez a felhasználónév már foglalt. Válassz egy másikat!');
        } else if (signUpError.message.toLowerCase().includes('email')) {
          setError('Hibás email formátum vagy az email már használatban van.');
        } else {
          setError('Hiba történt a regisztráció során. Próbáld újra!');
        }
        setIsLoading(false);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError('Hiba történt. Próbáld újra.');
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
          <p className="text-dark-500 dark:text-dark-400 mt-2">{t('auth.register')}</p>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-dark-200 dark:border-dark-700 p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-error-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
            </div>
          )}

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

            <Input
              label={t('auth.username')}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="felhasználónév"
              required
              autoComplete="username"
            />

            <Input
              label={t('auth.password')}
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
              {t('auth.register')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-dark-500 dark:text-dark-400">
              {t('auth.have_account')}{' '}
              <Link
                to="/login"
                className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
              >
                {t('auth.login')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
