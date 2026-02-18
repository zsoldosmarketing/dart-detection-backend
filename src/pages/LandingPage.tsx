import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Target,
  Swords,
  BarChart3,
  Camera,
  Mic,
  Trophy,
  ArrowRight,
  UserPlus,
  LogIn,
  CheckCircle2,
  Zap,
  Users,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import clsx from 'clsx';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('opacity-100', 'translate-y-0');
          el.classList.remove('opacity-0', 'translate-y-8');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Dartboard() {
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden="true">
      <defs>
        <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="200" cy="200" r="195" fill="url(#bg-glow)" />
      <circle cx="200" cy="200" r="170" fill="none" stroke="#334155" strokeWidth="2" opacity="0.5" />
      <circle cx="200" cy="200" r="140" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.4" />
      <circle cx="200" cy="200" r="110" fill="none" stroke="#334155" strokeWidth="2" opacity="0.5" />
      <circle cx="200" cy="200" r="80" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.4" />
      <circle cx="200" cy="200" r="50" fill="none" stroke="#334155" strokeWidth="2" opacity="0.5" />
      <circle cx="200" cy="200" r="25" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />
      <circle cx="200" cy="200" r="8" fill="#ef4444" stroke="#ef4444" strokeWidth="1" filter="url(#glow)">
        <animate attributeName="r" values="8;10;8" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite" />
      </circle>
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={200 + 25 * Math.cos(rad)}
            y1={200 + 25 * Math.sin(rad)}
            x2={200 + 170 * Math.cos(rad)}
            y2={200 + 170 * Math.sin(rad)}
            stroke="#475569"
            strokeWidth="1"
            opacity="0.3"
          />
        );
      })}
      <g opacity="0.6">
        {[
          { x: 185, y: 48, label: '20' },
          { x: 290, y: 90, label: '18' },
          { x: 340, y: 195, label: '6' },
          { x: 290, y: 310, label: '2' },
          { x: 185, y: 360, label: '3' },
          { x: 90, y: 310, label: '7' },
          { x: 50, y: 195, label: '11' },
          { x: 90, y: 90, label: '12' },
        ].map(({ x, y, label }) => (
          <text key={label} x={x} y={y} fill="#94a3b8" fontSize="14" fontWeight="600" fontFamily="Inter">
            {label}
          </text>
        ))}
      </g>
      <line x1="178" y1="158" x2="198" y2="196" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow)">
        <animate attributeName="opacity" values="0;1;1" dur="1.5s" fill="freeze" />
      </line>
      <line x1="225" y1="145" x2="202" y2="194" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow)">
        <animate attributeName="opacity" values="0;0;1;1" dur="2s" fill="freeze" />
      </line>
      <line x1="210" y1="150" x2="200" y2="198" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow)">
        <animate attributeName="opacity" values="0;0;0;1;1" dur="2.5s" fill="freeze" />
      </line>
    </svg>
  );
}

const features = [
  { icon: Target, title: 'Professzionalis edzes', desc: '180+ gyakorlat es strukturalt edzesprogramok minden szinthez.', color: 'text-blue-400 bg-blue-500/10' },
  { icon: Swords, title: 'Elomeccs & PVP', desc: 'Jatssz online barki ellen valos idoben, vagy kihivd a barataidat.', color: 'text-green-400 bg-green-500/10' },
  { icon: BarChart3, title: 'Reszletes statisztikak', desc: 'Minden dobas nyomon kovetve. Atlagok, trendek, fejlodes egy helyen.', color: 'text-orange-400 bg-orange-500/10' },
  { icon: Camera, title: 'Kamera felismeres', desc: 'AI-alapu dart felismeres - automatikusan rogziti a dobasaidat.', color: 'text-blue-400 bg-blue-500/10' },
  { icon: Mic, title: 'Hangvezerles', desc: 'Mondd be a pontszamot es a rendszer automatikusan rogziti.', color: 'text-green-400 bg-green-500/10' },
  { icon: Trophy, title: 'Klubok & Tornak', desc: 'Csatlakozz klubokhoz, indits versenyeket es merkozhetsz masokkal.', color: 'text-orange-400 bg-orange-500/10' },
];

const steps = [
  { num: '01', title: 'Regisztralj ingyen', desc: 'Hozd letre a fiokod masodpercek alatt, teljesen ingyen.', icon: UserPlus },
  { num: '02', title: 'Edz okosan', desc: 'Valassz 180+ gyakorlat kozul es koveted a fejlodest.', icon: Zap },
  { num: '03', title: 'Versenyezz', desc: 'Merkozhetsz masokkal, csatlakozz tornakhoz es klubokhoz.', icon: Trophy },
];

const stats = [
  { value: '10,000+', label: 'Jatekos' },
  { value: '500,000+', label: 'Dobas' },
  { value: '180+', label: 'Gyakorlat' },
  { value: '50+', label: 'Klub' },
];

export function LandingPage() {
  const featuresRef = useScrollReveal();
  const stepsRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6">
      <section className="relative overflow-hidden bg-dark-950 px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.12),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(34,197,94,0.08),_transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="text-center lg:text-left animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium mb-6 animate-slide-up stagger-1" style={{ animationFillMode: 'both' }}>
                <Target className="w-4 h-4" />
                #1 Darts Platform Magyarorszagon
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6 animate-slide-up stagger-2" style={{ animationFillMode: 'both' }}>
                <span className="bg-gradient-to-r from-blue-400 via-primary-400 to-green-400 bg-clip-text text-transparent">
                  Emeld magasabbra
                </span>
                <br />
                <span className="text-white">a jatekodat</span>
              </h1>
              <p className="text-lg sm:text-xl text-dark-400 max-w-lg mx-auto lg:mx-0 mb-8 animate-slide-up stagger-3" style={{ animationFillMode: 'both' }}>
                Professzionalis edzesprogramok, valos ideju statisztikak es versenyrendszer. Minden, amire szukseged van, hogy profi darts jatekos legy.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-slide-up stagger-4" style={{ animationFillMode: 'both' }}>
                <Link to="/register">
                  <Button size="lg" className="w-full sm:w-auto text-base px-8 py-3.5 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 shadow-glow" leftIcon={<UserPlus className="w-5 h-5" />}>
                    Ingyenes regisztracio
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 py-3.5 border-dark-600 text-dark-200 hover:bg-dark-800 hover:border-dark-500" leftIcon={<LogIn className="w-5 h-5" />}>
                    Bejelentkezes
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative flex justify-center animate-fade-in stagger-3" style={{ animationFillMode: 'both' }}>
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 lg:w-96 lg:h-96 animate-float">
                <div className="absolute inset-0 rounded-full bg-primary-500/5 blur-3xl" />
                <Dartboard />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-dark-900 border-y border-dark-800 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((s, i) => (
            <div key={s.label} className={clsx('text-center animate-slide-up', `stagger-${i + 1}`)} style={{ animationFillMode: 'both' }}>
              <p className="stat-value text-white">{s.value}</p>
              <p className="text-sm text-dark-400 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-16 lg:py-24 bg-dark-50 dark:bg-dark-950">
        <div
          ref={featuresRef}
          className="max-w-6xl mx-auto opacity-0 translate-y-8 transition-all duration-700 ease-out"
        >
          <div className="text-center mb-12">
            <p className="section-title text-primary-500 mb-2">Funkciok</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-white">
              Minden ami kell a fejlodeshez
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={clsx(
                  'glass dark:bg-dark-800/50 rounded-2xl p-6 gradient-border',
                  'hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300',
                  'animate-slide-up',
                  `stagger-${i + 1}`
                )}
                style={{ animationFillMode: 'both' }}
              >
                <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center mb-4', f.color)}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-dark-500 dark:text-dark-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-16 lg:py-24 bg-white dark:bg-dark-900">
        <div
          ref={stepsRef}
          className="max-w-4xl mx-auto opacity-0 translate-y-8 transition-all duration-700 ease-out"
        >
          <div className="text-center mb-12">
            <p className="section-title text-secondary-500 mb-2">Hogyan mukodik</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-white">
              Harom egyszeru lepes
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.num} className="relative text-center group">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-dark-300 dark:from-dark-700 to-transparent" />
                )}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border border-primary-500/20 mb-5 group-hover:scale-110 transition-transform duration-300">
                  <s.icon className="w-8 h-8 text-primary-500" />
                </div>
                <p className="text-xs font-bold text-primary-500 tracking-widest mb-2">{s.num}</p>
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">{s.title}</h3>
                <p className="text-dark-500 dark:text-dark-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-16 lg:py-24 bg-dark-50 dark:bg-dark-950">
        <div
          ref={ctaRef}
          className="max-w-3xl mx-auto opacity-0 translate-y-8 transition-all duration-700 ease-out"
        >
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-dark-900" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(34,197,94,0.2),_transparent_60%)]" />
            <div className="relative px-8 py-14 sm:px-14 sm:py-16 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Teljesen ingyenes
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Kesz vagy a fejlodesre?
              </h2>
              <p className="text-lg text-primary-100/70 max-w-md mx-auto mb-8">
                Csatlakozz tobb ezer jatekoshoz akik mar a DartsTraining platformon edzik magukat.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register">
                  <Button size="lg" className="w-full sm:w-auto text-base px-8 py-3.5 bg-white text-primary-700 hover:bg-dark-100 font-semibold" rightIcon={<ArrowRight className="w-5 h-5" />}>
                    Kezdd el most
                  </Button>
                </Link>
              </div>
              <div className="flex items-center justify-center gap-6 mt-8 text-sm text-primary-100/50">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Ingyenes</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Nincs kartya</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Azonnali hozzaferes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-4 sm:px-6 lg:px-8 py-8 bg-dark-950 border-t border-dark-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-dark-500">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-500" />
            <span className="font-semibold text-dark-300">DartsTraining</span>
          </div>
          <p>&copy; {new Date().getFullYear()} DartsTraining. Minden jog fenntartva.</p>
        </div>
      </footer>
    </div>
  );
}
