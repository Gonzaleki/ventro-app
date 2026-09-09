import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // If not signed in, redirect to login page immediately
  if (!session) {
    redirect("/login");
  }

  // If signed in, render the layout structure and the specific page
  return (
      <div className="flex-1 p-10">
        {children}
      </div>
  );
}