import { OrderItemsGrid } from "../../components/order.jsx";
import { Empty } from "../../components/ui.jsx";
import { money2 } from "../../lib/format.js";

export function ItemsCard({ items, extras }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Cards & extras</h3>
      </div>
      <div className="card-body stack">
        {items.length > 0 && <OrderItemsGrid items={items} />}

        {extras.length > 0 && (
          <div>
            <div className="small strong muted" style={{ marginBottom: 6 }}>
              Add-ons
            </div>
            <div className="price-rows">
              {extras.map((x, i) => (
                <div className="pr" key={i}>
                  <span>{x.extra_name}</span>
                  <span className="mono">+{money2(x.extra_price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!items.length && !extras.length && <Empty title="No items recorded" />}
      </div>
    </div>
  );
}
