import type { ReactNode } from "react";
import { Header } from "./Header";

interface AppShellProps {
  children: ReactNode;
  userEmail?: string | null;
}

export function AppShell({ children, userEmail = null }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <Header userEmail={userEmail} />
      <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
