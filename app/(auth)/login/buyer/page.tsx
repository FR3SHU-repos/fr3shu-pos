import { Suspense } from "react";
import { LoginForm } from "@/shared/components/auth/LoginForm";

export default function BuyerLoginPage() {
  return <Suspense><LoginForm intent="buyer" /></Suspense>;
}
