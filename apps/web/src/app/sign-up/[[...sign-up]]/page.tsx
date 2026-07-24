import { SignUp } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";

const clerkCard = {
  rootBox: "mx-auto",
  card: [
    "shadow-none",
    "bg-[color:var(--surface)]",
    "border-[1.85px] border-[color:var(--stroke-doodle)]/65",
    "rounded-[18px_22px_20px_16px]",
    "shadow-[2px_3px_0_var(--doodle-shadow-soft)]",
    "text-[color:var(--ink)]",
  ].join(" "),
  headerTitle:
    "font-[family-name:var(--font-hand)] text-3xl text-[color:var(--ink)]",
  headerSubtitle: "text-[color:var(--ink-muted)]",
  formButtonPrimary:
    "bg-[color:var(--accent)] text-[color:var(--accent-foreground)] hover:brightness-105 rounded-[14px_16px_13px_15px] shadow-[1px_2px_0_var(--doodle-shadow)]",
  formFieldInput: [
    "rounded-[10px_12px_11px_13px]",
    "border-[1.5px] border-[color:var(--stroke-doodle)]/40",
    "bg-[color:var(--surface)] text-[color:var(--ink)]",
  ].join(" "),
  formFieldLabel: "text-[color:var(--ink-muted)]",
  footerActionLink: "text-[color:var(--accent)]",
  identityPreviewText: "text-[color:var(--ink)]",
  identityPreviewEditButton: "text-[color:var(--accent)]",
};

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle compact />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, var(--glow-butter), transparent)",
        }}
      />
      <SignUp appearance={{ elements: clerkCard }} />
    </main>
  );
}
