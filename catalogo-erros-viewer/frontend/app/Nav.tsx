"use client";

import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", label: "Visão Geral" },
  { href: "/erros", label: "Catálogo de Erros" },
  { href: "/tarefas", label: "Tarefas Agendadas" },
  { href: "/custos", label: "Custos IA (Claude)" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav style={{
      background: "#4c1d95", borderBottom: "3px solid #f2b705",
      display: "flex", alignItems: "center", padding: "0 20px", height: 44,
    }}>
      <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginRight: 28, letterSpacing: 0.5 }}>
        ITP<span style={{ color: "#f2b705" }}>_TEC</span>
      </span>
      {ITENS.map((item) => {
        const ativo = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              color: ativo ? "#fff" : "#d8c8f0",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: ativo ? 700 : 500,
              padding: "12px 14px",
              borderBottom: ativo ? "3px solid #f2b705" : "3px solid transparent",
              marginBottom: -3,
              height: 44,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
