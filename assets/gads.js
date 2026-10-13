/* Google Ads conversion events. The base Google tag (AW-18492651168) is in each page's <head>.
   Paste each conversion action's label from Google Ads > Goals > Conversions > (action) > Tag setup
   > "Install the tag yourself" > event snippet: send_to 'AW-18492651168/<label>'. */
(function () {
  var AW = 'AW-18492651168';
  var LABELS = {
    start_takeoff: '', // click on any "Start a takeoff" link to app.suresquare.app
    lead: ''           // waitlist form saved
  };

  function track(name, label, params) {
    if (typeof window.gtag !== 'function') return;
    params = params || {};
    params.transport_type = 'beacon';
    window.gtag('event', name, params);
    if (label) {
      var conv = { send_to: AW + '/' + label, transport_type: 'beacon' };
      if (params.value != null) { conv.value = params.value; conv.currency = params.currency || 'USD'; }
      window.gtag('event', 'conversion', conv);
    }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="app.suresquare.app"]');
    if (!a) return;
    track('start_takeoff_click', LABELS.start_takeoff, { link_url: a.href, page_path: location.pathname });
  }, true);

  window.ssTrackLead = function (interests) {
    track('generate_lead', LABELS.lead, { lead_interests: (interests || []).join(',') });
  };
})();
