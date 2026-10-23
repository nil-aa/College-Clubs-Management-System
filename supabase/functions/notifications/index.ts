import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type NotificationRequest = {
  userId: string;
  type: string;
  title: string;
  message: string;
  channels?: string[];
  metadata?: Record<string, unknown>;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    let body: NotificationRequest;
    try {
      body = (await request.json()) as NotificationRequest;
    } catch {
      return json({ error: 'Request body must be valid JSON' }, 400);
    }
    if (
      !body ||
      typeof body !== 'object' ||
      typeof body.userId !== 'string' ||
      !body.userId ||
      typeof body.type !== 'string' ||
      !body.type ||
      typeof body.title !== 'string' ||
      !body.title ||
      typeof body.message !== 'string' ||
      !body.message
    ) {
      return json({ error: 'userId, type, title and message are required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Function is not configured' }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Authorization is required' }, 401);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Invalid authorization' }, 401);
    if (body.userId !== authData.user.id) {
      return json({ error: 'This skeleton only permits self-notifications' }, 403);
    }
    const channels = body.channels?.length ? body.channels : ['in_app'];
    const { data, error } = await admin.rpc('send_notification', {
      p_user_id: body.userId,
      p_type: body.type,
      p_title: body.title,
      p_message: body.message,
      p_channels: channels,
      p_metadata: body.metadata ?? {},
    });
    if (error) {
      console.error('[notifications] notification insert failed', {
        code: error.code,
        operation: 'send_notification',
      });
      return json({ error: 'Unable to create notification' }, 500);
    }

    if (!Deno.env.get('EMAIL_PROVIDER') && channels.includes('email')) {
      console.info(
        '[notifications] EMAIL_PROVIDER is not configured; email delivery was logged only.',
        {
          notificationId: data,
        },
      );
    }

    return json({
      notificationId: data,
      delivery: Deno.env.get('EMAIL_PROVIDER') ? 'queued' : 'logged',
    });
  } catch (error) {
    console.error('[notifications] request failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
      operation: 'create_notification',
    });
    return json({ error: 'Unable to create notification' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
