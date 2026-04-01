import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin/office_admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = roleData?.some((r: any) =>
      ["admin", "office_admin"].includes(r.role)
    );
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Only admins can invite resources" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { resource_id, redirect_url } = await req.json();
    if (!resource_id) {
      return new Response(
        JSON.stringify({ error: "resource_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get resource
    const { data: resource, error: resourceError } = await adminClient
      .from("resources")
      .select("id, email, display_name, invitation_status")
      .eq("id", resource_id)
      .is("deleted_at", null)
      .single();

    if (resourceError || !resource) {
      return new Response(
        JSON.stringify({ error: "Resource not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resource.email) {
      return new Response(
        JSON.stringify({ error: "Resource has no email address. Please add an email first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (resource.invitation_status === "active") {
      return new Response(
        JSON.stringify({ error: "This resource has already joined the platform" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists with this email
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === resource.email.toLowerCase()
    );

    if (existingUser) {
      // User already exists, just assign reporter role and link
      await adminClient.from("user_roles").upsert(
        { user_id: existingUser.id, role: "reporter" },
        { onConflict: "user_id,role" }
      );
      await adminClient
        .from("resources")
        .update({ user_id: existingUser.id, invitation_status: "active" })
        .eq("id", resource_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "User already exists. Reporter role assigned and resource linked.",
          already_exists: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Invite user via Supabase Auth
    // Use the app's published URL for redirect so users land on the app, not Lovable
    const appUrl = redirect_url || "https://forecast-compass-hub.lovable.app/auth";
    const signupUrl = `${appUrl}?email=${encodeURIComponent(resource.email)}&tab=signup`;

    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      resource.email,
      {
        redirectTo: signupUrl,
        data: {
          full_name: resource.display_name,
          invited_resource_id: resource.id,
        },
      }
    );

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update invitation status
    await adminClient
      .from("resources")
      .update({ invitation_status: "invitation_sent" })
      .eq("id", resource_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${resource.email}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
