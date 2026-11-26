"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { can, ROLE_LABEL, type Permission, type Role } from "@/domain";
import { postJson } from "@/lib/live";
import { DemoBadge } from "./ui";

const NAV: { href: string; label: string; permission: Permission }[] = [
  { href: "/staff", label: "Queue", permission: "queue:operate" },
  { href: "/staff/appointments", label: "Appointments", permission: "appointment:manage" },
  { href: "/staff/patients", label: "Patients", permission: "patient:view" },
  { href: "/staff/followups", label: "Follow-ups", permission: "patient:view" },
  { href: "/staff/outbox", label: "Outbox", permission: "outbox:view" },
  { href: "/owner", label: "Dashboard", permission: "dashboard:view" },
  { href: "/owner/settings", label: "Settings", permission: "settings:manage" },
  { href: "/owner/audit", label: "Audit log", permission: "audit:view" },
];

export interface ShellActor {
  name: string;
  role: Role;
  clinic: string;
}

export function StaffShell({ actor, current, children }: { actor: ShellActor; current: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <AppShell
      variant="surface"
      contentPadding={4}
      height="auto"
      topNav={
        <TopNav
          label="CareQueue staff navigation"
          heading={<TopNavHeading heading="CareQueue" headingHref="/staff" subheading={actor.clinic} />}
          centerContent={
            <>
              {NAV.filter((n) => can(actor.role, n.permission)).map((n) => (
                <TopNavItem key={n.href} label={n.label} href={n.href} isSelected={current === n.href} />
              ))}
            </>
          }
          endContent={
            <HStack gap={2} vAlign="center">
              <DemoBadge />
              <Text type="supporting" color="secondary">
                {actor.name} · {ROLE_LABEL[actor.role]}
              </Text>
              <Button
                label="Sign out"
                variant="ghost"
                size="sm"
                clickAction={async () => {
                  await postJson("/api/auth/logout");
                  router.push("/login");
                  router.refresh();
                }}
              />
            </HStack>
          }
        />
      }>
      {children}
    </AppShell>
  );
}
