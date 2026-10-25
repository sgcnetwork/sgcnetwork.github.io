
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const URL_ROOT = Deno.env.get('SUPABASE_URL')!;
const service = createClient(
  URL_ROOT,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

const SITE = 'https://sgcnetwork.co.za';
const CALLBACK = URL_ROOT + '/functions/v1/sgc-bookings?oauth=callback';
const OWNER = Deno.env.get('GOOGLE_OWNER_EMAIL') || 'netsgcwork@gmail.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': SITE,
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS'
};

function check(r: any): any {
  if (r.error) throw Error(r.error.message);
  return r.data;
}

function reply(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

async function rpc(action: string, data: any = {}): Promise<any> {
  return check(await service.rpc('sgc_booking_internal', {
    p_action: action,
    p_data: data
  }));
}

async function digest(value: string): Promise<string> {
  return [...new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  )].map(n => n.toString(16).padStart(2, '0')).join('');
}

async function sameSecret(a: string | null, b: string | null | undefined): Promise<boolean> {
  if (!a || !b) return false;
  const x = await digest(a), y = await digest(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function remote(url: string, options: RequestInit = {}): Promise<any> {
  const r = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(25000)
  });
  let data: any = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw Error('Remote service error ' + r.status);
  return data;
}

async function accessToken(host: any): Promise<string> {
  if (!host?.refresh_token) throw Error('Google Calendar is not connected.');

  const data = await remote('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
      refresh_token: host.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  if (!data.access_token) throw Error('Google authorisation needs reconnecting.');
  return data.access_token;
}

async function busyGoogle(host: any, from: number, to: number): Promise<any[]> {
  const token = await accessToken(host);
  const data = await remote('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(to).toISOString(),
      timeZone: 'Africa/Johannesburg',
      items: [{ id: host.calendar_id }]
    })
  });

  const calendar = data.calendars?.[host.calendar_id];
  if (!calendar || calendar.errors?.length)
    throw Error('Calendar availability could not be verified.');
  return calendar.busy || [];
}

const ms = 60000;

function overlaps(start: number, end: number, busy: any[]): boolean {
  return busy.some(b => start < Date.parse(b.end) && end > Date.parse(b.start));
}

function candidateSlots(config: any, day: string, busy: any[], now = Date.now()): any[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('Choose a valid date.');

  const base = Date.parse(day + 'T00:00:00+02:00');
  if (!Number.isFinite(base) ||
      new Date(base + 120 * ms).toISOString().slice(0, 10) !== day)
    throw Error('Invalid date.');

  if ((config.blocked_dates || []).includes(day)) return [];

  const dow = new Date(base + 120 * ms).getUTCDay();
  const hours = config.working_hours?.[String(dow)];
  if (!hours) return [];

  const minutes = (t: string) =>
    Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

  const result: any[] = [];
  const duration = config.duration_minutes * ms;
  const buffer = config.buffer_minutes * ms;

  for (
    let minute = Math.ceil(minutes(hours[0]) / 15) * 15;
    minute + config.duration_minutes <= minutes(hours[1]);
    minute += 15
  ) {
    const start = base + minute * ms;
    const end = start + duration;

    if (start < now + config.lead_minutes * ms ||
        start > now + config.horizon_days * 86400000) continue;

    if (!overlaps(start - buffer, end + buffer, busy)) {
      result.push({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString()
      });
    }
  }
  return result;
}

async function available(context: any, day: string): Promise<any[]> {
  if (context.settings?.delivery !== 'appointment')
    throw Error('Not a bookable service.');
  if (!context.host?.refresh_token)
    throw Error('Booking calendar is not connected yet.');

  const base = Date.parse(day + 'T00:00:00+02:00');
  if (!Number.isFinite(base) || Math.abs(base - Date.now()) > 92 * 86400000)
    throw Error('Date outside booking window.');

  const google = await busyGoogle(
    context.host, base - 240 * ms, base + 86400000 + 240 * ms
  );
  const local = await rpc('busy', { host_id: context.host.id });
  return candidateSlots(context.settings, day, [...google, ...local]);
}

async function calendarContext(b: any): Promise<any> {
  const host = check(await service.from('sgc_calendar_hosts')
    .select('*').eq('id', b.host_id).single());

  const token = await accessToken(host);
  const eventId = 'sgc' + b.id.replaceAll('-', '');
  const base = 'https://www.googleapis.com/calendar/v3/calendars/' +
    encodeURIComponent(b.calendar_id) + '/events';

  return {
    host, eventId, base,
    url: base + '/' + eventId,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  };
}

async function customerName(b: any): Promise<any> {
  const customer = check(await service.auth.admin.getUserById(b.user_id)).user;
  const profile = check(await service.from('profiles')
    .select('full_name').eq('id', b.user_id).maybeSingle());

  return {
    customer,
    name: profile?.full_name?.trim() ||
      customer.user_metadata?.full_name?.trim() ||
      customer.email
  };
}

async function removeWaitingEvent(b: any): Promise<void> {
  const c = await calendarContext(b);
  const found = await fetch(c.url, {
    headers: c.headers,
    signal: AbortSignal.timeout(20000)
  });

  if (found.ok) {
    const event = await found.json();

    if (event.status !== 'cancelled' &&
        event.extendedProperties?.private?.sgc_booking_id === b.id &&
        event.extendedProperties?.private?.sgc_phase === 'hold') {
      const removed = await fetch(c.url + '?sendUpdates=none', {
        method: 'DELETE',
        headers: c.headers,
        signal: AbortSignal.timeout(20000)
      });

      if (!removed.ok && removed.status !== 404 && removed.status !== 410)
        throw Error('Waiting appointment removal failed ' + removed.status);
    }
  } else if (found.status !== 404 && found.status !== 410) {
    throw Error('Waiting appointment lookup failed ' + found.status);
  }

  check(await service.from('sgc_bookings')
    .update({ hold_calendar_cleanup: false }).eq('id', b.id));
}

async function createWaitingEvent(b: any): Promise<any> {
  const c = await calendarContext(b);
  const person = await customerName(b);
  const current = await rpc('get', { id: b.id });

  if (current.status !== 'hold' ||
      Date.parse(current.hold_expires_at) <= Date.now())
    throw Error('Booking hold expired.');

  const payload = {
    id: c.eventId,
    summary: 'APPOINTMENT WAITING PAYMENT - ' + person.name,
    description: 'SGC: ' + b.name +
      '\nStudent: ' + person.name +
      '\nBooking: ' + b.id +
      '\nPayment hold expires: ' + b.hold_expires_at +
      '\n' + (b.notes || ''),
    status: 'tentative',
    transparency: 'transparent',
    start: { dateTime: b.starts_at, timeZone: 'Africa/Johannesburg' },
    end: { dateTime: b.ends_at, timeZone: 'Africa/Johannesburg' },
    extendedProperties: {
      private: { sgc_booking_id: b.id, sgc_phase: 'hold' }
    },
    conferenceData: { createRequest: { requestId: b.id } },
    reminders: { useDefault: false }
  };

  const result = await fetch(
    c.base + '?sendUpdates=none&conferenceDataVersion=1',
    {
      method: 'POST',
      headers: c.headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000)
    }
  );

  if (result.status === 409) {
    const event = await remote(c.url, { headers: c.headers });
    if (event.extendedProperties?.private?.sgc_booking_id !== b.id ||
        event.status === 'cancelled')
      throw Error('Waiting appointment conflict.');
  } else if (!result.ok) {
    throw Error('Waiting appointment creation failed ' + result.status);
  }

  const latest = await rpc('get', { id: b.id });
  if (latest.status !== 'hold' ||
      Date.parse(latest.hold_expires_at) <= Date.now()) {
    await removeWaitingEvent(latest);
    throw Error('Booking hold expired or was cancelled.');
  }

  await safeNotify(latest, 'hold');
  return await rpc('get', { id: b.id });
}

async function notifyBooking(b: any, phase: string): Promise<boolean> {
  const column = phase === 'hold'
    ? 'hold_email_sent_at' : 'confirmed_email_sent_at';

  if (b[column]) return true;

  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw Error('Booking email needs RESEND_API_KEY in Supabase secrets.');

  const c = await calendarContext(b);
  const person = await customerName(b);
  const event = await remote(c.url, { headers: c.headers });

  if (event.status === 'cancelled' ||
      event.extendedProperties?.private?.sgc_booking_id !== b.id)
    return false;

  const meeting = event.hangoutLink ||
    event.conferenceData?.entryPoints?.find(
      (x: any) => x.entryPointType === 'video'
    )?.uri;

  if (!meeting) {
    if (event.conferenceData?.createRequest?.status?.statusCode === 'failure')
      throw Error('Google Meet creation failed. Check the connected calendar supports Meet.');
    throw Error('Google Meet link is still being prepared. The background job will retry.');
  }

  const url = new URL(meeting);
  if (url.protocol !== 'https:' || url.hostname !== 'meet.google.com')
    throw Error('Unexpected Google Meet link.');

  const current = await rpc('get', { id: b.id });
  if (phase === 'hold' &&
      (current.status !== 'hold' ||
       Date.parse(current.hold_expires_at) <= Date.now())) return false;
  if (phase === 'confirmed' && current.status !== 'confirmed') return false;

  const when = new Date(b.starts_at).toLocaleString('en-ZA', {
    timeZone: 'Africa/Johannesburg'
  });
  const duration = Math.round(
    (Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60000
  );
  const waiting = phase === 'hold';
  const subject = (waiting
    ? 'Appointment waiting payment' : 'Appointment confirmed') +
    ' - ' + person.name;

  const text = [
    'SGC Network',
    subject,
    'Service: ' + b.name,
    'Student: ' + person.name,
    'Date and time: ' + when + ' (South African time)',
    'Duration: ' + duration + ' minutes',
    'Session price: R' + Number(b.amount_zar).toFixed(2),
    'Google Meet: ' + url.href,
    waiting
      ? 'This is an unpaid provisional booking. Complete payment before ' +
        new Date(b.hold_expires_at).toLocaleString('en-ZA', {
          timeZone: 'Africa/Johannesburg'
        }) +
        ' (South African time). Otherwise the hold expires and the appointment is removed.'
      : 'Your booking has been confirmed after payment verification.',
    'Booking reference: ' + b.id
  ].join('\n\n');

  const recipients = [...new Set(
    [person.customer.email, OWNER].filter(Boolean)
  )];

  for (const email of recipients) {
    await remote('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'sgc-booking/' + b.id + '/' + phase +
          '/' + await digest(email.toLowerCase())
      },
      body: JSON.stringify({
        from: Deno.env.get('BOOKING_FROM_EMAIL') ||
          'SGC Network <noreply@sgcnetwork.co.za>',
        to: [email],
        subject,
        text
      })
    });
  }

  check(await service.from('sgc_bookings').update({
    [column]: new Date().toISOString(),
    meeting_url: url.href,
    last_error: null
  }).eq('id', b.id));

  return true;
}

async function safeNotify(b: any, phase: string): Promise<void> {
  try {
    await notifyBooking(b, phase);
  } catch (e) {
    check(await service.from('sgc_bookings').update({
      last_error: e instanceof Error ? e.message : String(e)
    }).eq('id', b.id));
  }
}

async function maintenance(): Promise<any> {
  check(await service.from('sgc_bookings')
    .update({ status: 'expired' })
    .eq('status', 'hold')
    .lte('hold_expires_at', new Date().toISOString()));

  const rows = check(await service.from('sgc_bookings')
    .select('*')
    .eq('hold_calendar_cleanup', true)
    .in('status', ['expired', 'cancelled', 'payment_review'])
    .order('hold_expires_at')
    .limit(20));

  const results = await Promise.all(rows.map(async (b: any) => {
    try {
      await removeWaitingEvent(b);
      return { id: b.id, removed: true };
    } catch (e) {
      check(await service.from('sgc_bookings').update({
        last_error: e instanceof Error ? e.message : String(e)
      }).eq('id', b.id));
      return { id: b.id, removed: false };
    }
  }));

  const pending = check(await service.from('sgc_bookings')
    .select('*')
    .or('and(status.eq.hold,hold_email_sent_at.is.null),and(status.eq.confirmed,confirmed_email_sent_at.is.null)')
    .order('starts_at')
    .limit(20));

  await Promise.all(pending.map((b: any) =>
    safeNotify(b, b.status === 'hold' ? 'hold' : 'confirmed')
  ));

  return {
    processed: results.length,
    results,
    email_attempts: pending.length
  };
}

async function syncBooking(id: string): Promise<any> {
  const b = await rpc('claim', { id });
  if (!b) return await rpc('get', { id });

  const eventId = 'sgc' + b.id.replaceAll('-', '');

  try {
    const host = check(await service.from('sgc_calendar_hosts')
      .select('*').eq('id', b.host_id).single());
    const token = await accessToken(host);

    const eventURL =
      'https://www.googleapis.com/calendar/v3/calendars/' +
      encodeURIComponent(b.calendar_id) + '/events/' + eventId;

    const headers = {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    };

    let event: any = null;
    const found = await fetch(eventURL, {
      headers,
      signal: AbortSignal.timeout(20000)
    });

    if (found.ok) {
      event = await found.json();
      if (event.status === 'cancelled') {
        return await rpc('finish', {
          id,
          lease_id: b.lease_id,
          status: b.status === 'cancel_pending' ? 'cancelled' : 'payment_review',
          error: 'Calendar event was cancelled outside SGC.'
        });
      }
      if (event.extendedProperties?.private?.sgc_booking_id !== b.id)
        throw Error('Calendar event identity mismatch.');
    } else if (found.status !== 404 && found.status !== 410) {
      throw Error('Calendar lookup failed ' + found.status);
    }

    if (b.status === 'cancel_pending') {
      if (event) {
        const removed = await fetch(eventURL + '?sendUpdates=all', {
          method: 'DELETE',
          headers,
          signal: AbortSignal.timeout(20000)
        });
        if (!removed.ok && removed.status !== 404 && removed.status !== 410)
          throw Error('Calendar cancellation failed ' + removed.status);
      }

      return await rpc('finish', {
        id,
        lease_id: b.lease_id,
        status: 'cancelled',
        event_id: eventId
      });
    }

    if (event?.extendedProperties?.private?.sgc_phase === 'hold') {
      const busy = await busyGoogle(
        host, Date.parse(b.blocked_from), Date.parse(b.blocked_until)
      );

      if (overlaps(
        Date.parse(b.blocked_from),
        Date.parse(b.blocked_until),
        busy
      )) {
        await removeWaitingEvent(b);
        return await rpc('finish', {
          id,
          lease_id: b.lease_id,
          status: 'payment_review',
          error: 'Calendar became busy. Admin must arrange a new time or refund.'
        });
      }

      const person = await customerName(b);
      event = await remote(
        eventURL + '?sendUpdates=all&conferenceDataVersion=1',
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            summary: 'SGC: ' + b.name + ' - ' + person.name,
            status: 'confirmed',
            transparency: 'opaque',
            description: 'Paid booking ' + b.id + '\n' + (b.notes || ''),
            attendees: [{ email: person.customer.email }],
            extendedProperties: {
              private: { sgc_booking_id: b.id, sgc_phase: 'confirmed' }
            },
            conferenceData: { createRequest: { requestId: b.id } },
            reminders: { useDefault: true }
          })
        }
      );
    }

    if (!event) {
      const busy = await busyGoogle(
        host, Date.parse(b.blocked_from), Date.parse(b.blocked_until)
      );

      if (overlaps(
        Date.parse(b.blocked_from),
        Date.parse(b.blocked_until),
        busy
      )) {
        return await rpc('finish', {
          id,
          lease_id: b.lease_id,
          status: 'payment_review',
          error: 'Calendar became busy. Admin must arrange a new time or refund.'
        });
      }

      const customer = check(
        await service.auth.admin.getUserById(b.user_id)
      ).user;

      const payload = {
        id: eventId,
        summary: 'SGC: ' + b.name,
        description: 'Booking ' + b.id + '\n' + b.notes,
        start: { dateTime: b.starts_at, timeZone: 'Africa/Johannesburg' },
        end: { dateTime: b.ends_at, timeZone: 'Africa/Johannesburg' },
        attendees: [{ email: customer.email }],
        extendedProperties: {
          private: { sgc_booking_id: b.id }
        },
        conferenceData: { createRequest: { requestId: b.id } }
      };

      const created = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/' +
        encodeURIComponent(b.calendar_id) +
        '/events?sendUpdates=all&conferenceDataVersion=1',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(25000)
        }
      );

      if (created.status === 409) {
        event = await remote(eventURL, { headers });
      } else {
        if (!created.ok)
          throw Error('Calendar creation failed ' + created.status);
        event = await created.json();
      }
    }

    if (event.extendedProperties?.private?.sgc_booking_id !== b.id ||
        Date.parse(event.start?.dateTime) !== Date.parse(b.starts_at) ||
        Date.parse(event.end?.dateTime) !== Date.parse(b.ends_at))
      throw Error('Calendar event does not match the booking.');

    const meeting = event.hangoutLink ||
      event.conferenceData?.entryPoints?.find(
        (x: any) => x.entryPointType === 'video'
      )?.uri || '';

    const confirmed = await rpc('finish', {
      id,
      lease_id: b.lease_id,
      status: 'confirmed',
      event_id: eventId,
      meeting_url: meeting
    });

    await safeNotify(confirmed, 'confirmed');
    return await rpc('get', { id });

  } catch (e) {
    await rpc('release', {
      id,
      lease_id: b.lease_id,
      error: e instanceof Error ? e.message : String(e)
    });
    return await rpc('get', { id });
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: CORS_HEADERS });

  try {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.searchParams.get('oauth') === 'callback') {
      const state = url.searchParams.get('state');
      if (!state) throw Error('Missing calendar state.');

      const rows = check(await service.from('sgc_calendar_oauth_states')
        .delete()
        .eq('state_hash', await digest(state))
        .gt('expires_at', new Date().toISOString())
        .select('*'));

      if (rows.length !== 1)
        throw Error('Calendar connection expired. Start again in admin.');

      if (url.searchParams.get('error'))
        throw Error('Google connection was declined.');

      const tokens = await remote('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: url.searchParams.get('code') || '',
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          redirect_uri: CALLBACK,
          grant_type: 'authorization_code'
        })
      });

      const identity = await remote(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: 'Bearer ' + tokens.access_token } }
      );

      const host = check(await service.from('sgc_calendar_hosts')
        .select('*').eq('id', rows[0].host_id).single());

      const expectedEmail = (host.owner_email || host.calendar_id).toLowerCase();
      if (!identity.verified_email ||
          identity.email?.toLowerCase() !== expectedEmail)
        throw Error('Choose the Google account ' + expectedEmail + '.');

      const refresh = tokens.refresh_token || host.refresh_token;
      if (!refresh)
        throw Error('No offline calendar permission. Reconnect with consent.');

      check(await service.from('sgc_calendar_hosts').update({
        refresh_token: refresh,
        owner_email: identity.email,
        connected_at: new Date().toISOString()
      }).eq('id', host.id));

      return new Response(null, {
        status: 302,
        headers: {
          Location: SITE + '/sgc-academy-extra/admin.html?calendar=connected',
          'Cache-Control': 'no-store'
        }
      });
    }

    if (req.method !== 'POST')
      return reply({ error: 'POST required' }, 405);

    const body = await req.json();

    if (body.action === 'maintenance') {
      const secret = check(await service.from('sgc_booking_worker_config')
        .select('token').eq('id', 1).single()).token;

      if (!await sameSecret(
        req.headers.get('x-sgc-maintenance-secret'), secret
      )) return reply({ error: 'Not authorised' }, 401);

      return reply(await maintenance());
    }

    if (body.action === 'verified_payment') {
      if (!await sameSecret(
        req.headers.get('x-sgc-booking-secret'),
        Deno.env.get('BOOKING_WEBHOOK_SECRET')
      )) return reply({ error: 'Not authorised' }, 401);

      const paid = await rpc('paid', {
        id: body.booking_id,
        amount_zar: body.amount_zar,
        currency: body.currency,
        user_id: body.user_id,
        product_id: body.product_id,
        reference: body.transaction_id
      });

      const b = paid.status === 'paid_pending_calendar'
        ? await syncBooking(paid.id) : paid;

      return reply(
        { id: b.id, status: b.status },
        b.status === 'confirmed' ? 200 : 202
      );
    }

    const authorization = req.headers.get('authorization') || '';

    const client = createClient(
      URL_ROOT,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false }
      }
    );

    const auth = check(await client.auth.getUser(
      authorization.replace(/^Bearer\s+/i, '')
    ));

    const user = auth.user;
    if (!user?.email_confirmed_at)
      return reply({ error: 'Confirmed sign-in required' }, 401);

    const admin = check(await client.rpc('sgc_extra_is_admin')) === true;

    if (body.action === 'add_calendar') {
      if (!admin) throw Error('Admin access required');
      const email = String(body.email || '').trim().toLowerCase();
      const label = String(body.label || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
        throw Error('Enter a valid Google account email.');
      if (!label || label.length > 100) throw Error('Enter a calendar label (up to 100 characters).');
      const existing = check(await service.from('sgc_calendar_hosts')
        .select('id').eq('calendar_id', email).maybeSingle());
      if (existing) return reply({id: existing.id});
      const added = check(await service.from('sgc_calendar_hosts')
        .insert({label,calendar_id:email,owner_email:email}).select('id').single());
      return reply({id:added.id});
    }

    if (body.action === 'connect_calendar') {
      if (!admin) throw Error('Admin access required');

      if (!Deno.env.get('GOOGLE_CLIENT_ID') ||
          !Deno.env.get('GOOGLE_CLIENT_SECRET'))
        throw Error('Set the Google OAuth secrets first.');

      const host = check(await service.from('sgc_calendar_hosts')
        .select('id,owner_email,calendar_id').eq('id', body.host_id).single());

      const state = crypto.randomUUID() + crypto.randomUUID();

      check(await service.from('sgc_calendar_oauth_states').insert({
        state_hash: await digest(state),
        host_id: host.id,
        actor: user.id,
        expires_at: new Date(Date.now() + 10 * ms).toISOString()
      }));

      // Calendar and Google Drive permissions.
      // drive.readonly allows reading existing recording files.
      // drive.file allows managing files created/opened through the app.
      const q = new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
        redirect_uri: CALLBACK,
        response_type: 'code',
        scope: [
          'openid',
          'email',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.freebusy',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.readonly'
        ].join(' '),
        access_type: 'offline',
        prompt: 'consent select_account',
        include_granted_scopes: 'true',
        state,
        login_hint: host.owner_email || host.calendar_id
      });

      return reply({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?' + q.toString()
      });
    }

    if (body.action === 'availability' || body.action === 'hold') {
      const context = await rpc('context', {
        product_id: body.product_id
      });

      const date = body.action === 'hold'
        ? new Date(Date.parse(body.starts_at) + 120 * ms)
            .toISOString().slice(0, 10)
        : body.date;

      const slots = await available(context, date);

      if (body.action === 'availability')
        return reply({
          slots,
          duration_minutes: context.settings.duration_minutes,
          amount_zar: Math.round(
            Number(context.product.price_zar) * 100
          ) / 100
        });

      if (!slots.some(
        (s: any) => s.start === new Date(body.starts_at).toISOString()
      )) throw Error('That slot is no longer available.');

      const held = await rpc('hold', {
        product_id: body.product_id,
        user_id: user.id,
        starts_at: body.starts_at,
        notes: body.notes,
        settings_updated_at: context.settings.updated_at
      });

      try {
        return reply(await createWaitingEvent(held));
      } catch (e) {
        await rpc('cancel', { id: held.id });
        check(await service.from('sgc_bookings').update({
          last_error: e instanceof Error ? e.message : String(e)
        }).eq('id', held.id));
        throw e;
      }
    }

    const booking = await rpc('get', { id: body.booking_id });
    if (!admin && booking.user_id !== user.id)
      throw Error('Booking access denied.');

    if (body.action === 'checkout') {
      if (booking.status !== 'hold' ||
          Date.parse(booking.hold_expires_at) <= Date.now())
        throw Error('Booking hold expired. Choose a new slot.');

      const product = check(await service.from('sgc_products')
        .select('*')
        .eq('id', booking.product_id)
        .eq('active', true)
        .single());

      const method = check(await service.from('sgc_payment_methods')
        .select('*')
        .eq('id', body.method_id)
        .eq('active', true)
        .single());

      if (!(product.payment_method_ids || []).includes(method.id))
        throw Error('Payment method is not assigned.');

      if (method.provider === 'eft')
        return reply({
          amount_zar: booking.amount_zar,
          reference: 'SGC-' + booking.id,
          instructions: method.instructions,
          hold_expires_at: booking.hold_expires_at
        });

      const name = Deno.env.get('BOOKING_CHECKOUT_FUNCTION');
      if (!name || !/^[a-z0-9-]+$/.test(name))
        throw Error('Booking card checkout is not configured. Use EFT or ask SGC for assistance.');

      const payment = await remote(
        URL_ROOT + '/functions/v1/' + name,
        {
          method: 'POST',
          headers: {
            Authorization: authorization,
            apikey: Deno.env.get('SUPABASE_ANON_KEY')!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId: booking.id,
            amount: Number(booking.amount_zar),
            payerName: user.user_metadata?.full_name || 'SGC Customer',
            email: user.email,
            userId: user.id,
            product: product.provider_code,
            productName: booking.name
          })
        }
      );

      const destination = new URL(payment.checkoutUrl);
      const allowed = (Deno.env.get('STITCH_CHECKOUT_HOSTS') || '')
        .split(',').map(x => x.trim());

      if (!payment.success ||
          destination.protocol !== 'https:' ||
          !allowed.includes(destination.hostname))
        throw Error('Checkout returned an unverified payment link.');

      return reply({ checkoutUrl: destination.href });
    }

    if (body.action === 'cancel') {
      const cancelled = await rpc('cancel', { id: booking.id });
      const b = cancelled.status === 'cancel_pending'
        ? await syncBooking(booking.id) : cancelled;

      if (b.status === 'cancelled') {
        try {
          await removeWaitingEvent(b);
        } catch (e) {
          check(await service.from('sgc_bookings').update({
            last_error: e instanceof Error ? e.message : String(e)
          }).eq('id', b.id));
        }
      }

      return reply({
        id: b.id,
        status: b.status,
        message: 'Cancellation does not issue a refund. SGC must handle any paid refund separately.'
      });
    }

    if (body.action === 'admin_confirm') {
      if (!admin) throw Error('Admin access required');
      if (!body.note?.trim())
        throw Error('Add a payment verification note.');

      const paid = await rpc('paid', {
        id: booking.id,
        amount_zar: booking.amount_zar,
        currency: 'ZAR',
        user_id: booking.user_id,
        product_id: booking.product_id,
        reference: 'admin:' + booking.id,
        manual: true,
        admin_note: user.id + ': ' + body.note
      });

      return reply(paid.status === 'paid_pending_calendar'
        ? await syncBooking(booking.id) : paid);
    }

    if (body.action === 'retry') {
      if (!admin) throw Error('Admin access required');
      return reply(await syncBooking(booking.id));
    }

    return reply({ error: 'Unknown action' }, 400);

  } catch (e) {
    return reply({
      error: e instanceof Error ? e.message : 'Unable to complete request'
    }, 400);
  }
});
