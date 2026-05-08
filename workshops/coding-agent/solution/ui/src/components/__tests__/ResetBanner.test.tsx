import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetBanner } from "../ResetBanner";

describe("ResetBanner", () => {
  it("renders the reset notice text", () => {
    render(<ResetBanner onDismiss={vi.fn()} />);
    expect(screen.getByText(/reset|history/i)).toBeInTheDocument();
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    render(<ResetBanner onDismiss={onDismiss} />);
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[buttons.length - 1]);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
