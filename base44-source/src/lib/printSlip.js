import { format } from "date-fns";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const dt = (v) => (v ? format(new Date(v), "MMM d, yyyy h:mm a") : "—");

export function printBorrowSlip(slip) {
  if (!slip) return;
  const rows = (slip.loans || [])
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(l.asset_tag)}</td>
        <td>${esc(l.name)}</td>
        <td class="c">${esc(l.qty)}</td>
        <td>${esc(l.condition || "Good")}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
  <title>Borrow Slip ${esc(slip.trans_no)}</title>
  <style>
    *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
    body{margin:24px;color:#0f172a}
    .brand{border-bottom:3px solid #14306b;padding-bottom:8px;margin-bottom:16px}
    .brand h1{margin:0;font-size:17px;color:#14306b;letter-spacing:.5px}
    .brand p{margin:2px 0 0;font-size:11px;color:#475569}
    h2{font-size:13px;margin:0 0 10px;letter-spacing:1px;text-transform:uppercase}
    table{width:100%;border-collapse:collapse;font-size:11.5px}
    th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:left}
    th{background:#eef2f9;color:#14306b}
    td.c,th.c{text-align:center}
    .meta{display:flex;flex-wrap:wrap;gap:6px 28px;font-size:11.5px;margin-bottom:14px}
    .meta b{display:block;font-size:9.5px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
    .sign{display:flex;gap:40px;margin-top:36px;font-size:10.5px;color:#475569}
    .sign div{flex:1;border-top:1px solid #94a3b8;padding-top:5px}
    .note{margin-top:12px;font-size:10px;color:#64748b}
  </style></head><body>
    <div class="brand">
      <h1>WCC ATC NORTH MANILA — AMT TOOL ROOM</h1>
      <p>Department of Aircraft Maintenance Technology · Tool Release &amp; Return Counter</p>
    </div>
    <h2>Borrow Slip — ${esc(slip.status === "Completed" ? "Full Release" : "Partial Release")}</h2>
    <div class="meta">
      <span><b>Borrower</b>${esc(slip.borrower?.full_name)}</span>
      <span><b>Student ID</b>${esc(slip.borrower?.id_number)}</span>
      <span><b>Course / Section</b>${esc(slip.borrower?.course_section || "—")}</span>
      <span><b>Request Ref</b>${esc(slip.group?.ref)}</span>
      <span><b>Transaction No.</b>${esc(slip.trans_no)}</span>
      <span><b>Purpose</b>${esc(slip.group?.purpose || "—")}</span>
      <span><b>Released</b>${esc(dt(slip.issuedAt))}</span>
      <span><b>Due</b>${esc(dt(slip.dueIso))}</span>
      <span><b>Toolkeeper</b>${esc(slip.toolkeeper)}</span>
    </div>
    <table>
      <thead><tr><th class="c">#</th><th>Asset Tag (scanned)</th><th>Tool</th><th class="c">Qty</th><th>Condition at Issue</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">Only the tools listed above were physically scanned and released. Any requested tool not listed remains unissued.</p>
    <div class="sign">
      <div>Released by (toolkeeper)</div>
      <div>Received by (borrower)</div>
    </div>
  </body></html>`;

  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
