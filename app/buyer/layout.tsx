import BuyerShell from "@/shared/components/buyer/BuyerShell";

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return <BuyerShell>{children}</BuyerShell>;
}
