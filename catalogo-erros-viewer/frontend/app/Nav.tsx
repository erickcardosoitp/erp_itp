"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ITENS = [
  { href: "/", label: "Visão Geral" },
  { href: "/erros", label: "Catálogo de Erros" },
  { href: "/tarefas", label: "Tarefas Agendadas" },
  { href: "/infra", label: "Infraestrutura" },
  { href: "/custos", label: "Custos IA (Claude)" },
];

const LINKS_EXTERNOS = [
  { href: "https://grafana.itp.institutotiapretinha.org", label: "Grafana ↗" },
];

export default function Nav() {
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<{ nome: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUsuario({ nome: d.nome, role: d.role }));
  }, []);

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
      <span style={{ flex: 1 }} />
      {LINKS_EXTERNOS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#d8c8f0", textDecoration: "none", fontSize: 13, fontWeight: 500,
            padding: "6px 12px", border: "1px solid #7c3aed", borderRadius: 4,
          }}
        >
          {link.label}
        </a>
      ))}
      {usuario && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12, paddingLeft: 12, borderLeft: "1px solid #7c3aed" }}>
          <span style={{ color: "#fff", fontSize: 12.5 }}>
            {usuario.nome} <span style={{ color: "#f2b705", fontSize: 10, textTransform: "uppercase" }}>({usuario.role})</span>
          </span>
          <a href="/api/auth/logout" style={{ color: "#d8c8f0", fontSize: 12, textDecoration: "underline" }}>sair</a>
        </div>
      )}
    </nav>
  );
}
