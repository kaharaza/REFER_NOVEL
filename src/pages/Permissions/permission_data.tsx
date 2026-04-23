import { useEffect, useRef, useState } from "react";
import { getUserFromToken } from "../../utils/authUtils";
import { useNavigate } from "react-router-dom";
import { LoadingForm } from "../../component/LoadingForm";
import { GetCmuItAccount } from "../../api/GetApi";
import { PutUpdatePremission } from "../../api/PutApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PermissionDataProps {
  id: string;
  cmu_codeId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

// ─── Permission Config ────────────────────────────────────────────────────────

const ALL_PERMISSIONS: {
  key: string;
  label: string;
  description: string;
  icon: string;
  group: string;
}[] = [
  {
    key: "READ",
    label: "อ่านข้อมูล",
    description: "ดูข้อมูลในระบบ",
    icon: "👁",
    group: "ข้อมูล",
  },
  {
    key: "CREATE",
    label: "สร้างข้อมูล",
    description: "เพิ่มข้อมูลใหม่",
    icon: "✚",
    group: "ข้อมูล",
  },
  {
    key: "UPDATE",
    label: "แก้ไขข้อมูล",
    description: "อัปเดตข้อมูลที่มีอยู่",
    icon: "✎",
    group: "ข้อมูล",
  },
  {
    key: "DELETE",
    label: "ลบข้อมูล",
    description: "ลบข้อมูลออกจากระบบ",
    icon: "✕",
    group: "ข้อมูล",
  },
  {
    key: "EXPORT",
    label: "ส่งออกข้อมูล",
    description: "ดาวน์โหลดและส่งออกรายงาน",
    icon: "↓",
    group: "การจัดการ",
  },
  {
    key: "SEND_MAIL",
    label: "ส่งอีเมล",
    description: "ส่งการแจ้งเตือนทางอีเมล",
    icon: "✉",
    group: "การจัดการ",
  },
  {
    key: "VIEW_PRIVATE",
    label: "ดูข้อมูลส่วนตัว",
    description: "เข้าถึงข้อมูลที่จำกัดสิทธิ์",
    icon: "🔒",
    group: "การจัดการ",
  },
];

const GROUPS = ["ข้อมูล", "การจัดการ"];

const ROLE_CONFIG: Record<
  string,
  { label: string; badgeStyle: string; avatarStyle: string }
> = {
  ADMIN: {
    label: "ผู้ดูแลระบบ",
    badgeStyle: "bg-rose-50 text-rose-700 border border-rose-200",
    avatarStyle: "bg-rose-600",
  },
  COUNTER: {
    label: "เจ้าหน้าที่",
    badgeStyle: "bg-blue-50 text-blue-700 border border-blue-200",
    avatarStyle: "bg-blue-600",
  },
  USER: {
    label: "ผู้ใช้งานทั่วไป",
    badgeStyle: "bg-slate-100 text-slate-600 border border-slate-200",
    avatarStyle: "bg-slate-500",
  },
};

const getRoleCfg = (role: string) =>
  ROLE_CONFIG[role] ?? {
    label: role,
    badgeStyle: "bg-slate-100 text-slate-600 border border-slate-200",
    avatarStyle: "bg-slate-500",
  };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PermissionData() {
  const [accounts, setAccounts] = useState<PermissionDataProps[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // per-user unsaved changes: Record<userId, Set<permKey>>
  const [dirtyPerms, setDirtyPerms] = useState<Record<string, Set<string>>>({});
  // per-user unsaved role changes: Record<userId, newRole>
  const [dirtyRoles, setDirtyRoles] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState("");
  const router = useNavigate();
  const initRef = useRef(false);

  // ── fetch ─────────────────────────────────────────────────────────────────

  const fetchDataCmuItAccount = async () => {
    try {
      const resp = await GetCmuItAccount(); // expects PermissionDataProps[]
      if (resp) {
        setAccounts(resp.data);
        setSelectedId(resp.data[0].id);
      } else {
        setIsLoading(true);
        setMessages("ไม่พบข้อมูลผู้ใช้งาน");
        setTimeout(() => {
          setIsLoading(false);
          setMessages("");
        }, 2000);
      }
    } catch {
      setIsLoading(true);
      setMessages("Failed to fetch data. Please try again later.");
      setTimeout(() => {
        setIsLoading(false);
        setMessages("");
      }, 2000);
    }
  };

  useEffect(() => {
    if (getUserFromToken()) {
      const userLogin = getUserFromToken();
      if (
        userLogin?.aud === "admin" &&
        userLogin?.role === "ADMIN" &&
        userLogin?.email === import.meta.env.VITE_EMAIL_SERVICE
      ) {
        if (initRef.current) return;
        initRef.current = true;
        fetchDataCmuItAccount();
      } else {
        setIsLoading(true);
        setMessages("You don't have permission to access this page.");
        setTimeout(() => {
          setIsLoading(false);
          setMessages("");
          router("/novel/dashboard");
        }, 2000);
      }
    }
  }, []);

  if (isLoading) return <LoadingForm text={messages} />;

  // ── helpers ───────────────────────────────────────────────────────────────

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? null;

  const getActivePerms = (userId: string): Set<string> => {
    if (dirtyPerms[userId]) return dirtyPerms[userId];
    return new Set(accounts.find((a) => a.id === userId)?.permissions ?? []);
  };

  const getActiveRole = (userId: string): string => {
    if (dirtyRoles[userId]) return dirtyRoles[userId];
    return accounts.find((a) => a.id === userId)?.role ?? "";
  };

  const activePerms = selectedId
    ? getActivePerms(selectedId)
    : new Set<string>();

  const activeRole = selectedId ? getActiveRole(selectedId) : "";

  const isDirtyUser = (userId: string): boolean => {
    if (!dirtyPerms[userId] && !dirtyRoles[userId]) return false;
    const originalRole = accounts.find((a) => a.id === userId)?.role ?? "";
    const currentRole = dirtyRoles[userId];
    if (currentRole && currentRole !== originalRole) return true;
    if (!dirtyPerms[userId]) return false;
    const original = new Set(
      accounts.find((a) => a.id === userId)?.permissions ?? [],
    );
    const current = dirtyPerms[userId];
    if (original.size !== current.size) return true;
    for (const p of current) if (!original.has(p)) return true;
    return false;
  };

  // ── handlers ──────────────────────────────────────────────────────────────

  const togglePerm = (key: string) => {
    if (!selectedId) return;
    const id = selectedId;
    setDirtyPerms((prev) => {
      const base = getActivePerms(id);
      const next = new Set(base);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, [id]: next };
    });
    setSavedId(null);
  };

  const changeRole = (newRole: string) => {
    if (!selectedId) return;
    const id = selectedId;
    setDirtyRoles((prev) => ({ ...prev, [id]: newRole }));
    setSavedId(null);
  };

  const toggleGroupAll = (keys: string[], allOn: boolean) => {
    if (!selectedId) return;
    const id = selectedId;
    setDirtyPerms((prev) => {
      const base = getActivePerms(id);
      const next = new Set(base);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return { ...prev, [id]: next };
    });
    setSavedId(null);
  };

  const handleReset = () => {
    if (!selectedId) return;
    const id = selectedId;
    setDirtyPerms((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setDirtyRoles((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setSavedId(null);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    const id = selectedId;
    setSavingId(id);

    const payload = {
      adminId: id,
      permissions: Array.from(getActivePerms(id)),
      ...(dirtyRoles[id] && { role: dirtyRoles[id] }),
    };

    const resp = await PutUpdatePremission(payload);

    if (!resp.success) {
      setIsLoading(true);
      setMessages("Failed to update permissions. Please try again later.");
      setTimeout(() => {
        setIsLoading(false);
        setMessages("");
      }, 2000);
      setSavingId(null);
      return;
    }

    await new Promise((r) => setTimeout(r, 800));
    // Update local baseline so reset works from saved state
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              permissions: Array.from(getActivePerms(id)),
              role: getActiveRole(id),
            }
          : a,
      ),
    );
    setDirtyPerms((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setDirtyRoles((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setSavingId(null);
    setSavedId(id);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: "'Sarabun', sans-serif" }}
    >
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-20">
        <div className="w-full mx-auto flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white text-xs font-bold select-none">
            P
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-800 leading-none">
              จัดการสิทธิ์การใช้งาน
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Permission Management
            </p>
          </div>
          <div className="ml-auto">
            <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-medium">
              {accounts.length} ผู้ใช้งาน
            </span>
          </div>
        </div>
      </div>

      <div className="w-full mx-auto px-6 py-6 flex gap-5 items-start">
        {/* ── Left panel: user list ─────────────────────────────────────────── */}
        <div className="w-96 shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-20">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
              รายชื่อผู้ใช้งาน
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[calc(100vh-140px)] overflow-y-auto">
            {accounts.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                ไม่พบข้อมูล
              </div>
            ) : (
              accounts.map((acc) => {
                const cfg = getRoleCfg(acc.role);
                const isSelected = selectedId === acc.id;
                const dirty = isDirtyUser(acc.id);
                const permCount = getActivePerms(acc.id).size;

                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setSelectedId(acc.id);
                      setSavedId(null);
                    }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50
                      border-l-2 ${isSelected ? "bg-slate-50 border-slate-900" : "border-transparent"}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 select-none ${cfg.avatarStyle}`}
                    >
                      {acc.name.charAt(0)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-800 truncate leading-none">
                          {acc.name}
                        </span>
                        {dirty && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                            title="มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก"
                          />
                        )}
                      </div>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium mt-1 inline-block ${cfg.badgeStyle}`}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    {/* Perm count */}
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-slate-600">
                        {permCount}
                      </span>
                      <span className="text-xs text-slate-300">
                        /{ALL_PERMISSIONS.length}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right panel: permission editor ───────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {selectedAccount ? (
            <>
              {/* User profile card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 select-none ${getRoleCfg(activeRole).avatarStyle}`}
                  >
                    {selectedAccount.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-slate-800">
                        {selectedAccount.name}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-semibold ${getRoleCfg(activeRole).badgeStyle}`}
                      >
                        {getRoleCfg(activeRole).label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {selectedAccount.email}
                    </p>
                  </div>
                  <div className="text-right shrink-0 pl-4 border-l border-slate-100">
                    <span className="text-xs text-slate-400 block">
                      รหัสผู้ใช้
                    </span>
                    <span className="text-xs font-mono text-slate-600">
                      {selectedAccount.cmu_codeId}
                    </span>
                    <span className="text-xs text-slate-400 block mt-1.5">
                      สิทธิ์ที่เปิดใช้
                    </span>
                    <span className="text-sm font-bold text-slate-700">
                      {activePerms.size}
                      <span className="text-xs font-normal text-slate-400">
                        {" "}
                        / {ALL_PERMISSIONS.length}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Role selector */}
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <label className="text-xs font-semibold text-slate-500 tracking-wide uppercase block mb-2">
                    เปลี่ยนบทบาท
                  </label>
                  <select
                    value={activeRole}
                    onChange={(e) => changeRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-800
                      bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent
                      cursor-pointer transition-colors duration-150"
                  >
                    {Object.entries(ROLE_CONFIG).map(([roleKey, roleCfg]) => (
                      <option key={roleKey} value={roleKey}>
                        {roleCfg.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Permission groups */}
              {GROUPS.map((group) => {
                const groupPerms = ALL_PERMISSIONS.filter(
                  (p) => p.group === group,
                );
                const groupKeys = groupPerms.map((p) => p.key);
                const allOn = groupKeys.every((k) => activePerms.has(k));

                return (
                  <div
                    key={group}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                      <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                        {group}
                      </span>
                      <button
                        onClick={() => toggleGroupAll(groupKeys, allOn)}
                        className={`text-xs font-semibold px-3 py-1 rounded-md border cursor-pointer
                          ${
                            allOn
                              ? "bg-white border-slate-300 text-slate-500 hover:bg-slate-100"
                              : "bg-slate-900 border-slate-900 text-white hover:bg-slate-700"
                          }`}
                      >
                        {allOn ? "ปิดทั้งหมด" : "เปิดทั้งหมด"}
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {groupPerms.map((perm) => {
                        const on = activePerms.has(perm.key);
                        return (
                          <div
                            key={perm.key}
                            className={`flex items-center justify-between px-5 py-3.5 ${on ? "bg-white" : "bg-slate-50/60"}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-base w-6 text-center shrink-0 select-none">
                                {perm.icon}
                              </span>
                              <div>
                                <div className="text-sm font-medium text-slate-700 leading-none">
                                  {perm.label}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {perm.description}
                                </div>
                              </div>
                            </div>

                            <button
                              role="switch"
                              aria-checked={on}
                              onClick={() => togglePerm(perm.key)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                                focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900
                                ${on ? "bg-slate-900" : "bg-slate-200"}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ${on ? "translate-x-4" : "translate-x-0"}`}
                                style={{ transition: "transform 0.15s" }}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Save bar */}
              <div
                className={`sticky bottom-5 bg-white rounded-xl border shadow-md px-5 py-3.5
                flex items-center justify-between gap-4
                ${isDirtyUser(selectedId!) ? "border-amber-300 shadow-amber-100" : "border-slate-200 shadow-slate-100"}`}
              >
                <div className="text-sm">
                  {isDirtyUser(selectedId!) ? (
                    <span className="text-amber-600 font-medium">
                      ⚠ มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
                    </span>
                  ) : savedId === selectedId ? (
                    <span className="text-emerald-600 font-medium">
                      ✓ บันทึกสำเร็จ
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">
                      ไม่มีการเปลี่ยนแปลง
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    disabled={!isDirtyUser(selectedId!)}
                    className="text-sm px-4 py-1.5 rounded-lg border border-slate-200 text-slate-500
                      hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    รีเซ็ต
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={
                      !isDirtyUser(selectedId!) || savingId === selectedId
                    }
                    className="text-sm px-5 py-1.5 rounded-lg bg-slate-900 text-white font-semibold
                      hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {savingId === selectedId ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
              เลือกผู้ใช้งานเพื่อจัดการสิทธิ์
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
