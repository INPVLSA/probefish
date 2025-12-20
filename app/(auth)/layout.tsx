import { Fish } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/50 via-background to-muted/50">
      <div className="w-full max-w-md p-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg">
            <Fish className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Probefish</h1>
          <p className="text-muted-foreground text-sm mt-1">A web-based LLM prompt and endpoint testing platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
