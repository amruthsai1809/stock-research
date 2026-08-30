"use client";

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { StockSummary } from "@/src/domain/stock";
import { searchCompanies } from "@/src/domain/companySearch";
import { StockMark } from "@/src/components/ui";

export function CompanyPicker({
  stocks,
  excludedSymbols,
  label,
  onSelect,
  onClose,
  align = "left",
  ownerRef,
}: {
  stocks: StockSummary[];
  excludedSymbols: string[];
  label: string;
  onSelect: (symbol: string) => void;
  onClose: () => void;
  align?: "left" | "right";
  ownerRef?: RefObject<HTMLElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [useMobilePortal, setUseMobilePortal] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches);
  const panelRef = useRef<HTMLElement>(null);
  const listId = useId();
  const excluded = useMemo(() => new Set(excludedSymbols), [excludedSymbols]);
  const results = useMemo(
    () => searchCompanies(stocks.filter((stock) => !excluded.has(stock.symbol)), query, 10),
    [excluded, query, stocks],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setUseMobilePortal(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const closeWhenOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node
        && !panelRef.current?.contains(event.target)
        && !ownerRef?.current?.contains(event.target)
      ) onClose();
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [onClose, ownerRef]);

  const choose = (symbol: string) => {
    onSelect(symbol);
    onClose();
  };

  const picker = (
    <section ref={panelRef} className={`company-picker company-picker--${align}`} aria-label={label}>
      <div className="company-picker__search">
        <span aria-hidden="true">⌕</span>
        <input
          autoFocus
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[activeIndex] ? `${listId}-${results[activeIndex].symbol}` : undefined}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % results.length);
            }
            if (event.key === "ArrowUp" && results.length) {
              event.preventDefault();
              setActiveIndex((current) => (current - 1 + results.length) % results.length);
            }
            if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault();
              choose(results[activeIndex].symbol);
            }
          }}
          placeholder="Ticker or company name…"
        />
        <button type="button" onClick={onClose} aria-label="Close company picker">×</button>
      </div>
      <div className="company-picker__meta">
        <span>{query ? "Best matches" : "Suggested companies"}</span>
        <small>{results.length} shown</small>
      </div>
      <div id={listId} className="company-picker__results" role="listbox">
        {results.map((stock, index) => (
          <button
            type="button"
            role="option"
            id={`${listId}-${stock.symbol}`}
            aria-selected={index === activeIndex}
            className={index === activeIndex ? "is-active" : ""}
            key={stock.symbol}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(stock.symbol)}
          >
            <StockMark symbol={stock.symbol} size="sm" />
            <span><b>{stock.symbol}</b><small>{stock.name}</small></span>
            <em>{stock.sector}</em>
          </button>
        ))}
        {!results.length && <div className="company-picker__empty"><b>No matching company</b><span>Try part of the company name or its ticker.</span></div>}
      </div>
      <footer><span><kbd>↑</kbd><kbd>↓</kbd> Move</span><span><kbd>↵</kbd> Select</span><small>Local search</small></footer>
    </section>
  );
  return useMobilePortal ? createPortal(picker, document.body) : picker;
}
