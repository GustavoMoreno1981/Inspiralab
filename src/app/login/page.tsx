import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-[color:var(--muted)]">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
