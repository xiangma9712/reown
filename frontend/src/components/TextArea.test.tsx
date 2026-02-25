import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { TextArea } from "./TextArea";

describe("TextArea", () => {
  it("renders a textarea element", () => {
    render(<TextArea />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders a label when label prop is provided", () => {
    render(<TextArea label="Description" id="desc" />);
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("does not render a label when label prop is omitted", () => {
    const { container } = render(<TextArea />);
    expect(container.querySelector("label")).not.toBeInTheDocument();
  });

  it("accepts user input", async () => {
    const user = userEvent.setup();
    render(<TextArea />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "some text");
    expect(textarea).toHaveValue("some text");
  });

  it("shows error message when error prop is provided", () => {
    render(<TextArea error="Too short" />);
    expect(screen.getByText("Too short")).toBeInTheDocument();
  });

  it("applies placeholder text", () => {
    render(<TextArea placeholder="Enter description" />);
    expect(
      screen.getByPlaceholderText("Enter description")
    ).toBeInTheDocument();
  });
});
