"use client";
import { ReactNode, useEffect, useRef } from "react";
import { labels } from "../lib";

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    menu: (
      <>
        <path d="M4 5h16M4 12h16M4 19h16" />
        <path d="M8 3v4M16 10v4M8 17v4" />
      </>
    ),
    coffee: (
      <>
        <path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" />
        <path d="M16 9h2a3 3 0 0 1 0 6h-2M7 2v3M12 2v3M3 22h16" />
      </>
    ),
    cake: (
      <>
        <path d="M3 11h18v10H3zM3 15c3 3 3-3 6 0s3-3 6 0 3-3 6 0M6 11V8h12v3M12 8V4" />
        <path d="M12 4c-2-1-2-2 0-3 2 1 2 2 0 3" />
      </>
    ),
    orders: (
      <>
        <path d="M6 3h12v19l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </>
    ),
    loyalty: (
      <>
        <path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V7ZM15 7v12" />
        <path d="m6 12 2 2 3-3" />
      </>
    ),
    reports: <path d="M4 3v18h17M9 16v-5M14 16V7M19 16V4" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    edit: <path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z" />,
    trash: <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.coffee}
    </svg>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">HIGHLANDS COFFEE</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Đóng">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Icon name="coffee" size={32} />
      <p>{children}</p>
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`badge ${["Đang bán", "HOAN_TAT", "CHUA_SU_DUNG"].includes(value) ? "green" : ["Ngừng kinh doanh", "DA_HUY", "HET_HAN"].includes(value) ? "gray" : "amber"}`}
    >
      <span />
      {labels[value] || value}
    </span>
  );
}
export function Stat({
  title,
  value,
  icon,
  hint,
}: {
  title: string;
  value: number | string;
  icon: string;
  hint: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">
          <Icon name={icon} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </div>
  );
}
