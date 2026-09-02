import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-sm border border-card-border bg-card p-8 text-center">
        <AlertCircle className="mx-auto size-8 text-destructive" />
        <h1 className="display-font mt-4 text-4xl font-bold uppercase text-foreground">Route not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This desk does not exist. Use the navigation to return to live operations.</p>
      </div>
    </div>
  );
}
