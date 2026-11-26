import { Button } from "@astryxdesign/core/Button";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";

export default function NotFound() {
  return (
    <Center role="main" axis="both" padding={10}>
      <VStack gap={3} hAlign="center">
        <Heading level={1}>Page not found</Heading>
        <Text color="secondary">This link may have expired or been mistyped. Please scan the QR at the clinic again.</Text>
        <Button label="Go to CareQueue" href="/" />
      </VStack>
    </Center>
  );
}
