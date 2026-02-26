import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { fixtures } from "../storybook/fixtures";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "app.title": "reown",
        "app.tagline": "tagline",
        "repository.title": "Repositories",
        "repository.empty": "リポジトリがありません",
        "repository.add": "リポジトリを追加",
        "repository.remove": "削除",
        "repository.addAriaLabel": "リポジトリを追加",
        "repository.navAriaLabel": "リポジトリ一覧",
        "tabs.settingsAriaLabel": "設定を開く",
        "common.confirm": "確認",
        "common.cancel": "キャンセル",
        "common.delete": "削除",
      };
      if (key === "repository.removeAriaLabel") return `${opts?.name} を削除`;
      if (key === "repository.selectAriaLabel") return `${opts?.name} を選択`;
      if (key === "repository.confirmRemove")
        return `リポジトリ '${opts?.name}' を一覧から削除しますか？`;
      return translations[key] ?? key;
    },
  }),
}));

const defaultProps = {
  repositories: fixtures.repositories,
  selectedPath: null as string | null,
  onSelect: vi.fn(),
  onAdd: vi.fn(),
  onRemove: vi.fn(),
};

describe("Sidebar", () => {
  it("renders app title as non-heading element", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    const allReown = screen.getAllByText("reown");
    expect(allReown.length).toBeGreaterThanOrEqual(1);
    const brandElement = allReown.find((el) => el.tagName === "SPAN");
    expect(brandElement).toBeDefined();
  });

  it("renders repository list", () => {
    render(<Sidebar {...defaultProps} />);
    // Repo names are rendered as buttons (not headings)
    expect(screen.getByTitle("/Users/dev/project")).toBeInTheDocument();
    expect(screen.getByText("other-project")).toBeInTheDocument();
  });

  it("shows empty message when no repositories", () => {
    render(<Sidebar {...defaultProps} repositories={[]} />);
    expect(screen.getByText("リポジトリがありません")).toBeInTheDocument();
  });

  it("calls onSelect when repo is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Sidebar {...defaultProps} onSelect={onSelect} />);
    await user.click(screen.getByText("other-project"));
    expect(onSelect).toHaveBeenCalledWith("/Users/dev/other-project");
  });

  it("calls onAdd when add button is clicked", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<Sidebar {...defaultProps} onAdd={onAdd} />);
    await user.click(
      screen.getByText((content) => content.includes("リポジトリを追加"))
    );
    expect(onAdd).toHaveBeenCalled();
  });

  it("shows confirmation dialog when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Sidebar {...defaultProps} onRemove={onRemove} />);
    const removeButtons = screen.getAllByTitle("削除");
    await user.click(removeButtons[0]);
    expect(onRemove).not.toHaveBeenCalled();
    expect(
      screen.getByText("リポジトリ 'reown' を一覧から削除しますか？")
    ).toBeInTheDocument();
  });

  it("calls onRemove after confirming deletion", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Sidebar {...defaultProps} onRemove={onRemove} />);
    const removeButtons = screen.getAllByTitle("削除");
    await user.click(removeButtons[0]);
    await user.click(screen.getByRole("button", { name: "削除" }));
    expect(onRemove).toHaveBeenCalledWith("/Users/dev/project");
  });

  it("does not call onRemove when cancelling deletion", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Sidebar {...defaultProps} onRemove={onRemove} />);
    const removeButtons = screen.getAllByTitle("削除");
    await user.click(removeButtons[0]);
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("has aria-label on remove buttons", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByLabelText("reown を削除")).toBeInTheDocument();
    expect(screen.getByLabelText("other-project を削除")).toBeInTheDocument();
  });

  it("has aria-label on repository select buttons", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByLabelText("reown を選択")).toBeInTheDocument();
    expect(screen.getByLabelText("other-project を選択")).toBeInTheDocument();
  });

  it("has aria-label on add repository button", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByLabelText("リポジトリを追加")).toBeInTheDocument();
  });

  it("has aria-label on settings button", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByLabelText("設定を開く")).toBeInTheDocument();
  });

  it("has aria-keyshortcuts on settings button", () => {
    render(<Sidebar {...defaultProps} />);
    const settingsButton = screen.getByLabelText("設定を開く");
    expect(settingsButton).toHaveAttribute("aria-keyshortcuts", "S");
  });

  it("hides kbd shortcut from screen readers", () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    const kbd = container.querySelector("kbd");
    expect(kbd).toHaveAttribute("aria-hidden", "true");
  });

  it("has aria-label on nav element", () => {
    render(<Sidebar {...defaultProps} />);
    expect(
      screen.getByRole("navigation", { name: "リポジトリ一覧" })
    ).toBeInTheDocument();
  });

  it("highlights selected repository", () => {
    const { container } = render(
      <Sidebar {...defaultProps} selectedPath="/Users/dev/project" />
    );
    const selectedItem = container.querySelector(".border-l-accent");
    expect(selectedItem).toBeInTheDocument();
  });

  it("sets aria-current on selected repository", () => {
    const { container } = render(
      <Sidebar {...defaultProps} selectedPath="/Users/dev/project" />
    );
    const currentItem = container.querySelector('[aria-current="true"]');
    expect(currentItem).toBeInTheDocument();
    const nonSelectedItems = container.querySelectorAll("[aria-current]");
    expect(nonSelectedItems).toHaveLength(1);
  });
});
