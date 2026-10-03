/** @jest-environment node */
import { renderToStaticMarkup } from "react-dom/server";
import { GameCompleteEmail } from "../game-complete-template";
import { WelcomeEmail } from "../welcome-template";

// react-email's render dynamically imports react-dom/server, which Jest's
// CommonJS runtime cannot do; the markup is rendered directly instead.
jest.mock("react-email", () => ({
  ...jest.requireActual("react-email"),
  render: jest.fn(() => Promise.resolve("plain text")),
}));

const game = { username: "Ada", winnerUsername: "Grace", gameId: "game-42" };
const markup = (email: { component: React.ReactElement }) =>
  renderToStaticMarkup(email.component).replace(/<!-- -->/g, "");

test("winners are congratulated and linked to their game", () => {
  const html = markup(GameCompleteEmail({ ...game, isWinner: true }));
  expect(html).toContain("Hi Ada,");
  expect(html).toContain("Congratulations! You won the game!");
  expect(html).not.toContain("Grace won this round");
  expect(html).toContain('href="https://blitzer.fun/games/game-42"');
});

test("other players hear who won", () => {
  const html = markup(GameCompleteEmail({ ...game, isWinner: false }));
  expect(html).toContain("Grace won this round");
  expect(html).not.toContain("You won the game");
});

test("templates also produce their plain-text part", async () => {
  expect(await GameCompleteEmail({ ...game, isWinner: true }).text).toBe("plain text");
  expect(await WelcomeEmail({ username: "Ada" }).text).toBe("plain text");
});

test("the welcome email greets the new player by username", () => {
  expect(markup(WelcomeEmail({ username: "Ada" }))).toContain("Hi Ada,");
});
