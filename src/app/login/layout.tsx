import { AdminLanguageProvider } from "@/lib/i18n/AdminLanguageContext";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AdminLanguageProvider>{children}</AdminLanguageProvider>;
}
