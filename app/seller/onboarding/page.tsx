"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerSeller, type SellerOrgType } from "@/shared/lib/api/sellerOrgs";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";

export default function SellerOnboarding(){
  const router=useRouter();
  const draft=typeof window!=="undefined"?JSON.parse(sessionStorage.getItem("komola:seller-draft")||"{}"):{};
  const [f,setF]=useState({displayName:"",legalName:"",sellerType:(draft.sellerType||"Farmer") as SellerOrgType,contactName:draft.fullName||"",phoneE164:"",locationName:"",line1:"",line2:"",city:"",state:"",postalCode:"",country:"India"});
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const address={line1:f.line1,line2:f.line2,city:f.city,state:f.state,postalCode:f.postalCode,country:f.country};const res=await registerSeller({organization:{legalName:f.legalName||f.displayName,displayName:f.displayName,contactName:f.contactName,type:f.sellerType,phoneE164:f.phoneE164,billingAddress:address},location:{code:"MAIN",name:f.locationName,phoneE164:f.phoneE164,address}},crypto.randomUUID());setBusy(false);if(!res.success)return setError(res.message);sessionStorage.removeItem("komola:seller-draft");router.replace("/dashboard")}
  const field=(key:keyof typeof f,label:string,type="text")=><input aria-label={label} className={inputCls} type={type} placeholder={label} value={f[key]} onChange={e=>setF({...f,[key]:e.target.value})} required={!['legalName','line2'].includes(key)} />;
  return <main className="flex min-h-screen justify-center bg-surface p-4"><form onSubmit={submit} className={`${cardCls} my-6 w-full max-w-xl space-y-3`}><h1 className="text-xl font-semibold">Seller details</h1>{field("displayName","Business display name")}{field("legalName","Legal name (optional)")}{field("contactName","Contact name")}{field("phoneE164","Phone (+919…)","tel")}{field("locationName","First location name")}{field("line1","Address line 1")}{field("line2","Address line 2 (optional)")}{field("city","City")}{field("state","State")}{field("postalCode","Postal code")}{field("country","Country")}{error&&<p className="text-sm text-red-700">{error}</p>}<button className={`${primaryBtnCls} w-full`} disabled={busy}>{busy?"Submitting…":"Submit application"}</button></form></main>
}
