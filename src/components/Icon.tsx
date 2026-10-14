export type IconName =
  | "camera"
  | "lens"
  | "flash"
  | "receipt"
  | "shield"
  | "image"
  | "store"
  | "calendar"
  | "wrench"
  | "note"
  | "check"
  | "alert"
  | "clock"
  | "package"
  | "lock"
  | "chevron"
  | "close";

const paths: Record<IconName, string> = {
  camera:
    "M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-1.5h7l1 1.5h2A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  lens: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z",
  flash: "M11 3 5 13h5l-1 8 7-11h-5z",
  receipt: "M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zM9 8h6M9 11h6M9 14h4",
  shield: "M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z",
  image:
    "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5zM4 16l4.5-4.5 4 4 3-2.5L20 17M9 9.5A1 1 0 1 0 9 7.5a1 1 0 0 0 0 2z",
  store: "M4 9.5 6 4h12l2 5.5M4 9.5h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM9 20v-5h6v5",
  calendar: "M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v11A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5zM5 9.5h14M8 3v4M16 3v4",
  wrench:
    "M14.5 3a5 5 0 0 0-4.3 7.5L4 16.7a2 2 0 1 0 2.8 2.8l6.2-6.2A5 5 0 0 0 19 4.4l-3 3-2.1-2.1 3-3A5 5 0 0 0 14.5 3z",
  note: "M6 4h9l4 4v12H6zM14 4v5h5M9 13h6M9 16h6",
  check: "M5 12.5 10 17.5 19.5 7",
  alert: "M12 4 21 20H3zM12 10v4M12 17.2v.1",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 7.5V12l3 2",
  package: "M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10",
  lock: "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v8H5z",
  chevron: "M9 6l6 6-6 6",
  close: "M6 6l12 12M18 6L6 18",
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
