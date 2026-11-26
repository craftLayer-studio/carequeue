import type { ReactNode } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { Center } from "@astryxdesign/core/Center";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";

/** Mobile-first frame for patient pages opened from a QR code or WhatsApp link. */
export function PublicFrame({ clinic, isDemo, children }: { clinic: string; isDemo: boolean; children: ReactNode }) {
  return (
    <Center role="main" axis="horizontal" paddingInline={4} paddingBlock={6}>
      <VStack gap={5} width="100%" maxWidth={560}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <VStack gap={0.5}>
            <Text type="supporting" color="secondary">
              CareQueue
            </Text>
            <Text type="large" weight="bold">
              {clinic}
            </Text>
          </VStack>
          {isDemo ? <Badge variant="warning" label="Demo" /> : null}
        </HStack>
        {children}
        <Text type="supporting" color="secondary">
          CareQueue does not give medical advice. In an emergency, call 112.
        </Text>
      </VStack>
    </Center>
  );
}
