export function ProductImg({ url, size = 64 }) {
  if (!url) {
    return (
      <div
        className="item-thumb"
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
          color: "var(--ink-3)",
          fontSize: 10,
        }}
      >
        none
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="item-thumb"
      style={{ width: size, height: size, aspectRatio: "auto" }}
    />
  );
}
