import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlockingProgress } from "./SafeFeedback";

describe("BlockingProgress", () => {
  it("blocks the screen with an accessible modal while an operation is active", () => {
    const view = render(
      <BlockingProgress
        active
        title="임시저장 중입니다"
        description="완료될 때까지 기다려 주세요."
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("dialog")).toHaveTextContent("임시저장 중입니다");

    view.rerender(
      <BlockingProgress
        active={false}
        title="임시저장 중입니다"
        description="완료될 때까지 기다려 주세요."
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
