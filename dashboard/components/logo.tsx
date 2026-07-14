import { APP_DISPLAY_NAME } from "@/lib/brand";

interface LogoProps {
  size?: "sm" | "md" | "lg";
}

function Logo({ size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: { icon: "w-8 h-8", text: "text-lg", gap: "gap-2" },
    md: { icon: "w-10 h-10", text: "text-xl", gap: "gap-2.5" },
    lg: { icon: "w-12 h-12", text: "text-2xl", gap: "gap-3" },
  };

  const { icon, text, gap } = sizeClasses[size];

  return (
    <div className={`flex items-center ${gap}`} aria-label={APP_DISPLAY_NAME}>
      {/* Icon: rounded square with tally marks + checkmark */}
      <div
        className={`${icon} rounded-lg bg-primary flex items-center justify-center relative overflow-hidden`}
      >
        <svg viewBox="0 0 40 40" fill="none" className="w-full h-full" aria-hidden="true">
          {/* Speed/tally lines */}
          <line
            x1="6"
            y1="14"
            x2="14"
            y2="14"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="20"
            x2="12"
            y2="20"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="26"
            x2="10"
            y2="26"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Checkmark */}
          <polyline
            points="14,22 20,28 34,12"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Text */}
      <span className={`${text} tracking-tight`}>
        <span className="font-bold text-foreground">Tally</span>
        <span className="font-light text-foreground/80"> Runner</span>
      </span>
    </div>
  );
}

export default Logo;
