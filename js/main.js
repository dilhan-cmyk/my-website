// Roshan's 70th Birthday - main.js
// Depends on js/config.js being loaded first (window.CONFIG).
(function () {
  'use strict';

  /* ===========================================================
     Tiny API layer (demo mode vs real fetch)
     =========================================================== */

  function uuidv4() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // In-memory demo store, seeded fresh each page load.
  var demoAttendees = [
    { name: 'Tamara', guestCount: 2 },
    { name: 'Peter', guestCount: 1 },
  ];

  function isDemoMode() {
    return !CONFIG.APPS_SCRIPT_URL;
  }

  function demoDelay(fn, ms) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(fn());
      }, ms || 250);
    });
  }

  function apiGet(params) {
    if (isDemoMode()) {
      var action = params && params.action;
      if (action === 'attendees') {
        return demoDelay(function () {
          var list = demoAttendees.slice();
          var stored = getStoredRsvp();
          if (stored && stored.name) {
            var firstName = stored.name.trim().split(/\s+/)[0];
            list = [{ name: firstName, guestCount: stored.guestCount }].concat(list);
          }
          return { ok: true, attendees: list };
        }, 300);
      }
      return demoDelay(function () {
        return { ok: false, error: 'unknown_action' };
      }, 200);
    }

    var url = CONFIG.APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
    return fetch(url, { method: 'GET' })
      .then(function (res) { return res.json(); })
      .catch(function () {
        return { ok: false, error: 'network_error' };
      });
  }

  function demoUploadPhoto(body) {
    var stored = getStoredRsvp();
    var current = (stored && stored.photosUploaded) || 0;
    if (current >= CONFIG.MAX_PHOTOS_PER_PERSON) {
      return { ok: false, error: 'photo_limit' };
    }
    var remaining = CONFIG.MAX_PHOTOS_PER_PERSON - (current + 1);
    return { ok: true, url: 'https://example.com/demo-photos/' + encodeURIComponent(body.filename || 'photo.jpg'), remaining: remaining };
  }

  function apiPost(body) {
    if (isDemoMode()) {
      var action = body && body.action;
      if (action === 'rsvp') {
        return demoDelay(function () {
          if (body.website) {
            // Honeypot tripped: silently succeed without storing anything real.
            return { ok: true, id: 'fake' };
          }
          return { ok: true, id: uuidv4() };
        }, 350);
      }
      if (action === 'editRsvp') {
        return demoDelay(function () {
          return { ok: true };
        }, 350);
      }
      if (action === 'uploadPhoto') {
        return demoDelay(function () {
          return demoUploadPhoto(body);
        }, 400);
      }
      return demoDelay(function () {
        return { ok: false, error: 'unknown_action' };
      }, 200);
    }

    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    })
      .then(function (res) { return res.json(); })
      .catch(function () {
        return { ok: false, error: 'network_error' };
      });
  }

  /* ===========================================================
     localStorage helpers
     =========================================================== */

  function getStoredRsvp() {
    try {
      var raw = window.localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
      return null;
    } catch (e) {
      return null;
    }
  }

  function setStoredRsvp(record) {
    try {
      window.localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(record));
    } catch (e) {
      /* localStorage unavailable, ignore */
    }
  }

  /* ===========================================================
     Date / countdown helpers
     =========================================================== */

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatCountdown(msRemaining) {
    var totalSeconds = Math.floor(msRemaining / 1000);
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    return days + 'd : ' + pad2(hours) + 'h : ' + pad2(minutes) + 'm : ' + pad2(seconds) + 's';
  }

  function startCountdown(el, targetIso, onDone, doneText) {
    var target = new Date(targetIso).getTime();

    function tick() {
      var now = Date.now();
      var remaining = target - now;
      if (remaining <= 0) {
        el.textContent = doneText;
        if (onDone) onDone();
        return false;
      }
      el.textContent = formatCountdown(remaining);
      return true;
    }

    var alive = tick();
    if (!alive) return null;
    var intervalId = setInterval(function () {
      var stillAlive = tick();
      if (!stillAlive) {
        clearInterval(intervalId);
      }
    }, 1000);
    return intervalId;
  }

  function isPastDeadline() {
    return Date.now() > new Date(CONFIG.RSVP_DEADLINE).getTime();
  }

  /* ===========================================================
     Hero background image loading (graceful fallback)
     =========================================================== */

  function initHeroImage() {
    var heroMedia = document.getElementById('hero-media');
    if (!heroMedia) return;
    var img = new Image();
    img.onload = function () {
      heroMedia.style.setProperty('--hero-photo-url', 'url("assets/hero.jpg")');
      heroMedia.classList.remove('hero-media--fallback');
      heroMedia.classList.add('hero-media--photo');
    };
    img.onerror = function () {
      // Expected until the host drops in the real photo; keep the gradient
      // fallback and avoid any noisy console output.
    };
    img.src = 'assets/hero.jpg';
  }

  /* ===========================================================
     Countdown init
     =========================================================== */

  function initCountdowns() {
    var heroEl = document.getElementById('hero-countdown');
    if (heroEl) {
      startCountdown(heroEl, CONFIG.EVENT_START, null, "It's today! 🎉");
    }

    var rsvpEl = document.getElementById('rsvp-countdown');
    if (rsvpEl) {
      var label = document.createElement('p');
      label.className = 'countdown-label';
      label.textContent = 'RSVP deadline';
      var valueEl = document.createElement('span');
      rsvpEl.innerHTML = '';
      rsvpEl.appendChild(label);
      rsvpEl.appendChild(valueEl);
      startCountdown(valueEl, CONFIG.RSVP_DEADLINE, null, 'RSVPs have closed');
    }
  }

  /* ===========================================================
     Map embed (inject src from config, keeps HTML free of inline config)
     =========================================================== */

  function initMap() {
    var iframe = document.querySelector('.map-embed');
    if (iframe) {
      iframe.src = CONFIG.MAP_EMBED_URL;
    }
  }

  /* ===========================================================
     Sticky banner + RSVP button state
     =========================================================== */

  function refreshBannerAndButton() {
    var stored = getStoredRsvp();
    var banner = document.getElementById('sticky-banner');
    var body = document.body;
    var rsvpButton = document.getElementById('rsvp-button');
    var pastDeadline = isPastDeadline();

    if (stored) {
      banner.hidden = false;
      body.classList.add('has-banner');
    } else {
      banner.hidden = true;
      body.classList.remove('has-banner');
    }

    if (!rsvpButton) return;

    rsvpButton.disabled = false;
    if (stored && !pastDeadline) {
      rsvpButton.textContent = 'Edit RSVP';
      rsvpButton.dataset.mode = 'edit';
    } else if (stored && pastDeadline) {
      rsvpButton.textContent = 'View My RSVP';
      rsvpButton.dataset.mode = 'view';
    } else if (!stored && pastDeadline) {
      rsvpButton.textContent = 'RSVPs Are Now Closed';
      rsvpButton.dataset.mode = 'closed';
      rsvpButton.disabled = true;
    } else {
      rsvpButton.textContent = 'RSVP Now';
      rsvpButton.dataset.mode = 'rsvp';
    }
  }

  /* ===========================================================
     Attendee list
     =========================================================== */

  function loadAttendees() {
    var listEl = document.getElementById('attendee-list');
    if (!listEl) return;
    listEl.innerHTML = '<li class="attendee-loading">Loading guest list...</li>';

    apiGet({ action: 'attendees' }).then(function (res) {
      if (!res || !res.ok || !Array.isArray(res.attendees)) {
        listEl.innerHTML = '<li class="attendee-empty">Guest list will appear here soon.</li>';
        return;
      }
      if (res.attendees.length === 0) {
        listEl.innerHTML = '<li class="attendee-empty">Be the first to RSVP!</li>';
        return;
      }
      listEl.innerHTML = '';
      res.attendees.forEach(function (a) {
        var li = document.createElement('li');
        li.textContent = a.name + ' (' + a.guestCount + ')';
        listEl.appendChild(li);
      });
    }).catch(function () {
      listEl.innerHTML = '<li class="attendee-empty">Guest list will appear here soon.</li>';
    });
  }

  /* ===========================================================
     Modal: focus trap / open / close
     =========================================================== */

  var modalBackdrop = null;
  var modalEl = null;
  var modalBody = null;
  var modalCloseBtn = null;
  var lastFocusedBeforeModal = null;
  var lastSubmitTimestamp = 0;

  function getFocusableElements() {
    return Array.prototype.slice.call(
      modalEl.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function trapFocusHandler(e) {
    if (e.key !== 'Tab') return;
    var focusable = getFocusableElements();
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onModalKeydown(e) {
    if (e.key === 'Escape') {
      closeModal();
    } else {
      trapFocusHandler(e);
    }
  }

  function openModal(triggerEl) {
    lastFocusedBeforeModal = triggerEl || document.activeElement;
    modalBackdrop.hidden = false;
    document.addEventListener('keydown', onModalKeydown);
    var focusable = getFocusableElements();
    if (focusable.length) focusable[0].focus();
  }

  function closeModal() {
    modalBackdrop.hidden = true;
    document.removeEventListener('keydown', onModalKeydown);
    modalBody.innerHTML = '';
    if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
      lastFocusedBeforeModal.focus();
    }
  }

  /* ===========================================================
     RSVP form rendering
     =========================================================== */

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderRsvpForm(mode) {
    var stored = getStoredRsvp();
    var isEdit = mode === 'edit';
    var title = isEdit ? 'Edit your RSVP' : 'RSVP';

    modalBody.innerHTML =
      '<h2 id="rsvp-modal-title" class="modal-title">' + title + '</h2>' +
      '<form id="rsvp-form" novalidate>' +
      '  <div class="form-field">' +
      '    <label for="rsvp-name">Name</label>' +
      '    <input type="text" id="rsvp-name" name="name" required autocomplete="name">' +
      '  </div>' +
      '  <div class="form-field">' +
      '    <label for="rsvp-email">Email</label>' +
      '    <input type="email" id="rsvp-email" name="email" required autocomplete="email">' +
      '  </div>' +
      '  <div class="form-field">' +
      '    <label for="rsvp-guests">How many people are you RSVP-ing for, including yourself?</label>' +
      '    <input type="number" id="rsvp-guests" name="guestCount" min="1" step="1" value="1" required>' +
      '  </div>' +
      '  <div class="form-field hp-field" aria-hidden="true">' +
      '    <label for="rsvp-website">Website</label>' +
      '    <input type="text" id="rsvp-website" name="website" tabindex="-1" autocomplete="off">' +
      '  </div>' +
      '  <p id="rsvp-form-error" class="form-error" role="alert"></p>' +
      '  <div class="modal-actions">' +
      '    <button type="button" id="rsvp-cancel" class="btn btn-secondary">Cancel</button>' +
      '    <button type="submit" id="rsvp-confirm" class="btn btn-primary">Confirm</button>' +
      '  </div>' +
      '</form>';

    if (isEdit && stored) {
      modalBody.querySelector('#rsvp-name').value = stored.name || '';
      modalBody.querySelector('#rsvp-email').value = stored.email || '';
      modalBody.querySelector('#rsvp-guests').value = stored.guestCount || 1;
    }

    modalBody.querySelector('#rsvp-cancel').addEventListener('click', function () {
      closeModal();
    });

    modalBody.querySelector('#rsvp-form').addEventListener('submit', function (e) {
      e.preventDefault();
      handleRsvpSubmit(isEdit, stored);
    });
  }

  function handleRsvpSubmit(isEdit, stored) {
    var errorEl = document.getElementById('rsvp-form-error');
    var confirmBtn = document.getElementById('rsvp-confirm');
    var nameInput = document.getElementById('rsvp-name');
    var emailInput = document.getElementById('rsvp-email');
    var guestsInput = document.getElementById('rsvp-guests');
    var websiteInput = document.getElementById('rsvp-website');

    errorEl.textContent = '';

    var name = nameInput.value.trim();
    var email = emailInput.value.trim();
    var guestCount = parseInt(guestsInput.value, 10);

    if (!name) {
      errorEl.textContent = 'Please enter your name.';
      nameInput.focus();
      return;
    }
    if (!emailInput.checkValidity() || !email) {
      errorEl.textContent = 'Please enter a valid email address.';
      emailInput.focus();
      return;
    }
    if (!Number.isInteger(guestCount) || guestCount < 1) {
      errorEl.textContent = 'Guest count must be a whole number of at least 1.';
      guestsInput.focus();
      return;
    }

    var now = Date.now();
    if (now - lastSubmitTimestamp < 10000) {
      errorEl.textContent = 'Please wait a moment before submitting again.';
      return;
    }

    confirmBtn.disabled = true;
    var originalLabel = confirmBtn.textContent;
    confirmBtn.textContent = 'Submitting...';

    var payload;
    if (isEdit && stored) {
      payload = {
        action: 'editRsvp',
        id: stored.id,
        name: name,
        email: email,
        guestCount: guestCount,
      };
    } else {
      payload = {
        action: 'rsvp',
        name: name,
        email: email,
        guestCount: guestCount,
        website: websiteInput.value,
      };
    }

    apiPost(payload).then(function (res) {
      if (!res || !res.ok) {
        errorEl.textContent = (res && res.error) ? 'Something went wrong (' + res.error + '). Please try again.' : 'Something went wrong. Please try again.';
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalLabel;
        return;
      }

      lastSubmitTimestamp = Date.now();

      var record;
      if (isEdit && stored) {
        record = {
          id: stored.id,
          name: name,
          email: email,
          guestCount: guestCount,
          photosUploaded: stored.photosUploaded || 0,
        };
      } else {
        record = {
          id: res.id,
          name: name,
          email: email,
          guestCount: guestCount,
          photosUploaded: 0,
        };
      }
      setStoredRsvp(record);
      refreshBannerAndButton();
      loadAttendees();
      renderConfirmationScreen(record);
    }).catch(function () {
      errorEl.textContent = 'Something went wrong. Please try again.';
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalLabel;
    });
  }

  /* ===========================================================
     Post-confirmation screen
     =========================================================== */

  // RFC 5545: commas, semicolons and backslashes in text values must be escaped
  function icsEscape(text) {
    return text.replace(/\\/g, '\\\\').replace(/[,;]/g, function (c) { return '\\' + c; });
  }

  function buildIcsContent() {
    var uid = uuidv4() + '@roshans70th';
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Roshans70th//RSVP//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTAMP:' + icsUtcStamp(new Date()),
      'DTSTART:20260802T030000Z',
      'DTEND:20260802T070000Z',
      'SUMMARY:Roshan\'s 70th Birthday',
      'LOCATION:' + icsEscape(CONFIG.ADDRESS),
      'DESCRIPTION:' + icsEscape('Roshan\'s 70th Birthday, see you there!'),
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    return lines.join('\r\n') + '\r\n';
  }

  function icsUtcStamp(date) {
    function p(n) { return String(n).padStart(2, '0'); }
    return (
      date.getUTCFullYear() +
      p(date.getUTCMonth() + 1) +
      p(date.getUTCDate()) +
      'T' +
      p(date.getUTCHours()) +
      p(date.getUTCMinutes()) +
      p(date.getUTCSeconds()) +
      'Z'
    );
  }

  function downloadIcs() {
    var content = buildIcsContent();
    var blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'roshans-70th.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function renderConfirmationScreen(record) {
    var firstName = (record.name || '').trim().split(/\s+/)[0] || 'there';
    var guestCount = record.guestCount || 1;
    var message;
    if (guestCount === 1) {
      message = "🎉 You're all set, " + escapeHtml(firstName) + '!';
    } else {
      message = "🎉 You're all set! " + escapeHtml(firstName) + ' + ' + (guestCount - 1) + ' guests';
    }

    var photosUploaded = record.photosUploaded || 0;
    var limitReached = photosUploaded >= CONFIG.MAX_PHOTOS_PER_PERSON;

    modalBody.innerHTML =
      '<h2 id="rsvp-modal-title" class="modal-title">You\'re in!</h2>' +
      '<p class="confirmation-message">' + message + '</p>' +
      '<div class="confirmation-actions">' +
      '  <button type="button" id="save-calendar-btn" class="btn btn-secondary">Save to Calendar</button>' +
      '  <a id="get-directions-btn" class="btn btn-secondary" href="' + CONFIG.MAPS_URL + '" target="_blank" rel="noopener">Get Directions</a>' +
      '</div>' +
      '<div class="upload-block" id="upload-block">' +
      '  <h3>Got a photo of you and Roshan? Share it!</h3>' +
      '  <div class="form-field">' +
      '    <label for="photo-input">Choose photo(s)</label>' +
      '    <input type="file" id="photo-input" accept="image/*" multiple' + (limitReached ? ' disabled' : '') + '>' +
      '  </div>' +
      '  <p class="upload-limit-note" id="upload-limit-note">' +
      (limitReached
        ? "You've reached the " + CONFIG.MAX_PHOTOS_PER_PERSON + '-photo limit. Thanks for sharing!'
        : (CONFIG.MAX_PHOTOS_PER_PERSON - photosUploaded) + ' photo upload(s) remaining.') +
      '  </p>' +
      '  <div class="upload-status" id="upload-status" aria-live="polite"></div>' +
      '  <button type="button" id="skip-upload" class="btn-text">Skip for now</button>' +
      '</div>' +
      '<div class="done-row">' +
      '  <button type="button" id="rsvp-done" class="btn btn-primary">Done</button>' +
      '</div>';

    modalBody.querySelector('#save-calendar-btn').addEventListener('click', downloadIcs);
    modalBody.querySelector('#skip-upload').addEventListener('click', function () {
      var block = document.getElementById('upload-block');
      if (block) block.remove();
    });
    modalBody.querySelector('#rsvp-done').addEventListener('click', function () {
      closeModal();
      refreshBannerAndButton();
      loadAttendees();
    });

    var photoInput = modalBody.querySelector('#photo-input');
    if (photoInput) {
      photoInput.addEventListener('change', function (e) {
        handlePhotoSelection(e.target.files, record);
        e.target.value = '';
      });
    }
  }

  function handlePhotoSelection(fileList, record) {
    var statusEl = document.getElementById('upload-status');
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    files.forEach(function (file) {
      processOnePhoto(file, record, statusEl);
    });
  }

  function processOnePhoto(file, record, statusEl) {
    var itemEl = document.createElement('p');
    itemEl.className = 'upload-status-item';
    itemEl.textContent = file.name + ': checking...';
    if (statusEl) statusEl.appendChild(itemEl);

    var current = getStoredRsvp();
    var uploadedSoFar = (current && current.photosUploaded) || 0;

    if (uploadedSoFar >= CONFIG.MAX_PHOTOS_PER_PERSON) {
      itemEl.textContent = file.name + ': photo limit reached, not uploaded.';
      itemEl.classList.add('is-error');
      updateUploadLimitNote();
      return;
    }

    if (!file.type || file.type.indexOf('image/') !== 0) {
      itemEl.textContent = file.name + ': not an image, skipped.';
      itemEl.classList.add('is-error');
      return;
    }

    var maxBytes = CONFIG.MAX_PHOTO_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      itemEl.textContent = file.name + ': too large (max ' + CONFIG.MAX_PHOTO_MB + 'MB), skipped.';
      itemEl.classList.add('is-error');
      return;
    }

    itemEl.textContent = file.name + ': uploading...';

    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      var base64 = String(dataUrl).split(',')[1] || '';

      apiPost({
        action: 'uploadPhoto',
        id: current && current.id,
        filename: file.name,
        mimeType: file.type,
        dataBase64: base64,
      }).then(function (res) {
        if (!res || !res.ok) {
          var reason = (res && res.error) || 'upload_failed';
          itemEl.textContent = file.name + ': failed (' + reason + ').';
          itemEl.classList.add('is-error');
          return;
        }
        itemEl.textContent = file.name + ': uploaded successfully.';
        itemEl.classList.add('is-success');

        var latest = getStoredRsvp();
        if (latest) {
          latest.photosUploaded = (latest.photosUploaded || 0) + 1;
          setStoredRsvp(latest);
        }
        updateUploadLimitNote();
      }).catch(function () {
        itemEl.textContent = file.name + ': failed to upload.';
        itemEl.classList.add('is-error');
      });
    };
    reader.onerror = function () {
      itemEl.textContent = file.name + ': could not read file.';
      itemEl.classList.add('is-error');
    };
    reader.readAsDataURL(file);
  }

  function updateUploadLimitNote() {
    var noteEl = document.getElementById('upload-limit-note');
    var inputEl = document.getElementById('photo-input');
    if (!noteEl) return;
    var stored = getStoredRsvp();
    var uploaded = (stored && stored.photosUploaded) || 0;
    if (uploaded >= CONFIG.MAX_PHOTOS_PER_PERSON) {
      noteEl.textContent = "You've reached the " + CONFIG.MAX_PHOTOS_PER_PERSON + '-photo limit. Thanks for sharing!';
      if (inputEl) inputEl.disabled = true;
    } else {
      noteEl.textContent = (CONFIG.MAX_PHOTOS_PER_PERSON - uploaded) + ' photo upload(s) remaining.';
    }
  }

  /* ===========================================================
     RSVP button click handler
     =========================================================== */

  function onRsvpButtonClick() {
    var rsvpButton = document.getElementById('rsvp-button');
    var mode = rsvpButton.dataset.mode;
    var stored = getStoredRsvp();

    openModal(rsvpButton);

    if (mode === 'view') {
      renderConfirmationScreen(stored);
    } else if (mode === 'edit') {
      renderRsvpForm('edit');
    } else {
      renderRsvpForm('rsvp');
    }
  }

  function onBannerViewDetails() {
    var stored = getStoredRsvp();
    if (!stored) return;
    var banner = document.getElementById('banner-view-details');
    openModal(banner);
    renderConfirmationScreen(stored);
  }

  /* ===========================================================
     Init
     =========================================================== */

  function init() {
    modalBackdrop = document.getElementById('rsvp-modal-backdrop');
    modalEl = document.getElementById('rsvp-modal');
    modalBody = document.getElementById('modal-body');
    modalCloseBtn = document.getElementById('modal-close');

    initHeroImage();
    initCountdowns();
    initMap();
    refreshBannerAndButton();
    loadAttendees();

    var rsvpButton = document.getElementById('rsvp-button');
    if (rsvpButton) {
      rsvpButton.addEventListener('click', onRsvpButtonClick);
    }

    var bannerBtn = document.getElementById('banner-view-details');
    if (bannerBtn) {
      bannerBtn.addEventListener('click', onBannerViewDetails);
    }

    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeModal);
    }

    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', function (e) {
        if (e.target === modalBackdrop) {
          closeModal();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
