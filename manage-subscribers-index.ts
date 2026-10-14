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
      const deviceId = String(body.deviceId ?? "");
      const deviceLabel = String(body.deviceLabel ?? "جهاز غير معروف").slice(0, 120);
      if (!/^[a-zA-Z0-9-]{20,80}$/.test(deviceId)) return json({ error: "invalid_device" }, 400);
      const { data: adminAccess } = await adminClient.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!adminAccess) {
        const { data: subscription, error: subscriptionError } = await adminClient.from("subscriptions").select("active,expires_at").eq("user_id", user.id).maybeSingle();
        if (subscriptionError) throw subscriptionError;
        if (!subscription || !subscription.active || (subscription.expires_at && new Date(subscription.expires_at).getTime() < Date.now())) {
          return json({ error: "subscription_inactive" }, 403);
        }
      }
      const { data: existing, error: existingError } = await adminClient.from("account_devices").select("device_id").eq("user_id", user.id).maybeSingle();
      if (existingError) throw existingError;
      if (existing && existing.device_id !== deviceId) return json({ error: "device_locked" }, 409);
      if (!existing) {
        const { error: insertError } = await adminClient.from("account_devices").insert({ user_id: user.id, device_id: deviceId, device_label: deviceLabel });
        if (insertError) {
          const { data: afterRace } = await adminClient.from("account_devices").select("device_id").eq("user_id", user.id).maybeSingle();
          if (!afterRace || afterRace.device_id !== deviceId) return json({ error: "device_locked" }, 409);
        }
      }
      return json({ ok: true });
    }
    const { data: adminRow } = await adminClient.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow) return json({ error: "forbidden" }, 403);

    if (body.action === "list") {
      const { data, error } = await adminClient.from("subscriptions").select("user_id,login_id,active,expires_at,created_at").order("created_at", { ascending: false });
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
      if (!/^[a-z0-9_-]{4,32}$/.test(loginId)) return json({ error: "id_format" }, 400);
      if (password.length < 10) return json({ error: "password_too_short" }, 400);
      const email = `${loginId}@ha-accounting.invalid`;
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { login_id: loginId } });
      if (createError) return json({ error: createError.message }, 400);
      const { error: subError } = await adminClient.from("subscriptions").insert({ user_id: created.user.id, login_id: loginId, active: true, expires_at: expiresAt });
      if (subError) { await adminClient.auth.admin.deleteUser(created.user.id); throw subError; }
      return json({ user: { user_id: created.user.id, login_id: loginId, active: true, expires_at: expiresAt } }, 201);
    }
    if (body.action === "update") {
      const userId = String(body.userId ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "invalid_user" }, 400);
      const update: Record<string, unknown> = {};
      if (typeof body.active === "boolean") update.active = body.active;
      if (body.expiresAt !== undefined) update.expires_at = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
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
    return json({ error: "server_error" }, 500);
  }
});
