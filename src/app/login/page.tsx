import type { Metadata } from "next";
import { LoginForm } from "@/components/staff/LoginForm";
import { formatPhone, ROLE_LABEL, type Role } from "@/domain";
import { getDb } from "@/server/db/client";
import { DEMO_STAFF, isEmpty } from "@/server/db/seed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const db = await getDb();
  const demo = !(await isEmpty(db));
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return (
    <LoginForm
      next={safeNext}
      demoAccounts={
        demo
          ? DEMO_STAFF.map((s) => ({ name: s.name, role: ROLE_LABEL[s.role as Role], phone: formatPhone(s.phone) }))
          : []
      }
    />
  );
}
