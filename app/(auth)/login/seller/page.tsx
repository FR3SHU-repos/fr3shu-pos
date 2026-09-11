import { Suspense } from "react";
import { LoginForm } from "@/shared/components/auth/LoginForm";

export default function SellerLoginPage() {
  return <Suspense><LoginForm intent="seller" /></Suspense>;
}
