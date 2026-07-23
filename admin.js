import { auth, db, CLIENT_SLUG } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// pdf.js (loaded as a classic script in admin.html) needs its worker pointed at a matching version.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* ------------------------------------------------------------------ */
/* DOM refs                                                            */
/* ------------------------------------------------------------------ */

const loginScreen = document.getElementById("loginScreen");
const appEl = document.getElementById("app");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const reportMonth = document.getElementById("reportMonth");
const reportPlatform = document.getElementById("reportPlatform");
const dropzone = document.getElementById("dropzone");
const dropzoneLabel = document.getElementById("dropzoneLabel");
const pdfInput = document.getElementById("pdfInput");
const extractStatus = document.getElementById("extractStatus");
const reviewGrid = document.getElementById("reviewGrid");
const notesField = document.getElementById("mNotes");
const publishBtn = document.getElementById("publishBtn");
const draftBtn = document.getElementById("draftBtn");
const cancelBtn = document.getElementById("cancelBtn");
const reportsList = document.getElementById("reportsList");

const fields = {
  spend: document.getElementById("mSpend"),
  results: document.getElementById("mResults"),
  cpr: document.getElementById("mCpr"),
  impressions: document.getElementById("mImpressions"),
  clicks: document.getElementById("mClicks"),
  ctr: document.getElementById("mCtr"),
};
const tags = {
  spend: document.getElementById("tagSpend"),
  results: document.getElementById("tagResults"),
  cpr: document.getElementById("tagCpr"),
  impressions: document.getElementById("tagImpressions"),
  clicks: document.getElementById("tagClicks"),
  ctr: document.getElementById("tagCtr"),
};

let currentFile = null;
let editingReportId = null;

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginScreen.style.display = "none";
    appEl.classList.add("is-visible");
    await ensureClientDoc();
    listenToReports();
  } else {
    loginScreen.style.display = "flex";
    appEl.classList.remove("is-visible");
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.style.display = "none";
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("loginEmail").value.trim(),
      document.getElementById("loginPassword").value
    );
  } catch (err) {
    loginError.textContent = "Couldn't sign in — check your email and password.";
    loginError.style.display = "block";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

async function ensureClientDoc() {
  const clientRef = doc(db, "clients", CLIENT_SLUG);
  const snap = await getDoc(clientRef);
  if (!snap.exists()) {
    await setDoc(clientRef, {
      name: "Kairos Kreations",
      slug: CLIENT_SLUG,
      createdAt: serverTimestamp(),
    });
  }
}

/* ------------------------------------------------------------------ */
/* PDF text extraction — best-effort. This is why every field below   */
/* is editable and tagged "detected" vs "not found": treat it as a    */
/* fast first draft, not a source of truth.                            */
/* ------------------------------------------------------------------ */

async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return fullText;
}

function findNumber(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const num = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

// Generic across Meta / TikTok / Google — the label wording overlaps
// enough that one pattern set covers all three reasonably well.
const PATTERNS = {
  spend: [
    /amount spent[^\d]{0,15}([\d,]+\.?\d*)/i,
    /total spent[^\d]{0,15}([\d,]+\.?\d*)/i,
    /ad spend[^\d]{0,15}([\d,]+\.?\d*)/i,
    /\bcost\b(?!\s*per)[^\d]{0,15}([\d,]+\.?\d*)/i,
  ],
  results: [
    /\bresults?\b(?!\s*rate)[^\d]{0,15}([\d,]+)/i,
    /\bconversions?\b[^\d]{0,15}([\d,]+)/i,
    /\bleads?\b[^\d]{0,15}([\d,]+)/i,
  ],
  cpr: [
    /cost per result[^\d]{0,15}([\d,]+\.?\d*)/i,
    /cost per conversion[^\d]{0,15}([\d,]+\.?\d*)/i,
    /cost\s*\/\s*conv\.?[^\d]{0,15}([\d,]+\.?\d*)/i,
    /cost per lead[^\d]{0,15}([\d,]+\.?\d*)/i,
  ],
  impressions: [/impressions[^\d]{0,15}([\d,]+)/i],
  clicks: [
    /link clicks[^\d]{0,15}([\d,]+)/i,
    /\bclicks\b(?!\s*through)[^\d]{0,15}([\d,]+)/i,
  ],
  ctr: [
    /ctr[^\d]{0,20}([\d.]+)\s*%/i,
    /click-through rate[^\d]{0,20}([\d.]+)\s*%/i,
  ],
};

function applyExtraction(text) {
  Object.keys(PATTERNS).forEach((key) => {
    const value = findNumber(text, PATTERNS[key]);
    if (value !== null) {
      fields[key].value = value;
      tags[key].textContent = "detected";
      tags[key].classList.remove("missing");
      tags[key].classList.add("found");
    } else {
      fields[key].value = "";
      tags[key].textContent = "not found";
      tags[key].classList.remove("found");
      tags[key].classList.add("missing");
    }
  });
}

/* ------------------------------------------------------------------ */
/* File handling                                                       */
/* ------------------------------------------------------------------ */

dropzone.addEventListener("click", () => pdfInput.click());
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("is-dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("is-dragover");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
pdfInput.addEventListener("change", () => {
  if (pdfInput.files[0]) handleFile(pdfInput.files[0]);
});

async function handleFile(file) {
  if (file.type !== "application/pdf") {
    extractStatus.textContent = "That doesn't look like a PDF — try again.";
    extractStatus.className = "extract-status";
    return;
  }
  currentFile = file;
  dropzoneLabel.textContent = file.name;
  extractStatus.textContent = "Reading the PDF…";
  extractStatus.className = "extract-status is-busy";
  reviewGrid.classList.remove("is-visible");

  try {
    const text = await extractTextFromPdf(file);
    applyExtraction(text);
    reviewGrid.classList.add("is-visible");
    const foundCount = Object.values(tags).filter((t) => t.classList.contains("found")).length;
    extractStatus.textContent = `Found ${foundCount} of 6 metrics automatically — check them below before saving.`;
    extractStatus.className = "extract-status is-done";
  } catch (err) {
    extractStatus.textContent = "Couldn't read that PDF automatically — enter the numbers below manually.";
    extractStatus.className = "extract-status";
    reviewGrid.classList.add("is-visible");
  }
}

/* ------------------------------------------------------------------ */
/* Save / publish                                                       */
/* ------------------------------------------------------------------ */

function buildReportData(isPublished) {
  return {
    monthStart: reportMonth.value ? `${reportMonth.value}-01` : null,
    platform: reportPlatform.value,
    spend: fields.spend.value ? parseFloat(fields.spend.value) : null,
    results: fields.results.value ? parseInt(fields.results.value, 10) : null,
    costPerResult: fields.cpr.value ? parseFloat(fields.cpr.value) : null,
    impressions: fields.impressions.value ? parseInt(fields.impressions.value, 10) : null,
    clicks: fields.clicks.value ? parseInt(fields.clicks.value, 10) : null,
    ctr: fields.ctr.value ? parseFloat(fields.ctr.value) : null,
    adminNotes: notesField.value.trim(),
    isPublished,
    updatedAt: serverTimestamp(),
  };
}

async function saveReport(isPublished) {
  if (!reportMonth.value) {
    alert("Pick a month first.");
    return;
  }
  publishBtn.disabled = true;
  draftBtn.disabled = true;

  try {
    const data = buildReportData(isPublished);

    const reportsRef = collection(db, "clients", CLIENT_SLUG, "monthlyReports");
    if (editingReportId) {
      await updateDoc(doc(reportsRef, editingReportId), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(reportsRef, data);
    }

    resetForm();
  } catch (err) {
    alert("Something went wrong saving this report: " + err.message);
  } finally {
    publishBtn.disabled = false;
    draftBtn.disabled = false;
  }
}

publishBtn.addEventListener("click", () => saveReport(true));
draftBtn.addEventListener("click", () => saveReport(false));
cancelBtn.addEventListener("click", resetForm);

function resetForm() {
  currentFile = null;
  editingReportId = null;
  reportMonth.value = "";
  pdfInput.value = "";
  dropzoneLabel.textContent = "Click to choose a PDF, or drag one here";
  extractStatus.textContent = "";
  extractStatus.className = "extract-status";
  reviewGrid.classList.remove("is-visible");
  Object.values(fields).forEach((f) => (f.value = ""));
  Object.values(tags).forEach((t) => {
    t.textContent = "not found";
    t.classList.remove("found");
    t.classList.add("missing");
  });
  notesField.value = "";
}

/* ------------------------------------------------------------------ */
/* Existing reports list                                                */
/* ------------------------------------------------------------------ */

function platformLabel(p) {
  return { meta: "Meta", tiktok: "TikTok", google: "Google Ads" }[p] || p;
}

function listenToReports() {
  const reportsRef = collection(db, "clients", CLIENT_SLUG, "monthlyReports");
  const q = query(reportsRef, orderBy("monthStart", "desc"));
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      reportsList.innerHTML =
        '<p class="empty-note">No reports uploaded yet — the first one you add will show up here.</p>';
      return;
    }
    reportsList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const r = docSnap.data();
      const item = document.createElement("div");
      item.className = "report-item";
      const monthLabel = r.monthStart
        ? new Date(r.monthStart + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : "—";
      item.innerHTML = `
        <div class="report-main">
          <span class="report-title">${monthLabel} &middot; ${platformLabel(r.platform)}</span>
          <span class="report-meta">${
            r.spend != null ? "$" + Number(r.spend).toLocaleString() : "no spend logged"
          } &middot; ${r.results != null ? r.results + " results" : "no results logged"}</span>
        </div>
        <span class="status-pill ${r.isPublished ? "published" : "draft"}">${
        r.isPublished ? "Published" : "Draft"
      }</span>
        <div class="report-actions">
          <button class="icon-btn" data-action="toggle" data-id="${docSnap.id}" data-published="${r.isPublished}">${
        r.isPublished ? "Unpublish" : "Publish"
      }</button>
          <button class="icon-btn" data-action="edit" data-id="${docSnap.id}">Edit</button>
          <button class="icon-btn danger" data-action="delete" data-id="${docSnap.id}">Delete</button>
        </div>
      `;
      reportsList.appendChild(item);
    });
  });
}

reportsList.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const reportsRef = collection(db, "clients", CLIENT_SLUG, "monthlyReports");

  if (btn.dataset.action === "toggle") {
    const isPublished = btn.dataset.published === "true";
    await updateDoc(doc(reportsRef, id), { isPublished: !isPublished });
  }

  if (btn.dataset.action === "delete") {
    if (confirm("Delete this report? This can't be undone.")) {
      await deleteDoc(doc(reportsRef, id));
    }
  }

  if (btn.dataset.action === "edit") {
    const snap = await getDoc(doc(reportsRef, id));
    if (!snap.exists()) return;
    const r = snap.data();
    editingReportId = id;
    reportMonth.value = r.monthStart ? r.monthStart.slice(0, 7) : "";
    reportPlatform.value = r.platform || "meta";
    fields.spend.value = r.spend ?? "";
    fields.results.value = r.results ?? "";
    fields.cpr.value = r.costPerResult ?? "";
    fields.impressions.value = r.impressions ?? "";
    fields.clicks.value = r.clicks ?? "";
    fields.ctr.value = r.ctr ?? "";
    notesField.value = r.adminNotes || "";
    dropzoneLabel.textContent = "You're editing saved numbers — re-upload the PDF only if you want to re-detect them";
    reviewGrid.classList.add("is-visible");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});
