import { RouteLoading } from "@/shared/components/RouteBoundary";

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <RouteLoading />
    </main>
  );
}
