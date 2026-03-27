import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import { render } from "@react-email/render";
import * as React from "react";

interface CirclesAnnouncementEmailProps {
  username: string;
}

const CirclesAnnouncementTemplate = ({
  username,
}: CirclesAnnouncementEmailProps) => {
  const previewText = `Blitzer update: Introducing Circles — a new way to organize your games`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={contentSection}>
            <img
              src="https://blitzer.fun/img/blitzer-logo.png"
              alt="Blitzer Logo"
              width="80"
              height="80"
              style={{
                display: "block",
                margin: "0 auto 24px auto",
                borderRadius: "16px",
                background: "#fff",
              }}
            />
            <Text style={title}>Introducing Circles</Text>
            <Text style={paragraph}>Hi {username},</Text>
            <Text style={paragraph}>
              Blitzer just got a big update. We&apos;ve replaced the friends
              system with <strong>Circles</strong> — groups for the people you
              actually play Dutch Blitz with.
            </Text>
            <Text style={subtitle}>What&apos;s changing</Text>
            <Text style={listItem}>
              • <strong>Circles replace friends.</strong> A circle is your game
              night crew, family group, or coworkers — whoever you play with.
            </Text>
            <Text style={listItem}>
              • <strong>Games belong to a circle.</strong> When you create a
              game, it&apos;s scoped to your active circle. Switch circles to
              see different game histories.
            </Text>
            <Text style={listItem}>
              • <strong>Your old games are safe.</strong> Games played before
              this update are archived under &quot;Legacy Games&quot; and still
              count toward your personal stats.
            </Text>
            <Text style={subtitle}>What you need to do</Text>
            <Text style={paragraph}>
              Next time you sign in, you&apos;ll be asked to create a circle.
              Give it a name (e.g. &quot;Family Game Night&quot;) and you&apos;re
              good to go. You can invite other players from the circle settings.
            </Text>
            <Section style={buttonContainer}>
              <Button href="https://blitzer.fun" style={button}>
                Sign In &amp; Set Up Your Circle
              </Button>
            </Section>
            <Hr style={hr} />
            <Text style={footer}>
              This inbox isn&apos;t monitored, replies won&apos;t be read.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#fff7ea",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#fff",
  margin: "0 auto",
  padding: "32px 0 48px",
  marginBottom: "64px",
  borderRadius: "16px",
  boxShadow: "0 2px 12px rgba(41,8,6,0.06)",
  maxWidth: "480px",
};

const title = {
  fontSize: "28px",
  fontWeight: "800",
  color: "#290806",
  textAlign: "center" as const,
  margin: "16px 0 24px 0",
  letterSpacing: "-0.5px",
};

const subtitle = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#290806",
  margin: "24px 0 8px 0",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#290806",
  margin: "0 0 12px 0",
};

const listItem = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#290806",
  marginBottom: "8px",
};

const contentSection = {
  padding: "0 48px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "36px 0 24px 0",
};

const button = {
  backgroundColor: "#290806",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "17px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
  boxShadow: "0 2px 8px rgba(41,8,6,0.10)",
  border: "none",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "32px 0 16px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "13px",
  lineHeight: "22px",
  textAlign: "center" as const,
  marginTop: "24px",
};

export const CirclesAnnouncementEmail = (
  props: CirclesAnnouncementEmailProps
) => {
  const component = <CirclesAnnouncementTemplate {...props} />;
  const text = render(component, { plainText: true });

  return { component, text };
};
