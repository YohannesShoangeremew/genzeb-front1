import { describe, expect, it } from "vitest";
import { gameSocketUrl } from "./ws";

describe("gameSocketUrl", () => {
  it.each(["REGULAR", "VIP"])("routes the %s tier through the type query", (tier) => {
    expect(gameSocketUrl(tier)).toContain(`/api/v1/ws/game?type=${tier}`);
  });

  it("routes a game UUID through the game-specific endpoint", () => {
    const gameId = "cf3cc3c4-992b-45c8-9d40-ab90d68a2c49";
    expect(gameSocketUrl(gameId)).toContain(`/api/v1/ws/game/${gameId}`);
  });
});
