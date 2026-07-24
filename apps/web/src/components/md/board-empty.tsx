import { DoodleFrame } from "@/components/md/doodle-frame";

function SketchPinIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
      className="text-stroke-doodle"
    >
      <path
        d="M9.2 11.5c.4-3.2 3.1-5.2 5.8-4.9 2.4.3 4.6 2.4 4.3 5.1-.2 1.8-1.3 3.1-2.4 4.1l.7 7.2c.05.5-.3.8-.7.7l-2.1-.4c-.4-.08-.6-.5-.55-.9l.55-5.8c-1.4-.9-2.9-2.2-3.2-4.1-.2-.8-.15-1.4-.4-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="var(--sticky-peach)"
        fillOpacity="0.55"
      />
      <path
        d="M13.8 20.2v3.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BoardEmptyIllustration() {
  return (
    <DoodleFrame
      preset="sketch-b"
      color="butter"
      className="mx-auto max-w-sm"
      delay={0.08}
    >
      <div className="flex items-start gap-3">
        <SketchPinIcon />
        <div>
          <p className="font-hand text-2xl leading-tight">
            Park a thought
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--on-sticky)]/65">
            Add a due date when it matters. SiroMan will help you follow
            through.
          </p>
        </div>
      </div>
    </DoodleFrame>
  );
}
