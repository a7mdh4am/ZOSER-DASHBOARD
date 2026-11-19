import { useSearchParams } from "react-router-dom";
import { ReturnsTable } from "../components/returns.jsx";
import { Empty, PageLoader, Pager, SearchInput } from "../components/ui.jsx";
import { useApiData } from "../hooks/useApiData.js";
import { returnsApi } from "../lib/api.js";

// Every parcel staff marked returned, newest first, so the whole team sees them in one
// place: open an order to call the customer or send it again
export default function Returns() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const setParam = (patch) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(patch).forEach(([k, v]) =>
          v ? next.set(k, v) : next.delete(k),
        );
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: true },
    );

  const { data, error, loading } = useApiData(
    () => returnsApi.list({ search, page: String(page), per_page: "25" }),
    [search, page],
  );

  return (
    <div className="stack">
      <div className="row wrap">
        <div className="grow" style={{ minWidth: 220, maxWidth: 420 }}>
          <SearchInput
            value={search}
            onChange={(v) => setParam({ q: v })}
            placeholder="Search id, name or phone…"
          />
        </div>
      </div>

      <div className="card">
        {loading && !data ? (
          <PageLoader />
        ) : error ? (
          <Empty title="Couldn't load returns" hint={error} />
        ) : !data.returns.length ? (
          <Empty
            title="No returned orders"
            hint={
              search
                ? "Try a different search."
                : "When someone marks a shipment Returned, it shows here."
            }
          />
        ) : (
          <>
            <div style={{ opacity: loading ? 0.6 : 1 }}>
              <ReturnsTable rows={data.returns} />
            </div>
            <Pager
              page={page}
              perPage={data.per_page}
              total={data.total}
              onPage={(p) => setParam({ page: String(p) })}
            />
          </>
        )}
      </div>
    </div>
  );
}
