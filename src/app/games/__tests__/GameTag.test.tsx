import { fireEvent, render, screen } from "@testing-library/react";
import GameTag from "../[id]/GameTag";
import { saveGameTag } from "@/server/mutations/games";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));
jest.mock("@/server/mutations/games", () => ({ saveGameTag: jest.fn() }));

beforeEach(() => {
  mockRefresh.mockReset();
  jest.mocked(saveGameTag).mockReset();
});

it("links the tag to the filtered games list and hides editing from spectators", () => {
  const { rerender, container } = render(
    <GameTag gameId="g1" tag="late night" canEdit={false} suggestions={[]} />,
  );
  expect(screen.getByRole("link", { name: /Tag: late night/ })).toHaveAttribute(
    "href",
    "/games?tag=late%20night",
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();

  rerender(<GameTag gameId="g1" tag={null} canEdit={false} suggestions={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it("adds a tag with suggestions offered", async () => {
  jest.mocked(saveGameTag).mockResolvedValue({ ok: true, tag: "sober" });
  const { container } = render(
    <GameTag
      gameId="g1"
      tag={null}
      canEdit
      suggestions={["stoned", "sober"]}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Add a tag" }));
  expect(
    [...container.querySelectorAll("datalist option")].map((o) =>
      o.getAttribute("value"),
    ),
  ).toEqual(["stoned", "sober"]);
  fireEvent.change(screen.getByLabelText("Tag"), {
    target: { value: "sober" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save tag" }));

  await screen.findByRole("button", { name: "Change tag" });
  expect(saveGameTag).toHaveBeenCalledWith("g1", "sober");
  expect(screen.getByRole("link", { name: /Tag: sober/ })).toBeInTheDocument();
  expect(mockRefresh).toHaveBeenCalled();
});

it("removes an existing tag", async () => {
  jest.mocked(saveGameTag).mockResolvedValue({ ok: true, tag: null });
  render(<GameTag gameId="g1" tag="stoned" canEdit suggestions={[]} />);

  fireEvent.click(screen.getByRole("button", { name: "Change tag" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove tag" }));

  await screen.findByRole("button", { name: "Add a tag" });
  expect(saveGameTag).toHaveBeenCalledWith("g1", "");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
