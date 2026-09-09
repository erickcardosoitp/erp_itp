export const metadata = {
  title: "Catálogo de Erros — ITP",
  description: "Histórico e tendências dos erros catalogados na VM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8f9fb" }}>
        {children}
      </body>
    </html>
  );
}
