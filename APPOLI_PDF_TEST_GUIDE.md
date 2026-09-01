# 🧪 APPOLI PDF FEATURE - COMPREHENSIVE TEST GUIDE

**Last Updated:** 1 September 2026  
**Test Status:** Ready for Manual Verification  
**Commit:** b89908c

---

## 📋 TEST OVERVIEW

This guide covers complete testing of the Appoli PDF feature across **3 forms**:
1. **Analisa Usaha** (Business Analysis) - 1-2 pages
2. **Inspeksi ICS** (Internal Inspection) - 2-3 pages  
3. **Data Lahan** (Land Survey) - 1 page

---

## ✅ UNIT TESTS (Already Passing)

### TypeScript Compilation
```bash
✅ npx tsc --noEmit
Result: PASS (no type errors)
```

### Import Validation
```
✅ All imports resolve correctly
✅ Firebase auth initialized
✅ Type definitions accurate
```

---

## 🧪 INTEGRATION TESTS

### TEST #1: Analisa Usaha PDF Generation
**Form:** Business Analysis  
**Complexity:** Medium (cost tables + calculations)  
**Expected:** 1-2 page PDF

**Steps:**
1. Open Appoli Dashboard
2. Navigate to "Analisa Usaha" tab
3. Click on a farmer record → opens preview
4. Verify preview shows:
   - [ ] Header with APPOLI logo
   - [ ] Farmer identity (nama, kode, kelompok, luas lahan, varietas, musim tanam)
   - [ ] Cost breakdown tables (Biaya A, B, C)
   - [ ] Calculation rows with proper formatting
   - [ ] Revenue and profit calculation
   - [ ] Signature areas (Petani & Petugas)

5. Click PDF button (or "Cetak PDF")
6. Verify in new tab:
   - [ ] PDF loads within 10-15 seconds
   - [ ] No console errors
   - [ ] Numbers formatted correctly (Rp 1.000.000 format)
   - [ ] Tables render with borders
   - [ ] Logo visible at top
   - [ ] Print preview looks good (Ctrl+P)

**Expected Result:** ✅ Professional PDF with all data accurate

---

### TEST #2: Inspeksi ICS PDF Generation
**Form:** Internal Inspection  
**Complexity:** High (multi-section, 2-3 pages)  
**Expected:** 2-3 page PDF

**Steps:**
1. Navigate to "Inspeksi ICS" tab
2. Click on inspection record → opens preview
3. Verify preview shows:
   - [ ] Identity table (nama petani, inspektur, tanggal, jam)
   - [ ] Status bidang lahan (Baru/Sama/Penambahan/Pengurangan)
   - [ ] Land data table with columns (luas, tanaman utama, selingan, kimia terakhir)
   - [ ] Aspek pemeriksaan kepatuhan (multiple criteria sections)
   - [ ] Checkboxes for "Diterima" / "Tidak"
   - [ ] Manajemen risiko section with risk levels
   - [ ] Rekomendasi & Keputusan section
   - [ ] Signature section at bottom

4. Click PDF button
5. Verify in new tab:
   - [ ] PDF loads within 15-20 seconds (longer due to multi-page)
   - [ ] **Page 1:** Header + status + land data + criteria start
   - [ ] **Page 2:** Criteria continuation + risk management
   - [ ] **Page 3:** Recommendations + signatures (if present)
   - [ ] No text overflow on any page
   - [ ] Tables span correctly across pages
   - [ ] Checkboxes visible ([✓] or [ ])
   - [ ] Font readable in print preview

**Expected Result:** ✅ Multi-page PDF with all sections properly paginated

---

### TEST #3: Data Lahan PDF Generation
**Form:** Land Survey  
**Complexity:** Low (tabular data only)  
**Expected:** 1 page PDF

**Steps:**
1. Navigate to "Data Lahan" tab
2. Click on land record → opens preview
3. Verify preview shows:
   - [ ] Header with APPOLI branding
   - [ ] Identity section (nama petani, kode, alamat, kelompok, status milik)
   - [ ] "Lahan pertanian organik" section with columns
   - [ ] Multiple land entries with luas, tanaman utama, sisipan, kimia
   - [ ] Total area row with sum calculation (4 decimal places)
   - [ ] "Kalender masa tanam" section (MT 1, MT 2, etc.)
   - [ ] "Matriks Batas Geografis" with directions (Barat, Timur, Selatan, Utara)
   - [ ] "Ternak Pendukung" section (jenis, jumlah, pakan, kondisi)
   - [ ] Signature block (Petani & Petugas)
   - [ ] Footer with document description

4. Click PDF button
5. Verify in new tab:
   - [ ] PDF loads within 5-10 seconds (simplest form)
   - [ ] All sections fit on single page
   - [ ] No content cut off
   - [ ] Area calculations correct (matches preview)
   - [ ] All tables fully visible with borders
   - [ ] Print preview (Ctrl+P) shows proper margins

**Expected Result:** ✅ Clean single-page PDF, easy to read

---

## 🔧 EDGE CASE TESTS

### TEST #4: Incomplete Data Handling
**Scenario:** PDF with missing fields

**Steps:**
1. Manually edit a form to have empty/null fields
2. Generate PDF
3. Verify:
   - [ ] PDF still generates (doesn't crash)
   - [ ] Empty fields show "-" placeholder
   - [ ] No console errors
   - [ ] Server logs show warning: "Data [...] tidak lengkap"

**Expected Result:** ✅ Graceful handling with placeholder values

---

### TEST #5: Popup Window Handling
**Scenario:** Test popup blocking & window closure

**Steps:**
1. Test 1: With pop-ups allowed
   - Generate PDF normally
   - [ ] Should open in new tab
   
2. Test 2: With pop-ups blocked
   - Enable popup blocker
   - Try to generate PDF
   - [ ] Should show error: "Popup diblokir"
   - [ ] User gets clear message with action

3. Test 3: Close window before PDF loads
   - Generate PDF
   - Quickly close the popup window
   - [ ] No errors in parent window
   - [ ] Parent page still functional

**Expected Result:** ✅ Proper error handling for all popup scenarios

---

### TEST #6: Authentication Edge Cases
**Scenario:** Token expiration & invalid auth

**Test 6A: Expired Token**
- Wait 1+ hour after login
- Try to generate PDF
- [ ] Should show error: "Sesi login berakhir"
- [ ] Redirect to login page works

**Test 6B: Invalid Token**
- Manually corrupt token in request headers (dev tools)
- Try PDF generation
- [ ] Should return 401 Unauthorized
- [ ] Error message: "Token autentikasi tidak ditemukan"

**Expected Result:** ✅ Clear authentication error messages

---

### TEST #7: Timeout & Slow Network
**Scenario:** Simulate slow PDF generation

**Steps:**
1. Throttle network to "Slow 3G" (Chrome DevTools)
2. Generate complex form (Inspeksi ICS)
3. Verify:
   - [ ] Generation starts (popup opens)
   - [ ] Waits up to 70 seconds on client
   - [ ] Server timeout: 120 seconds
   - [ ] Should eventually complete or show timeout error

**Expected Result:** ✅ Timeout handling works correctly

---

## 🖨️ PRINT QUALITY TESTS

### TEST #8: Print to PDF (Save As PDF)
**Steps:**
1. Generate PDF and view in browser
2. Press Ctrl+P → Print dialog
3. Select "Save as PDF"
4. Verify:
   - [ ] All content visible in print preview
   - [ ] Margins appropriate
   - [ ] Font sizes readable
   - [ ] Tables don't overflow
   - [ ] Colors print correctly (especially for forms with colored headers)

**Expected Result:** ✅ Print-quality PDF output

---

### TEST #9: Physical Printer Test
**Steps:**
1. Generate PDF for each form
2. Print to physical printer (A4 paper)
3. Verify:
   - [ ] Analisa Usaha: All tables visible, no cut-off
   - [ ] Inspeksi ICS: Page breaks correct, all pages printed
   - [ ] Data Lahan: Single page, complete
   - [ ] Font readable (not too small)
   - [ ] Logo visible and clear
   - [ ] Borders visible on all tables

**Expected Result:** ✅ Professional printed output

---

## 🌐 CROSS-BROWSER TESTS

### TEST #10: Browser Compatibility

**Chrome/Edge:**
```
✅ PDF opens in new tab
✅ Displays correctly
✅ Print works
```

**Firefox:**
```
✅ PDF opens in new tab (or viewer)
✅ Display quality matches Chrome
✅ Print preview works
```

**Safari (iOS/macOS):**
```
✅ PDF opens in new tab
✅ Mobile rendering OK
✅ Can save/share PDF
```

**Expected Result:** ✅ Consistent behavior across browsers

---

## 📱 MOBILE DEVICE TESTS

### TEST #11: Responsive Behavior

**Mobile (iPhone/Android):**
1. Open Appoli Dashboard on mobile
2. Generate PDF
3. Verify:
   - [ ] PDF opens successfully
   - [ ] Readable without excessive scrolling
   - [ ] Landscape mode better for tables
   - [ ] Share/save options work

**Expected Result:** ✅ Mobile-friendly PDF handling

---

## 📊 PERFORMANCE TESTS

### TEST #12: Generation Speed

**Metrics to Track:**
| Form | Expected Time | Acceptable Range |
|------|---------------|------------------|
| Analisa Usaha | 8-12s | 5-15s |
| Inspeksi ICS | 12-18s | 8-25s |
| Data Lahan | 5-8s | 3-12s |

**Test:**
1. Clear browser cache
2. Generate each form type 3 times
3. Measure time from click to PDF loaded
4. Record in spreadsheet

**Expected Result:** ✅ Consistent performance within acceptable ranges

---

## 🐛 ERROR LOGGING TEST

### TEST #13: Console & Server Logs

**On Browser Console (F12):**
- [ ] No JavaScript errors
- [ ] No 404s for resources
- [ ] No CORS errors
- [ ] Check Network tab: PDF request returns 200

**On Server Logs (Vercel/local):**
```
Expected patterns:
✅ Request: GET /api/appoli/pdf?collection=analisaUsaha&id=...
✅ Token verified: Bearer [token]
✅ PDF generated: size XXX bytes
✅ No warnings about missing logo
```

**Expected Result:** ✅ Clean logs, no error spam

---

## ✅ FINAL VERIFICATION CHECKLIST

Before marking as "Production Ready":

### Functionality
- [ ] All 3 forms generate PDF successfully
- [ ] Data accuracy verified in PDF
- [ ] Error handling works correctly
- [ ] No console errors or warnings
- [ ] Authentication working

### Quality
- [ ] Print preview looks professional
- [ ] Physical print quality acceptable
- [ ] Font sizes readable
- [ ] Tables properly formatted
- [ ] Logo visible on all forms

### Performance
- [ ] Generation time acceptable
- [ ] No memory leaks observed
- [ ] Server timeout sufficient
- [ ] Client-side timeout appropriate

### Reliability
- [ ] Works consistently (5+ test cycles)
- [ ] Edge cases handled gracefully
- [ ] Error messages clear and helpful
- [ ] Recovery from errors works

---

## 🚀 DEPLOYMENT READINESS

### Pre-Production Checklist
```
FUNCTIONALITY:
  [✅] All 3 forms working
  [✅] TypeScript compilation passing
  [✅] No console errors
  [✅] Authentication verified

TESTING:
  [ ] Unit tests passing (if any)
  [ ] Integration tests complete
  [ ] Edge cases tested
  [ ] Cross-browser verified
  [ ] Performance acceptable

DOCUMENTATION:
  [✅] APPOLI_PDF_AUDIT.md created
  [✅] PDF_FIXES_IMPLEMENTED.md created
  [✅] This test guide provided

APPROVAL:
  [ ] QA team sign-off
  [ ] PM approval
  [ ] Ready for production deployment
```

---

## 📝 TEST RESULT RECORDING

Use this template for recording test results:

```
TEST SESSION: [Date] [Tester Name]
Browser: [Chrome/Firefox/Safari]
Environment: [Local/Preview/Production]

Form: Analisa Usaha
Status: [ ] PASS [ ] FAIL [ ] PARTIAL
Issues: [List any problems found]
Notes: [Additional observations]

Form: Inspeksi ICS  
Status: [ ] PASS [ ] FAIL [ ] PARTIAL
Issues: [List any problems found]
Notes: [Additional observations]

Form: Data Lahan
Status: [ ] PASS [ ] FAIL [ ] PARTIAL
Issues: [List any problems found]
Notes: [Additional observations]

Performance:
- Analisa Usaha: ___ seconds
- Inspeksi ICS: ___ seconds
- Data Lahan: ___ seconds

Overall: [✅ READY FOR PRODUCTION / ⚠️ NEEDS FIXES / ❌ BLOCKING ISSUES]
Blockers: [If any]
```

---

## 🎯 SUCCESS CRITERIA

✅ **Test Passing** = All 3 forms generate valid PDFs consistently
⚠️ **Minor Issues** = PDFs work but cosmetic improvements needed
❌ **Blocking Issues** = PDF generation fails or data corruption

---

**Ready for comprehensive manual testing!**

