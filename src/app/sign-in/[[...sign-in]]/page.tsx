import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      {/*
        Sign-up happens on this same route, at /sign-in/create. Stating that
        explicitly matters: Clerk otherwise infers it, and setting a
        NEXT_PUBLIC_CLERK_SIGN_UP_URL makes it infer that sign-up is a separate
        page instead — at which point this component stops claiming /create and
        bounces it back to /sign-in, leaving no way to sign up at all.
      */}
      <SignIn withSignUp />
    </div>
  );
}
