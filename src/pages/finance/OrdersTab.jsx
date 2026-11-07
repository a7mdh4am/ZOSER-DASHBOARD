// Finance > Orders: per-order money report, sortable, with CSV export.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconDownload } from "../../components/Icons.jsx";
import {
  Badge,
  Empty,
  OrderLink,
  PageLoader,
  Pager,
  SearchInput,
  StatusBadge,
} from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { useApiData } from "../../hooks/useApiData.js";
import { financeApi } from "../../lib/api.js";
import { datedFileName, saveFile } from "../../lib/csv.js";
import { fmtDate, money } from "../../lib/format.js";
import { FormulaBox } from "./parts.jsx";
import { PAYMENT_STATUS_COLOR, qs } from "./shared.js";

export function OrdersTab({ filters }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("order_time");
  const [dir, setDir] = useState("desc");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const toast = useToast();

  const query = qs(filters, { search, sort, dir, page, perPage: 25 });
  const { data, error } = useApiData(() => financeApi.orders(query), [query]);

  // Every matching order, not just this page.
  const [exportCsv] = useAction(async () => {
    try {
      saveFile(
        datedFileName("orders"),
        await financeApi.ordersCsv(qs(filters, { search, sort, dir })),
      );
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const th = (key, label, numeric = false) => (
    <th
      className={`sortable${numeric ? " num" : ""}`}
      onClick={() => {
        setDir(sort === key && dir === "desc" ? "asc" : "desc");
        setSort(key);
        setPage(1);
      }}
    >
      {label}
      {sort === key ? (dir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  if (error) return <Empty title="Couldn't load the report" hint={error} />;

  return (
    <div className="stack">
      <div className="row wrap no-print">
        <div className="grow" style={{ minWidth: 220, maxWidth: 400 }}>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Order id, name, phone…"
          />
        </div>
        <button className="btn sm" onClick={exportCsv}>
          <IconDownload /> CSV / Excel
        </button>
      </div>

      <div className="card">
        {!data ? (
          <PageLoader padding={50} />
        ) : (
          <>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {th("id", "Order")}
                    {th("order_time", "Date")}
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="num">Price</th>
                    <th className="num">Discount</th>
                    {th("net", "Total", true)}
                    {th("paid", "Paid", true)}
                    {th("balance", "Balance", true)}
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr
                      key={r.id}
                      className="row-link"
                      onClick={() => navigate(`/orders/${r.id}`)}
                    >
                      <td className="strong">
                        <OrderLink id={r.id} />
                      </td>
                      <td className="small muted">{fmtDate(r.order_time)}</td>
                      <td>
                        <div>{r.full_name}</div>
                        <div className="small muted">
                          {r.product_name} · {r.city || "—"}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="num">{money(r.price)}</td>
                      <td className="num">
                        {Number(r.discount_amount) > 0
                          ? `−${money(r.discount_amount)}`
                          : "—"}
                      </td>
                      <td className="num strong">{money(r.net)}</td>
                      <td className="num">
                        {Number(r.dep) > 0 ? money(r.dep) : "—"}
                      </td>
                      <td className="num">{money(r.balance)}</td>
                      <td>
                        <Badge color={PAYMENT_STATUS_COLOR[r.payment_status]}>
                          {r.payment_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={data.page}
              perPage={data.perPage}
              total={data.total}
              onPage={setPage}
            />
          </>
        )}
      </div>
      <FormulaBox
        items={[
          [
            "Total",
            "grand_total (subtotal + shipping − discount + adjustments)",
          ],
          ["Paid", "SUM of active deposit ledger entries linked to the order"],
          ["Balance", "total − paid"],
          [
            "Payment",
            "order's payment_status: unpaid / pending / paid / failed / refunded",
          ],
        ]}
      />
    </div>
  );
}
