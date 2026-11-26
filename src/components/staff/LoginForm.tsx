"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { postJson } from "@/lib/live";
import { DemoBadge, ErrorBanner } from "../ui";

export function LoginForm({ next, demoAccounts }: { next: string | null; demoAccounts: { name: string; role: string; phone: string }[] }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(p = phone) {
    setError(null);
    try {
      const res = await postJson<{ demoCode: string | null }>("/api/auth/otp", { phone: p });
      setDemoCode(res.demoCode);
      setStep("code");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function verify() {
    setError(null);
    try {
      const res = await postJson<{ role: string }>("/api/auth/verify", { phone, code });
      router.push(next ?? (res.role === "owner" ? "/owner" : "/staff"));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Center role="main" axis="both" padding={6}>
      <VStack gap={4} width="100%" maxWidth={440}>
        <VStack gap={1} hAlign="center">
          <Text type="large" weight="bold">
            CareQueue
          </Text>
          <Text color="secondary">Clinic staff sign in</Text>
        </VStack>
        <Card padding={6}>
          <VStack gap={4}>
            <Heading level={1}>{step === "phone" ? "Sign in with your mobile" : "Enter the 6-digit code"}</Heading>
            {step === "phone" ? (
              <>
                <TextInput label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={setPhone} onEnter={() => void sendCode()} />
                <Button label="Send code" variant="primary" size="lg" clickAction={() => sendCode()} />
              </>
            ) : (
              <>
                {demoCode ? (
                  <Banner status="warning" title={`Demo code: ${demoCode}`} description="Shown here because this demo does not send SMS. A live clinic gets the code by SMS or WhatsApp." />
                ) : (
                  <Banner status="info" title="If this number belongs to clinic staff, a code has been sent." />
                )}
                <TextInput label="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} onEnter={() => void verify()} />
                <Button label="Sign in" variant="primary" size="lg" clickAction={verify} />
                <Button label="Use another number" variant="ghost" onClick={() => setStep("phone")} />
              </>
            )}
            <ErrorBanner message={error} />
          </VStack>
        </Card>
        {demoAccounts.length > 0 ? (
          <Card padding={4}>
            <VStack gap={2}>
              <Text weight="semibold">
                Demo accounts <DemoBadge />
              </Text>
              <Text type="supporting" color="secondary">
                Tap one to fill the number and get a code. Each role sees different screens; only the receptionist and doctors see full phone numbers.
              </Text>
              <List hasDividers density="compact">
                {demoAccounts.map((a) => (
                  <ListItem
                    key={a.phone}
                    label={`${a.role}: ${a.name}`}
                    description={a.phone}
                    onClick={() => {
                      setPhone(a.phone);
                      setCode("");
                      void sendCode(a.phone);
                    }}
                  />
                ))}
              </List>
            </VStack>
          </Card>
        ) : null}
      </VStack>
    </Center>
  );
}
