export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">CamWatch</h1>
          <p className="text-sm text-muted-foreground">
            Ingresa tus credenciales para continuar
          </p>
        </div>
        {/* LoginForm — se implementa en Sprint 1 */}
        <div className="rounded-lg border border-border p-6 text-center text-muted-foreground text-sm">
          Formulario de login — Sprint 1
        </div>
      </div>
    </main>
  );
}
