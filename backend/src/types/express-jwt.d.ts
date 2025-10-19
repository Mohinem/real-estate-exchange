import type { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      jwt?: JwtPayload & {
        uid?: string;
        role?: string;
        email?: string;
      };
    }
  }
}

export {};
