"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Plus, RefreshCw, UserMinus, X } from "lucide-react";
import toast from "react-hot-toast";
import { groupsApi } from "@/shared/lib/api";
import type { GroupInvitation, GroupJoinRequest, GroupMember, GroupSummary } from "@/shared/lib/api/groups";
import { cardCls, ghostBtnCls, inputCls, primaryBtnCls, StatusBadge } from "@/shared/components/ui";

type FormState = { name: string };

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [sellerCode, setSellerCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>({ name: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => groups.find((group) => group.groupId === selectedId) ?? groups[0], [groups, selectedId]);

  async function loadGroups() {
    setLoading(true);
    const result = await groupsApi.list();
    if (!result.success || !result.data) {
      toast.error(result.message || "Could not load Groups.");
      setLoading(false);
      return;
    }
    setGroups(result.data.items);
    const stored = typeof window !== "undefined" ? localStorage.getItem("komola-active-group-id") : null;
    const next = result.data.items.find((group) => group.groupId === stored)?.groupId ?? result.data.items[0]?.groupId ?? "";
    setSelectedId(next);
    if (next) localStorage.setItem("komola-active-group-id", next);
    const code = await groupsApi.sellerCode();
    if (code.success) setSellerCode(code.data?.code ?? "");
    setLoading(false);
  }

  async function loadSelected(groupId: string) {
    const [memberResult, requestResult, invitationResult] = await Promise.all([
      groupsApi.members(groupId),
      groupsApi.joinRequests(groupId),
      groupsApi.invitations(groupId),
    ]);
    if (memberResult.success) setMembers(memberResult.data?.items ?? []);
    if (requestResult.success) setRequests(requestResult.data?.items ?? []);
    if (invitationResult.success) setInvitations(invitationResult.data?.items ?? []);
  }

  useEffect(() => { void loadGroups(); }, []);
  useEffect(() => { if (selectedId) void loadSelected(selectedId); }, [selectedId]);

  function switchGroup(groupId: string) {
    setSelectedId(groupId);
    localStorage.setItem("komola-active-group-id", groupId);
    toast.success("Group selected. Refreshing Group-scoped data.");
    window.setTimeout(() => window.location.reload(), 250);
  }

  async function createGroup() {
    if (!form.name.trim()) {
      toast.error("Enter the Group name.");
      return;
    }
    setBusy(true);
    const result = await groupsApi.create({ name: form.name.trim() });
    setBusy(false);
    if (!result.success || !result.data) return toast.error(result.message || "Could not create Group.");
    toast.success("Group created.");
    setShowCreate(false);
    setForm({ name: "" });
    await loadGroups();
  }

  async function createInvite() {
    if (!selected) return;
    const result = await groupsApi.createInvitation(selected.groupId, { expiresInHours: 72 });
    if (!result.success || !result.data?.code) return toast.error(result.message || "Could not create invite.");
    setInviteCode(result.data.code);
    await navigator.clipboard?.writeText(result.data.code);
    toast.success("Invite code created and copied.");
    await loadSelected(selected.groupId);
  }

  async function decide(request: GroupJoinRequest, decision: "approve" | "reject") {
    if (!selected) return;
    const result = await groupsApi.decideJoinRequest(selected.groupId, request.id, decision, { role: "cashier" });
    if (!result.success) return toast.error(result.message || "Could not update request.");
    toast.success(decision === "approve" ? "Seller approved." : "Request rejected.");
    await loadSelected(selected.groupId);
  }

  async function remove(member: GroupMember) {
    if (!selected || !window.confirm(`Remove ${member.displayName} from ${selected.name}?`)) return;
    const result = await groupsApi.removeMember(selected.groupId, member.id);
    if (!result.success) return toast.error(result.message || "Could not remove member.");
    toast.success("Member removed.");
    await loadSelected(selected.groupId);
  }

  const activeInvitation = invitations.find((invite) => invite.status === "active");

  if (loading) return <div className="mx-auto max-w-5xl"><div className={`${cardCls} animate-pulse`}>Loading Groups…</div></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-primary">Seller Groups</p><h1 className="mt-1 text-2xl font-semibold text-foreground-heading">Groups</h1><p className="mt-2 max-w-2xl text-sm text-foreground-muted">Create Groups, invite sellers, and control access to each Group’s products, registers, and sales.</p></div>
        <button className={primaryBtnCls} onClick={() => setShowCreate((value) => !value)}><Plus className="h-4 w-4" />Create Group</button>
      </header>

      {showCreate ? <section className={`${cardCls} space-y-4`}><h2 className="text-lg font-semibold text-foreground-heading">Create a Group</h2><p className="text-sm text-foreground-muted">The location code will be generated automatically.</p><label className="block space-y-1 text-sm font-medium text-foreground-body">Group name<input className={inputCls} value={form.name} onChange={(event) => setForm({ name: event.target.value })} /></label><div className="flex flex-wrap gap-2"><button className={primaryBtnCls} disabled={busy} onClick={() => void createGroup()}>Create Group</button><button className={ghostBtnCls} onClick={() => setShowCreate(false)}>Cancel</button></div></section> : null}

      {groups.length === 0 ? <section className={cardCls}><h2 className="text-lg font-semibold text-foreground-heading">No Groups yet</h2><p className="mt-2 text-sm text-foreground-muted">Create your first Group to manage its products, register, sellers, and sales.</p></section> : <>
        <section className={`${cardCls} space-y-3`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-foreground-muted">Active Group</p><h2 className="text-lg font-semibold text-foreground-heading">{selected?.name}</h2></div><button className={ghostBtnCls} onClick={() => void loadGroups()}><RefreshCw className="h-4 w-4" />Refresh</button></div><select className={inputCls} value={selected?.groupId ?? ""} onChange={(event) => switchGroup(event.target.value)}>{groups.map((group) => <option key={group.groupId} value={group.groupId}>{group.name} · {group.roles.join(", ")}</option>)}</select><p className="text-sm text-foreground-muted">Selling for: <span className="font-semibold text-foreground-body">{selected?.name}</span>. Products and sales stay inside the selected Group.</p></section>

        {selected ? <div className="grid gap-5 lg:grid-cols-2">
          <section className={`${cardCls} space-y-4`}><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-foreground-heading">Invite sellers</h2><p className="mt-1 text-sm text-foreground-muted">Invite codes create a pending request. They never grant access automatically.</p></div><button className={primaryBtnCls} onClick={() => void createInvite()}><Plus className="h-4 w-4" />New code</button></div>{activeInvitation ? <div className="rounded-2xl bg-surface-muted p-4"><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wide text-foreground-muted">Active invite</span><StatusBadge status={activeInvitation.status} /></div><p className="mt-2 text-2xl font-semibold tracking-[0.18em] text-foreground-heading">{inviteCode || `••••${activeInvitation.codeHint}`}</p><p className="mt-1 text-xs text-foreground-muted">Expires {new Date(activeInvitation.expiresAt).toLocaleString()}</p></div> : <p className="rounded-2xl bg-surface-muted p-4 text-sm text-foreground-muted">No active invite code.</p>}{inviteCode ? <div className="flex items-center gap-3"><QRCodeSVG value={inviteCode} size={92} /><p className="text-sm text-foreground-muted">Share the invite code or QR. The seller must still be approved by the Group owner.</p></div> : <p className="rounded-2xl bg-surface-muted p-4 text-sm text-foreground-muted">Create a new code to display its QR. For security, previously created codes are not returned in full.</p>}</section>

          <section className={`${cardCls} space-y-4`}><div><h2 className="text-lg font-semibold text-foreground-heading">Your seller QR</h2><p className="mt-1 text-sm text-foreground-muted">Other Group owners can scan this to identify you and receive a join request.</p></div>{sellerCode ? <><div className="flex justify-center rounded-2xl bg-white p-4"><QRCodeSVG value={sellerCode} size={160} /></div><div className="flex items-center justify-between gap-3"><code className="rounded-xl bg-surface-muted px-3 py-2 text-sm">{sellerCode}</code><button className={ghostBtnCls} onClick={() => void navigator.clipboard?.writeText(sellerCode)}><Copy className="h-4 w-4" />Copy</button></div></> : null}<button className={ghostBtnCls} onClick={async () => { const result = await groupsApi.rotateSellerCode(); if (result.success) setSellerCode(result.data?.code ?? ""); }}><RefreshCw className="h-4 w-4" />Rotate seller QR</button></section>

          <section className={`${cardCls} space-y-4 lg:col-span-2`}><div><h2 className="text-lg font-semibold text-foreground-heading">Pending requests</h2><p className="mt-1 text-sm text-foreground-muted">Approve sellers before they can use this Group’s products, location, register, or sales.</p></div>{requests.filter((request) => request.status === "pending").length === 0 ? <p className="rounded-2xl bg-surface-muted p-4 text-sm text-foreground-muted">No pending requests.</p> : <div className="space-y-3">{requests.filter((request) => request.status === "pending").map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle p-4"><div><p className="font-semibold text-foreground-heading">{request.requesterName}</p><p className="text-sm text-foreground-muted">Requested {request.requestedRole} · {new Date(request.createdAt).toLocaleDateString()}</p></div><div className="flex gap-2"><button className={primaryBtnCls} onClick={() => void decide(request, "approve")}><Check className="h-4 w-4" />Approve</button><button className={ghostBtnCls} onClick={() => void decide(request, "reject")}><X className="h-4 w-4" />Reject</button></div></div>)}</div>}</section>

          <section className={`${cardCls} space-y-4 lg:col-span-2`}><div><h2 className="text-lg font-semibold text-foreground-heading">Members</h2><p className="mt-1 text-sm text-foreground-muted">Removed members keep historical sale records but lose new access immediately.</p></div><div className="space-y-2">{members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-muted p-4"><div><p className="font-semibold text-foreground-heading">{member.displayName}</p><p className="text-sm text-foreground-muted">{member.roles.join(", ")} · {member.status}</p></div>{!member.roles.includes("owner") && member.status === "active" ? <button className={ghostBtnCls} onClick={() => void remove(member)}><UserMinus className="h-4 w-4" />Remove</button> : null}</div>)}</div></section>
        </div> : null}
      </>}
    </div>
  );
}
