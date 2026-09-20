import jwt from "jsonwebtoken";

export function createSupabaseRealtimeToken(userId: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not set");
  }
  return jwt.sign(
    {
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
    },
    secret,
    { expiresIn: "1h" },
  );
}
