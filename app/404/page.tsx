import Link from "next/link"

/**
 * Rota /404 no App Router. Evita que o build use o Pages Router para este path
 * (que quebra com "Html should not be imported outside of pages/_document").
 */
export default function Page404() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-center text-muted-foreground">
        A página que você procura não existe ou foi movida.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
