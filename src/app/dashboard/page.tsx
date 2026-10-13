import Link from "next/link";
import type { RecipientStatus, BroadcastStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import Nav from "@/components/Nav";
import UploadForm from "@/components/UploadForm";
import NewListForm from "@/components/NewListForm";
import BroadcastForm from "@/components/BroadcastForm";
import { getClientIdFromCookies } from "@/lib/users";

export const dynamic = "force-dynamic";

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span data-lang="en">{en}</span>
      <span data-lang="ar">{ar}</span>
    </>
  );
}

export default async function Dashboard() {
  const clientId = await getClientIdFromCookies();

  const [contacts, optedOut, lists, templates, broadcasts, recipientGroups, statusGroups, unreadAgg] =
    await Promise.all([
      prisma.contact.count({ where: { clientId } }),
      prisma.contact.count({ where: { clientId, optedOut: true } }),
      prisma.contactList.findMany({
        where: { clientId, archived: false },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { memberships: true } } },
      }),
      prisma.template.findMany({ where: { clientId, status: "APPROVED" }, orderBy: { name: "asc" } }),
      prisma.broadcast.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { template: true, list: true },
      }),
      // Aggregate per-recipient delivery outcomes across every send for this tenant —
      // the raw material for the deliverability funnel.
      prisma.broadcastRecipient.groupBy({
        by: ["status"],
        where: { broadcast: { clientId } },
        _count: { _all: true },
      }),
      // Campaign lifecycle states → what is live right now.
      prisma.broadcast.groupBy({
        by: ["status"],
        where: { clientId },
        _count: { _all: true },
      }),
      prisma.conversation.aggregate({ where: { clientId }, _sum: { unread: true } }),
    ]);

  // ── Delivery funnel ──────────────────────────────────────────────
  const rc: Record<RecipientStatus, number> = { PENDING: 0, SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0 };
  for (const g of recipientGroups) rc[g.status] = g._count._all;
  const read = rc.READ;
  const delivered = rc.DELIVERED + rc.READ;
  const sent = rc.SENT + rc.DELIVERED + rc.READ;
  const failed = rc.FAILED;
  const pending = rc.PENDING;
  const totalRecipients = sent + failed + pending;
  const everSent = sent > 0;

  // ── Campaign lifecycle ───────────────────────────────────────────
  const bs: Record<BroadcastStatus, number> = { DRAFT: 0, SCHEDULED: 0, QUEUED: 0, SENDING: 0, COMPLETED: 0, FAILED: 0 };
  for (const g of statusGroups) bs[g.status] = g._count._all;
  const sendingNow = bs.SENDING + bs.QUEUED;
  const scheduled = bs.SCHEDULED;
  const unread = unreadAgg._sum.unread ?? 0;

  const optedIn = contacts - optedOut;
  const optInPct = pct(optedIn, contacts);

  return (
    <>
      <Nav />
      <main className="app">
        {/* ── Command-center header: title + honest live status line ── */}
        <header className="dash-head reveal">
          <div>
            <p className="eyebrow">
              <T en="Command center" ar="مركز التحكم" />
            </p>
            <h1>
              <T en="Dashboard" ar="لوحة التحكم" />
            </h1>
            <p className="dash-status" aria-live="polite">
              {sendingNow > 0 ? (
                <>
                  <span className="pulse-dot" aria-hidden />
                  <span>
                    <strong>{nf(sendingNow)}</strong>{" "}
                    <T
                      en={plural(sendingNow, "campaign")}
                      ar={plural(sendingNow, "حملة", "حملات")}
                    />{" "}
                    <T en="sending now" ar="تُرسل الآن" />
                  </span>
                </>
              ) : scheduled > 0 ? (
                <span>
                  <strong>{nf(scheduled)}</strong>{" "}
                  <T
                    en={plural(scheduled, "campaign")}
                    ar={plural(scheduled, "حملة", "حملات")}
                  />{" "}
                  <T en="scheduled to send" ar="مجدولة للإرسال" />
                </span>
              ) : (
                <span>
                  <T en="Nothing sending right now — all quiet." ar="لا شيء يُرسل الآن — كل شيء هادئ." />
                </span>
              )}
              {unread > 0 && (
                <>
                  <span className="dash-status__sep" aria-hidden>
                    ·
                  </span>
                  <Link href="/inbox" className="dash-status__link">
                    {nf(unread)}{" "}
                    <T
                      en={plural(unread, "reply", "replies")}
                      ar={plural(unread, "رد", "ردود")}
                    />
                  </Link>
                </>
              )}
            </p>
          </div>
          <p className="dash-asof">
            <T en="Snapshot" ar="لقطة" /> · {timeLabel(new Date())}
          </p>
        </header>

        {/* ── Deliverability (hero) + live pulse ─ */}
        <section className="analytics reveal d1" aria-label="Deliverability">
          <div className="card">
            <div className="dash-cardhead">
              <h3>
                <T en="Deliverability" ar="معدل التوصيل" />
              </h3>
              <span className="note">
                <T en="across all sends" ar="عبر جميع الإرسالات" />
              </span>
            </div>

            {everSent ? (
              <>
                <div className="dash-rates">
                  <Rate value={`${pct(delivered, sent)}%`} label="Reached the phone" labelAr="وصلت للهاتف" />
                  <Rate value={`${pct(read, delivered)}%`} label="Opened & read" labelAr="فُتحت وقُرئت" />
                  <Rate value={`${pct(failed, totalRecipients)}%`} label="Failed" labelAr="فشلت" muted={failed === 0} />
                </div>
                <div className="funnel">
                  <FunnelRow label="Sent" labelAr="مُرسلة" value={sent} total={totalRecipients} accent />
                  <FunnelRow label="Delivered" labelAr="مسلَّمة" value={delivered} total={totalRecipients} />
                  <FunnelRow label="Read" labelAr="مقروءة" value={read} total={totalRecipients} />
                </div>
              </>
            ) : (
              <div className="dash-empty dash-empty--inset">
                <strong>
                  <T en="No messages sent yet" ar="لم تُرسل رسائل بعد" />
                </strong>
                <T
                  en="Your delivery funnel — sent, delivered, read — appears here after your first broadcast."
                  ar="قمع التوصيل — المرسلة والمسلَّمة والمقروءة — سيظهر هنا بعد أول بث لك."
                />
              </div>
            )}
          </div>

          <div className="card">
            <div className="dash-cardhead">
              <h3>
                <T en="Live now" ar="مباشر الآن" />
              </h3>
              {sendingNow > 0 && <span className="pulse-dot" aria-hidden />}
            </div>
            <div className="dash-pulse">
              <PulseRow k="Sending" kAr="تُرسَل" v={bs.SENDING} live={bs.SENDING > 0} />
              <PulseRow k="Queued" kAr="في الانتظار" v={bs.QUEUED} />
              <PulseRow k="Scheduled" kAr="مجدولة" v={scheduled} />
              <PulseRow k="Unread replies" kAr="ردود غير مقروءة" v={unread} href="/inbox" accent={unread > 0} />
            </div>
          </div>
        </section>

        {/* ── Audience ledger — varied band, not identical stat cards ── */}
        <section className="dash-ledger reveal d2" aria-label="Audience">
          <div className="dash-ledger__item">
            <div className="dash-ledger__num">{nf(contacts)}</div>
            <div className="dash-ledger__label">
              <T en="Contacts" ar="جهات الاتصال" />
            </div>
            {contacts > 0 && (
              <>
                <div className="dash-ledger__meter" aria-hidden>
                  <i style={{ width: `${optInPct}%` }} />
                </div>
                <div className="dash-ledger__sub">
                  {optInPct}% <T en="opted in" ar="وافقوا" /> · {nf(optedOut)} <T en="opted out" ar="ألغوا الاشتراك" />
                </div>
              </>
            )}
          </div>
          <div className="dash-ledger__item">
            <div className="dash-ledger__num">{nf(lists.length)}</div>
            <div className="dash-ledger__label">
              <T en="Lists" ar="القوائم" />
            </div>
            <Link href="/lists" className="dash-ledger__sub dash-ledger__sub--link">
              <T en="Manage lists →" ar="إدارة القوائم ←" />
            </Link>
          </div>
          <div className="dash-ledger__item">
            <div className="dash-ledger__num">{nf(templates.length)}</div>
            <div className="dash-ledger__label">
              <T en="Approved templates" ar="القوالب المعتمدة" />
            </div>
            <Link href="/templates" className="dash-ledger__sub dash-ledger__sub--link">
              <T en="View templates →" ar="عرض القوالب ←" />
            </Link>
          </div>
        </section>

        {/* ─ Compose — the three core actions, kept intact ── */}
        <section className="dash-section reveal d3">
          <p className="eyebrow">
            <T en="Compose" ar="إنشاء" />
          </p>
          <h2>
            <T en="Build a list, import contacts, send" ar="أنشئ قائمة، استورد جهات اتصال، أرسِل" />
          </h2>
        </section>
        <section className="grid-forms reveal d3">
          <NewListForm lists={lists} />
          <UploadForm lists={lists} />
          <BroadcastForm lists={lists} templates={templates} />
        </section>

        {/* ── Recent broadcasts ── */}
        <section className="dash-section reveal d4">
          <h2>
            <T en="Recent broadcasts" ar="آخر البثوث" />
          </h2>
        </section>
        <div className="card reveal d4" style={{ padding: 0, overflow: "hidden" }}>
          <table data-test-id="broadcasts-table" className="table dash-table">
            <thead>
              <tr>
                <th>
                  <T en="Template" ar="القالب" />
                </th>
                <th>
                  <T en="List" ar="القائمة" />
                </th>
                <th>
                  <T en="Status" ar="الحالة" />
                </th>
                <th>
                  <T en="Delivery" ar="التوصيل" />
                </th>
                <th>
                  <T en="Failed" ar="فاشلة" />
                </th>
                <th>
                  <T en="When" ar="متى" />
                </th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => {
                const progress = pct(b.sentCount, b.totalCount);
                const when =
                  b.status === "SCHEDULED" && b.scheduledAt
                    ? `Scheduled ${dateLabel(b.scheduledAt)}`
                    : rel(b.createdAt);
                return (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/broadcasts/${b.id}`} data-test-id="broadcast-link" className="dash-table__tpl">
                        {b.template.name}
                      </Link>
                    </td>
                    <td className="muted">{b.list.name}</td>
                    <td>
                      <span className={`badge badge--${b.status}`}>{b.status}</span>
                    </td>
                    <td>
                      <div className="dash-prog">
                        <span className="dash-prog__track" aria-hidden>
                          <span className="dash-prog__bar" style={{ width: `${progress}%` }} />
                        </span>
                        <span className="dash-prog__num">
                          {nf(b.sentCount)}/{nf(b.totalCount)}
                        </span>
                      </div>
                    </td>
                    <td className={b.failedCount > 0 ? "dash-fail" : "muted"}>{nf(b.failedCount)}</td>
                    <td className="muted dash-table__when">{when}</td>
                  </tr>
                );
              })}
              {broadcasts.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="dash-empty">
                      <strong>
                        <T en="No broadcasts yet" ar="لا بثوث بعد" />
                      </strong>
                      <T
                        en="Pick a template and a list above, then send — your sends will show up here with live delivery."
                        ar="اختر قالباً وقائمة أعلاه ثم أرسِل — ستظهر إرسالاتك هنا مع التوصيل المباشر."
                      />
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

/* ─ server-rendered presentational helpers ── */

function Rate({ value, label, labelAr, muted }: { value: string; label: string; labelAr: string; muted?: boolean }) {
  return (
    <div className="dash-rate">
      <div className={`dash-rate__val${muted ? " dash-rate__val--muted" : ""}`}>{value}</div>
      <div className="dash-rate__label">
        <T en={label} ar={labelAr} />
      </div>
    </div>
  );
}

function FunnelRow({ label, labelAr, value, total, accent }: { label: string; labelAr: string; value: number; total: number; accent?: boolean }) {
  const w = pct(value, total);
  return (
    <div className="funnel__row">
      <span className="funnel__label">
        <T en={label} ar={labelAr} />
      </span>
      <span className="funnel__track">
        <span className={`funnel__bar${accent ? " funnel__bar--accent" : ""}`} style={{ width: `${w}%` }} />
      </span>
      <span className="funnel__val">
        {nf(value)} · {w}%
      </span>
    </div>
  );
}

function PulseRow({ k, kAr, v, live, accent, href }: { k: string; kAr: string; v: number; live?: boolean; accent?: boolean; href?: string }) {
  const val = (
    <span className={`dash-pulse__v${accent && v > 0 ? " dash-pulse__v--accent" : ""}`}>{nf(v)}</span>
  );
  return (
    <div className="dash-pulse__row">
      <span className="dash-pulse__k">
        {live && <span className="pulse-dot" aria-hidden />}
        <T en={k} ar={kAr} />
      </span>
      {href && v > 0 ? <Link href={href}>{val}</Link> : val}
    </div>
  );
}

/* ── pure formatters ── */

function nf(n: number): string {
  return n.toLocaleString("en-US");
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function plural(n: number, one: string, many?: string): string {
  return n === 1 ? one : many ?? `${one}s`;
}

function rel(date: Date): string {
  const m = Math.round((Date.now() - date.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return dateLabel(date);
}

function dateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
