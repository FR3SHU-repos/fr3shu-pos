import { RouteNotFound } from "@/shared/components/RouteBoundary";

export default function NotFound() {
  return <RouteNotFound homeHref="/dashboard" homeLabel="Home" />;
}
