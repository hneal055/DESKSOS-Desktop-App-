import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { User, SafeUser, JwtPayload } from "../types/index.js";
import { JWT_SECRET } from "../config.js";

const router = Router();

const sign = (user: Pick<User, "id" | "email" | "role" | "name">): string =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name } satisfies JwtPayload,
    JWT_SECRET,
    { expiresIn: "7d" }
  );

router.post("/login", (req: Request, res: Response): void => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(
    email.toLowerCase().trim()
  ) as User | undefined;
  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const { password: _, ...safeUser } = user;
  res.json({ token: sign(user), user: safeUser as SafeUser });
});

router.post("/register", (req: Request, res: Response): void => {
  const { name, email, password } = req.body as {
    name?: string; email?: string; password?: string;
  };
  if (!name || !email || !password) {
    res.status(400).json({ error: "All fields required" });
    return;
  }
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(
    email.toLowerCase().trim()
  );
  if (exists) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const newUser: User = {
    id: uuidv4(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: bcrypt.hashSync(password, 10),
    role: "technician",
  };
  db.prepare("INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)").run(
    newUser.id, newUser.name, newUser.email, newUser.password, newUser.role
  );
  const { password: _, ...safeUser } = newUser;
  res.status(201).json({ token: sign(newUser), user: safeUser as SafeUser });
});

export default router;

