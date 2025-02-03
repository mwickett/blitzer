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
import * as React from "react";

interface FriendRequestEmailProps {
  username: string;
  fromUsername: string;
}

export const FriendRequestEmail = ({
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
          <Section>
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
