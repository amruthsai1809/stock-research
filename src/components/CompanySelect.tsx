"use client";

import { useCallback, useRef, useState } from "react";
import type { StockSummary } from "@/src/domain/stock";
import { CompanyPicker } from "@/src/components/CompanyPicker";
import { StockMark } from "@/src/components/ui";

type Props = {
  stocks: readonly StockSummary[];
  value: string;
  label: string;
  onChange: (symbol: string) => void;
  detail?: string;
  className?: string;
  showMark?: boolean;
  align?: "left" | "right";
};

export function CompanySelect({ stocks, value, label, onChange, detail, className = "", showMark = false, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const ownerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const stock = stocks.find((item) => item.symbol === value) ?? stocks[0];
  if (!stock) return null;

  return <div ref={ownerRef} className={`company-select ${open ? "is-open" : ""} ${className}`.trim()}>
    <button
      type="button"
      className="company-select__trigger"
      aria-label={`${label}: ${stock.symbol} ${stock.name}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
    >
      {showMark && <StockMark symbol={stock.symbol} size="sm" />}
      <span>
        <small>{label}</small>
        <b>{stock.symbol}<em>{stock.name}</em></b>
        {detail && <i>{detail}</i>}
      </span>
      <strong aria-hidden="true">⌄</strong>
    </button>
    {open && <CompanyPicker
      stocks={[...stocks]}
      excludedSymbols={[]}
      label={`Find a company for ${label.toLowerCase()}`}
      align={align}
      ownerRef={ownerRef}
      onSelect={(symbol) => { onChange(symbol); close(); }}
      onClose={close}
    />}
  </div>;
}
