import { useState } from "react";
import { CustomizationFields } from "../../components/order.jsx";
import { Can } from "../../components/ui.jsx";
import { EditDesignModal } from "./EditDesignModal.jsx";

export function CustomizationCard({
  order,
  items,
  products,
  cardCount,
  onChanged,
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="card">
      <div className="card-head">
        <h3>Customization</h3>
        <div className="grow" />
        <Can perm="orders.details.update">
          <button className="btn sm ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        </Can>
      </div>
      {editing && (
        <EditDesignModal
          order={order}
          items={items || []}
          products={products || []}
          cardCount={cardCount}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
      <div className="card-body stack">
        <CustomizationFields order={order} showDesign />
      </div>
    </div>
  );
}
