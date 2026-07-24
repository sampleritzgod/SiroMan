import { SignUp } from "@clerk/nextjs";

const clerkCard = {
  rootBox: "mx-auto",
  card: [
    "shadow-none",
    "bg-[color:var(--surface)]",
    "border-[1.85px] border-[color:var(--stroke-doodle)]/65",
    "rounded-[18px_22px_20px_16px]",
    "shadow-[2px_3px_0_rgba(42,38,34,0.08)]",
  ].join(" "),
  headerTitle: "font-[family-name:var(--font-hand)] text-3xl",
  headerSubtitle: "text-[color:var(--ink-muted)]",
  formButtonPrimary:
    "bg-[color:var(--accent)] hover:brightness-105 rounded-[14px_16px_13px_15px] shadow-[1px_2px_0_rgba(42,38,34,0.12)]",
  formFieldInput:
    "rounded-[10px_12px_11px_13px] border-[1.5px] border-[color:var(--stroke-doodle)]/40",
  footerActionLink: "text-[color:var(--accent)]",
};

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(255,241,168,0.55), transparent)",
        }}
      />
      <SignUp appearance={{ elements: clerkCard }} />
    </main>
  );
}
