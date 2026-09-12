import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { Permission, resolvePermissions } from "@/lib/permissions";

const TOKEN_NAME = "wt_admin_token";
const EXPIRES = "24h";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
  permissions?: Permission[];
}

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET?.trim();
  return secret || null;
}

export function signToken(payload: TokenPayload): string {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error("JWT_SECRET no está configurado");
  }
  return jwt.sign(payload, secret, { expiresIn: EXPIRES, algorithm: "HS256" });
}

export function verifyToken(token: string): TokenPayload | null {
  const secret = getJwtSecret();
  if (!secret) return null;

  try {
    return jwt.verify(token, secret, { algorithms: ["HS256"] }) as TokenPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_NAME)?.value;
  if (!token) return null;
  const session = verifyToken(token);
  if (!session) return null;
  return {
    ...session,
    permissions: resolvePermissions(session.role, session.permissions),
  };
}

export { TOKEN_NAME };
