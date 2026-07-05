// Shared configuration for Roshan's 70th birthday site.
// APPS_SCRIPT_URL empty string = demo mode (no backend calls, simulated data).
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzmTOSIWEwnoWjNXhHSPW1nH59hg9BSPMHslv6joWtvJyuwvTJdL_Rs_63ZjoqFc2dg/exec",

  EVENT_TITLE: "Roshan's 70th Birthday",
  // Sydney is UTC+10 in July/August (no DST then), so fixed offsets are safe.
  EVENT_START: "2026-08-02T13:00:00+10:00",
  EVENT_END: "2026-08-02T17:00:00+10:00",
  RSVP_DEADLINE: "2026-07-19T23:59:59+10:00",

  ADDRESS: "95 The Comenarra Parkway, Turramurra, New South Wales",
  MAPS_URL: "https://www.google.com/maps/dir/?api=1&destination=95+The+Comenarra+Parkway%2C+Turramurra+NSW",
  MAP_EMBED_URL: "https://www.google.com/maps?q=95+The+Comenarra+Parkway%2C+Turramurra+NSW&output=embed",

  RSVP_CONTACT: "Tamara",
  MAX_PHOTOS_PER_PERSON: 5,
  MAX_PHOTO_MB: 10,

  STORAGE_KEY: "roshan70_rsvp",
};
