import request from "supertest";
import { app } from "../src/app";

describe("Community API", () => {
  it("GET /api/community/modules returns modules", async () => {
    const res = await request(app).get("/api/community/modules").expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.modules)).toBe(true);
    expect(res.body.modules.length).toBeGreaterThan(0);
  });

  it("GET /api/community/prayer-wall/posts returns 200 with items array", async () => {
    const res = await request(app).get("/api/community/prayer-wall/posts").expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});




