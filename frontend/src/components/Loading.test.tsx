import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Loading, Spinner } from "./Loading";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.loading": "Loading…",
      };
      return translations[key] ?? key;
    },
  }),
}));

describe("Loading", () => {
  it("renders loading text", () => {
    render(<Loading />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders a spinner", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("Spinner", () => {
  it("renders with status role", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has loading aria-label", () => {
    render(<Spinner />);
    expect(screen.getByLabelText("loading")).toBeInTheDocument();
  });

  it.each(["sm", "md"] as const)("renders %s size", (size) => {
    render(<Spinner size={size} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
