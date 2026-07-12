/**
 * ExpTrackerLite — Apps Script backend
 *
 * Deploy this as a Web App bound to your Google Sheet. It exposes:
 *   GET  ?action=data                            -> { budgets: [...], expenses: [...] }
 *   POST { action: 'add',    main, category, amount, date, remarks }
 *   POST { action: 'update', _row, main, category, amount, date, remarks }
 *
 * Reads column headers dynamically from row 1 of each sheet, so your exact
 * column order/names don't need to match this file. Matching is
 * case-insensitive and ignores spaces (e.g. "Budget Amount" -> "budgetamount").
 *
 * Each expense returned from GET includes a "_row" field: the actual row
 * number in the Expense Log sheet. The frontend sends that same _row back
 * to identify exactly which row to update when editing.
 */

var BUDGET_SHEET = 'Budget';
var EXPENSE_SHEET = 'Expense Log';

function doGet(e) {
  var action = e.parameter.action || 'data';
  if (action === 'data') {
    var payload = {
      budgets: readSheetAsObjects_(BUDGET_SHEET, false),
      expenses: readSheetAsObjects_(EXPENSE_SHEET, true)
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
    if (body.action === 'update') {
      updateExpense_(body);
    } else {
      appendExpense_(body);
    }
    return jsonOutput_({ ok: true });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

/**
 * Reads the Expense Log's header row, adding "Remarks" and/or "Date"
 * columns if they don't already exist. Returns the (possibly updated)
 * headers plus their normalized-key lookup indices.
 */
function ensureExpenseColumns_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var normHeaders = headers.map(function (h) { return normalizeKey_(h); });

  var remarksIdx = normHeaders.indexOf('remarks');
  if (remarksIdx === -1) {
    sheet.getRange(1, headers.length + 1).setValue('Remarks');
    headers.push('Remarks');
    normHeaders.push('remarks');
    remarksIdx = normHeaders.length - 1;
  }

  var dateIdx = normHeaders.indexOf('date');
  if (dateIdx === -1) {
    sheet.getRange(1, headers.length + 1).setValue('Date');
    headers.push('Date');
    normHeaders.push('date');
    dateIdx = normHeaders.length - 1;
  }

  return {
    headers: headers,
    normHeaders: normHeaders,
    mainIdx: normHeaders.indexOf('main'),
    categoryIdx: normHeaders.indexOf('category'),
    amountIdx: normHeaders.indexOf('amount'),
    remarksIdx: remarksIdx,
    dateIdx: dateIdx
  };
}

// Only digits, whitespace, and + - * / ( ) . are ever allowed through to
// become a live spreadsheet formula. Anything else silently falls back to
// the plain computed number - this is a server-side safety net, since the
// frontend already restricts input to the same characters.
var SAFE_FORMULA_PATTERN = /^[0-9+\-*/(). \t]+$/;

function buildExpenseRow_(cols, entry) {
  var row = new Array(cols.headers.length).fill('');
  if (cols.mainIdx > -1) row[cols.mainIdx] = entry.main || '';
  if (cols.categoryIdx > -1) row[cols.categoryIdx] = entry.category || '';

  if (cols.amountIdx > -1) {
    var expr = entry.amountExpr ? String(entry.amountExpr).trim() : '';
    var isPlainNumber = /^-?[0-9]+(\.[0-9]+)?$/.test(expr);
    if (expr && !isPlainNumber && SAFE_FORMULA_PATTERN.test(expr)) {
      // A string starting with "=" is entered as a live formula by
      // setValues(), exactly as if typed into the cell by hand.
      row[cols.amountIdx] = '=' + expr;
    } else {
      row[cols.amountIdx] = Number(entry.amount) || 0;
    }
  }

  row[cols.remarksIdx] = entry.remarks || '';
  row[cols.dateIdx] = entry.date ? new Date(entry.date) : new Date();
  return row;
}

function appendExpense_(entry) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSE_SHEET);
  if (!sheet) throw new Error('Sheet "' + EXPENSE_SHEET + '" not found');

  var cols = ensureExpenseColumns_(sheet);
  var row = buildExpenseRow_(cols, entry);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function updateExpense_(entry) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSE_SHEET);
  if (!sheet) throw new Error('Sheet "' + EXPENSE_SHEET + '" not found');

  var rowNum = Number(entry._row);
  if (!rowNum || rowNum < 2 || rowNum > sheet.getLastRow()) {
    throw new Error('Invalid row reference for update: ' + entry._row);
  }

  var cols = ensureExpenseColumns_(sheet);
  var row = buildExpenseRow_(cols, entry);
  sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
}

function readSheetAsObjects_(sheetName, includeRowNumber) {
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
    if (includeRowNumber) {
      obj._row = r + 2; // +2: 1-indexed sheet rows, plus header row
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
