import { ComoFunciona } from "@/components/landing/como-funciona";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { ProteccionDatos } from "@/components/landing/proteccion-datos";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1">
        <Hero />
        <ComoFunciona />
        <ProteccionDatos />
      </main>
      <Footer />
    </div>
  );
}
