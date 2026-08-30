"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { StockSummary } from "@/src/domain/stock";
import { searchCompanies } from "@/src/domain/companySearch";
import { StockMark } from "@/src/components/ui";

type PickerPosition = {
  left: number;
  top: number;
  width: number;
  resultsHeight: number;
  placement: "above" | "below";
};

export type CompanyPickerItem = {
  symbol: string;
  name: string;
  detail: string;
};

const MOBILE_BREAKPOINT = 760;
const VIEWPORT_GUTTER = 12;
const DESKTOP_WIDTH = 370;
const PANEL_CHROME_HEIGHT = 112;

export function CompanyPicker({
  stocks,
  excludedSymbols,
  label,
  onSelect,
  onClose,
  align = "left",
  ownerRef,
  anchorElement,
  additionalItems = [],
  idleLabel = "Suggested companies",
  placeholder = "Ticker or company name…",
}: {
  stocks: StockSummary[];
  excludedSymbols: string[];
  label: string;
  onSelect: (symbol: string) => void;
  onClose: () => void;
  align?: "left" | "right";
  ownerRef?: RefObject<HTMLElement | null>;
  anchorElement?: HTMLElement | null;
  additionalItems?: CompanyPickerItem[];
  idleLabel?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT);
  const [position, setPosition] = useState<PickerPosition | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const listId = useId();
  const excluded = useMemo(() => new Set(excludedSymbols), [excludedSymbols]);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const supplemental = additionalItems
      .filter((item) => !excluded.has(item.symbol))
      .filter((item) => !normalized || `${item.symbol} ${item.name} ${item.detail}`.toLowerCase().includes(normalized))
      .slice(0, 4);
    const companies = searchCompanies(
      stocks.filter((stock) => !excluded.has(stock.symbol)),
      query,
      Math.max(4, 10 - supplemental.length),
    ).map((stock) => ({ symbol: stock.symbol, name: stock.name, detail: stock.sector }));
    return [...supplemental, ...companies].slice(0, 10);
  }, [additionalItems, excluded, query, stocks]);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (isMobile) return;

    const updatePosition = () => {
      const anchor = anchorElement ?? ownerRef?.current;
      if (!anchor?.isConnected) return;

      const anchorBox = anchor.getBoundingClientRect();
      const width = Math.min(DESKTOP_WIDTH, window.innerWidth - (VIEWPORT_GUTTER * 2));
      const preferredLeft = align === "right" ? anchorBox.right - width : anchorBox.left;
      const left = Math.max(VIEWPORT_GUTTER, Math.min(preferredLeft, window.innerWidth - width - VIEWPORT_GUTTER));
      const panelHeight = Math.min(panelRef.current?.scrollHeight ?? 430, window.innerHeight - (VIEWPORT_GUTTER * 2));
      const spaceBelow = window.innerHeight - anchorBox.bottom - VIEWPORT_GUTTER;
      const spaceAbove = anchorBox.top - VIEWPORT_GUTTER;
      const placement = spaceBelow < Math.min(panelHeight, 360) && spaceAbove > spaceBelow ? "above" : "below";
      const available = Math.max(190, placement === "above" ? spaceAbove - 8 : spaceBelow - 8);
      const renderedHeight = Math.min(panelHeight, available);
      const top = placement === "above"
        ? Math.max(VIEWPORT_GUTTER, anchorBox.top - renderedHeight - 8)
        : Math.min(anchorBox.bottom + 8, window.innerHeight - renderedHeight - VIEWPORT_GUTTER);

      setPosition({
        left,
        top,
        width,
        resultsHeight: Math.max(96, Math.min(310, renderedHeight - PANEL_CHROME_HEIGHT)),
        placement,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, anchorElement, isMobile, ownerRef, results.length]);

  useEffect(() => {
    const closeWhenOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      const owner = ownerRef?.current;
      if (
        !panelRef.current?.contains(event.target)
        && !owner?.contains(event.target)
        && !anchorElement?.contains(event.target)
      ) onClose();
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [anchorElement, onClose, ownerRef]);

  const choose = (symbol: string) => {
    onSelect(symbol);
    onClose();
  };

  const desktopStyle = !isMobile && position ? {
    left: `${position.left}px`,
    top: `${position.top}px`,
    width: `${position.width}px`,
    "--picker-results-height": `${position.resultsHeight}px`,
  } as CSSProperties : undefined;

  const picker = (
    <section
      ref={panelRef}
      className={`company-picker company-picker--${align} ${!isMobile && !position ? "is-positioning" : ""}`}
      data-placement={isMobile ? "sheet" : position?.placement}
      style={desktopStyle}
      aria-label={label}
    >
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
          placeholder={placeholder}
        />
        <button type="button" onClick={onClose} aria-label="Close company picker">×</button>
      </div>
      <div className="company-picker__meta">
        <span>{query ? "Best matches" : idleLabel}</span>
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
            <em>{stock.detail}</em>
          </button>
        ))}
        {!results.length && <div className="company-picker__empty"><b>No matching company</b><span>Try part of the company name or its ticker.</span></div>}
      </div>
      <footer><span><kbd>↑</kbd><kbd>↓</kbd> Move</span><span><kbd>↵</kbd> Select</span><small>Local search</small></footer>
    </section>
  );

  return createPortal(picker, document.body);
}
