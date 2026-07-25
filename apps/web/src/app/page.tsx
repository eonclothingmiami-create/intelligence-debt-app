import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="hero-plane relative min-h-[100svh] overflow-hidden text-mist">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
          <div className="absolute bottom-10 left-10 h-56 w-56 rounded-full bg-moss/40 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-between px-6 py-8 md:px-10 md:py-12">
          <header className="flex items-center justify-between">
            <p className="brand-mark text-3xl text-gold md:text-4xl">FIE</p>
            <Link
              href="/app"
              className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-mist transition hover:bg-gold/10"
            >
              Abrir OS
            </Link>
          </header>

          <div className="max-w-3xl pb-16 pt-20 md:pb-24">
            <h1 className="brand-mark text-5xl leading-[0.95] text-mist md:text-7xl">
              CFO digital
            </h1>
            <p className="mt-6 max-w-xl text-lg text-mist/80 md:text-xl">
              No es un ERP ni un contador: convierte ventas, gastos, deudas y caja reales en
              recomendaciones justificadas — sin inventar supuestos.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/app"
                className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink transition hover:brightness-110"
              >
                Entrar al tablero
              </Link>
              <a
                href="#instalar"
                className="rounded-full border border-mist/30 px-6 py-3 text-sm font-medium text-mist/90"
              >
                Instalar en el celular
              </a>
            </div>
          </div>

          <p className="text-xs uppercase tracking-[0.22em] text-mist/50">
            Inputs tuyos · Outputs del motor · Sin defaults financieros ocultos
          </p>
        </div>
      </section>

      <section id="instalar" className="mx-auto max-w-3xl px-6 py-20 md:px-10">
        <h2 className="brand-mark text-3xl text-forest md:text-4xl">PWA en el celular</h2>
        <p className="mt-4 text-muted">
          Con el servidor local o un deploy HTTPS, abre la app en el navegador del teléfono y usa
          “Agregar a pantalla de inicio” / “Instalar app”.
        </p>
        <ol className="mt-8 space-y-3 text-ink/90">
          <li>
            1. Entra a <span className="font-semibold">/app</span> desde Chrome o Safari.
          </li>
          <li>2. Menú del navegador → Instalar / Agregar a inicio.</li>
          <li>3. Se abre como app independiente (standalone).</li>
        </ol>
        <Link
          href="/app"
          className="mt-10 inline-flex rounded-full bg-forest px-5 py-3 text-sm font-semibold text-mist"
        >
          Ir al OS ahora
        </Link>
      </section>
    </main>
  );
}
