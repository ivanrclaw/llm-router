import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

describe("GET /api/health", () => {
  it("returns the service health payload without starting a listener", async () => {
    const response = await request(createApp()).get("/api/health").expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      service: "llm-router",
      version: "0.0.0",
    });
    expect(typeof response.body.timestamp).toBe("string");
  });
});
