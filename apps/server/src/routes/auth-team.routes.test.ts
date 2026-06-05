import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { DataSource } from "typeorm";
import { createApp } from "../app.js";
import { createMigratedTestDataSource } from "../test/test-db.js";

async function createTestServer() {
  const dataSource = await createMigratedTestDataSource("auth-routes-test");
  return { dataSource, app: createApp({ dataSource }) };
}

describe("dashboard auth and team membership API", () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = undefined;
  });

  it("registers a user, creates a default team, and returns /auth/me with owner role", async () => {
    const server = await createTestServer();
    dataSource = server.dataSource;

    const register = await request(server.app).post("/api/auth/register").send({
      email: "owner@example.com",
      name: "Owner User",
      password: "correct horse battery staple",
      teamName: "Owner Team",
      locale: "es",
    });

    expect(register.status).toBe(201);
    expect(register.body.token).toEqual(expect.any(String));
    expect(register.body.user).toMatchObject({ email: "owner@example.com", name: "Owner User", locale: "es" });
    expect(register.body.teams[0]).toMatchObject({ name: "Owner Team", role: "owner" });
    expect(register.body.user.passwordHash).toBeUndefined();

    const users = await dataSource.query("select email, passwordHash from users where email = ?", ["owner@example.com"]);
    expect(users).toHaveLength(1);
    expect(users[0].passwordHash).not.toContain("correct horse");
    expect(users[0].passwordHash).toMatch(/^\$2[aby]\$/);
    expect(register.body.token.split(".")).toHaveLength(3);

    const me = await request(server.app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${register.body.token}`);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("owner@example.com");
    expect(me.body.teams).toHaveLength(1);
    expect(me.body.teams[0].role).toBe("owner");
  });

  it("logs in with valid credentials, rejects invalid credentials, and supports logout", async () => {
    const server = await createTestServer();
    dataSource = server.dataSource;

    await request(server.app).post("/api/auth/register").send({
      email: "login@example.com",
      name: "Login User",
      password: "valid-password-123",
      teamName: "Login Team",
    });

    const invalidLogin = await request(server.app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "wrong-password",
    });
    expect(invalidLogin.status).toBe(401);

    const login = await request(server.app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "valid-password-123",
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));

    const rows = await dataSource.query("select lastLoginAt from users where email = ?", ["login@example.com"]);
    expect(rows[0].lastLoginAt).toBeTruthy();

    const logout = await request(server.app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(logout.status).toBe(204);
  });

  it("enforces team role permissions and team isolation", async () => {
    const server = await createTestServer();
    dataSource = server.dataSource;

    const owner = await request(server.app).post("/api/auth/register").send({
      email: "owner2@example.com",
      name: "Owner Two",
      password: "owner-password-123",
      teamName: "Owner Two Team",
    });
    const viewer = await request(server.app).post("/api/auth/register").send({
      email: "viewer@example.com",
      name: "Viewer User",
      password: "viewer-password-123",
      teamName: "Viewer Team",
    });

    const ownerTeamId = owner.body.teams[0].id;
    const viewerUserId = viewer.body.user.id;

    const invite = await request(server.app)
      .post(`/api/teams/${ownerTeamId}/invitations`)
      .set("Authorization", `Bearer ${owner.body.token}`)
      .send({ email: "viewer@example.com", role: "viewer" });
    expect(invite.status).toBe(201);
    expect(invite.body.token).toEqual(expect.any(String));
    expect(invite.body.tokenHash).toBeUndefined();

    const accept = await request(server.app)
      .post(`/api/invitations/${invite.body.token}/accept`)
      .set("Authorization", `Bearer ${viewer.body.token}`);
    expect(accept.status).toBe(200);
    expect(accept.body.membership).toMatchObject({ teamId: ownerTeamId, userId: viewerUserId, role: "viewer" });

    const viewerPatch = await request(server.app)
      .patch(`/api/teams/${ownerTeamId}`)
      .set("Authorization", `Bearer ${viewer.body.token}`)
      .send({ name: "Hacked Team" });
    expect(viewerPatch.status).toBe(403);

    const teams = await request(server.app)
      .get("/api/teams")
      .set("Authorization", `Bearer ${viewer.body.token}`);
    expect(teams.status).toBe(200);
    expect(teams.body.teams.map((team: { id: string }) => team.id)).toContain(ownerTeamId);

    const ownerMembers = await request(server.app)
      .get(`/api/teams/${ownerTeamId}/members`)
      .set("Authorization", `Bearer ${owner.body.token}`);
    expect(ownerMembers.status).toBe(200);
    const viewerMembership = ownerMembers.body.members.find((member: { userId: string }) => member.userId === viewerUserId);
    expect(viewerMembership.role).toBe("viewer");

    const promote = await request(server.app)
      .patch(`/api/teams/${ownerTeamId}/members/${viewerMembership.id}`)
      .set("Authorization", `Bearer ${owner.body.token}`)
      .send({ role: "member" });
    expect(promote.status).toBe(200);
    expect(promote.body.member.role).toBe("member");
  });
});
