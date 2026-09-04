import { redirect } from "next/navigation";
import { getSession } from "@/shared/lib/auth";

export default async function Home() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
