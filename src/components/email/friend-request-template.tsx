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

interface FriendRequestEmailProps {
  username: string;
  fromUsername: string;
}

const FriendRequestEmailTemplate = ({
  username,
  fromUsername,
}: FriendRequestEmailProps) => {
  const previewText = `${fromUsername} sent you a friend request on Blitzer`;

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
            <Text style={title}>New Friend Request</Text>
            <Text style={paragraph}>Hi {username},</Text>
            <Text style={paragraph}>
              {fromUsername} would like to connect with you on Blitzer! Adding
              friends makes it easy to:
            </Text>
            <Text style={listItem}>• Start new games together</Text>
            <Text style={listItem}>• Share game results</Text>
            <Text style={listItem}>• Keep track of your gaming history</Text>
            <Section style={buttonContainer}>
              <Button href="https://blitzer.fun/friends" style={button}>
                View Friend Request
              </Button>
            </Section>
            <Hr style={hr} />
            <Text style={footer}>
              You received this email because you have notifications enabled for
              friend requests on Blitzer.
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

const contentSection = {
  padding: "0 48px",
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

export const FriendRequestEmail = (props: FriendRequestEmailProps) => {
  const component = <FriendRequestEmailTemplate {...props} />;
  const text = render(component, {
    plainText: true,
  });

  return {
    component,
    text,
  };
};
