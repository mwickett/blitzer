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
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const title = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#484848",
  textAlign: "center" as const,
  margin: "30px 0",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#484848",
};

const listItem = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#484848",
  marginLeft: "12px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#5850EC",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "14px",
  lineHeight: "24px",
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
