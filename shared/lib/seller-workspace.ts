const key = "komola:seller-workspace";
let personalId: string | null = null;

export function setPersonalWorkspace(id: string | null) {
  personalId = id;
}

export function workspaceForRequest() {
  return selectedWorkspace() ?? personalId;
}

export function selectedWorkspace() {
  return typeof window === "undefined" ? null : sessionStorage.getItem(key);
}

export function clearWorkspace() {
  if (typeof window !== "undefined") sessionStorage.removeItem(key);
}

// Reload to dispose of the previous workspace's carts, queries and sync worker.
export function switchWorkspace(id: string | null) {
  if (id) sessionStorage.setItem(key, id);
  else clearWorkspace();
  window.location.assign(new URL("/dashboard", window.location.origin));
}
