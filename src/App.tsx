export default function App() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-16">
      <section
        className="w-full max-w-xl border-l-4 border-blue-700 pl-6 sm:pl-10"
        aria-labelledby="welcome-title"
      >
        <p className="mb-8 font-mono text-sm font-bold uppercase tracking-widest text-blue-700">
          GymLog
        </p>
        <h1
          id="welcome-title"
          className="font-display text-5xl font-bold leading-tight tracking-tight sm:text-6xl"
        >
          Cada treino
          <br />
          conta.
        </h1>
        <p className="mt-6 max-w-sm text-lg leading-relaxed text-slate-600">
          Seu espaço para registrar treinos, acompanhar cargas e consultar exercícios.
        </p>
        <p className="mt-10 text-sm text-slate-500">
          Em construção. Seu diário de treino começa aqui.
        </p>
      </section>
    </main>
  );
}
