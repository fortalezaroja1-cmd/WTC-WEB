"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, LockKeyhole, Plus, RefreshCcw, ShieldCheck, UserRound, X } from "lucide-react";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, ROLE_LABELS, ROLE_PRESETS, AdminRoleName } from "@/lib/permissions";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: AdminRoleName;
  permissions: string[];
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  failedAttempts: number;
  lockedUntil: string | null;
};

type UserForm = {
  id?: string;
  name: string;
  email: string;
  role: AdminRoleName;
  password: string;
  active: boolean;
  permissions: string[];
};

const EMPTY: UserForm = {
  name: "",
  email: "",
  role: "SALES",
  password: "",
  active: true,
  permissions: [...ROLE_PRESETS.SALES],
};

function generatePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const nums = "23456789";
  const symbols = "!@#$%*+-_";
  const all = upper + lower + nums + symbols;
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const base = [pick(upper), pick(lower), pick(nums), pick(symbols)];
  while (base.length < 14) base.push(pick(all));
  for (let i = base.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState<UserForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");

  const isEditing = Boolean(form.id);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar los usuarios");
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selected = useMemo(() => users.find((u) => u.id === form.id), [users, form.id]);

  const startNew = () => {
    setForm({ ...EMPTY, permissions: [...ROLE_PRESETS.SALES] });
    setError("");
    setSuccess("");
  };

  const editUser = (user: UserRow) => {
    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
      active: user.active,
      permissions: [...(user.permissions || ROLE_PRESETS[user.role])],
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setRole = (role: AdminRoleName) => {
    setForm((current) => ({
      ...current,
      role,
      permissions: [...ROLE_PRESETS[role]],
    }));
  };

  const togglePermission = (permission: string) => {
    if (form.role === "ADMIN") return;
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  };

  const useGeneratedPassword = () => {
    const password = generatePassword();
    setForm((current) => ({ ...current, password }));
    setCopied(false);
  };

  const copyPassword = async () => {
    if (!form.password) return;
    await navigator.clipboard.writeText(form.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const createInvite = async () => {
    setSaving(true); setError(""); setSuccess(""); setInviteUrl("");
    try {
      const res = await fetch("/api/admin/invitations", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:form.name,email:form.email,role:form.role,permissions:form.role==="ADMIN"?ALL_PERMISSIONS:form.permissions }) });
      const data = await res.json(); if(!res.ok) throw new Error(data.error || "No se pudo crear la invitación");
      setInviteUrl(data.inviteUrl); setSuccess("Invitación creada. Copia el enlace y envíaselo a la persona.");
    } catch(e:any){ setError(e.message || "No se pudo crear la invitación"); } finally { setSaving(false); }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: any = {
        name: form.name,
        email: form.email,
        role: form.role,
        active: form.active,
        permissions: form.role === "ADMIN" ? ALL_PERMISSIONS : form.permissions,
      };
      if (form.password) payload.password = form.password;
      if (form.id) payload.id = form.id;

      if (!form.id && !form.password) throw new Error("Define una contraseña inicial para el usuario");

      const res = await fetch("/api/admin/users", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el usuario");

      setSuccess(form.id ? "Usuario actualizado" : "Usuario creado. Ya puede iniciar sesión con su correo y contraseña.");
      await load();
      if (form.id) {
        setForm((current) => ({ ...current, password: "" }));
      } else {
        setForm({ ...EMPTY, permissions: [...ROLE_PRESETS.SALES] });
      }
    } catch (e: any) {
      setError(e.message || "No se pudo guardar el usuario");
    } finally {
      setSaving(false);
    }
  };

  const unlock = async () => {
    if (!form.id) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: form.id, unlock: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo desbloquear");
      setSuccess("Usuario desbloqueado");
      await load();
    } catch (e: any) {
      setError(e.message || "No se pudo desbloquear");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1240px]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">Usuarios y permisos</h1>
            <ShieldCheck size={20} className="text-copper" />
          </div>
          <p className="text-sm text-muted mt-1">Crea accesos individuales y define exactamente qué puede ver o modificar cada persona.</p>
        </div>
        <button onClick={startNew} className="inline-flex items-center justify-center gap-2 bg-graphite text-white rounded-lg px-4 py-2.5 text-sm font-semibold">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-5 items-start">
        <section className="bg-white border border-hair rounded-xl overflow-hidden xl:sticky xl:top-5">
          <div className="p-4 border-b border-hair flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Equipo</div>
              <div className="text-[11px] text-muted mt-0.5">{users.filter((u) => u.active).length} activos · {users.length} total</div>
            </div>
            <button onClick={load} className="w-9 h-9 rounded-lg border border-hair flex items-center justify-center" aria-label="Actualizar"><RefreshCcw size={15}/></button>
          </div>
          <div className="max-h-[72vh] overflow-y-auto">
            {loading && <div className="p-8 text-center text-xs text-muted">Cargando usuarios...</div>}
            {!loading && users.map((user) => {
              const locked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
              return (
                <button key={user.id} onClick={() => editUser(user)} className={`w-full text-left p-4 border-b border-hair hover:bg-paper/60 ${form.id === user.id ? "bg-[#F4F5F7] border-l-2 border-l-copper" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#E9EDF1] text-muted flex items-center justify-center shrink-0"><UserRound size={18}/></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-sm truncate">{user.name}</div>
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${user.active ? "bg-green" : "bg-[#B8BEC6]"}`} />
                      </div>
                      <div className="text-[11px] text-muted truncate mt-0.5">{user.email}</div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        <span className="text-[9px] rounded-full bg-paper px-2 py-1 font-semibold">{ROLE_LABELS[user.role]}</span>
                        <span className="text-[9px] rounded-full bg-paper px-2 py-1 text-muted">{user.permissions?.length || 0} permisos</span>
                        {locked && <span className="text-[9px] rounded-full bg-red-50 text-alert px-2 py-1 font-semibold">Bloqueado</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-5 min-w-0">
          <div className="bg-white border border-hair rounded-xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="font-semibold">{isEditing ? `Editar · ${selected?.name || "usuario"}` : "Crear usuario"}</h2>
                <p className="text-xs text-muted mt-1">Cada persona debe usar su propio correo y contraseña.</p>
              </div>
              {isEditing && <button onClick={startNew} className="w-9 h-9 rounded-lg border border-hair flex items-center justify-center"><X size={16}/></button>}
            </div>

            {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 text-alert px-3 py-2.5 text-xs">{error}</div>}
            {success && <div className="mb-4 rounded-lg border border-green/20 bg-green-50 text-green px-3 py-2.5 text-xs font-semibold flex items-center gap-2"><Check size={14}/>{success}</div>}
            {inviteUrl && <div className="mb-4 rounded-lg border border-copper/30 bg-paper p-3"><div className="text-[11px] font-semibold mb-2">Link de invitación · válido 7 días y de un solo uso</div><div className="flex gap-2"><input readOnly value={inviteUrl} className="flex-1 min-w-0 border border-hair rounded-lg px-3 py-2 text-xs"/><button onClick={async()=>{await navigator.clipboard.writeText(inviteUrl);setCopied(true);setTimeout(()=>setCopied(false),1800)}} className="px-3 rounded-lg border border-hair bg-white text-xs font-semibold">{copied?"Copiado":"Copiar"}</button></div></div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold block mb-1.5">Nombre</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Laura Gómez" className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold block mb-1.5">Correo de acceso</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="laura@empresa.com" className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold block mb-1.5">Rol base</span>
                <select value={form.role} onChange={(e) => setRole(e.target.value as AdminRoleName)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-copper">
                  {(Object.keys(ROLE_LABELS) as AdminRoleName[]).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold block mb-1.5">Estado</span>
                <select value={form.active ? "ACTIVE" : "INACTIVE"} onChange={(e) => setForm({ ...form, active: e.target.value === "ACTIVE" })} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-copper">
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </label>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-xs font-semibold">{isEditing ? "Nueva contraseña (opcional)" : "Contraseña inicial"}</span>
                <button type="button" onClick={useGeneratedPassword} className="text-[11px] font-semibold text-copper inline-flex items-center gap-1"><KeyRound size={12}/> Generar segura</button>
              </div>
              <div className="flex gap-2">
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="text" placeholder={isEditing ? "Déjala vacía para conservar la actual" : "Mínimo 8 caracteres"} className="flex-1 min-w-0 border border-hair rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-copper" />
                <button type="button" onClick={copyPassword} disabled={!form.password} className="w-11 rounded-lg border border-hair bg-white flex items-center justify-center disabled:opacity-40" title="Copiar contraseña">{copied ? <Check size={15} className="text-green"/> : <Copy size={15}/>}</button>
              </div>
              <p className="text-[10px] text-muted mt-1.5">La contraseña nunca se muestra de nuevo después de guardar. Si se pierde, se restablece desde aquí.</p>
            </div>

            {selected?.lockedUntil && new Date(selected.lockedUntil) > new Date() && (
              <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs"><b>Cuenta bloqueada.</b> Hubo varios intentos fallidos de inicio de sesión.</div>
                <button onClick={unlock} disabled={saving} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold inline-flex items-center justify-center gap-2"><LockKeyhole size={14}/> Desbloquear</button>
              </div>
            )}
          </div>

          <div className="bg-white border border-hair rounded-xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h2 className="font-semibold">Permisos</h2>
                <p className="text-xs text-muted mt-1">El rol aplica una plantilla; después puedes activar o quitar permisos individualmente.</p>
              </div>
              <div className="text-[10px] font-mono text-muted">{form.role === "ADMIN" ? ALL_PERMISSIONS.length : form.permissions.length}/{ALL_PERMISSIONS.length}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.id} className="rounded-xl border border-hair overflow-hidden">
                  <div className="px-3.5 py-3 bg-paper/70 border-b border-hair text-xs font-bold">{group.label}</div>
                  <div className="divide-y divide-hair">
                    {group.permissions.map(([permission, label]) => {
                      const checked = form.role === "ADMIN" || form.permissions.includes(permission);
                      return (
                        <label key={permission} className={`flex items-center gap-3 px-3.5 py-3 text-xs ${form.role === "ADMIN" ? "opacity-70" : "cursor-pointer hover:bg-paper/50"}`}>
                          <input type="checkbox" checked={checked} disabled={form.role === "ADMIN"} onChange={() => togglePermission(permission)} className="w-4 h-4 accent-[#C9773B]" />
                          <span className="flex-1">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6">
            <div className="text-[11px] text-muted">Los cambios de permisos se aplican al próximo inicio de sesión del usuario.</div>
            <div className="flex flex-col sm:flex-row gap-2">
              {!isEditing && <button onClick={createInvite} disabled={saving || !form.name.trim() || !form.email.trim()} className="border border-copper text-copper bg-white rounded-lg px-5 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40"><Copy size={15}/> Crear link de invitación</button>}
            <button onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()} className="bg-copper text-white rounded-lg px-5 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40">
              <Check size={16}/>{saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear usuario"}
            </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
