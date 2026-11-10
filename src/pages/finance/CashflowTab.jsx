// Finance > Cash flow, and the form for recording income and expenses.

import { useState } from "react";
import { GroupedBars, StatCard } from "../../components/charts.jsx";
import { IconDownload, IconPlus } from "../../components/Icons.jsx";
import { Badge, Can, Modal, Segmented } from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { financeApi } from "../../lib/api.js";
import { downloadCsv } from "../../lib/csv.js";
import { fmtDate, money } from "../../lib/format.js";
import { SectionShell } from "./parts.jsx";
import { shortMoney, sectionCache, useSection } from "./shared.js";

const EMPTY_ENTRY = {
  type: "expense",
  category: "",
  value: "",
  description: "",
  orderId: "",
};

export function CashflowTab({ filters }) {
  const hook = useSection("cashflow", filters);
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_ENTRY);

  const [submit, recording] = useAction(async () => {
    try {
      await financeApi.addEntry({
        type: form.type,
        category: form.category,
        value: Number(form.value),
        description: form.description,
        orderId: form.orderId ? Number(form.orderId) : undefined,
      });
      toast("Entry recorded");
      setAdding(false);
      setForm(EMPTY_ENTRY);
      sectionCache.clear();
      hook.reload();
    } catch (e) {
      toast(e.message, "err");
    }
  });

  return (
    <SectionShell hook={hook}>
      {(d) => {
        const inSum = d.months.reduce((s, m) => s + Number(m.money_in), 0);
        const outSum = d.months.reduce((s, m) => s + Number(m.money_out), 0);
        return (
          <div className="stack">
            <div className="row no-print">
              <div className="grow" />
              <button
                className="btn sm"
                onClick={() => downloadCsv("cashflow", d.months)}
              >
                <IconDownload /> CSV
              </button>
              <Can perm="finance.entry.add">
                <button
                  className="btn sm primary"
                  onClick={() => setAdding(true)}
                >
                  <IconPlus size={14} /> Add entry
                </button>
              </Can>
            </div>
            <div className="stat-grid">
              <StatCard
                label="Money in"
                value={money(inSum)}
                deltaLabel="deposits + other income"
              />
              <StatCard
                label="Money out"
                value={money(outSum)}
                deltaLabel="expenses"
              />
              <StatCard label="Net cash flow" value={money(inSum - outSum)} />
              <StatCard
                label="Running balance"
                value={money(
                  d.months.at(-1)?.running_balance ?? d.opening_balance,
                )}
                deltaLabel={
                  filters.from
                    ? `opening ${money(d.opening_balance)}`
                    : "entire ledger history"
                }
              />
            </div>

            {d.months.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h3>Monthly cash flow</h3>
                </div>
                <div className="card-body">
                  <GroupedBars
                    data={d.months.map((m) => ({
                      label: m.period,
                      money_in: Number(m.money_in),
                      money_out: Number(m.money_out),
                    }))}
                    series={[
                      {
                        key: "money_in",
                        label: "In",
                        color: "var(--st-shipped)",
                      },
                      {
                        key: "money_out",
                        label: "Out",
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
                <h3>Latest ledger entries</h3>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Order</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="small muted">{fmtDate(e.created_at)}</td>
                        <td>{e.description}</td>
                        <td>{e.category}</td>
                        <td>
                          <Badge
                            color={
                              e.type === "expense"
                                ? "var(--st-pending)"
                                : "var(--st-paid)"
                            }
                          >
                            {e.type}
                          </Badge>
                        </td>
                        <td>{e.order_id ? `#${e.order_id}` : "—"}</td>
                        <td
                          className="num strong"
                          style={{
                            color:
                              e.type === "expense"
                                ? "var(--danger)"
                                : "var(--good)",
                          }}
                        >
                          {e.type === "expense" ? "−" : "+"}
                          {money(e.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {adding && (
              <Modal
                title="Add ledger entry"
                onClose={() => setAdding(false)}
                footer={
                  <>
                    <button className="btn" onClick={() => setAdding(false)}>
                      Cancel
                    </button>
                    <button
                      className="btn primary"
                      onClick={submit}
                      disabled={
                        recording ||
                        !form.category ||
                        !form.value ||
                        Number(form.value) <= 0 ||
                        !form.description.trim()
                      }
                    >
                      {recording ? "Saving…" : "Record"}
                    </button>
                  </>
                }
              >
                <div className="stack gap-14">
                  <label className="field">
                    <span>Type</span>
                    <Segmented
                      fill
                      value={form.type}
                      onChange={(type) =>
                        setForm({ ...form, type, category: "" })
                      }
                      options={[
                        ["expense", "Expense"],
                        ["income", "Income"],
                      ]}
                    />
                    <span className="small muted">
                      Deposits are recorded from the order page; refunds are set
                      via an order's payment status.
                    </span>
                  </label>
                  <label className="field">
                    <span>Category</span>
                    <select
                      className="input"
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        Choose a category
                      </option>
                      {d.categories[form.type].map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Amount (EGP)</span>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.value}
                      onChange={(e) =>
                        setForm({ ...form, value: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <input
                      className="input"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="e.g. October salaries, J&T collection"
                    />
                  </label>
                  <label className="field">
                    <span>Linked order id (optional)</span>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={form.orderId}
                      onChange={(e) =>
                        setForm({ ...form, orderId: e.target.value })
                      }
                    />
                  </label>
                </div>
              </Modal>
            )}
          </div>
        );
      }}
    </SectionShell>
  );
}
