import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-subtle-bg p-6">
      <h1 className="text-2xl font-semibold text-text-primary">Turnia</h1>
      <p className="max-w-md text-center text-text-secondary">
        Gestión de turnos de guardia para hospitales y clínicas.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Entrar
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary hover:bg-subtle-bg"
        >
          Registrarse
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary hover:bg-subtle-bg"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
