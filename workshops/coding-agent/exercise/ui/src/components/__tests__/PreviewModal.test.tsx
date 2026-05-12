import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PreviewModal } from "../PreviewModal";

describe("PreviewModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<PreviewModal open={false} onClose={() => {}} image="blob:x" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an image when given a src", () => {
    render(<PreviewModal open onClose={() => {}} image="blob:abc" title="shot.png" />);
    const img = screen.getByRole("img", { name: "shot.png" });
    expect(img).toHaveAttribute("src", "blob:abc");
    expect(screen.getByText("shot.png")).toBeInTheDocument();
  });

  it("invokes onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<PreviewModal open onClose={onClose} image="blob:a" />);
    fireEvent.click(screen.getByLabelText("close preview"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<PreviewModal open onClose={onClose} image="blob:a" />);
    const backdrop = container.querySelector(".preview-modal");
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT close when content (inside backdrop) is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<PreviewModal open onClose={onClose} image="blob:a" />);
    const content = container.querySelector(".preview-modal-content");
    fireEvent.click(content!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape keydown", () => {
    const onClose = vi.fn();
    render(<PreviewModal open onClose={onClose} image="blob:a" />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on other keys", () => {
    const onClose = vi.fn();
    render(<PreviewModal open onClose={onClose} image="blob:a" />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
