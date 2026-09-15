import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// If already logged in, go to dashboard
export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/platform/dashboard");
  }
  redirect("/login");
}
