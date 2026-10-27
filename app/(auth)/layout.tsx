import { Brand } from "@/components/top-bar";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[400px] flex-col justify-center gap-6 px-5 py-12">
      <Brand />
      {children}
      <p className="text-center text-xs text-muted">Parodie de réseau social. Projet scolaire, tout est fictif.</p>
    </main>
  );
}
