/**
 * ExpTrackerLite — Apps Script backend
 *
 * Deploy this as a Web App bound to your Google Sheet. It exposes:
 *   GET  ?action=data        -> { budgets: [...], expenses: [...] }
 *   POST { main, category, amount, remarks }  -> appends a row to "Expense Log"
 *
 * Reads column headers dynamically from row 1 of each sheet, so your exact
 * column order/names don't need to match this file. Matching is
 * case-insensitive and ignores spaces (e.g. "Budget Amount" -> "budgetamount").
 */

var BUDGET_SHEET = 'Budget';
var EXPENSE_SHEET = 'Expense Log';

function doGet(e) {
  var action = e.parameter.action || 'data';
  if (action === 'data') {
    var payload = {
      budgets: readSheetAsObjects_(BUDGET_SHEET),
      expenses: readSheetAsObjects_(EXPENSE_SHEET)
    };
    return jsonOutput_(payload);
  }
  return jsonOutput_({ error: 'Unknown action' });
}

function doPost(e) {
  try {
    // Client sends Content-Type: text/plain to avoid CORS preflight,
    // so we parse the JSON body manually here.
    var body = JSON.parse(e.postData.contents);
    appendExpense_(body);
    return jsonOutput_({ ok: true });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

function appendExpense_(entry) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSE_SHEET);
  if (!sheet) throw new Error('Sheet "' + EXPENSE_SHEET + '" not found');

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var normHeaders = headers.map(function (h) { return normalizeKey_(h); });

  // Make sure a Remarks column exists; add one if it's missing.
  var remarksIdx = normHeaders.indexOf('remarks');
  if (remarksIdx === -1) {
    var newCol = lastCol + 1;
    sheet.getRange(1, newCol).setValue('Remarks');
    headers.push('Remarks');
    normHeaders.push('remarks');
    remarksIdx = normHeaders.length - 1;
  }

  // Make sure a Date column exists; add one if it's missing.
  var dateIdx = normHeaders.indexOf('date');
  if (dateIdx === -1) {
    var newCol2 = headers.length + 1;
    sheet.getRange(1, newCol2).setValue('Date');
    headers.push('Date');
    normHeaders.push('date');
    dateIdx = normHeaders.length - 1;
  }

  var row = new Array(headers.length).fill('');
  var mainIdx = normHeaders.indexOf('main');
  var categoryIdx = normHeaders.indexOf('category');
  var amountIdx = normHeaders.indexOf('amount');

  if (mainIdx > -1) row[mainIdx] = entry.main || '';
  if (categoryIdx > -1) row[categoryIdx] = entry.category || '';
  if (amountIdx > -1) row[amountIdx] = Number(entry.amount) || 0;
  row[remarksIdx] = entry.remarks || '';
  row[dateIdx] = entry.date ? new Date(entry.date) : new Date();

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function readSheetAsObjects_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var normHeaders = headers.map(function (h) { return normalizeKey_(h); });
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var results = [];
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var isEmpty = row.every(function (v) { return v === '' || v === null; });
    if (isEmpty) continue;

    var obj = {};
    for (var c = 0; c < normHeaders.length; c++) {
      var key = normHeaders[c];
      if (!key) continue;
      var val = row[c];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[key] = val;
    }
    results.push(obj);
  }
  return results;
}

function normalizeKey_(header) {
  return String(header || '').toLowerCase().replace(/\s+/g, '');
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
