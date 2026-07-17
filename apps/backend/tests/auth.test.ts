import { describe, expect, it, beforeAll } from "bun:test";
import { prisma, cleanDb } from "./setup";
import { login, createUser, getMe, listUsers } from "../src/modules/auth/auth.service";

describe("Auth Service", () => {
  beforeAll(async () => {
    await cleanDb();
    await createUser({ username: "testuser", password: "testpass", name: "Test User", role: "GURU" });
    await createUser({ username: "admin", password: "admin123", name: "Admin", role: "ADMINISTRATOR" });
  });

  describe("createUser", () => {
    it("creates user with hashed password", async () => {
      const user = await createUser({ username: "newuser", password: "pass123", name: "New", role: "GURU" });
      expect(user).toBeDefined();
      expect(user.username).toBe("newuser");
      const inDb = await prisma.user.findUnique({ where: { username: "newuser" } });
      expect(inDb).toBeDefined();
      expect(inDb!.password).not.toBe("pass123");
    });

    it("rejects duplicate username", async () => {
      expect(createUser({ username: "testuser", password: "x", name: "x", role: "GURU" })).rejects.toThrow();
    });

    it("creates users with all roles", async () => {
      const roles = ["ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH"] as const;
      for (const role of roles) {
        const user = await createUser({ username: `role-${role}`, password: "pass", name: role, role });
        expect(user.role).toBe(role);
      }
    });
  });

  describe("login", () => {
    it("succeeds with valid credentials", async () => {
      const result = await login({ username: "testuser", password: "testpass" });
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.username).toBe("testuser");
    });

    it("fails with wrong password", async () => {
      expect(login({ username: "testuser", password: "wrongpass" })).rejects.toThrow();
    });

    it("fails with non-existent username", async () => {
      expect(login({ username: "nobody", password: "pass" })).rejects.toThrow();
    });
  });

  describe("getMe", () => {
    it("returns user by id", async () => {
      const result = await login({ username: "testuser", password: "testpass" });
      const me = await getMe(result.user.userId);
      expect(me.username).toBe("testuser");
    });
  });

  describe("listUsers", () => {
    it("returns all users", async () => {
      const users = await listUsers();
      expect(users.length).toBeGreaterThanOrEqual(2);
    });

    it("excludes password field", async () => {
      const users = await listUsers();
      for (const u of users) {
        expect((u as any).password).toBeUndefined();
      }
    });
  });
});
