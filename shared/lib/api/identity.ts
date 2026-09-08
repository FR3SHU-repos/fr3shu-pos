import { request, type ApiResult } from "./client";

export interface VerifiedContact {
  id: string;
  type: "email" | "phone";
  value: string;
  verified: boolean;
  verifiedAt: string | null;
  primary: boolean;
  source: string;
}

export interface PersonProfile {
  id: string;
  displayName: string;
  status: "active" | "merged" | "suspended";
  buyer: boolean;
  contacts: VerifiedContact[];
}

export interface Capabilities {
  personId: string;
  buyer: boolean;
  seller: boolean;
  availableExperiences: Array<"buyer" | "seller">;
}
export interface DiscoveryCode { code: string; url: string }

export const profile = (): Promise<ApiResult<PersonProfile>> => request("me/profile");
export const capabilities = (): Promise<ApiResult<Capabilities>> => request("me/capabilities");
export const updateProfile = (displayName: string, buyer: boolean): Promise<ApiResult<PersonProfile>> =>
  request("me/profile", { method: "PUT", body: { displayName, buyer } });
export const discoveryCode = (): Promise<ApiResult<DiscoveryCode>> => request("me/discovery-code");
export const rotateDiscoveryCode = (): Promise<ApiResult<DiscoveryCode>> => request("me/discovery-code/rotate", { method: "POST" });
