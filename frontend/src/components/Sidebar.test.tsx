import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { fixtures } from "../storybook/fixtures";

const mockSetTheme = vi.fn();
vi.mock("../ThemeContext", () => ({
  useTheme: () => ({ theme: "system", setTheme: mockSetTheme }),
}));

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
        "sidebar.close": "サイドバーを閉じる",
        "common.confirm": "確認",
        "common.cancel": "キャンセル",
        "common.delete": "削除",
        "theme.label": "テーマ切替",
        "theme.light": "Light",
        "theme.dark": "Dark",
        "theme.system": "System",
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

  it("renders repository section heading as h2 with aria-labelledby", () => {
    render(<Sidebar {...defaultProps} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute("id", "sidebar-repositories-heading");
    expect(heading.textContent).toBe("Repositories");
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute(
      "aria-labelledby",
      "sidebar-repositories-heading"
    );
  });

  it("renders repository list", () => {
    render(<Sidebar {...defaultProps} />);
    // Repo names are rendered as buttons with aria-label
    expect(screen.getByLabelText("reown を選択")).toBeInTheDocument();
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

  it("has accessible name on nav element via aria-labelledby", () => {
    render(<Sidebar {...defaultProps} />);
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute(
      "aria-labelledby",
      "sidebar-repositories-heading"
    );
  });

  it("falls back to aria-label on nav when collapsed", () => {
    render(
      <Sidebar {...defaultProps} collapsed={true} onToggleCollapse={vi.fn()} />
    );
    const nav = screen.getByRole("navigation");
    expect(nav).not.toHaveAttribute("aria-labelledby");
    expect(nav).toHaveAttribute("aria-label", "リポジトリ一覧");
  });

  it("highlights selected repository", () => {
    const { container } = render(
      <Sidebar {...defaultProps} selectedPath="/Users/dev/project" />
    );
    const selectedItem = container.querySelector(".border-l-accent");
    expect(selectedItem).toBeInTheDocument();
  });

  it("shows checkmark icon for selected repository", () => {
    const { container } = render(
      <Sidebar {...defaultProps} selectedPath="/Users/dev/project" />
    );
    const selectedItem = container.querySelector('[aria-current="true"]');
    expect(selectedItem).toBeInTheDocument();
    const checkIcon = selectedItem!.querySelector("svg[aria-hidden='true']");
    expect(checkIcon).toBeInTheDocument();
  });

  it("does not show checkmark icon for non-selected repositories", () => {
    const { container } = render(
      <Sidebar {...defaultProps} selectedPath="/Users/dev/project" />
    );
    const nonSelectedItems = container.querySelectorAll(
      ".border-l-transparent"
    );
    nonSelectedItems.forEach((item) => {
      const checkIcon = item.querySelector("svg[aria-hidden='true']");
      expect(checkIcon).not.toBeInTheDocument();
    });
  });

  it("shows tooltip with repo name and path on hover", async () => {
    const user = userEvent.setup();
    render(<Sidebar {...defaultProps} />);
    const repoButton = screen.getByLabelText("reown を選択");
    await user.hover(repoButton);
    // Radix renders tooltip content twice (visual + aria-describedby hidden span)
    const pathElements = await screen.findAllByText("/Users/dev/project");
    expect(pathElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders close button when onClose is provided", () => {
    const onClose = vi.fn();
    render(<Sidebar {...defaultProps} onClose={onClose} />);
    expect(screen.getByLabelText("サイドバーを閉じる")).toBeInTheDocument();
  });

  it("does not render close button when onClose is not provided", () => {
    render(<Sidebar {...defaultProps} />);
    expect(
      screen.queryByLabelText("サイドバーを閉じる")
    ).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Sidebar {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByLabelText("サイドバーを閉じる"));
    expect(onClose).toHaveBeenCalled();
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

  it("renders theme toggle with three options", () => {
    render(<Sidebar {...defaultProps} />);
    const radiogroup = screen.getByRole("radiogroup", { name: "テーマ切替" });
    expect(radiogroup).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toBeInTheDocument();
  });

  it("calls setTheme when theme option is clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar {...defaultProps} />);
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("marks current theme as checked", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });
});
