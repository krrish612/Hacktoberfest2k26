import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}

export function Section({ title, description, aside, children }: SectionProps) {
  return (
    <section className="section">
      <div className="section__head">
        <div>
          <h2 className="section__title">{title}</h2>
          {description ? <p className="section__note">{description}</p> : null}
        </div>
        {aside ? <div className="section__aside">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}
