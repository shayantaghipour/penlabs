"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export type GlassTab = {
  key: string;
  content: ReactNode;
  className?: string;
  onDoubleClick?: () => void;
};

type Props = {
  tabs: GlassTab[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  orientation: "vertical" | "horizontal";
  radius?: number;
  className?: string;
  trailing?: ReactNode; // دکمه‌هایی که تب نیستن (مثل +)
};

type Box = { x: number; y: number; w: number; h: number };
type Drag = Box & { key: string };

const HOLD_MS = 220; // مدت نگه داشتن روی لمسی تا کشیدن شروع بشه
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function GlassTabs({
  tabs,
  activeKey,
  onSelect,
  orientation,
  radius = 20,
  className = "",
  trailing,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [animate, setAnimate] = useState(false);

  const g = useRef({
    id: -1,
    sx: 0,
    sy: 0,
    lx: 0,
    ly: 0,
    engaged: false,
    touch: false,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });
  const hoverKey = useRef<string | null>(null);
  const suppressClick = useRef(false);

  const horizontal = orientation === "horizontal";
  const tabKeys = tabs.map((t) => t.key).join("|");

  const findEl = useCallback(
    (key: string) =>
      ref.current?.querySelector<HTMLElement>(`[data-tab-key="${CSS.escape(key)}"]`) ?? null,
    []
  );

  /* ---------- اندازه‌گیری تب فعال ---------- */

  const measure = useCallback(() => {
    const el = activeKey === null ? null : findEl(activeKey);
    if (!el) {
      setBox(null);
      return;
    }
    const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    setBox((p) =>
      p && p.x === next.x && p.y === next.y && p.w === next.w && p.h === next.h ? p : next
    );
  }, [activeKey, findEl]);

  useIsoLayoutEffect(() => {
    measure();
    const c = ref.current;
    if (!c) return;
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    c.querySelectorAll("[data-tab-key]").forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [measure, tabKeys]);

  // انیمیشن بعد از اولین اندازه‌گیری فعال می‌شه تا لنز از گوشه صفحه نپره
  useEffect(() => {
    if (box && !animate) {
      const t = setTimeout(() => setAnimate(true), 60);
      return () => clearTimeout(t);
    }
  }, [box, animate]);

  // تب فعال همیشه تو دید باشه
  useEffect(() => {
    if (activeKey === null) return;
    findEl(activeKey)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeKey, findEl]);

  // وقتی کشیدن فعاله، اسکرول لمسی رو متوقف کن
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const block = (e: TouchEvent) => {
      if (g.current.engaged && e.cancelable) e.preventDefault();
    };
    c.addEventListener("touchmove", block, { passive: false });
    return () => c.removeEventListener("touchmove", block);
  }, []);

  /* ---------- کشیدن ---------- */

  function updateDrag(clientX: number, clientY: number) {
    const c = ref.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();

    // اسکرول خودکار نزدیک لبه‌ها
    const EDGE = 28;
    if (horizontal) {
      if (clientX - rect.left < EDGE) c.scrollLeft -= 10;
      else if (rect.right - clientX < EDGE) c.scrollLeft += 10;
    } else {
      if (clientY - rect.top < EDGE) c.scrollTop -= 10;
      else if (rect.bottom - clientY < EDGE) c.scrollTop += 10;
    }

    const pos = horizontal
      ? clientX - rect.left + c.scrollLeft
      : clientY - rect.top + c.scrollTop;

    // نزدیک‌ترین تب به انگشت
    let best: HTMLElement | null = null;
    let bestDist = Infinity;
    c.querySelectorAll<HTMLElement>("[data-tab-key]").forEach((el) => {
      const start = horizontal ? el.offsetLeft : el.offsetTop;
      const size = horizontal ? el.offsetWidth : el.offsetHeight;
      const d = pos < start ? start - pos : pos > start + size ? pos - (start + size) : 0;
      if (d < bestDist) {
        bestDist = d;
        best = el;
      }
    });
    const target = best as HTMLElement | null;
    if (!target) return;

    const key = target.dataset.tabKey ?? "";
    hoverKey.current = key;

    const size = horizontal ? target.offsetWidth : target.offsetHeight;
    const total = horizontal ? c.scrollWidth : c.scrollHeight;
    const along = Math.max(0, Math.min(pos - size / 2, total - size));

    setDrag({
      key,
      x: horizontal ? along : target.offsetLeft,
      y: horizontal ? target.offsetTop : along,
      w: target.offsetWidth,
      h: target.offsetHeight,
    });
  }

  function engage() {
    const s = g.current;
    const c = ref.current;
    if (!c || s.id === -1) return;
    s.engaged = true;
    try {
      c.setPointerCapture(s.id);
    } catch {}
    navigator.vibrate?.(8);
    updateDrag(s.lx, s.ly);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!(e.target as HTMLElement).closest("[data-tab-key]")) return;

    const s = g.current;
    clearTimeout(s.timer);
    s.id = e.pointerId;
    s.sx = s.lx = e.clientX;
    s.sy = s.ly = e.clientY;
    s.engaged = false;
    s.touch = e.pointerType !== "mouse";

    if (s.touch) s.timer = setTimeout(engage, HOLD_MS);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = g.current;
    if (e.pointerId !== s.id) return;

    if (s.engaged) {
      updateDrag(e.clientX, e.clientY);
      return;
    }

    const dist = Math.hypot(e.clientX - s.sx, e.clientY - s.sy);
    if (s.touch) {
      // انگشت قبل از نگه داشتن حرکت کرد: کاربر داره اسکرول می‌کنه
      if (dist > 10) {
        clearTimeout(s.timer);
        s.id = -1;
      } else {
        s.lx = e.clientX;
        s.ly = e.clientY;
      }
    } else if (dist > 4 && (e.buttons & 1) === 1) {
      s.lx = e.clientX;
      s.ly = e.clientY;
      engage();
    }
  }

  function finish(commit: boolean) {
    const s = g.current;
    clearTimeout(s.timer);

    if (s.engaged) {
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 80);
      const key = hoverKey.current;
      if (commit && key && key !== activeKey) onSelect(key);
    }

    s.engaged = false;
    s.id = -1;
    hoverKey.current = null;
    setDrag(null);
  }

  /* ---------- رندر ---------- */

  const lens = drag ?? box;

  return (
    <div
      ref={ref}
      role="tablist"
      className={`glass-tabs relative ${className}`}
      style={{ "--tab-radius": `${radius}px` } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onContextMenu={(e) => {
        if (g.current.touch) e.preventDefault();
      }}
    >
      <div
        aria-hidden
        className="glass-lens"
        data-animate={animate}
        data-dragging={drag !== null}
        style={{
          transform: `translate(${lens?.x ?? 0}px, ${lens?.y ?? 0}px)`,
          width: lens?.w ?? 0,
          height: lens?.h ?? 0,
          opacity: lens ? 1 : 0,
        }}
      />

      {tabs.map((t) => (
        <div
          key={t.key}
          role="tab"
          tabIndex={0}
          aria-selected={t.key === activeKey}
          data-tab-key={t.key}
          className={`tab-item relative z-10 ${t.className ?? ""}`}
          onClick={() => onSelect(t.key)}
          onDoubleClick={t.onDoubleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(t.key);
            }
          }}
        >
          {t.content}
        </div>
      ))}

      {trailing}
    </div>
  );
}