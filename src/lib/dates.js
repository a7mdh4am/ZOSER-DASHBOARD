/**
 * YYYY-MM-DD for `date` in the browser's time zone. Use this instead of
 * toISOString().slice(0, 10), which gives the UTC day — in Cairo that's still
 * yesterday until 2–3 am, and puts the 1st of the month on the 31st.
 */
export function localISODate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
