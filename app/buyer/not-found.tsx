import { RouteNotFound } from "@/shared/components/RouteBoundary";

export default function NotFound() {
  return <RouteNotFound homeHref="/buyer" homeLabel="your rewards" />;
}
