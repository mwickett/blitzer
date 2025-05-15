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

interface WelcomeEmailProps {
  username: string;
}

const WelcomeEmailTemplate = ({ username }: WelcomeEmailProps) => {
  const previewText = `Welcome to Blitzer - Let's start scoring!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
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
            <Text style={title}>Welcome to Blitzer!</Text>
            <Text style={paragraph}>Hi {username},</Text>
            <Text style={paragraph}>
              Thanks for joining Blitzer! We&apos;re excited to help you keep
              score and track your games with friends.
            </Text>
            <Text style={paragraph}>With Blitzer, you can:</Text>
            <Text style={listItem}>• Create and manage game scoresheets</Text>
            <Text style={listItem}>• Track scores across multiple rounds</Text>
            <Text style={listItem}>• Connect with friends and share games</Text>
            <Section style={buttonContainer}>
              <Button href="https://blitzer.fun" style={button}>
                Start Your First Game
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
  marginLeft: "18px",
  marginBottom: "4px",
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

export const WelcomeEmail = (props: WelcomeEmailProps) => {
  const component = <WelcomeEmailTemplate {...props} />;
  const text = render(component, {
    plainText: true,
  });

  return {
    component,
    text,
  };
};
