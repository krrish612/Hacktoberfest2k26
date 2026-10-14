import type { AppInfo, Gear } from "../types";
import { warrantyView } from "../lib/warranty";
import { Icon } from "./Icon";

const categoryIcon = {
  "Camera body": "camera",
  Lens: "lens",
  Flash: "flash",
} as const;

function iconFor(category: string): "camera" | "lens" | "flash" | "package" {
  return categoryIcon[category as keyof typeof categoryIcon] ?? "package";
}

interface SidebarProps {
  gears: Gear[];
  selectedId: string;
  onSelect: (id: string) => void;
  info: AppInfo | null;
  runtime: string;
}

export function Sidebar({ gears, selectedId, onSelect, info, runtime }: SidebarProps) {
  return (
    <aside className="rail">
      <div className="rail__brand">
        <span className="rail__mark" aria-hidden="true">
          <Icon name="camera" size={20} />
        </span>
        <span>
          <span className="rail__wordmark">ShutterProof</span>
          <span className="rail__tagline">Gear records on this device</span>
        </span>
      </div>

      <nav className="rail__nav" aria-label="Gear records">
        <p className="rail__heading">Gear</p>
        <ul className="gearlist">
          {gears.map((gear) => {
            const view = warrantyView(gear);
            const active = gear.id === selectedId;
            return (
              <li key={gear.id}>
                <button
                  type="button"
                  className="gearlist__item"
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelect(gear.id)}
                >
                  <Icon name={iconFor(gear.category)} size={17} />
                  <span className="gearlist__text">
                    <span className="gearlist__name">{gear.model ?? gear.name}</span>
                    <span className="gearlist__meta">
                      <span className={`dot dot--${view.status}`} aria-hidden="true" />
                      {view.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="rail__foot">
        <p className="rail__badge">
          <Icon name="lock" size={14} />
          {runtime}
        </p>
        <p className="rail__version">
          v{info?.version ?? "0.1.0"} · {info ? "desktop shell" : "preview build"}
        </p>
      </div>
    </aside>
  );
}
