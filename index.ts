import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ha-device-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
const allowedModules = new Set(["restaurant", "wholesale", "market", "engineering", "yemen", "service", "personal", "generator", "detergents", "full"]);
const moduleFor = (value: unknown) => typeof value === "string" && allowedModules.has(value) ? value : "full";

async function ensureGeneratorProfile(userId: string, loginId: string, nameValue?: unknown, ownerValue?: unknown) {
  const { data: existing, error: profileLookupError } = await adminClient
    .from("generator_profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (profileLookupError) throw profileLookupError;
  if (existing) return;

  const clean = (value: unknown, fallback: string) => {
    const text = String(value ?? "").trim().slice(0, 100);
    return text || fallback;
  };
  const ownerName = clean(ownerValue, loginId);
  const generatorName = clean(nameValue, `${ownerName} - مولدة`);
  const { data: workspace, error: workspaceError } = await adminClient
    .from("generator_workspaces")
    .insert({ generator_name: generatorName, owner_name: ownerName })
    .select("id").single();
  if (workspaceError) throw workspaceError;

  const { error: profileError } = await adminClient.from("generator_profiles").insert({
    user_id: userId,
    workspace_id: workspace.id,
    username: loginId,
    display_name: ownerName,
    role: "owner",
    active: true,
  });
  if (profileError) {
    await adminClient.from("generator_workspaces").delete().eq("id", workspace.id);
    throw profileError;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) return json({ error: "unauthorized" }, 401);
    const body = await req.json();
    if (body.action === "claim-device") {
      const { data: adminAccess } = await adminClient.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!adminAccess) {
        const { data: subscription, error: subscriptionError } = await adminClient.from("subscriptions").select("active,expires_at").eq("user_id", user.id).maybeSingle();
        if (subscriptionError) throw subscriptionError;
        if (!subscription || !subscription.active || (subscription.expires_at && new Date(subscription.expires_at).getTime() < Date.now())) {
          return json({ error: "subscription_inactive" }, 403);
        }
      }
      return json({ ok: true, multiDevice: true });
    }
    const { data: adminRow } = await adminClient.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow) return json({ error: "forbidden" }, 403);

    if (body.action === "list") {
      const { data, error } = await adminClient.from("subscriptions").select("user_id,login_id,active,expires_at,module_type,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: devices, error: deviceError } = await adminClient.from("account_devices").select("user_id,device_label,bound_at");
      if (deviceError) throw deviceError;
      const byUser = new Map((devices ?? []).map((d) => [d.user_id, d]));
      return json({ users: (data ?? []).map((s) => ({ ...s, ...(byUser.get(s.user_id) ?? {}) })) });
    }
    if (body.action === "create") {
      const loginId = String(body.loginId ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
      const moduleType = moduleFor(body.moduleType);
      if (!/^[a-z0-9_-]{4,32}$/.test(loginId)) return json({ error: "id_format" }, 400);
      if (password.length < 10) return json({ error: "password_too_short" }, 400);
      const email = `${loginId}@ha-accounting.invalid`;
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { login_id: loginId } });
      if (createError) return json({ error: createError.message }, 400);
      const { error: subError } = await adminClient.from("subscriptions").insert({ user_id: created.user.id, login_id: loginId, active: true, expires_at: expiresAt, module_type: moduleType });
      if (subError) { await adminClient.auth.admin.deleteUser(created.user.id); throw subError; }
      if (moduleType === "generator") {
        try {
          await ensureGeneratorProfile(created.user.id, loginId, body.generatorName, body.generatorOwner);
        } catch (error) {
          await adminClient.from("subscriptions").delete().eq("user_id", created.user.id);
          await adminClient.auth.admin.deleteUser(created.user.id);
          throw error;
        }
      }
      return json({ user: { user_id: created.user.id, login_id: loginId, active: true, expires_at: expiresAt, module_type: moduleType } }, 201);
    }
    if (body.action === "delete") {
      const userId = String(body.userId ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "معرّف الحساب غير صحيح." }, 400);
      if (userId === user.id) return json({ error: "لا يمكن للأدمن حذف حسابه الحالي من هنا." }, 400);
      const { data: protectedAdmin, error: protectedAdminError } = await adminClient.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle();
      if (protectedAdminError) throw protectedAdminError;
      if (protectedAdmin) return json({ error: "لا يمكن حذف حساب الأدمن الرئيسي." }, 403);
      const { data: subscription, error: subscriptionError } = await adminClient.from("subscriptions").select("user_id,login_id").eq("user_id", userId).maybeSingle();
      if (subscriptionError) throw subscriptionError;
      if (!subscription) return json({ error: "الحساب غير موجود ضمن قائمة المشتركين." }, 404);
      const { data: generatorProfile, error: generatorProfileError } = await adminClient.from("generator_profiles").select("workspace_id").eq("user_id", userId).maybeSingle();
      if (generatorProfileError) throw generatorProfileError;
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) return json({ error: `تعذر حذف الحساب من تسجيل الدخول: ${deleteError.message}` }, 400);
      const cleanupWarnings: string[] = [];
      for (const table of ["subscriptions", "account_devices", "accounting_workspaces", "generator_profiles"]) {
        const { error } = await adminClient.from(table).delete().eq("user_id", userId);
        if (error) cleanupWarnings.push(`${table}: ${error.message}`);
      }
      if (generatorProfile?.workspace_id) {
        const { error } = await adminClient.from("generator_workspaces").delete().eq("id", generatorProfile.workspace_id);
        if (error) cleanupWarnings.push(`generator_workspaces: ${error.message}`);
      }
      if (cleanupWarnings.length) {
        console.error("Deleted Auth user but public data cleanup reported errors", userId, cleanupWarnings);
        return json({ ok: true, warning: "تم حذف تسجيل الدخول. توجد بيانات مرتبطة لم تُحذف تلقائياً؛ راجع مسؤول قاعدة البيانات." });
      }
      return json({ ok: true });
    }
    if (body.action === "update") {
      const userId = String(body.userId ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "invalid_user" }, 400);
      const update: Record<string, unknown> = {};
      if (body.moduleType === "generator") {
        const { data: subscription, error: lookupError } = await adminClient.from("subscriptions").select("login_id").eq("user_id", userId).maybeSingle();
        if (lookupError) throw lookupError;
        if (!subscription) return json({ error: "الحساب غير موجود ضمن قائمة المشتركين." }, 404);
        await ensureGeneratorProfile(userId, subscription.login_id, body.generatorName, body.generatorOwner);
      }
      if (typeof body.active === "boolean") update.active = body.active;
      if (body.expiresAt !== undefined) update.expires_at = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
      if (body.moduleType !== undefined) {
        if (typeof body.moduleType !== "string" || !allowedModules.has(body.moduleType)) return json({ error: "invalid_module_type" }, 400);
        update.module_type = body.moduleType;
      }
      if (!Object.keys(update).length) return json({ error: "nothing_to_update" }, 400);
      const { error } = await adminClient.from("subscriptions").update(update).eq("user_id", userId);
      if (error) throw error;
      return json({ ok: true });
    }
    if (body.action === "reset-device") {
      const userId = String(body.userId ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "invalid_user" }, 400);
      const { error } = await adminClient.from("account_devices").delete().eq("user_id", userId);
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("manage-subscribers error", error);
    const detail = error instanceof Error ? error.message : String(error);
    if (/foreign key|violates.*constraint/i.test(detail)) {
      return json({ error: "لا يمكن حذف الحساب لأن له فواتير أو طلبات مرتبطة به. الحساب وبياناته محفوظة؛ أوقفه من القائمة إذا تريد منع دخوله دون حذف سجلاته." }, 409);
    }
    return json({ error: "server_error" }, 500);
  }
});
