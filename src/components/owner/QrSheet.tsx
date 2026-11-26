"use client";

import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";

interface Props {
  clinic: string;
  isDemo: boolean;
  tokenUrl: string;
  bookUrl: string;
  tokenImg: string;
  bookImg: string;
}

/** Printable A4 sheet for the reception desk. */
export function QrSheet({ clinic, isDemo, tokenUrl, bookUrl, tokenImg, bookImg }: Props) {
  return (
    <Center role="main" axis="horizontal" padding={6}>
      <VStack gap={6} width="100%" maxWidth={900}>
        <HStack gap={2} hAlign="between" vAlign="center">
          <Link href="/owner">Back to dashboard</Link>
          <Button label="Print" variant="primary" onClick={() => window.print()} />
        </HStack>
        <VStack gap={2} hAlign="center">
          <HStack gap={2} vAlign="center">
            <Heading level={1} justify="center">
              {clinic}
            </Heading>
            {isDemo ? <Badge variant="warning" label="Demo" /> : null}
          </HStack>
          <Text type="large" justify="center">
            Scan for your token. No need to stand at the counter.
          </Text>
          <Text color="secondary" justify="center">
            टोकन के लिए स्कैन करें। अपनी बारी फ़ोन पर देखें।
          </Text>
        </VStack>
        <Grid columns={{ minWidth: 280, max: 2 }} gap={6}>
          <Card padding={6}>
            <VStack gap={3} hAlign="center">
              <Heading level={2}>Get a token now</Heading>
              <VStack width="100%" maxWidth={280}>
                <AspectRatio ratio={1} fit="contain">
                  {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI, nothing to optimise */}
                  <img src={tokenImg} alt={`QR code to get a token at ${clinic}`} />
                </AspectRatio>
              </VStack>
              <Text type="supporting" color="secondary" wordBreak="break-all" justify="center">
                {tokenUrl}
              </Text>
            </VStack>
          </Card>
          <Card padding={6}>
            <VStack gap={3} hAlign="center">
              <Heading level={2}>Book an appointment</Heading>
              <VStack width="100%" maxWidth={280}>
                <AspectRatio ratio={1} fit="contain">
                  {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI, nothing to optimise */}
                  <img src={bookImg} alt={`QR code to book an appointment at ${clinic}`} />
                </AspectRatio>
              </VStack>
              <Text type="supporting" color="secondary" wordBreak="break-all" justify="center">
                {bookUrl}
              </Text>
            </VStack>
          </Card>
        </Grid>
        <Text type="supporting" color="secondary" justify="center">
          Your details are used only for this visit and the messages you choose. CareQueue does not give medical advice. Emergency: 112.
        </Text>
      </VStack>
    </Center>
  );
}
