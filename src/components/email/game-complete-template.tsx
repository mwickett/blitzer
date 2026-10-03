import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Button,
  Preview,
  Section,
  Hr,
  Img,
  render,
} from "react-email";
import * as React from "react";

interface GameCompleteEmailProps {
  username: string;
  winnerUsername: string;
  isWinner: boolean;
  gameId: string;
  story?: string;
  guestNames?: string[];
}

const GameCompleteEmailTemplate = ({
  username,
  winnerUsername,
  isWinner,
  gameId,
  story,
  guestNames = [],
}: GameCompleteEmailProps) => {
  const previewText = isWinner
    ? "Congratulations on your win!"
    : `Game complete - ${winnerUsername} won!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={contentSection}>
            <Img
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
            <Text style={title}>Game Complete!</Text>
            <Text style={paragraph}>Hi {username},</Text>
            {isWinner ? (
              <Text style={paragraph}>Congratulations! You won the game! 🎉</Text>
            ) : (
              <Text style={paragraph}>
                Game over! {winnerUsername} won this round. Better luck next
                time! 🎮
              </Text>
            )}
            {story ? (
              <Section style={storySection}>
                <Text style={storyTitle}>The story of this game</Text>
                <Text style={storyText}>{story}</Text>
              </Section>
            ) : null}
            <Text style={paragraph}>
              Want to see the final scores? Check out the game details:
            </Text>
            <Section style={buttonContainer}>
              <Button
                href={`https://blitzer.fun/games/${gameId}`}
                style={button}
              >
                View Game Details
              </Button>
            </Section>
            {guestNames.length > 0 ? (
              <Text style={paragraph}>
                {formatNames(guestNames)} played as{" "}
                {guestNames.length === 1 ? "a guest" : "guests"}. Invite{" "}
                {guestNames.length === 1 ? "them" : "them all"} from the game
                page so their next games count toward their own stats.
              </Text>
            ) : null}
            <Text style={paragraph}>
              Ready for another game? Start a new one and challenge your
              friends!
            </Text>
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

function formatNames(names: string[]) {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

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

const storySection = {
  backgroundColor: "#fff7ea",
  borderRadius: "12px",
  padding: "16px 20px",
  margin: "20px 0",
};

const storyTitle = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#290806",
  margin: "0 0 8px 0",
};

const storyText = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#290806",
  margin: "0",
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

export const GameCompleteEmail = (props: GameCompleteEmailProps) => {
  const component = <GameCompleteEmailTemplate {...props} />;
  const text = render(component, {
    plainText: true,
  });

  return {
    component,
    text,
  };
};
