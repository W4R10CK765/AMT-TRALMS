import React, { useMemo, useState } from "react";
import { Image } from "@/components/ui/image";
import { Plus, ArrowRight } from "lucide-react";
import { toolImage } from "./toolImages";
import "./order-menu.css";

const catOf = (item) => (item.category || "Uncategorized").trim();

export default function ToolOrderMenu({ items = [], qty = {}, total = 0, onAdd, onReview }) {
  const cats = useMemo(() => {
    const map = new Map();
    items.forEach((i) => map.set(catOf(i), (map.get(catOf(i)) || 0) + 1));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const [active, setActive] = useState("all");
  const tabs = [{ key: "all", label: "All tools", n: items.length }, ...cats.map(([label, n]) => ({ key: label, label, n }))];
  const shown = active === "all" ? items : items.filter((i) => catOf(i) === active);

  return (
    <section className="omu-section">
      <div className={`omu-screen ${total > 0 ? "has-order" : ""}`}>
        <div className="omu-stage">
          <div className="omu-scroll">
            <header className="omu-head">
              <div className="omu-brand">
                <span className="omu-brand-mark" aria-hidden="true" />
                <div>
                  <div className="omu-brand-title">Tool Room</div>
                  <div className="omu-brand-sub">AMT-TRALMS · WCC ATC North Manila</div>
                </div>
              </div>
            </header>

            <div className="omu-tabs" role="tablist" aria-label="Tool categories">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active === t.key}
                  className="omu-tab"
                  onClick={() => setActive(t.key)}
                >
                  <span className="omu-tab-en">{t.label}</span>
                  <span className="omu-tab-sub">{t.n} {t.n === 1 ? "tool" : "tools"}</span>
                </button>
              ))}
            </div>

            <ul className="omu-grid" role="tabpanel">
              {shown.map((item) => {
                const picked = qty[item.id] || 0;
                return (
                  <li key={item.id} className={`omu-card ${picked ? "is-picked" : ""}`}>
                    <div className="omu-shot">
                      <Image
                        src={toolImage(item.category)}
                        alt={`${item.name}${item.category ? ` — ${item.category}` : ""}`}
                        className="h-full w-full"
                        fittingType="fill"
                      />
                      <button
                        type="button"
                        className="omu-add"
                        onClick={() => onAdd(item)}
                        aria-label={`Add ${item.name} to your request`}
                      >
                        <Plus className="h-[62%] w-[62%]" strokeWidth={2.6} aria-hidden="true" />
                      </button>
                      <span className="omu-chip" aria-hidden={picked === 0}>{picked}</span>
                    </div>
                    <div className="omu-body">
                      <div className="omu-names">
                        <p className="omu-card-tag">{item.asset_tag}</p>
                        <h3 className="omu-name">{item.name}</h3>
                      </div>
                      <p className="omu-meta"><b>{item.qty_available}</b> available</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {shown.length === 0 && (
              <p className="omu-empty">
                No tools are available in this category right now. Please check another category or ask the tool room staff.
              </p>
            )}
          </div>
        </div>

        <span className="omu-sr" role="status" aria-live="polite">
          {total === 0 ? "No tools selected" : `${total} ${total === 1 ? "tool" : "tools"} in one request`}
        </span>

        <footer className="omu-bar">
          <div className="omu-total">
            <p className="omu-total-label">Your request</p>
            <p className="omu-total-val is-bumped" key={total}>
              <span>{total} {total === 1 ? "Tool" : "Tools"}</span>
              <span className="omu-dot" aria-hidden="true" />
              <span>1 Request</span>
            </p>
          </div>
          <button type="button" className="omu-cta" disabled={total === 0} onClick={onReview}>
            Review request
            <ArrowRight aria-hidden="true" />
          </button>
        </footer>
      </div>
    </section>
  );
}
