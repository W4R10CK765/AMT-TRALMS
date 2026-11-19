import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import ScannerBar from "@/components/counter/ScannerBar";
import ReleaseQueue from "@/components/counter/ReleaseQueue";
import ReleaseWorkspace from "@/components/counter/ReleaseWorkspace";
import ReturnsPanel from "@/components/counter/ReturnsPanel";
import StudentPicker from "@/components/counter/StudentPicker";
import BorrowSlipDialog from "@/components/counter/BorrowSlipDialog";
import useNow from "@/hooks/useNow";
import { audit } from "@/lib/audit";
import { groupRequests, OPEN_STATUSES, defaultDueInput } from "@/lib/requests";
import { findAsset, assessAsset, commitRelease } from "@/lib/releaseTools";
import { commitReturn } from "@/lib/returnTools";
import { findBorrowerByCode, parseBorrowerQr } from "@/lib/borrowerQr";

export default function ToolCounter() {
  const qc = useQueryClient();
  const now = useNow(1000);

  const [mode, setMode] = useState("release");
  const [me, setMe] = useState(null);
  const [lastError, setLastError] = useState("");

  const [student, setStudent] = useState(null);
  const [activeRef, setActiveRef] = useState("");
  const [staged, setStaged] = useState([]);
  const [due, setDue] = useState(defaultDueInput(null));
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState(false);
  const [slip, setSlip] = useState(null);

  const [retStudent, setRetStudent] = useState(null);
  const [retLoan, setRetLoan] = useState(null);
  const [retBusy, setRetBusy] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setMe).catch(() => {});
  }, []);

  const { data: queueRows = [] } = useQuery({
    queryKey: ["counter-queue"],
    queryFn: async () =>
      (await base44.entities.BorrowRequest.filter({ status: { $in: OPEN_STATUSES } }, { sort: "requested_at", limit: 100 }))
        .items,
    refetchInterval: 30000,
  });

  const { data: borrowers = [] } = useQuery({
    queryKey: ["borrowers-active"],
    queryFn: async () =>
      (await base44.entities.Borrower.filter({ status: "Active" }, { sort: "full_name", limit: 300 })).items,
  });

  const { data: openLoans = [] } = useQuery({
    queryKey: ["borrower-loans", student?.id],
    enabled: !!student,
    queryFn: async () =>
      (await base44.entities.Loan.filter(
        { borrower_id: student.id, status: { $in: ["Open", "Partial"] } },
        { sort: "expected_return_at", limit: 100 }
      )).items,
  });

  const { data: retLoans = [] } = useQuery({
    queryKey: ["borrower-loans", retStudent?.id],
    enabled: !!retStudent,
    queryFn: async () =>
      (await base44.entities.Loan.filter(
        { borrower_id: retStudent.id, status: { $in: ["Open", "Partial"] } },
        { sort: "expected_return_at", limit: 100 }
      )).items,
  });

  useEffect(() => base44.entities.BorrowRequest.subscribe(() => qc.invalidateQueries({ queryKey: ["counter-queue"] })), [qc]);

  const queue = useMemo(() => groupRequests(queueRows), [queueRows]);

  const studentRequests = useMemo(
    () => (student ? queue.filter((g) => g.borrower_id === student.id) : []),
    [queue, student]
  );
  const activeGroup = queue.find((g) => g.ref === activeRef);

  // --- expiry: pending requests die after five minutes, with no stock or loan effect ---
  const expiring = useRef(new Set());
  useEffect(() => {
    const tick = async () => {
      const stamp = Date.now();
      const stale = queue.filter(
        (g) =>
          g.status === "Pending Release" &&
          g.expires_at &&
          new Date(g.expires_at).getTime() <= stamp &&
          !expiring.current.has(g.ref)
      );
      if (!stale.length) return;
      stale.forEach((g) => expiring.current.add(g.ref));
      for (const g of stale) {
        await base44.entities.BorrowRequest.updateMany({ request_ref: g.ref }, { $set: { status: "Expired" } });
        await audit({
          action: "request_expired",
          ref: g.ref,
          entity: "BorrowRequest",
          detail: `${g.borrower_name} was not processed within the 5-minute window`,
          actor: "counter timer",
        });
      }
      toast.info(`${stale.length} request(s) expired`);
      qc.invalidateQueries({ queryKey: ["counter-queue"] });
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [queue, qc]);

  const reject = async (msg, action = "scan_rejected", detail = "") => {
    setLastError(msg);
    toast.error(msg);
    await audit({ action, ref: activeRef, detail, actor: me?.full_name, outcome: "rejected" });
  };

  const startRequest = async (group) => {
    if (!group) return;
    setActiveRef(group.ref);
    setStaged([]);
    setOverride(null);
    setDue(defaultDueInput(group));
    if (group.status === "Pending Release") {
      await base44.entities.BorrowRequest.updateMany(
        { request_ref: group.ref },
        { $set: { status: "In Progress", started_at: new Date().toISOString() } }
      );
      await audit({
        action: "processing_started",
        ref: group.ref,
        entity: "BorrowRequest",
        detail: `${group.borrower_name} — countdown stopped`,
        actor: me?.full_name,
      });
      qc.invalidateQueries({ queryKey: ["counter-queue"] });
    }
  };

  const identifyStudent = async (borrower, ref) => {
    setStudent(borrower);
    setOverride(null);
    setLastError("");
    await audit({
      action: "student_identified",
      ref: ref || "",
      entity: "Borrower",
      entity_id: borrower.id,
      detail: `${borrower.full_name} (${borrower.id_number})`,
      actor: me?.full_name,
    });
    const own = queue.filter((g) => g.borrower_id === borrower.id);
    const target = ref ? own.find((g) => g.ref === ref) : own[0];
    if (target) await startRequest(target);
    else {
      setActiveRef("");
      setStaged([]);
      setDue(defaultDueInput(null));
    }
    if (borrower.status !== "Active") toast.warning("Inactive borrower — releases are blocked");
  };

  const processFromQueue = async (group) => {
    try {
      const borrower = await base44.entities.Borrower.get(group.borrower_id);
      await identifyStudent(borrower, group.ref);
    } catch {
      toast.error("Could not load that student");
    }
  };

  const scanAssetForRelease = async (code) => {
    if (!student || !activeGroup) return;
    if (student.status !== "Active") return reject(`Borrower is ${student.status} — release blocked`, "scan_rejected", code);

    const item = await findAsset(code);
    if (!item) {
      const other = await findBorrowerByCode(code);
      if (other) return identifyStudent(other, "");
      return reject(`Unknown asset tag "${code}"`, "scan_rejected", code);
    }

    const line = activeGroup.lines.find((l) => l.item_id === item.id);
    if (!line) {
      return reject(`${item.name} was not requested on ${activeGroup.ref}`, "scan_rejected_unrequested", item.asset_tag);
    }

    const stagedCount = staged.filter((s) => s.item.id === item.id).length;
    const verdict = assessAsset({ item, line, stagedCount });
    if (!verdict.ok) {
      if (verdict.restricted && me?.role === "admin") {
        setOverride({ item, line, reason: "" });
        setLastError(`${item.name}: ${verdict.reason} — record an override to release it.`);
        toast.warning(`${item.name}: ${verdict.reason}`);
        await audit({
          action: "scan_restricted",
          ref: activeGroup.ref,
          entity: "Item",
          entity_id: item.id,
          detail: `${item.asset_tag} — ${verdict.reason}`,
          actor: me?.full_name,
          outcome: "rejected",
        });
        return;
      }
      return reject(`${item.name}: ${verdict.reason}`, "scan_rejected", item.asset_tag);
    }

    setStaged((s) => [...s, { item, line, at: new Date().toISOString(), override: null }]);
    setLastError("");
    const remaining = line.qty - (line.released_qty || 0);
    toast.success(`${item.name} scanned (${stagedCount + 1}/${remaining})`);
    await audit({
      action: "tool_scanned",
      ref: activeGroup.ref,
      entity: "Item",
      entity_id: item.id,
      detail: `${item.asset_tag} ${item.name}`,
      actor: me?.full_name,
    });
  };

  const scanRelease = async (code) => {
    if (student && activeGroup) return scanAssetForRelease(code);
    const borrower = await findBorrowerByCode(code);
    if (borrower) return identifyStudent(borrower, "");
    const payload = parseBorrowerQr(code);
    if (payload) {
      return reject(
        `Borrower QR not on file — ${payload.full_name || "no name"} (${payload.id_number || "no ID"}). Add them under Borrowers.`,
        "scan_rejected",
        payload.id_number
      );
    }
    if (student) return reject("Pick an open request first, then scan the tools", "scan_rejected", code);
    return reject("Scan the student's RFID card or QR code first", "scan_rejected", code);
  };

  const scanReturn = async (code) => {
    if (!retStudent) {
      const borrower = await findBorrowerByCode(code);
      if (borrower) {
        setRetStudent(borrower);
        setRetLoan(null);
        setLastError("");
        await audit({
          action: "student_identified",
          entity: "Borrower",
          entity_id: borrower.id,
          detail: `${borrower.full_name} (${borrower.id_number}) — returns`,
          actor: me?.full_name,
        });
        return;
      }
      const payload = parseBorrowerQr(code);
      if (payload) {
        return reject(
          `Borrower QR not on file — ${payload.full_name || "no name"} (${payload.id_number || "no ID"}). Add them under Borrowers.`,
          "return_scan_rejected",
          payload.id_number
        );
      }
      return reject("Scan the student's RFID card or QR code first", "return_scan_rejected", code);
    }

    const tag = code.trim().toLowerCase();
    const hit = retLoans.find(
      (l) => (l.asset_tag || "").toLowerCase() === tag && (l.qty_issued || 0) - (l.qty_returned || 0) > 0
    );
    if (hit) {
      setRetLoan(hit);
      setLastError("");
      toast.success(`${hit.item_name} matched — confirm the return below`);
      await audit({
        action: "return_scan",
        entity: "Loan",
        entity_id: hit.id,
        detail: `${hit.asset_tag} ${hit.item_name}`,
        actor: me?.full_name,
      });
      return;
    }

    const item = await findAsset(code);
    if (item) {
      const elsewhere = (await base44.entities.Loan.filter(
        { asset_tag: item.asset_tag, status: { $in: ["Open", "Partial"] } },
        { limit: 3 }
      )).items[0];
      return reject(
        elsewhere
          ? `${item.name} is on loan to ${elsewhere.borrower_name}`
          : `${item.name} has no open loan to return`,
        "return_scan_rejected",
        item.asset_tag
      );
    }
    return reject(`Unknown asset tag "${code}"`, "return_scan_rejected", code);
  };

  const handleScan = async (raw) => {
    const code = (raw || "").trim();
    if (!code) return;
    if (mode === "release") return scanRelease(code);
    return scanReturn(code);
  };

  const confirmOverride = async () => {
    if (!override) return;
    const reason = (override.reason || "").trim();
    if (!reason) return toast.error("State the reason for the override");
    const note = `OVERRIDE by ${me?.full_name || "admin"}: ${reason}`;
    setStaged((s) => [...s, { item: override.item, line: override.line, at: new Date().toISOString(), override: note }]);
    await audit({
      action: "override_recorded",
      ref: activeRef,
      entity: "Item",
      entity_id: override.item.id,
      detail: `${override.item.asset_tag} — ${note}`,
      actor: me?.full_name,
    });
    setOverride(null);
    setLastError("");
    toast.success("Override recorded — asset staged for release");
  };

  const commitScanned = async () => {
    if (!student || !activeGroup || !staged.length) return;
    if (student.status !== "Active") return toast.error("Borrower is inactive — release blocked");
    setBusy(true);
    try {
      const result = await commitRelease({
        group: activeGroup,
        borrower: student,
        staged,
        dueIso: new Date(due).toISOString(),
        toolkeeper: me?.full_name || me?.email || "toolkeeper",
      });
      await audit({
        action: result.status === "Completed" ? "release_completed" : "release_partial",
        ref: activeGroup.ref,
        entity: "Loan",
        detail: `${staged.length} unit(s) · ${result.trans_no}`,
        actor: me?.full_name,
      });
      setSlip({ ...result, overrideNotes: staged.filter((s) => s.override).map((s) => s.override) });
      setStaged([]);
      setOverride(null);
      toast.success(
        result.status === "Completed"
          ? "All requested tools released — request completed"
          : "Partial release recorded — remaining tools stay pending"
      );
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e.message || "Could not complete the release");
    }
    setBusy(false);
  };

  const confirmReturn = async (payload) => {
    if (!retLoan || !retStudent) return;
    setRetBusy(true);
    try {
      await commitReturn({ loan: retLoan, ...payload, toolkeeper: me?.full_name || me?.email });
      await audit({
        action:
          payload.condition === "Damaged"
            ? "damage_reported"
            : payload.condition === "Lost"
            ? "loss_reported"
            : "return_confirmed",
        entity: "Loan",
        entity_id: retLoan.id,
        detail: `${retLoan.asset_tag} ${retLoan.item_name} × ${payload.qty} · ${payload.condition}${
          payload.notes ? ` — ${payload.notes}` : ""
        }`,
        actor: me?.full_name,
      });
      toast.success(payload.condition === "Lost" ? "Loss recorded" : "Return confirmed");
      setRetLoan(null);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e.message || "Could not record the return");
    }
    setRetBusy(false);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tool Release &amp; Return Counter</h1>
          <p className="text-sm text-slate-600">
            One counter for student requests, physical tool release, and returns.
          </p>
        </div>
        <div className="rounded-lg border bg-white px-3 py-2 text-xs text-slate-600">
          Toolkeeper: <span className="font-medium text-slate-900">{me?.full_name || me?.email || "—"}</span>
          <span className="ml-2 text-slate-400">{format(new Date(now), "MMM d, h:mm a")}</span>
        </div>
      </div>

      <ScannerBar onScan={handleScan} lastError={lastError} />

      <div className="inline-flex rounded-lg border bg-white p-1">
        {[
          ["release", "Release"],
          ["return", "Returns"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setMode(key);
              setLastError("");
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === key ? "bg-[#14306b] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "release" ? (
        <div className="grid gap-4 xl:grid-cols-[22rem_1fr] xl:items-start">
          <ReleaseQueue groups={queue} activeRef={activeRef} now={now} onProcess={processFromQueue} />
          {!student ? (
            <StudentPicker
              borrowers={borrowers}
              onPick={(b) => identifyStudent(b, "")}
              title="Waiting for a student"
              hint="Scan the student's RFID card or QR code above, or pick them from the list."
            />
          ) : (
            <ReleaseWorkspace
              student={student}
              openLoans={openLoans}
              requests={studentRequests}
              activeGroup={activeGroup}
              staged={staged}
              due={due}
              setDue={setDue}
              now={now}
              onSelect={(ref) => startRequest(queue.find((g) => g.ref === ref))}
              onRemoveStaged={(i) => setStaged((s) => s.filter((_, j) => j !== i))}
              onCommit={commitScanned}
              busy={busy}
              override={override}
              onOverrideReason={(reason) => setOverride((o) => ({ ...o, reason }))}
              onOverrideConfirm={confirmOverride}
              onOverrideCancel={() => setOverride(null)}
              onClear={() => {
                setStudent(null);
                setActiveRef("");
                setStaged([]);
                setOverride(null);
                setLastError("");
              }}
            />
          )}
        </div>
      ) : !retStudent ? (
        <StudentPicker
          borrowers={borrowers}
          onPick={(b) => {
            setRetStudent(b);
            setRetLoan(null);
          }}
          title="Identify the returning student"
          hint="Scan the student's card to see every tool they still have on loan."
        />
      ) : (
        <ReturnsPanel
          student={retStudent}
          loans={retLoans}
          selected={retLoan}
          onSelect={setRetLoan}
          onConfirm={confirmReturn}
          busy={retBusy}
          onClear={() => {
            setRetStudent(null);
            setRetLoan(null);
            setLastError("");
          }}
        />
      )}

      <BorrowSlipDialog slip={slip} onClose={() => setSlip(null)} />
    </div>
  );
}
