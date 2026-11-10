import { useState } from "react";
import {
  CustomizationFields,
  OrderItemsGrid,
} from "../../components/order.jsx";
import { Can } from "../../components/ui.jsx";
import { countLabel, money2 } from "../../lib/format.js";
import { EditDesignModal } from "./EditDesignModal.jsx";
import { ExtrasSection } from "./ExtrasSection.jsx";

/** One order item: its design, price, physical items, add-ons and details. */
export function LineCard({
  orderId,
  line,
  title,
  products,
  extraOptions,
  onChanged,
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="card">
      <div className="card-head">
        <h3>{title}</h3>
        <div className="grow" />
        <span className="small muted">
          {countLabel(line.items.length, line.kind)} ·{" "}
          <span className="mono">{money2(line.price)}</span>
        </span>
        <Can perm="orders.details.update">
          <button className="btn sm ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        </Can>
      </div>
      {editing && (
        <EditDesignModal
          orderId={orderId}
          line={line}
          products={products}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
      <div className="card-body stack">
        <OrderItemsGrid items={line.items} />

        <ExtrasSection
          orderId={orderId}
          line={line}
          options={extraOptions}
          onChanged={onChanged}
        />

        <CustomizationFields order={line} />
      </div>
    </div>
  );
}
