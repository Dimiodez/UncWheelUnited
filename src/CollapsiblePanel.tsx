import { useState } from "react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
  initiallyOpen?: boolean;
  className?: string;
  children: ReactNode;
};

export default function CollapsiblePanel({ title, eyebrow, meta, initiallyOpen = true, className = "", children }: Props) {
  const [open, setOpen] = useState(initiallyOpen);

  return <details className={`collapsible-panel ${className}`.trim()} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>
      <div>{eyebrow && <span>{eyebrow}</span>}<strong>{title}</strong></div>
      <div className="collapsible-summary-meta">{meta}<i aria-hidden="true" /></div>
    </summary>
    <div className="collapsible-panel-content">{children}</div>
  </details>;
}
