import Nav from "./Nav";

export const metadata = {
  title: "ITP_TEC",
  description: "Console operacional da equipe de TI do ITP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", background: "#f4f5f7", color: "#1a1d21" }}>
        <Nav />
        <div style={{ padding: "16px 20px" }}>{children}</div>
      </body>
    </html>
  );
}
