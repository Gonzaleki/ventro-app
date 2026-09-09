import { auth, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold">
          Welcome to Ventro!
        </h1>
        <p className="text-slate-500 mt-2">
          You are securely logged in as {session?.user?.name}.
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({
              redirectTo: "/login",
            });
          }}
        >
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}