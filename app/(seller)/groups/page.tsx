"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { groupsApi, registersApi, salesApi } from "@/shared/lib/api";
import type {
  GroupInvitation,
  GroupJoinRequest,
  GroupMember,
  GroupSummary,
} from "@/shared/lib/api/groups";
import { BuyerQrScanner } from "@/shared/components/pos/BuyerQrScanner";
import { cardCls, ghostBtnCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import { selectedWorkspace, switchWorkspace } from "@/shared/lib/seller-workspace";
import { usePosUser } from "@/shared/context/PosUserContext";
import { formatPaise } from "@/shared/lib/money";
import { copyText } from "@/shared/lib/clipboard";
import { ReceiptView } from "@/shared/components/pos/ReceiptView";
import { useApi } from "@/shared/hooks/useApi";

const roles = ["cashier", "seller", "manager"];
const sellerQr = (value: string) => value.match(/SLR-?[A-F0-9]{10}/i)?.[0].toUpperCase() ?? null;

export default function GroupsPage() {
  const { organization, loading: workspaceLoading } = usePosUser();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [history, setHistory] = useState<GroupSummary[]>([]);
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [sellerCode, setSellerCode] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState("");
  const [role, setRole] = useState("cashier");
  const [managedId, setManagedId] = useState("");
  const [archive, setArchive] = useState<GroupSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [active, previous, mine, seller] = await Promise.all([
      groupsApi.list(),
      groupsApi.history(),
      groupsApi.myRequests(),
      groupsApi.sellerCode(),
    ]);
    if (active.success && active.data) setGroups(active.data.items);
    else toast.error(active.message);
    if (previous.success && previous.data) setHistory(previous.data.items);
    if (mine.success && mine.data) setRequests(mine.data.items);
    if (seller.success) setSellerCode(seller.data?.code ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const managed = groups.find((group) => group.groupId === managedId);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const result = await groupsApi.create({ name: name.trim() });
    setBusy(false);
    if (!result.success || !result.data) return toast.error(result.message);
    setName("");
    setManagedId(result.data.groupId);
    await load();
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    if (!preview) {
      const result = await groupsApi.resolveInvitation(code.trim().toUpperCase());
      if (result.success && result.data) setPreview(result.data.groupName);
      else toast.error(result.message);
    } else {
      const result = await groupsApi.requestJoin(code.trim().toUpperCase(), role);
      if (!result.success) toast.error(result.message);
      else {
        toast.success("Join request sent.");
        setCode("");
        setPreview("");
        await load();
      }
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-3xl font-bold">Groups</h1>
      <section className={cardCls}>
        <h2 className="mb-3 text-lg font-semibold">Selling workspace</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className={selectedWorkspace() ? ghostBtnCls : primaryBtnCls}
            disabled={workspaceLoading || !selectedWorkspace()}
            onClick={() => switchWorkspace(null)}
          >
            Personal workspace
          </button>
          {groups.map((group) => (
            <button
              key={group.groupId}
              className={selectedWorkspace() === group.groupId ? primaryBtnCls : ghostBtnCls}
              disabled={selectedWorkspace() === group.groupId}
              onClick={() => switchWorkspace(group.groupId)}
            >
              {group.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-foreground-muted">
          Current workspace: {organization?.displayName ?? "Choose a workspace"}
        </p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <form className={cardCls + " space-y-3"} onSubmit={create}>
          <h2 className="text-lg font-semibold">Create a group</h2>
          <label className="block">
            Group name
            <input
              className={inputCls}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button className={primaryBtnCls} disabled={busy}>
            Create group
          </button>
        </form>
        <form className={cardCls + " space-y-3"} onSubmit={join}>
          <h2 className="text-lg font-semibold">Join a group</h2>
          <label className="block">
            Invite code
            <input
              className={inputCls}
              required
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setPreview("");
              }}
            />
          </label>
          {preview ? (
            <>
              <p>Request access to {preview}</p>
              <RoleSelect standardOnly value={role} onChange={setRole} />
            </>
          ) : null}
          <button className={primaryBtnCls} disabled={busy}>
            {preview ? "Send join request" : "Find group"}
          </button>
        </form>
        <section className={cardCls + " space-y-3"}>
          <h2 className="text-lg font-semibold">My seller QR</h2>
          {sellerCode ? (
            <>
              <QRCodeSVG value={sellerCode} size={120} />
              <button className={ghostBtnCls} onClick={() => void copyText(sellerCode)}>
                Copy {sellerCode}
              </button>
            </>
          ) : null}
          <button
            className={ghostBtnCls}
            onClick={async () => {
              const result = await groupsApi.rotateSellerCode();
              if (result.success && result.data) setSellerCode(result.data.code);
              else toast.error(result.message);
            }}
          >
            Rotate seller code
          </button>
        </section>
        <section className={cardCls}>
          <h2 className="mb-3 text-lg font-semibold">My join requests</h2>
          {requests.length ? (
            <ul className="space-y-2">
              {requests.map((request) => (
                <li key={request.id}>
                  {request.groupName ?? "Group"} · {request.status}
                  {request.rejectionReason ? " · " + request.rejectionReason : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>No join requests.</p>
          )}
        </section>
      </div>
      <section className={cardCls + " space-y-3"}>
        <h2 className="text-lg font-semibold">Manage membership</h2>
        <select
          className={inputCls}
          aria-label="Group to manage"
          value={managedId}
          onChange={(event) => setManagedId(event.target.value)}
        >
          <option value="">Select a group</option>
          {groups.map((group) => (
            <option key={group.groupId} value={group.groupId}>
              {group.name}
            </option>
          ))}
        </select>
        {managed ? <GroupManagement key={managed.groupId} group={managed} reload={load} /> : null}
      </section>
      <section className={cardCls + " space-y-3"}>
        <h2 className="text-lg font-semibold">Previous groups</h2>
        {history.length ? (
          <ul className="space-y-2">
            {history.map((group) => (
              <li key={group.groupId}>
                {group.name} · {group.status} / {group.membershipStatus}{" "}
                {group.status === "closed" &&
                (group.membershipStatus === "active" || group.roles.includes("owner")) ? (
                  <button className={ghostBtnCls} onClick={() => setArchive(group)}>
                    View history
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No previous groups.</p>
        )}
        {archive ? <ClosedHistory key={archive.groupId} group={archive} /> : null}
      </section>
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  standardOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  standardOnly?: boolean;
}) {
  const options = standardOnly ? roles.filter((role) => role !== "manager") : roles;
  return (
    <label className="block">
      Role
      <select className={inputCls} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((role) => (
          <option key={role}>{role}</option>
        ))}
      </select>
    </label>
  );
}

function GroupManagement({ group, reload }: { group: GroupSummary; reload: () => Promise<void> }) {
  const { groupId } = group;
  const owner = group.roles.includes("owner");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [newCode, setNewCode] = useState("");
  const [target, setTarget] = useState("");
  const [role, setRole] = useState("cashier");
  const [approvalRoles, setApprovalRoles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await groupsApi.members(groupId);
    if (result.success && result.data) setMembers(result.data.items);
    if (!owner) return;
    const [pending, codes] = await Promise.all([
      groupsApi.joinRequests(groupId),
      groupsApi.invitations(groupId),
    ]);
    if (pending.success && pending.data) setRequests(pending.data.items);
    if (codes.success && codes.data) setInvitations(codes.data.items);
  }, [groupId, owner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(run: () => Promise<{ success: boolean; message: string }>) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await run();
      if (!result.success) toast.error(result.message);
      else await load();
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    const message = owner
      ? "Close this group? Its register must be closed first. Sync outstanding sales before continuing."
      : "Leave this group? Sync outstanding sales before continuing.";
    if (!window.confirm(message)) return;
    const result = await (owner ? groupsApi.close(groupId) : groupsApi.leave(groupId));
    if (result.success) {
      if (selectedWorkspace() === groupId) switchWorkspace(null);
      else await reload();
    }
    return result;
  }

  return (
    <div className="space-y-4">
      {owner ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={ghostBtnCls}
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const result = await groupsApi.createInvitation(groupId, { expiresInHours: 72 });
                  if (result.success) setNewCode(result.data?.code ?? "");
                  return result;
                })
              }
            >
              Create invite code
            </button>
            {newCode ? (
              <>
                <QRCodeSVG value={newCode} size={88} />
                <button className={ghostBtnCls} onClick={() => void copyText(newCode)}>
                  Copy {newCode}
                </button>
              </>
            ) : null}
          </div>
          {invitations
            .filter((invitation) => invitation.status === "active")
            .map((invitation) => (
              <div key={invitation.id} className="flex flex-wrap items-center gap-2">
                <span>
                  Invite ending {invitation.codeHint} · expires{" "}
                  {new Date(invitation.expiresAt).toLocaleString()}
                </span>
                <button
                  className={ghostBtnCls}
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const result = await groupsApi.revokeInvitation(groupId, invitation.id);
                      if (result.success) setNewCode("");
                      return result;
                    })
                  }
                >
                  Revoke
                </button>
              </div>
            ))}
          <div className="space-y-2">
            <label className="block">
              Seller code
              <input
                className={inputCls}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            </label>
            <BuyerQrScanner label="seller" parseCode={sellerQr} onScan={setTarget} />
            <RoleSelect standardOnly value={role} onChange={setRole} />
            <button
              className={primaryBtnCls}
              disabled={busy || !target.trim()}
              onClick={() =>
                void action(() =>
                  groupsApi.requestJoinBySellerCode(
                    target
                      .trim()
                      .toUpperCase()
                      .replace(/^SLR(?!-)/, "SLR-"),
                    groupId,
                    role,
                  ),
                )
              }
            >
              Invite seller
            </button>
          </div>
          <h3 className="font-semibold">Join requests</h3>
          {requests.map((request) => (
            <div key={request.id} className="space-y-2 border-t border-border-subtle py-2">
              <p>
                {request.requesterName} · {request.requestedRole} · {request.status}
              </p>
              {request.status === "pending" ? (
                <>
                  <RoleSelect
                    value={
                      approvalRoles[request.id] ??
                      (roles.includes(request.requestedRole) ? request.requestedRole : "cashier")
                    }
                    onChange={(value) =>
                      setApprovalRoles((current) => ({ ...current, [request.id]: value }))
                    }
                  />
                  <button
                    className={primaryBtnCls}
                    disabled={busy}
                    onClick={() =>
                      void action(() =>
                        groupsApi.decideJoinRequest(groupId, request.id, "approve", {
                          role:
                            approvalRoles[request.id] ??
                            (roles.includes(request.requestedRole)
                              ? request.requestedRole
                              : "cashier"),
                        }),
                      )
                    }
                  >
                    Approve
                  </button>{" "}
                  <button
                    className={ghostBtnCls}
                    disabled={busy}
                    onClick={() =>
                      void action(() => groupsApi.decideJoinRequest(groupId, request.id, "reject"))
                    }
                  >
                    Reject
                  </button>
                </>
              ) : null}
            </div>
          ))}
        </>
      ) : null}
      <h3 className="font-semibold">Members</h3>
      {members.map((member) => (
        <div key={member.id} className="flex flex-wrap items-center gap-2">
          <span>
            {member.displayName} · {member.roles.join(", ")} · {member.status}
          </span>
          {owner && member.status === "active" && !member.roles.includes("owner") ? (
            <button
              className={ghostBtnCls}
              disabled={busy}
              onClick={() => {
                if (window.confirm("Remove this seller from the group?"))
                  void action(() => groupsApi.removeMember(groupId, member.id));
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}
      <button
        className={ghostBtnCls}
        disabled={busy}
        onClick={() => void action(async () => (await end()) ?? { success: true, message: "" })}
      >
        {owner ? "Close group" : "Leave group"}
      </button>
    </div>
  );
}

function ClosedHistory({ group }: { group: GroupSummary }) {
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sales, setSales] = useState<Awaited<ReturnType<typeof salesApi.list>> | null>(null);
  const [shifts, setShifts] = useState<Awaited<
    ReturnType<typeof registersApi.closedShifts>
  > | null>(null);
  useEffect(() => {
    let active = true;
    void salesApi.list({ page, limit: 20 }, group.groupId).then((result) => {
      if (active) setSales(result);
    });
    return () => {
      active = false;
    };
  }, [group.groupId, page]);
  useEffect(() => {
    let active = true;
    void registersApi.closedShifts(group.groupId).then((result) => {
      if (active) setShifts(result);
    });
    return () => {
      active = false;
    };
  }, [group.groupId]);

  return (
    <div className="space-y-3 border-t border-border-subtle pt-4">
      <h3 className="font-semibold">{group.name} · Read-only history</h3>
      <h4 className="font-semibold">Sales and receipts</h4>
      {!sales ? (
        <p>Loading sales…</p>
      ) : !sales.success ? (
        <p role="alert">{sales.message}</p>
      ) : !sales.data?.items.length ? (
        <p>No sales.</p>
      ) : (
        <ul className="space-y-2">
          {sales.data.items.map((sale) => (
            <li key={sale._id}>
              <button
                className={ghostBtnCls}
                aria-expanded={receiptId === sale._id}
                onClick={() => setReceiptId(receiptId === sale._id ? null : sale._id)}
              >
                {sale.receiptNo} · {sale.operatorName || "Seller unavailable"} ·{" "}
                {formatPaise(sale.totalPaise)} · {new Date(sale.soldAt).toLocaleDateString()}
              </button>
              {receiptId === sale._id ? <ArchivedReceipt group={group} id={sale._id} /> : null}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button
          className={ghostBtnCls}
          disabled={page <= 1 || !sales}
          onClick={() => {
            setSales(null);
            setPage(page - 1);
          }}
        >
          Previous
        </button>
        <button
          className={ghostBtnCls}
          disabled={page >= (sales?.data?.meta.totalPages ?? 1)}
          onClick={() => {
            setSales(null);
            setPage(page + 1);
          }}
        >
          Next
        </button>
      </div>
      <h4 className="font-semibold">Recent closed shifts</h4>
      {!shifts ? (
        <p>Loading shifts…</p>
      ) : !shifts.success ? (
        <p role="alert">{shifts.message}</p>
      ) : !shifts.data?.items.length ? (
        <p>No closed shifts.</p>
      ) : (
        <ul>
          {shifts.data.items.map((shift) => (
            <li key={shift.id}>
              {new Date(shift.openedAt).toLocaleString()} · Counted{" "}
              {formatPaise(shift.countedCashMinor)} · Variance {formatPaise(shift.varianceMinor)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ArchivedReceipt({ group, id }: { group: GroupSummary; id: string }) {
  const { data, error } = useApi(() => salesApi.get(id, group.groupId), [id, group.groupId], {
    keepData: false,
  });
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Loading receipt…</p>;
  return (
    <ReceiptView
      sale={data.sale}
      orgName={group.name}
      payments={data.payments.map((payment) => ({
        method: payment.method,
        amountPaise: payment.amountPaise,
        reference: payment.upiRef,
      }))}
    />
  );
}
