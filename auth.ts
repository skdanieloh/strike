import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  trustHost: true,
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id ?? token.sub;
      }
      if (trigger === "update" && session) {
        const s = session as {
          bestScore?: number;
          bestStage?: number;
          bestPlane?: string;
        };
        if (typeof s.bestScore === "number") token.bestScore = s.bestScore;
        if (typeof s.bestStage === "number") token.bestStage = s.bestStage;
        if (typeof s.bestPlane === "string") token.bestPlane = s.bestPlane;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.bestScore =
          typeof token.bestScore === "number" ? token.bestScore : undefined;
        session.user.bestStage =
          typeof token.bestStage === "number" ? token.bestStage : undefined;
        session.user.bestPlane =
          typeof token.bestPlane === "string" ? token.bestPlane : undefined;
      }
      return session;
    },
  },
});
