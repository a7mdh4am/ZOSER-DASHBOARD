import { useState } from "react";
import { IconExternal, IconPlus, IconUser } from "../../components/Icons.jsx";
import { ThemeChips } from "../../components/ThemeChips.jsx";
import { Badge, Can, CopyField, Modal } from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { useApiData } from "../../hooks/useApiData.js";
import { nfcApi, ordersApi, profilesApi } from "../../lib/api.js";
import { fmtDate } from "../../lib/format.js";

const KINDS = ["card", "keychain", "necklace", "bracelet", "link"];

/** "Laila's card", or "Unnamed card" for one with no name on it */
const itemName = (item) =>
  item.label ? `${item.label}'s ${item.kind}` : `Unnamed ${item.kind}`;

const ROLE = { person: "", recipient: "gets the gift", giver: "gives it" };

const PERSON_STATE = {
  active: ["Joined", "var(--st-shipped)"],
  pending: ["Waiting", "var(--ink-3)"],
  held: ["Signing up", "var(--st-production)"],
  left: ["Left", "var(--danger)"],
};

const PAGE_STATE = {
  draft: ["Codes not made", "var(--ink-3)"],
  waiting: ["Nobody in yet", "var(--ink-3)"],
  live: ["Live", "var(--st-shipped)"],
  closed: ["Closed", "var(--danger)"],
  merged: ["Merged", "var(--ink-3)"],
};

const ACTIONS = {
  claim: "claimed",
  attach: "tapped their own item",
  hold: "started signing up for",
  release: "said it isn't theirs:",
  leave: "left",
  swap: "swapped places on",
  merge: "merged a page into this one",
  giver: "joined as the giver",
  staff_assign: "was put in a place by staff",
  staff_unassign: "was taken out of a place by staff",
  staff_item: "item moved by staff",
  staff_merge: "pages merged by staff",
  staff_split: "page split by staff",
};

// Runs a page or item action: an optional confirmation, then a toast and a reload
function usePageAction(onChanged) {
  const toast = useToast();
  return useAction(async (action, done, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await action();
      toast(done);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });
}

/**
 * The order's memory pages: the shopper chose at checkout which items open which page,
 * and who each item is for. Each person is a place on the page that waits until they tap
 * their own item and say it's theirs; then it's theirs (and the item is too). Staff step
 * in for mistakes: a wrong claim, a lost card, a name spelt wrong, two pages to join.
 */
export function MemoryPagesCard({ order, profiles, onChanged }) {
  const toast = useToast();
  const [provision, busy] = useAction(async () => {
    try {
      const { made } = await ordersApi.provision(order.id);
      toast(
        made
          ? `${made} code${made === 1 ? "" : "s"} made`
          : "Every item already has its code",
      );
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });
  const canProvision = !order.provisioned_at && [1, 5].includes(order.status);

  return (
    <div className="card">
      <div className="card-head">
        <IconUser />
        <h3>Memory pages</h3>
      </div>
      <div className="card-body stack gap-18">
        {!order.provisioned_at && (
          <div className="stack gap-6">
            <div className="small muted">
              The chips&apos; codes are made when the order moves to Production.
              Claims open once it ships.
            </div>
            {canProvision && (
              <Can perm="nfc.provision">
                <button
                  className="btn sm"
                  onClick={provision}
                  disabled={busy}
                  style={{ alignSelf: "flex-start" }}
                >
                  {busy ? "Making…" : "Make the codes now"}
                </button>
              </Can>
            )}
          </div>
        )}
        {profiles.map((profile) => (
          <PageBlock key={profile.id} profile={profile} onChanged={onChanged} />
        ))}
        {profiles.length === 0 && (
          <div className="small muted">This order has no memory pages.</div>
        )}
      </div>
    </div>
  );
}

function PageBlock({ profile, onChanged }) {
  const [run, busy] = usePageAction(onChanged);
  const [adding, setAdding] = useState(null); // "item" or "person"
  const [showLog, setShowLog] = useState(false);
  const [giverLink, setGiverLink] = useState(null);

  // Toggling a chip updates these right away; a reload of the order replaces
  // them (adjusting state during render rather than in an effect).
  const [themes, setThemes] = useState(profile.themes);
  const [themesFrom, setThemesFrom] = useState(profile.themes);
  if (profile.themes !== themesFrom) {
    setThemesFrom(profile.themes);
    setThemes(profile.themes);
  }

  const [stateLabel, stateColor] = PAGE_STATE[profile.state] ?? [
    profile.state,
    "var(--ink-3)",
  ];
  const giver = profile.participants.find((p) => p.role === "giver");
  const recipient = profile.participants.find((p) => p.role === "recipient");
  const people = profile.participants.filter((p) => p.state !== "removed");

  const [makeGiverLink, linkBusy] = useAction(async () => {
    try {
      setGiverLink((await profilesApi.giverLink(profile.id)).url);
    } catch (err) {
      window.alert(err.message);
    }
  });

  return (
    <div className="stack gap-10">
      <div className="row wrap gap-8">
        <div>
          <div className="strong">{profile.names || "Unnamed page"}</div>
          <div className="small muted">
            {profile.type} page <span className="mono">#{profile.id}</span>
            {profile.legacy
              ? ` · from the old system (${profile.legacy_uid})`
              : ""}
            {profile.has_pin ? " · PIN for visitors" : ""}
            {profile.order_ids.length > 1
              ? ` · orders ${profile.order_ids.map((id) => `#${id}`).join(", ")}`
              : ""}
          </div>
        </div>
        <div className="grow" />
        <Badge color={stateColor}>{stateLabel}</Badge>
      </div>

      <div className="stack gap-6">
        <div className="row wrap gap-8">
          <div className="small strong muted">PEOPLE</div>
          <div className="grow" />
          <Can perm="profiles.participants.manage">
            <button
              className="btn sm ghost"
              onClick={() => setAdding("person")}
            >
              <IconPlus size={14} /> Person
            </button>
          </Can>
        </div>
        {people.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            items={profile.items}
            run={run}
            busy={busy}
          />
        ))}
      </div>

      <div className="row wrap gap-8">
        <div className="small strong muted">ITEMS</div>
        <div className="grow" />
        <Can perm="profiles.items.manage">
          <button className="btn sm ghost" onClick={() => setAdding("item")}>
            <IconPlus size={14} /> Item
          </button>
        </Can>
      </div>
      {profile.items.length === 0 && (
        <div className="small muted">No codes yet.</div>
      )}
      {profile.items
        .filter((item) => item.state !== "replaced")
        .map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            people={people}
            run={run}
            busy={busy}
          />
        ))}

      <Can perm="profiles.participants.manage">
        <div className="row wrap gap-6">
          {profile.state === "closed" && (
            <button
              className="btn sm"
              disabled={busy}
              onClick={() =>
                run(() => profilesApi.reopen(profile.id), "Page reopened")
              }
            >
              Reopen
            </button>
          )}
          {profile.has_pin && (
            <button
              className="btn sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => profilesApi.clearPin(profile.id),
                  "PIN cleared",
                  "Clear the visitors' PIN?\n\nAnyone who taps an item will see the page straight away until its people set a new one.",
                )
              }
            >
              Clear PIN
            </button>
          )}
          {giver?.state === "pending" && recipient?.state === "active" && (
            <button
              className="btn sm"
              disabled={linkBusy}
              onClick={makeGiverLink}
            >
              Giver link for {giver.display_name}
            </button>
          )}
          <button
            className="btn sm ghost"
            onClick={() => setShowLog((v) => !v)}
          >
            {showLog ? "Hide" : "Show"} claim log
          </button>
        </div>
      </Can>
      {giverLink && (
        <CopyField
          value={giverLink}
          label="giver link"
          style={{ width: "100%" }}
        />
      )}

      {showLog && (
        <div className="stack gap-4 small">
          {profile.claim_log.length === 0 && (
            <div className="muted">Nothing yet.</div>
          )}
          {profile.claim_log.map((event) => (
            <div key={event.id} className="row gap-8">
              <span className="mono muted">
                {fmtDate(event.created_at, true)}
              </span>
              <span>
                {event.username ? `@${event.username}` : event.actor}{" "}
                {ACTIONS[event.action] ?? event.action}
                {event.item_id
                  ? ` ${itemName(profile.items.find((i) => i.id === event.item_id) ?? { kind: "item", label: null })}`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {themes.length > 0 && (
        <Can perm="profiles.themes.add">
          <div>
            <div className="small strong muted" style={{ margin: "6px 0" }}>
              PAGE THEMES — click to assign / remove
            </div>
            <ThemeChips
              holder={{ profileId: profile.id }}
              themes={themes}
              onChange={setThemes}
              gap={6}
            />
          </div>
        </Can>
      )}

      {adding === "item" && (
        <AddItemModal
          profile={profile}
          people={people}
          onClose={() => setAdding(null)}
          onDone={() => {
            setAdding(null);
            onChanged();
          }}
        />
      )}
      {adding === "person" && (
        <AddPersonModal
          profile={profile}
          onClose={() => setAdding(null)}
          onDone={() => {
            setAdding(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/** One person on the page: their name here, joined or waiting, and the fixes */
function PersonRow({ person, items, run, busy }) {
  const [label, color] = PERSON_STATE[person.state] ?? [
    person.state,
    "var(--ink-3)",
  ];
  const theirs = items.filter(
    (i) => i.assigned_participant_id === person.id && i.state !== "replaced",
  );
  return (
    <div className="nfc-item stack gap-6">
      <div className="row wrap gap-6">
        <span className="strong">{person.display_name}</span>
        {ROLE[person.role] && (
          <span className="small muted">{ROLE[person.role]}</span>
        )}
        {person.display_name !== person.checkout_name && (
          <span className="small muted">
            (ordered as {person.checkout_name})
          </span>
        )}
        <div className="grow" />
        <Badge color={color}>{label}</Badge>
      </div>
      <div className="small muted">
        {person.account
          ? `@${person.account.username} · since ${fmtDate(person.claimed_at)}`
          : "No account yet"}
        {person.hold_expires_at
          ? ` · held until ${fmtDate(person.hold_expires_at, true)}`
          : ""}
        {` · ${theirs.length ? theirs.map(itemName).join(", ") : "no item"}`}
        {person.has_voice ? " · has a voice" : ""}
      </div>
      <Can perm="profiles.participants.manage">
        <div className="row wrap gap-6">
          <button
            className="btn sm"
            disabled={busy}
            onClick={() => {
              const name = window.prompt(
                `Name on this page for ${person.display_name}:`,
                person.display_name,
              );
              if (name?.trim())
                run(
                  () => profilesApi.renamePerson(person.id, name.trim()),
                  "Name changed",
                );
            }}
          >
            Rename
          </button>
          <button
            className="btn sm"
            disabled={busy}
            onClick={() => {
              const username = window.prompt(
                `Put which account in ${person.display_name}'s place? Their username:${person.account ? `\n\nIt replaces @${person.account.username}, whose place this stops being.` : ""}`,
              );
              if (username?.trim())
                run(
                  () =>
                    profilesApi.assignPerson(
                      person.id,
                      username.trim().replace(/^@/, ""),
                    ),
                  `@${username.trim()} is ${person.display_name} now`,
                );
            }}
          >
            Assign account
          </button>
          {(person.account ||
            person.state === "held" ||
            person.state === "left") && (
            <button
              className="btn sm ghost danger"
              disabled={busy}
              onClick={() =>
                run(
                  () => profilesApi.unassignPerson(person.id),
                  `${person.display_name}'s place is open again`,
                  `Take ${person.account ? `@${person.account.username}` : "whoever it is"} out of ${person.display_name}'s place?\n\nTheir items stop being theirs, their voice on this page goes, and the next person to tap ${person.display_name}'s item can claim it. What they added stays.`,
                )
              }
            >
              Unassign
            </button>
          )}
          {person.state === "pending" && theirs.length === 0 && (
            <button
              className="btn sm ghost danger"
              disabled={busy}
              onClick={() =>
                run(
                  () => profilesApi.removePerson(person.id),
                  `${person.display_name} removed`,
                  `Remove ${person.display_name} from this page?`,
                )
              }
            >
              Remove
            </button>
          )}
        </div>
      </Can>
    </div>
  );
}

/**
 * One physical item: on or off, whose it is, how often it's been opened, its link (as
 * programmed on the chip), and what staff can do.
 */
function ItemRow({ item, people, run, busy }) {
  const [showOpens, setShowOpens] = useState(false);
  const on = item.state === "active";
  const label = itemName(item);
  const opens = item.opens;

  return (
    <div className="nfc-item stack gap-6">
      <div className="row wrap gap-6">
        <span className="strong">{label}</span>
        {item.programmed_at ? (
          <span className="small muted">programmed</span>
        ) : (
          <span className="small muted">not programmed</span>
        )}
        <div className="grow" />
        {item.state === "void" ? (
          <Badge color="var(--ink-3)">Cancelled</Badge>
        ) : on ? (
          <Badge color="var(--st-shipped)">On</Badge>
        ) : (
          <Badge color="var(--danger)">Off</Badge>
        )}
      </div>
      <div className="small muted">
        For {item.assigned_to ?? "nobody"} ·{" "}
        {item.owner
          ? `${item.owner.name} (@${item.owner.username}) claimed it ${fmtDate(item.claimed_at)}`
          : "not claimed yet"}
        {!on &&
          item.turned_off_at &&
          ` · turned off ${item.turned_off_by === "staff" ? "by staff" : item.turned_off_by ? `by @${item.turned_off_by}` : ""} ${fmtDate(item.turned_off_at)}`}
      </div>
      <div className="small muted">
        Opened {opens.total} time{opens.total === 1 ? "" : "s"} ({opens.members}{" "}
        by people in the page, {opens.visitors} by visitors)
        {opens.last_at ? ` · last ${fmtDate(opens.last_at, true)}` : ""}
        {opens.total > 0 && (
          <>
            {" · "}
            <button
              className="link-btn"
              onClick={() => setShowOpens(true)}
              style={{ font: "inherit" }}
            >
              See taps
            </button>
          </>
        )}
      </div>
      <CopyField
        value={item.link}
        label={`link of ${label}`}
        style={{ width: "100%" }}
      />
      <div className="row wrap gap-6">
        <a className="btn sm" href={item.link} target="_blank" rel="noreferrer">
          <IconExternal /> Open
        </a>
        {!item.programmed_at && (
          <Can perm="nfc.provision">
            <button
              className="btn sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => nfcApi.programmed(item.id),
                  `${label} marked programmed`,
                )
              }
            >
              Mark programmed
            </button>
          </Can>
        )}
        {item.state !== "void" && (
          <Can perm="profiles.items.manage">
            <button
              className="btn sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => nfcApi.setStatus(item.id, on ? "off" : "active"),
                  on ? `${label} turned off` : `${label} turned on`,
                  on
                    ? `Turn off ${label}?\n\nIts link will say it's turned off. The page and its other items keep working.`
                    : null,
                )
              }
            >
              {on ? "Turn off" : "Turn on"}
            </button>
            <select
              className="input sm"
              aria-label={`Who ${label} is for`}
              value={item.assigned_participant_id ?? ""}
              disabled={busy}
              onChange={(e) =>
                run(
                  () => nfcApi.assign(item.id, Number(e.target.value)),
                  "Item moved",
                )
              }
            >
              {item.assigned_participant_id == null && (
                <option value="">For nobody</option>
              )}
              {people
                .filter((p) => p.role !== "giver")
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    For {person.display_name}
                  </option>
                ))}
            </select>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => nfcApi.replace(item.id),
                  "New code made",
                  `Replace ${label}?\n\nIt gets a new code (a new chip to program), for the same person and owner. The old code stops working for good.`,
                )
              }
            >
              Replace
            </button>
          </Can>
        )}
      </div>
      {showOpens && (
        <OpensModal item={item} onClose={() => setShowOpens(false)} />
      )}
    </div>
  );
}

/** An item's taps in the last 30 days, newest first. */
function OpensModal({ item, onClose }) {
  const { data, error } = useApiData(
    () => nfcApi.opens(item.id, 30),
    [item.id],
  );
  return (
    <Modal
      title={`Taps of ${itemName(item)}`}
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Close
        </button>
      }
    >
      {error && <div className="small text-danger">{error}</div>}
      {data && (
        <div className="stack gap-6">
          {data.opens.length === 0 && (
            <div className="small muted">No taps in the last 30 days.</div>
          )}
          {data.opens.map((open, i) => (
            <div key={i} className="row gap-8 small">
              <span className="mono">{fmtDate(open.at, true)}</span>
              <span>{open.member ? "Someone in the page" : "A visitor"}</span>
              <span className="muted">
                {open.source === "qr" ? "QR code" : "tap"}
              </span>
            </div>
          ))}
          <div className="small muted">
            Taps on one phone within half an hour count once. Visitors
            aren&apos;t named.
          </div>
        </div>
      )}
    </Modal>
  );
}

/** One more item on this page (a spare, or an old-system link). The price doesn't change. */
function AddItemModal({ profile, people, onClose, onDone }) {
  const toast = useToast();
  const [kind, setKind] = useState("card");
  const [participantId, setParticipantId] = useState(
    people.find((p) => p.role !== "giver")?.id ?? "",
  );

  const [submit, busy] = useAction(async () => {
    try {
      await profilesApi.addItem(profile.id, {
        kind,
        participantId: participantId ? Number(participantId) : undefined,
      });
      toast("Item added");
      onDone();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <Modal
      title="Add an item"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? "Adding…" : "Add item"}
          </button>
        </>
      }
    >
      <div className="stack gap-10">
        <label className="field">
          <span>For</span>
          <select
            className="input"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
          >
            {people
              .filter((p) => p.role !== "giver")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>Kind</span>
          <select
            className="input"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <div className="small muted">
          A new code on page #{profile.id} (a chip to program). It doesn&apos;t
          change the order&apos;s price.
        </div>
      </div>
    </Modal>
  );
}

/** A new person's place on the page (they claim it by tapping an item you give them) */
function AddPersonModal({ profile, onClose, onDone }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [submit, busy] = useAction(async () => {
    try {
      await profilesApi.addPerson(profile.id, { displayName: name.trim() });
      toast(`${name.trim()} added`);
      onDone();
    } catch (err) {
      toast(err.message, "err");
    }
  });
  return (
    <Modal
      title="Add a person"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !name.trim()}
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </>
      }
    >
      <div className="stack gap-10">
        <label className="field">
          <span>Their name on this page</span>
          <input
            className="input"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <div className="small muted">
          Then add an item for them: it&apos;s how they join.
        </div>
      </div>
    </Modal>
  );
}
