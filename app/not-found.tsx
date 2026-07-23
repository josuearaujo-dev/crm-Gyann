/**
 * Página not-found. Evita Link e classes que dependem de contexto para o prerender passar.
 */
export const dynamic = "force-dynamic"

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "60vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "1rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
        Página não encontrada
      </h1>
      <p style={{ textAlign: "center", color: "#666" }}>
        A página que você procura não existe ou foi movida.
      </p>
      <a
        href="/"
        style={{
          display: "inline-block",
          padding: "0.5rem 1rem",
          backgroundColor: "#174873",
          color: "white",
          borderRadius: "0.375rem",
          textDecoration: "none",
        }}
      >
        Voltar ao início
      </a>
    </div>
  )
}
