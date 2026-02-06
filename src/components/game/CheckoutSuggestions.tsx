import { memo } from 'react';
import { t } from '../../lib/i18n';
import {
  formatDartDisplay,
  type CheckoutRoute,
  type SetupSuggestion,
} from '../../lib/dartsEngine';

interface CheckoutSuggestionsProps {
  showSuggestions: boolean;
  checkoutRoutes: CheckoutRoute[];
  setupSuggestions: SetupSuggestion[];
  currentRemaining: number;
}

export const CheckoutSuggestions = memo(function CheckoutSuggestions({
  showSuggestions,
  checkoutRoutes,
  setupSuggestions,
  currentRemaining,
}: CheckoutSuggestionsProps) {
  if (!showSuggestions || (checkoutRoutes.length === 0 && (setupSuggestions.length === 0 || currentRemaining <= 170))) {
    return null;
  }

  return (
    <div className="mb-3">
      <p className="text-xs text-dark-500 mb-1">{t('training.suggested_routes')}:</p>
      {checkoutRoutes.length > 0 ? (
        checkoutRoutes.length === 1 ? (
          <div className="px-4 py-3 rounded-lg bg-primary-500 text-white text-base font-bold">
            {checkoutRoutes[0].darts.map(d => formatDartDisplay(d)).join(' → ')}
            {checkoutRoutes[0].salvage && (
              <span className="text-sm block opacity-90 mt-1 font-medium">{checkoutRoutes[0].salvage.replace(/S(\d+)/g, '$1')}</span>
            )}
          </div>
        ) : (
          <div className={`grid gap-2 ${checkoutRoutes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {checkoutRoutes.slice(0, 3).map((route, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg text-center transition-all ${
                  idx === 0
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-200 dark:bg-dark-700 text-dark-900 dark:text-dark-100'
                }`}
              >
                <p className={`text-sm font-bold ${idx === 0 ? 'text-white' : ''}`}>
                  {route.darts.map(d => formatDartDisplay(d)).join(' → ')}
                </p>
                {route.salvage && (
                  <p className={`text-xs mt-1 font-medium ${idx === 0 ? 'opacity-90' : 'text-dark-600 dark:text-dark-300'}`}>
                    {route.salvage.replace(/S(\d+)/g, '$1')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      ) : setupSuggestions.length === 1 ? (
        <div className="px-4 py-3 rounded-lg bg-primary-500 text-white text-base font-bold">
          {formatDartDisplay(setupSuggestions[0].target)} → {setupSuggestions[0].leave}
          <span className="text-sm block opacity-90 mt-1 font-medium">
            {setupSuggestions[0].projection.slice(0, 2).map((p) => `Ha ${p.hit.startsWith('S') ? p.hit.slice(1) : p.hit}: ${p.leave} marad`).join(' | ')}
          </span>
        </div>
      ) : (
        <div className={`grid gap-2 ${setupSuggestions.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {setupSuggestions.slice(0, 3).map((suggestion, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg text-center transition-all ${
                idx === 0
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-200 dark:bg-dark-700 text-dark-900 dark:text-dark-100'
              }`}
            >
              <p className={`text-sm font-bold ${idx === 0 ? 'text-white' : ''}`}>
                {formatDartDisplay(suggestion.target)} → {suggestion.leave}
              </p>
              <p className={`text-xs mt-1 font-medium ${idx === 0 ? 'opacity-90' : 'text-dark-600 dark:text-dark-300'}`}>
                {suggestion.projection.slice(0, 2).map((p) => `${p.hit.startsWith('S') ? p.hit.slice(1) : p.hit}:${p.leave}`).join(' ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
