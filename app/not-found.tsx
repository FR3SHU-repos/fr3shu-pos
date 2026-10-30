import { RouteNotFound } from "@/shared/components/RouteBoundary";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <RouteNotFound homeHref="/" homeLabel="the home page" />
    </main>
  );
}
