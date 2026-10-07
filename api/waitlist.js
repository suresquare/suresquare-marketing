// POST /api/waitlist
// Saves a waitlist / early-access sign-up to the Supabase `leads` table, then (optionally)
// emails a notification to the sales inbox through Postmark.
//
// Environment variables (set in Vercel, never committed):
//   SUPABASE_URL               required  e.g. https://abcd1234.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  required  server-only secret key (sb_secret_… or legacy service_role); bypasses RLS
//   POSTMARK_SERVER_TOKEN      optional  enables the notification email
//   NOTIFY_TO                  optional  default sales@suresquare.bid
//   NOTIFY_FROM                optional  default "SureSquare Website <hello@suresquare.bid>"

const INTERESTS = { takeoffs: 'Takeoff service', crm: 'SureSquare CRM' };
const SOURCES = ['DuroLast', 'Elevate', 'Facebook', 'Google', 'Other'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'object' && req.body ? req.body : {};

  // Honeypot: real visitors never see or fill this field.
  if (body.website) {
    return res.status(200).json({ ok: true });
  }

  const fullName = clip(body.full_name, 120);
  const email = clip(body.email, 200).toLowerCase();
  const company = clip(body.company, 160);
  const source = SOURCES.includes(body.source) ? body.source : null;
  const interests = Array.isArray(body.interests)
    ? [...new Set(body.interests.filter((i) => i in INTERESTS))]
    : [];

  if (!fullName) return res.status(400).json({ error: 'Add your name so we know who to contact.' });
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Enter a valid email address, like name@company.com.' });
  if (!interests.length) return res.status(400).json({ error: 'Choose at least one thing you are interested in.' });

  // Strip whitespace: a key pasted into Vercel with a line break in it is an invalid header value.
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\s+/g, '');
  if (!supabaseUrl || !serviceKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
    return res.status(500).json({ error: 'Sign-ups are not configured on the server yet. Please email sales@suresquare.bid.' });
  }

  const lead = {
    full_name: fullName,
    email,
    company: company || null,
    interests,
    source,
    user_agent: clip(req.headers['user-agent'], 300) || null,
  };

  let saveError = null;
  try {
    // Upsert on email so a repeat sign-up updates the existing row instead of failing.
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/leads?on_conflict=email`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys go in apikey only.
        ...(serviceKey.startsWith('eyJ') ? { Authorization: `Bearer ${serviceKey}` } : {}),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(lead),
    });
    if (!response.ok) saveError = `Supabase ${response.status}: ${clip(await response.text(), 500)}`;
  } catch (err) {
    saveError = `Supabase request error: ${err && err.message ? err.message : err}`;
  }

  if (saveError) {
    // Log the lead itself so it can be recovered from the Vercel logs even if the email below also fails.
    console.error('Supabase insert failed:', saveError, JSON.stringify(lead));
  }

  // The notification email doubles as the backup copy of the lead when the database save fails,
  // so a Supabase outage does not lose the sign-up.
  let emailed = false;
  try {
    emailed = await notify(lead, saveError);
  } catch (err) {
    console.error('Notification email failed:', err);
  }

  if (saveError && !emailed) {
    return res.status(502).json({ error: 'We could not save your sign-up. Please try again, or email sales@suresquare.bid.' });
  }

  return res.status(200).json({ ok: true });
};

// Returns true when the email was sent, false when Postmark is not configured.
async function notify(lead, saveError) {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) return false;

  const to = process.env.NOTIFY_TO || 'sales@suresquare.bid';
  const from = process.env.NOTIFY_FROM || 'SureSquare Website <hello@suresquare.bid>';
  const interestText = lead.interests.map((i) => INTERESTS[i]).join(', ');
  const rows = [
    ['Name', lead.full_name],
    ['Email', lead.email],
    ['Company', lead.company || '—'],
    ['Interested in', interestText],
    ['Heard about us', lead.source || '—'],
  ];
  if (saveError) rows.push(['NOT SAVED', `This sign-up did not save to Supabase (${saveError}). Add it by hand.`]);

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      ReplyTo: lead.email,
      Subject: `${saveError ? '[NOT SAVED] ' : ''}New sign-up: ${lead.full_name} (${interestText})`,
      TextBody: ['New sign-up from suresquare.bid', '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n'),
      HtmlBody: `<table style="font-family:Arial,sans-serif;font-size:14px;color:#17122e">${rows
        .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5d5873">${k}</td><td>${escapeHtml(v)}</td></tr>`)
        .join('')}</table>`,
      MessageStream: 'outbound',
    }),
  });
  if (!response.ok) throw new Error(`Postmark ${response.status}: ${await response.text()}`);
  return true;
}

function clip(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
