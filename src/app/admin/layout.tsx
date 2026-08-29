import { AdminLanguageProvider } from "@/lib/i18n/AdminLanguageContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLanguageProvider>{children}</AdminLanguageProvider>;
}
