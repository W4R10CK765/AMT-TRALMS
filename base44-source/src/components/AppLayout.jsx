import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Boxes, ArrowLeftRight, ListChecks, Wrench, FileText, Users, Menu, X, ScanLine } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/counter", label: "Tool Release & Return Counter", icon: ArrowLeftRight },
  { to: "/transactions", label: "Transactions", icon: ListChecks },
  { to: "/maintenance", label: "Maintenance & Calibration", icon: Wrench },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/borrowers", label: "Borrowers", icon: Users },
  { to: "/student", label: "Student Kiosk", icon: ScanLine },
];

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-[#14306b] px-4 py-3 text-white">
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="h-8 w-1 rounded bg-red-600" />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">AMT-TRALMS</div>
          <div className="text-[11px] text-blue-100">WCC ATC North Manila · Dept. of Aircraft Maintenance Technology</div>
        </div>
      </header>
      <div className="flex">
        <nav className={`${open ? "block" : "hidden"} fixed inset-x-0 top-[57px] z-20 border-b bg-white p-3 lg:static lg:block lg:min-h-[calc(100vh-57px)] lg:w-64 lg:border-b-0 lg:border-r`}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}
              className={({ isActive }) => `mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-[#14306b] font-medium text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
