import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      bestScore?: number;
      bestStage?: number;
      bestPlane?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    bestScore?: number;
    bestStage?: number;
    bestPlane?: string;
  }
}
