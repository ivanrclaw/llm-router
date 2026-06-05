export function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold tracking-tight mb-4">LLM Router</h1>
      <p className="text-muted-foreground text-lg mb-8">
        Multi-tenant LLM API gateway with model categorization
      </p>
      <div className="flex gap-6">
        <a
          href="/api/health"
          className="text-sm px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
        >
          Health Check
        </a>
      </div>
    </div>
  );
}
