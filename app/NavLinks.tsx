'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/alerts", label: "Alert" },
  { href: "/perangkat", label: "Perangkat" },
  { href: "/pengaturan", label: "Pengaturan" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {navItems.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-primary/15 text-primary"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
