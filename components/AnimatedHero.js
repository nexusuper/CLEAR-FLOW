import ClayButton from './ui/ClayButton';

export default function AnimatedHero() {
  return (
    <section className="px-4 pt-8 pb-4">
      <div className="relative max-w-5xl mx-auto overflow-hidden rounded-[34px] px-6 py-12 text-center text-white clay-raised"
           style={{ background: 'linear-gradient(160deg,#7dd3fc,#0ea5e9)' }}>
        <div className="hero-shimmer" />

        {/* rising bubbles */}
        <span className="hero-bubble" style={{ left: '12%', width: 10, height: 10, animationDuration: '6s' }} />
        <span className="hero-bubble" style={{ left: '24%', width: 6, height: 6, animationDuration: '5s', animationDelay: '1.5s' }} />
        <span className="hero-bubble" style={{ left: '78%', width: 12, height: 12, animationDuration: '7s', animationDelay: '.8s' }} />
        <span className="hero-bubble" style={{ left: '88%', width: 7, height: 7, animationDuration: '5.5s', animationDelay: '2.2s' }} />
        <span className="hero-bubble" style={{ left: '60%', width: 8, height: 8, animationDuration: '6.5s', animationDelay: '3s' }} />

        {/* 3D drop + drip + ripple */}
        <div className="relative z-10 mx-auto" style={{ width: 120, height: 150 }}>
          <svg className="hero-drop mx-auto" style={{ width: 104, height: 104 }} viewBox="0 0 100 100">
            <defs>
              <radialGradient id="heroDrop" cx="36%" cy="30%" r="78%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#cdefff" />
                <stop offset="70%" stopColor="#7dd3fc" />
                <stop offset="100%" stopColor="#0284c7" />
              </radialGradient>
            </defs>
            <path d="M50 6C50 6 18 44 18 65a32 32 0 0 0 64 0C82 44 50 6 50 6z" fill="url(#heroDrop)" />
            <ellipse cx="36" cy="48" rx="10" ry="16" fill="#ffffff" opacity="0.6" />
            <circle cx="62" cy="72" r="6" fill="#ffffff" opacity="0.25" />
          </svg>
          <span className="hero-droplet" />
          <span className="hero-ripple" />
        </div>

        <h1 className="relative z-10 text-4xl md:text-6xl font-bold leading-tight mb-3"
            style={{ textShadow: '0 3px 8px rgba(2,80,120,.25)' }}>
          Fresh Water,<br />Delivered to Your Door
        </h1>
        <p className="relative z-10 max-w-xl mx-auto mb-6 font-semibold text-sky-50">
          Order purified water refills in minutes. No account needed — just fill the form and we deliver.
        </p>
        <div className="relative z-10 flex flex-col sm:flex-row gap-4 justify-center">
          <ClayButton href="/order" variant="white" size="lg">Order Now</ClayButton>
          <ClayButton href="/products" variant="ghost" size="lg">See Pricing</ClayButton>
        </div>

        {/* rolling waves */}
        <div className="absolute left-0 right-0 -bottom-0.5 h-14 z-0">
          <svg className="hero-wave hero-wave-1" viewBox="0 0 1200 60" preserveAspectRatio="none">
            <path d="M0,30 C150,60 350,0 600,30 C850,60 1050,0 1200,30 L1200,60 L0,60 Z" fill="rgba(255,255,255,.35)" />
          </svg>
          <svg className="hero-wave hero-wave-2" viewBox="0 0 1200 60" preserveAspectRatio="none">
            <path d="M0,35 C200,5 400,55 600,35 C800,15 1000,55 1200,35 L1200,60 L0,60 Z" fill="rgba(255,255,255,.55)" />
          </svg>
        </div>
      </div>
    </section>
  );
}
