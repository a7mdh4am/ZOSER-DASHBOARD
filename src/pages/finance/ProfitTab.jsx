// Finance > Profit, and the per-product unit costs it's based on.

import { useState } from "react";
import { GroupedBars, StatCard } from "../../components/charts.jsx";
import { Can, Modal } from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { financeApi } from "../../lib/api.js";
import { money } from "../../lib/format.js";
import { FormulaBox, SectionShell } from "./parts.jsx";
import { shortMoney, pct, sectionCache, useSection } from "./shared.js";

export function ProfitTab({ filters }) {
  const hook = useSection("profit", filters);
  const toast = useToast();
  const [editing, setEditing] = useState(null); // {id, name, unit_cost}
  const [costVal, setCostVal] = useState("");

  const [saveCost, savingCost] = useAction(async () => {
    try {
      await financeApi.setCost(editing.id, Number(costVal));
      toast(`Cost saved for ${editing.name}`);
      setEditing(null);
      sectionCache.clear();
      hook.reload();
    } catch (e) {
      toast(e.message, "err");
    }
  });

  return (
    <SectionShell hook={hook}>
      {(d) => {
        const configured = d.cost_configured;
        const grossMargin =
          configured && Number(d.net_revenue) > 0
            ? d.gross_profit / Number(d.net_revenue)
            : null;
        const netMargin =
          Number(d.net_revenue) > 0
            ? d.net_profit / Number(d.net_revenue)
            : null;

        return (
          <div className="stack">
            {!configured && (
              <div className="alert-card warn">
                <span aria-hidden>⚠️</span>
                <div>
                  <div className="a-title">
                    Gross profit needs product costs
                  </div>
                  <div className="a-detail">
                    The schema has no product cost data, so COGS and gross
                    margin can't be computed yet. Set a unit cost per card below
                    — profit lights up immediately (net profit from recorded
                    expenses is already shown).
                  </div>
                </div>
              </div>
            )}

            <div className="stat-grid">
              <StatCard label="Net revenue" value={money(d.net_revenue)} />
              <StatCard
                label="COGS"
                value={configured ? money(d.cogs) : "—"}
                deltaLabel={
                  configured
                    ? `${d.units_missing_cost} cards missing a cost`
                    : "set costs below"
                }
              />
              <StatCard
                label="Gross profit"
                value={configured ? money(d.gross_profit) : "—"}
                deltaLabel={
                  grossMargin != null ? `margin ${pct(grossMargin)}` : undefined
                }
              />
              <StatCard
                label="Expenses"
                value={money(d.expenses)}
                deltaLabel="expense ledger entries"
              />
              <StatCard label="Refunds" value={money(d.refunds)} />
              <StatCard
                label="Net profit"
                value={money(d.net_profit)}
                deltaLabel={
                  netMargin != null ? `margin ${pct(netMargin)}` : undefined
                }
              />
            </div>
            <FormulaBox
              items={[
                [
                  "COGS",
                  "unit cost × cards in the order, summed over non-cancelled orders (only for products with a cost set)",
                ],
                ["Gross profit", "net revenue − COGS"],
                ["Net profit", "net revenue − refunds − expenses − COGS"],
                ["Margins", "profit ÷ net revenue"],
              ]}
            />

            {d.trend.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h3>Monthly: revenue vs costs</h3>
                </div>
                <div className="card-body">
                  <GroupedBars
                    data={d.trend.map((t) => ({
                      label: t.period,
                      net: Number(t.net),
                      out:
                        Number(t.cogs) + Number(t.expenses) + Number(t.refunds),
                    }))}
                    series={[
                      {
                        key: "net",
                        label: "Net revenue",
                        color: "var(--accent)",
                      },
                      {
                        key: "out",
                        label: "COGS + expenses + refunds",
                        color: "var(--st-cancelled)",
                      },
                    ]}
                    formatV={shortMoney}
                  />
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-head">
                <h3>Unit costs (per card)</h3>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Unit cost</th>
                      <th className="no-print" />
                    </tr>
                  </thead>
                  <tbody>
                    {d.costs.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td className="num">
                          {p.unit_cost != null ? (
                            money(p.unit_cost)
                          ) : (
                            <span className="muted">not set</span>
                          )}
                        </td>
                        <td className="no-print" style={{ textAlign: "right" }}>
                          <Can perm="finance.costs.manage">
                            <button
                              className="btn sm ghost"
                              onClick={() => {
                                setEditing(p);
                                setCostVal(p.unit_cost ?? "");
                              }}
                            >
                              {p.unit_cost != null ? "Update" : "Set cost"}
                            </button>
                          </Can>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {editing && (
              <Modal
                title={`Unit cost — ${editing.name}`}
                onClose={() => setEditing(null)}
                footer={
                  <>
                    <button className="btn" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                    <button
                      className="btn primary"
                      onClick={saveCost}
                      disabled={savingCost || !costVal || Number(costVal) < 0}
                    >
                      {savingCost ? "Saving…" : "Save"}
                    </button>
                  </>
                }
              >
                <label className="field">
                  <span>
                    Cost per card (EGP) — effective from today; history stays
                    intact
                  </span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={costVal}
                    onChange={(e) => setCostVal(e.target.value)}
                    autoFocus
                  />
                </label>
              </Modal>
            )}
          </div>
        );
      }}
    </SectionShell>
  );
}
