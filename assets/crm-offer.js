// SureSquare CRM early-access offer popup.
// Shows once per visitor (localStorage), after 15 seconds on the page or half a page of scrolling,
// whichever comes first. Add ?offer=crm to any page that loads this script to open it straight away.
// Sign-ups go to /api/waitlist with the CRM interest, the same as the /waitlist form.
(function () {
  var KEY = 'ss_crm_offer_v1';
  var forced = /[?&]offer=crm\b/.test(location.search);
  if (!window.HTMLDialogElement) return;
  try { if (!forced && localStorage.getItem(KEY)) return; } catch (e) { /* storage blocked: still show once per page view */ }

  var html =
    '<dialog class="offer" id="crm-offer" aria-labelledby="crm-offer-title">' +
      '<button class="offer-close" type="button" aria-label="Close" data-close>&times;</button>' +
      '<p class="offer-tag">SureSquare CRM · Early access</p>' +
      '<h2 id="crm-offer-title">50% off SureSquare CRM. For life.</h2>' +
      '<p class="offer-lede">We\'re opening the CRM to a small group of roofing companies first.</p>' +
      '<ul class="offer-terms"><li>First 20 companies only</li><li>At least 3 users on the CRM</li></ul>' +
      '<form class="offer-form" novalidate>' +
        '<div class="hp-field" aria-hidden="true"><label for="offer-website">Website</label><input type="text" id="offer-website" name="website" tabindex="-1" autocomplete="off"></div>' +
        '<div class="field"><label for="offer-name">Full name</label><input id="offer-name" name="full_name" autocomplete="name" required maxlength="120"></div>' +
        '<div class="field"><label for="offer-email">Work email</label><input id="offer-email" name="email" type="email" autocomplete="email" required maxlength="200"></div>' +
        '<div class="field"><label for="offer-company">Company</label><input id="offer-company" name="company" autocomplete="organization" required maxlength="160"></div>' +
        '<label class="opt"><input type="checkbox" name="three_users" id="offer-users"><span>Our company will have 3 or more people using the CRM.</span></label>' +
        '<button class="btn btn-primary" type="submit">Claim my spot</button>' +
        '<p class="form-msg err" role="alert" hidden></p>' +
      '</form>' +
      '<p class="form-msg ok" role="status" hidden>You\'re on the list. We\'ll email you to confirm your early-access spot.</p>' +
      '<p class="offer-fine">No payment now. We\'ll reach out before the CRM opens to your company.</p>' +
    '</dialog>';

  var shown = false;
  function remember() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }

  function open() {
    if (shown) return;
    shown = true;
    window.removeEventListener('scroll', onScroll);
    clearTimeout(timer);
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var dlg = wrap.firstChild;
    document.body.appendChild(dlg);
    wire(dlg);
    dlg.showModal();
    remember();
  }

  function wire(dlg) {
    var form = dlg.querySelector('form'), btn = form.querySelector('button[type=submit]'),
        err = form.querySelector('.err'), ok = dlg.querySelector('.ok'), fine = dlg.querySelector('.offer-fine');
    dlg.querySelector('[data-close]').addEventListener('click', function () { dlg.close(); });
    // Click on the backdrop closes it.
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { dlg.remove(); });

    function fail(msg, field) {
      err.textContent = msg; err.hidden = false;
      if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    }
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); err.hidden = true;
      form.querySelectorAll('[aria-invalid]').forEach(function (f) { f.removeAttribute('aria-invalid'); });
      var name = form.full_name, email = form.email, company = form.company;
      if (!name.value.trim()) return fail('Add your name so we know who to contact.', name);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return fail('Enter a valid email address, like name@company.com.', email);
      if (!company.value.trim()) return fail('Add your company name. The offer is per company.', company);
      if (!form.three_users.checked) return fail('The offer is for companies with at least 3 users. Tick the box if that\'s you.', form.three_users);
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        var res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: name.value.trim(), email: email.value.trim(), company: company.value.trim(), interests: ['crm'], offer: 'crm-50-for-life', three_plus_users: true, website: form.website.value })
        });
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(out.error || 'We could not save your sign-up. Please try again.');
        if (window.ssTrackLead) window.ssTrackLead(['crm']);
        form.hidden = true; fine.hidden = true; ok.hidden = false;
        ok.setAttribute('tabindex', '-1'); ok.focus();
        remember();
      } catch (ex) {
        fail(ex.message || 'We could not save your sign-up. Please try again, or email sales@suresquare.bid.');
        btn.disabled = false; btn.textContent = 'Claim my spot';
      }
    });
  }

  function onScroll() {
    var doc = document.documentElement;
    if ((window.scrollY + window.innerHeight) / doc.scrollHeight >= 0.5) open();
  }

  if (forced) { open(); return; }
  var timer = setTimeout(open, 15000);
  window.addEventListener('scroll', onScroll, { passive: true });
})();
