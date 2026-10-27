import Link from 'next/link';
import { Button } from "@/components/ui/button";

export default function ComingSoonPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="text-center space-y-8 max-w-md">
        <div className="flex items-center justify-center gap-2">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Naranja Pimienta</h1>
        </div>

        <h2 className="text-3xl font-semibold tracking-tight">
          Próximamente
        </h2>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login">
            <Button className="px-6 py-3">Ir al login</Button>
          </Link>
          <a href="mailto:contacto@naranjapimienta.local">
            <Button variant="outline" className="px-6 py-3">Contacto</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
