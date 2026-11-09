import { useState } from "react";
import { IconExternal, IconPlus, IconTrash } from "../../components/Icons.jsx";
import { Can, Modal, TimelineItem } from "../../components/ui.jsx";
import { useAuth } from "../../context/auth.js";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { ordersApi } from "../../lib/api.js";
import { fmtDate } from "../../lib/format.js";

export function NotesCard({ orderId, notes, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const canDelete = can("production.notes.delete");

  // The server logs the delete, with the note's text, in the activity feed.
  const [remove, removing] = useAction(async (note) => {
    const preview =
      note.edits.length > 120 ? `${note.edits.slice(0, 120)}…` : note.edits;
    if (!window.confirm(`Delete this production note?\n\n“${preview}”`)) return;
    try {
      await ordersApi.deleteNote(orderId, note.id);
      toast("Production note deleted");
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  // Nothing to show and nothing to add → don't render an empty card.
  if (!notes.length && !can("production.notes.add")) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Production notes</h3>
        <div className="grow" />
        <Can perm="production.notes.add">
          <button className="btn sm primary" onClick={() => setAdding(true)}>
            <IconPlus size={14} /> Add note
          </button>
        </Can>
      </div>
      {adding && (
        <NoteModal
          orderId={orderId}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
      <div className="card-body">
        {notes.length === 0 ? (
          <div className="small muted">
            No production notes yet. Add one when the customer sends updates
            after ordering.
          </div>
        ) : (
          <div className="timeline">
            {notes.map((n) => (
              <TimelineItem key={n.id} color="var(--st-production)">
                <div className="note">
                  <div className="grow">
                    <div className="pre-wrap break-anywhere">{n.edits}</div>
                    {n.images?.length > 0 && (
                      <div className="row wrap" style={{ marginTop: 2 }}>
                        {n.images.map((img, imgIdx) => (
                          <a
                            key={imgIdx}
                            className="small text-accent"
                            href={img.image_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Attachment {n.images.length > 1 ? imgIdx + 1 : ""}{" "}
                            <IconExternal size={11} />
                          </a>
                        ))}
                      </div>
                    )}
                    {n.created_at && (
                      <div className="small muted">
                        {fmtDate(n.created_at, true)}
                      </div>
                    )}
                  </div>
                  {canDelete && (
                    <button
                      className="btn ghost danger icon"
                      onClick={() => remove(n)}
                      disabled={removing}
                      title="Delete note"
                      aria-label="Delete note"
                    >
                      <IconTrash size={15} />
                    </button>
                  )}
                </div>
              </TimelineItem>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Add a production note with optional image attachments (multipart). */
function NoteModal({ orderId, onClose, onDone }) {
  const toast = useToast();
  const [edits, setEdits] = useState("");
  const [files, setFiles] = useState([]);

  const [submit, busy] = useAction(async () => {
    try {
      const fd = new FormData();
      fd.append("edits", edits);
      files.forEach((f) => fd.append("photos", f));
      await ordersApi.addNote(orderId, fd);
      toast("Production note added");
      onDone();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <Modal
      title="Add production note"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !edits.trim()}
          >
            {busy ? "Saving…" : "Save note"}
          </button>
        </>
      }
    >
      <div className="stack gap-14">
        <label className="field">
          <span>Note — what the customer needs / changed</span>
          <textarea
            className="input"
            rows={4}
            value={edits}
            onChange={(e) => setEdits(e.target.value)}
            placeholder="e.g. Customer asked to change the boy's name spelling and the song link."
            autoFocus
          />
        </label>
        <label className="field">
          <span>Attachments (optional — PNG, JPG, WebP or GIF)</span>
          <input
            className="input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length > 0 && (
            <span className="small muted">
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </span>
          )}
        </label>
      </div>
    </Modal>
  );
}
