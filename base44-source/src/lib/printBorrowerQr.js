import { qrImageUrl } from "@/lib/qrCode";
import { buildBorrowerQr } from "@/lib/borrowerQr";

const esc = (v) =>
  String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const courseLine = (b) =>
  [b.course, b.section].filter(Boolean).join(" — ") || b.course_section || "—";

export function printBorrowerQr(borrower) {
  const win = window.open("", "_blank", "width=520,height=700");
  if (!win) return;
  const qr = qrImageUrl(buildBorrowerQr(borrower), 300);
  win.document.write(`<!doctype html><html><head><title>Borrower QR — ${esc(borrower.full_name)}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:24px;font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a}
    .card{width:360px;margin:0 auto;border:2px solid #14306b;border-radius:10px;padding:18px;text-align:center}
    .org{font-weight:700;color:#14306b;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
    .sub{font-size:10px;color:#475569;margin-top:2px}
    .title{margin-top:10px;font-size:14px;font-weight:600;color:#14306b}
    img{width:220px;height:220px;margin:10px auto;display:block}
    .name{font-size:15px;font-weight:700}
    .row{font-size:11px;color:#334155;margin-top:3px}
    .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    @media print{body{padding:0}.card{border-color:#000}}
  </style></head><body>
    <div class="card">
      <div class="org">WCC ATC — AMT Tool Room</div>
      <div class="sub">Dept. of Aircraft Maintenance Technology</div>
      <div class="title">Borrower QR Pass</div>
      <img src="${qr}" alt="QR code" />
      <div class="name">${esc(borrower.full_name)}</div>
      <div class="row">${esc(borrower.borrower_type || "Student")} · <span class="mono">${esc(borrower.id_number)}</span></div>
      <div class="row">${esc(courseLine(borrower))}</div>
    </div>
    <script>
      (function(){
        var img = document.querySelector('img');
        var go = function(){ setTimeout(function(){ window.print(); }, 150); };
        if (img && img.complete) go(); else if (img) img.onload = go; else go();
      })();
    </script>
  </body></html>`);
  win.document.close();
}
