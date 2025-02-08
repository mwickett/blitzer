import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Link,
  Preview,
  Section,
  Heading,
} from "@react-email/components";

interface GameCompleteEmailProps {
  username: string;
  winnerUsername: string;
  isWinner: boolean;
  gameId: string;
}

export const GameCompleteEmail = ({
  username,
  winnerUsername,
  isWinner,
  gameId,
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
          <Heading style={h1}>Game Complete!</Heading>
          <Section style={section}>
            <Text style={text}>Hi {username},</Text>
            {isWinner ? (
              <Text style={text}>Congratulations! You won the game! 🎉</Text>
            ) : (
              <Text style={text}>
                Game over! {winnerUsername} won this round. Better luck next
                time! 🎮
              </Text>
            )}
            <Text style={text}>
              Want to see the final scores? Check out the game details:
            </Text>
            <Link
              href={`${process.env.NEXT_PUBLIC_APP_URL}/games/${gameId}`}
              style={button}
            >
              View Game Details
            </Link>
            <Text style={text}>
              Ready for another game? Start a new one and challenge your
              friends!
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

const section = {
  padding: "0 48px",
};

const text = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
};

const button = {
  backgroundColor: "#2563eb",
  borderRadius: "5px",
  color: "#fff",
  display: "block",
  fontSize: "16px",
  fontWeight: "bold",
  textAlign: "center" as const,
  textDecoration: "none",
  width: "100%",
  padding: "12px",
  marginTop: "16px",
  marginBottom: "16px",
};

const h1 = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "48px 0",
  padding: "0",
  textAlign: "center" as const,
};
