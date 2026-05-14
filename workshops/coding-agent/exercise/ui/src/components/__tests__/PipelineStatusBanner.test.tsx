import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineStatusBanner } from "../PipelineStatusBanner";

describe("PipelineStatusBanner", () => {
  it("renders nothing when state is ready", () => {
    const { container } = render(<PipelineStatusBanner state="ready" />);
    expect(container.firstChild).toBeNull();
  });

  it("explains the empty-pipe state", () => {
    render(<PipelineStatusBanner state="unbuilt" />);
    expect(screen.getByRole("status")).toHaveTextContent(/empty/i);
    expect(screen.getByRole("status")).toHaveTextContent(/design view/i);
  });

  it("explains the booting state", () => {
    render(<PipelineStatusBanner state="unavailable" />);
    expect(screen.getByRole("status")).toHaveTextContent(/starting up/i);
  });

  it("explains the unreachable state", () => {
    render(<PipelineStatusBanner state="unreachable" />);
    expect(screen.getByRole("status")).toHaveTextContent(/can't reach the api/i);
  });
});
