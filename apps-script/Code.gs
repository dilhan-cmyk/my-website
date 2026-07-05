/**
 * Roshan's 70th Birthday - RSVP backend
 *
 * Container-bound Apps Script for a Google Sheet. Deploy via
 * Extensions > Apps Script from the sheet, then Deploy > New deployment
 * (Web app, Execute as: Me, Who has access: Anyone).
 *
 * Sheet "RSVPs" columns (row 1 header):
 *   id | name | email | guest_count | timestamp | photo_urls
 *
 * See API-CONTRACT.md in the repo for the full request/response contract.
 * See DEPLOYMENT.md for setup instructions.
 */

// ---- Constants -------------------------------------------------------

var SHEET_NAME = 'RSVPs';
var PHOTO_FOLDER_NAME = 'Roshan 70th - Guest Photos';
var HEADERS = ['id', 'name', 'email', 'guest_count', 'timestamp', 'photo_urls'];
var MAX_PHOTOS = 5;
var MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
var LOCK_WAIT_MS = 10 * 1000; // 10 seconds

// Column indexes (1-based, matching HEADERS order)
var COL = {
  ID: 1,
  NAME: 2,
  EMAIL: 3,
  GUEST_COUNT: 4,
  TIMESTAMP: 5,
  PHOTO_URLS: 6
};

// ---- Setup (run once from the editor) --------------------------------

/**
 * One-time setup. Run this manually from the Apps Script editor after
 * pasting this file in. Creates the RSVPs sheet (with headers) if it
 * does not exist, and creates/locates the Drive photo folder, storing
 * its id in Script Properties so we don't need to search Drive again.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('PHOTO_FOLDER_ID');
  var folder = null;
  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      folder = null;
    }
  }
  if (!folder) {
    var existing = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
    if (existing.hasNext()) {
      folder = existing.next();
    } else {
      folder = DriveApp.createFolder(PHOTO_FOLDER_NAME);
    }
    props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  }

  Logger.log('Setup complete. Sheet: %s, Photo folder: %s', sheet.getName(), folder.getUrl());
}

// ---- Entry points ------------------------------------------------------

function doGet(e) {
  return safeRun_(function () {
    var action = e && e.parameter && e.parameter.action;
    if (action === 'attendees') {
      return handleAttendees_();
    }
    if (action === 'admin') {
      return handleAdmin_(e);
    }
    return jsonOut_({ ok: false, error: 'bad_request' });
  });
}

function doPost(e) {
  return safeRun_(function () {
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonOut_({ ok: false, error: 'bad_request' });
    }
    if (!body || typeof body.action !== 'string') {
      return jsonOut_({ ok: false, error: 'bad_request' });
    }

    switch (body.action) {
      case 'rsvp':
        return handleRsvp_(body);
      case 'editRsvp':
        return handleEditRsvp_(body);
      case 'uploadPhoto':
        return handleUploadPhoto_(body);
      case 'deleteRsvp':
        return handleDeleteRsvp_(body);
      default:
        return jsonOut_({ ok: false, error: 'bad_request' });
    }
  });
}

// ---- Handlers: writes (lock-protected) --------------------------------

function handleRsvp_(body) {
  // Honeypot: if filled in, pretend success but store nothing.
  if (body.website && String(body.website).trim() !== '') {
    return jsonOut_({ ok: true, id: 'fake' });
  }

  var validation = validateRsvpFields_(body);
  if (!validation.ok) {
    return jsonOut_({ ok: false, error: validation.error });
  }

  return withLock_(function () {
    var sheet = getSheet_();
    var id = Utilities.getUuid();
    var timestamp = new Date().toISOString();
    sheet.appendRow([
      id,
      validation.name,
      validation.email,
      validation.guestCount,
      timestamp,
      ''
    ]);
    return jsonOut_({ ok: true, id: id });
  });
}

function handleEditRsvp_(body) {
  if (!body.id) {
    return jsonOut_({ ok: false, error: 'not_found' });
  }

  var validation = validateRsvpFields_(body);
  if (!validation.ok) {
    return jsonOut_({ ok: false, error: validation.error });
  }

  return withLock_(function () {
    var sheet = getSheet_();
    var row = findRowById_(sheet, body.id);
    if (!row) {
      return jsonOut_({ ok: false, error: 'not_found' });
    }
    sheet.getRange(row, COL.NAME).setValue(validation.name);
    sheet.getRange(row, COL.EMAIL).setValue(validation.email);
    sheet.getRange(row, COL.GUEST_COUNT).setValue(validation.guestCount);
    return jsonOut_({ ok: true });
  });
}

function handleUploadPhoto_(body) {
  var id = body.id;
  var filename = body.filename;
  var mimeType = body.mimeType;
  var dataBase64 = body.dataBase64;

  if (!id || !filename || !mimeType || !dataBase64) {
    return jsonOut_({ ok: false, error: 'bad_request' });
  }
  if (String(mimeType).indexOf('image/') !== 0) {
    return jsonOut_({ ok: false, error: 'not_an_image' });
  }

  return withLock_(function () {
    var sheet = getSheet_();
    var row = findRowById_(sheet, id);
    if (!row) {
      return jsonOut_({ ok: false, error: 'not_found' });
    }

    var bytes;
    try {
      bytes = Utilities.base64Decode(dataBase64);
    } catch (err) {
      return jsonOut_({ ok: false, error: 'bad_request' });
    }
    if (bytes.length > MAX_PHOTO_BYTES) {
      return jsonOut_({ ok: false, error: 'too_large' });
    }

    var existingUrls = getPhotoUrls_(sheet, row);
    if (existingUrls.length >= MAX_PHOTOS) {
      return jsonOut_({ ok: false, error: 'photo_limit' });
    }

    var name = sheet.getRange(row, COL.NAME).getValue();
    var firstName = firstToken_(String(name)) || 'guest';
    var safeName = sanitizeFilename_(filename);
    var finalFilename = firstName + '_' + safeName;

    var blob = Utilities.newBlob(bytes, mimeType, finalFilename);
    var folder = getPhotoFolder_();
    var file = folder.createFile(blob);
    var url = file.getUrl();

    var updatedUrls = existingUrls.concat([url]);
    sheet.getRange(row, COL.PHOTO_URLS).setValue(updatedUrls.join(','));

    var remaining = MAX_PHOTOS - updatedUrls.length;
    return jsonOut_({ ok: true, url: url, remaining: remaining });
  });
}

function handleDeleteRsvp_(body) {
  if (!checkToken_(body.token)) {
    return jsonOut_({ ok: false, error: 'unauthorized' });
  }
  var id = body.id;
  if (!id) {
    return jsonOut_({ ok: false, error: 'not_found' });
  }

  return withLock_(function () {
    var sheet = getSheet_();
    var row = findRowById_(sheet, id);
    if (!row) {
      return jsonOut_({ ok: false, error: 'not_found' });
    }
    sheet.deleteRow(row);
    return jsonOut_({ ok: true });
  });
}

// ---- Handlers: reads ----------------------------------------------------

function handleAttendees_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var attendees = [];
  if (lastRow > 1) {
    var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var name = values[i][COL.NAME - 1];
      var guestCount = values[i][COL.GUEST_COUNT - 1];
      attendees.push({
        name: firstToken_(String(name)),
        guestCount: Number(guestCount)
      });
    }
    attendees.reverse(); // newest first
  }
  return jsonOut_({ ok: true, attendees: attendees });
}

function handleAdmin_(e) {
  var token = e && e.parameter && e.parameter.token;
  if (!checkToken_(token)) {
    return jsonOut_({ ok: false, error: 'unauthorized' });
  }

  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var records = [];
  var totalGuests = 0;

  if (lastRow > 1) {
    var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var guestCount = Number(row[COL.GUEST_COUNT - 1]) || 0;
      var photoUrlsRaw = row[COL.PHOTO_URLS - 1];
      var photoUrls = String(photoUrlsRaw || '')
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 0; });

      records.push({
        id: row[COL.ID - 1],
        name: row[COL.NAME - 1],
        email: row[COL.EMAIL - 1],
        guestCount: guestCount,
        timestamp: row[COL.TIMESTAMP - 1],
        photoUrls: photoUrls
      });
      totalGuests += guestCount;
    }
  }

  return jsonOut_({ ok: true, records: records, totalGuests: totalGuests });
}

// ---- Validation ----------------------------------------------------------

/**
 * Validates the shared rsvp/editRsvp fields (name, email, guestCount).
 * Returns { ok: true, name, email, guestCount } or { ok: false, error }.
 */
function validateRsvpFields_(body) {
  var name = body.name ? String(body.name).trim() : '';
  var email = body.email ? String(body.email).trim() : '';
  var guestCount = parseInt(body.guestCount, 10);

  if (!name) {
    return { ok: false, error: 'bad_request' };
  }
  if (!isValidEmail_(email)) {
    return { ok: false, error: 'bad_request' };
  }
  if (isNaN(guestCount) || guestCount < 1) {
    return { ok: false, error: 'bad_request' };
  }

  return {
    ok: true,
    name: sanitizeCell_(name),
    email: sanitizeCell_(email),
    guestCount: guestCount
  };
}

function isValidEmail_(email) {
  // Basic shape check: something@something.something
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Prevents spreadsheet formula injection: a value starting with =, +, or @
 * would otherwise be executed as a formula when written to the sheet.
 * A leading apostrophe forces Sheets to store it as plain text.
 */
function sanitizeCell_(value) {
  if (/^[=+@]/.test(value)) {
    return "'" + value;
  }
  return value;
}

// ---- Helpers ---------------------------------------------------------

/** Returns the RSVPs sheet, creating it with headers if missing. */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

/** Returns the Drive folder for guest photos, using the stored id or creating it. */
function getPhotoFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('PHOTO_FOLDER_ID');
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      // fall through to re-create/find below
    }
  }
  var existing = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  var folder;
  if (existing.hasNext()) {
    folder = existing.next();
  } else {
    folder = DriveApp.createFolder(PHOTO_FOLDER_NAME);
  }
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

/** Finds the 1-based row number for a given id in column A. Returns null if not found. */
function findRowById_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }
  var ids = sheet.getRange(2, COL.ID, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      return i + 2; // account for header row + 0-based index
    }
  }
  return null;
}

/** Returns the non-empty photo URLs for a given row as an array. */
function getPhotoUrls_(sheet, row) {
  var raw = sheet.getRange(row, COL.PHOTO_URLS).getValue();
  return String(raw || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

/** First whitespace-separated token of a name string. */
function firstToken_(name) {
  var trimmed = (name || '').trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.split(/\s+/)[0];
}

/** Strips characters that are unsafe/awkward in Drive filenames. */
function sanitizeFilename_(filename) {
  var safe = String(filename || 'photo').replace(/[^A-Za-z0-9._-]/g, '_');
  return safe || 'photo';
}

/** Compares a supplied token against the ADMIN_TOKEN script property. Fails closed. */
function checkToken_(token) {
  var adminToken = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!adminToken) {
    return false; // fail closed if not configured
  }
  return typeof token === 'string' && token === adminToken;
}

/** Wraps a write operation in a script lock; returns busy error on timeout. */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  var acquired = false;
  try {
    acquired = lock.tryLock(LOCK_WAIT_MS);
  } catch (e) {
    acquired = false;
  }
  if (!acquired) {
    return jsonOut_({ ok: false, error: 'busy' });
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** Runs a handler function, catching any uncaught exception as server_error. */
function safeRun_(fn) {
  try {
    return fn();
  } catch (e) {
    return jsonOut_({ ok: false, error: 'server_error' });
  }
}

/** Wraps a plain object as Apps Script JSON ContentService output. */
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
