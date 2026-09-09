import { signIn } from "@/auth";

export default function Login() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            Ventro
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Sign in to continue
          </p>
        </div>

        <div className="space-y-4">
          <form
            action={async () => {
              "use server";
              await signIn("google", {
                redirectTo: "/",
              });
            }}
          >
            <button
              className="flex w-full items-center justify-center rounded-lg border border-zinc-700 bg-white px-4 py-3 font-medium text-black transition hover:bg-zinc-100"
            >
              Continue with Google
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("github", {
                redirectTo: "/",
              });
            }}
          >
            <button
              className="flex w-full items-center justify-center rounded-lg bg-zinc-800 px-4 py-3 font-medium text-white transition hover:bg-zinc-700"
            >
              Continue with GitHub
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}