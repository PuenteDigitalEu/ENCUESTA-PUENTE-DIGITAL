import { LoginForm } from "./login-form";

export const metadata = { title: "Panel · Acceso" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  return (
    <main className="flex flex-1 flex-col bg-surface">
      <LoginForm motivo={motivo} />
    </main>
  );
}
