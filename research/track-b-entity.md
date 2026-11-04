# TRACK B — Corporate Entity Intelligence: EBC Flex Participant Portal

**Step 5 — Autonomous SEO Intelligence · Track B deliverable**
Target project: `/Users/emperorofafrica/Documents/TAF/Tobi/ebcparticipant`
Research date: 2026-11-02
Evidence tags on every claim: **OBSERVED** (direct source) / **INFERRED** (derived) / **ESTIMATED** (approximate) / **UNKNOWN** (not established).

---

## 1. Entity Identification (from repo + web verification)

| Fact | Value | Evidence | Source |
|---|---|---|---|
| Site display name | `EBC Flex` | OBSERVED | `lib/site-url.ts` `SITE_DISPLAY_NAME` |
| Project display name | `EBC Flex Participant Portal` | OBSERVED | `lib/project-config.ts` `PROJECT_DISPLAY_NAME` |
| "EBC" = **Employee Benefits Corporation** | Legal entity name; national third-party benefits administrator (TPA) | OBSERVED | https://www.ebcflex.com/ (© Employee Benefits Corporation), https://www.ebcflex.com/contactus/ (200), ebcflex.com/wp-content/uploads/EBC-Introduction_9111-Generic.pdf |
| Brand / product family | "EBC Flex" is the consumer-driven benefits brand of Employee Benefits Corporation | OBSERVED | https://www.ebcflex.com/ site title + product pages |
| Authentic participant login (Track A destination) | `https://portals.ebcflex.com/Participant/AuthenticateUser/Login.aspx?ReturnUrl=%2fParticipant` | OBSERVED | `lib/project-config.ts` `LOGIN_REDIRECT_URL` (HTTP 200 verified 2026-11-02) |
| Participant portal tagline | "Participant Login \| Your Personal Benefit Account" — "Enter your username and password to access your individual benefit account" | OBSERVED | portals.ebcflex.com login page copy (harvested into `lib/seo-keywords.ts` `DESTINATION_KEYWORDS`) |
| Employer-side login | "To manage your organization's benefit plan, log in as an employer" (separate employer portal) | OBSERVED | `components/ebc-login-landing.tsx`, portals.ebcflex.com |
| Company tagline | "Technology when you need it. People when it matters." | OBSERVED | https://www.ebcflex.com/ homepage |
| Brand slogan | "Ten Solutions. One Partner." | OBSERVED | https://www.ebcflex.com/ homepage |
| Site archetype (per master spec) | **Archetype 2 — Consumer-Directed Healthcare & Tax-Advantaged Accounts** (HSA/FSA/HRA/Commuter + Benefits Card + claims) | INFERRED | Product mix below |
| Repo name `ebcparticipant` | matches "EBC Participant" = participants of Employee Benefits Corporation plans | INFERRED | `lib/project-config.ts` `DEFAULT_PROJECT_ID` |

**Conclusion:** "EBC" is **Employee Benefits Corporation**, a private, 100% employee-owned (ESOP), Middleton, Wisconsin-based third-party administrator of consumer-directed benefit accounts (FSA, HSA, HRA, LSA, commuter, COBRA, POP, billing, compliance, Medicare Advantage supplemental benefits). It is **not** an employer itself — it is the **benefits administrator/plan servicer** whose participant portal this project replicates.

---

## 2. Corporate Background & Identity

- **Founded:** 1989 (BBB "Business Started 1/1/1989"; akta.pro "Founded 1989"; LinkedIn "founded in 1989") — **OBSERVED** (multi-source agreement). https://www.bbb.org/us/wi/middleton/profile/employee-benefit-plan/employee-benefits-corporation-0694-14005514
- **Incorporated (current entity):** 12/10/2001, Corporation, Wisconsin — **OBSERVED** (BBB).
- **HQ:** 1350 Deming Way, Suite 200, Middleton, WI 53562-4640 — **OBSERVED** (https://www.ebcflex.com/contactus/, 200). BBB lists "Ste 300" (suite discrepancy — **OBSERVED conflict**; use official contact page value).
- **Mailing:** General Mail PO Box 44347, Madison, WI 53744-4347; COBRA Payments PO Box 2420, Omaha, NE 68103-2420 — **OBSERVED** (contactus page).
- **Ownership:** Private company; 100% employee-owned via ESOP since 2002 — **OBSERVED** (third-party): https://www.certifiedeo.com/company/employee-benefits-corporation ("Employee Ownership Type: ESOP, Employee-Owned Since: 2002"), cobrainsurance.com ("employee-owned … Founded in 1989"). No parent company or acquisition history disclosed — **OBSERVED/INFERRED** (akta.pro: "no disclosed parent or acquisition activity").
- **Workforce:** ~223 employees (LinkedIn, 2026) / ~226 (GraphIQ) / "51–100" (akta.pro) — **ESTIMATED** (sources conflict; use "~200+" only in prose, never a precise count).
- **Leadership named publicly:** Jennifer Christianson, VP of Operations; Erica Oppenheimer, Marketing Director — **OBSERVED** (BBB). CEO name: **UNKNOWN**.
- **Registered DBA legal entities (state registrations) — OBSERVED** (EBC Introduction PDF + LinkedIn About):
  - "EBC Benefits Administration Corporation" (DBA in AZ, CA, FL, KY, MA, MT, NC, NE, NY, OH, RI, TN, VA, WA)
  - "Employee Benefits Administrators of WI" (DBA in NH)
  - "EBC Benefits Administration" (DBA in VT)
- **Stock ticker:** **NONE** — private company, not publicly traded — **OBSERVED/INFERRED** (no exchange listing found; akta.pro "Company type: Private").
- **Geographic reach:** Employers/health plans/individuals "across all 50 states" — **OBSERVED** (ebcflex.com homepage Customer Satisfaction copy).

---

## 3. Benefits & Plan Structure ("Ten Solutions. One Partner.")

Official 10-solution suite — **OBSERVED** (https://www.ebcflex.com/ homepage, verbatim labels):

1. **FSA** (Flexible Spending Account) — cafeteria plan; includes limited-purpose FSA (dental/vision) and individual premium FSA variants — OBSERVED (EBC Claim Form benefit codes [F]/[L]/[I]).
2. **HSA** (Health Savings Account) — tax savings + investment options; delivered in partnership with **Pacific Life** (high-yield interest) and **WealthCare Saver** (custody/investments) — OBSERVED (EBC Introduction PDF; partnership detail via akta.pro = **INFERRED**).
3. **HRA** (Health Reimbursement Arrangement) — employer-designed; product brand **"The EBC HRA℠"** — OBSERVED (LinkedIn showcase affiliated pages).
4. **COBRA** — end-to-end continuation administration; platform **COBRASecure℠**; state continuation in WI, MN (all employers) + TX, NY, CT (with federal COBRA) — OBSERVED (https://www.ebcflex.com/cobrasolution/, LinkedIn showcase). (cobrainsurance.com also names "COBRASource" — **OBSERVED conflict**; COBRASecure is the branding EBC itself uses.)
5. **Commuter Benefits** — transit + parking; product brand **"CommuteEase"** — OBSERVED (EBC Introduction PDF; LinkedIn showcase).
6. **Lifestyle Spending Account (LSA)** — after-tax account (fitness, professional development, etc.) — OBSERVED (EBC Introduction PDF).
7. **Billing Services** — recurring premium billing — OBSERVED (EBC Introduction PDF).
8. **Premium Only Plans (POP)** — pre-tax premium contributions — OBSERVED (EBC Introduction PDF).
9. **Medicare Advantage** — supplemental benefits (OTC/SIKA debit card for health-plan partners) — OBSERVED (homepage list; BBB products). SKU-level OTC detail = **INFERRED** (akta.pro).
10. **Compliance Services** — wrap plan documents, Form 5500 filing, nondiscrimination testing (§125 cafeteria plans & FSAs) — OBSERVED (EBC Introduction PDF).

Additional product brands (OBSERVED — LinkedIn showcase affiliated pages): **The BESTflex Plan℠** (FSA brand), **SimplyHSA** (HSA brand), **COBRASecure℠**, **CommuteEase**.

**Participant-facing platform facts (OBSERVED):**
- **EBCentral® mobile app** — free; App Store (id1568713296) + Google Play (`com.ebcflex.ebcmoble`); developer/seller "Employee Benefits Corporation"; rebranded from **"EBC Mobile"** (App Store notes v2.5.1, 12/18/2025); ~50K+ downloads (Google Play), 4.7★ Apple / 3.2★ Google — sources: https://apps.apple.com/us/app/ebcentral/id1568713296 (200), https://play.google.com/store/apps/details?id=com.ebcflex.ebcmoble (200), https://ebcflex.com/mobile-app (200).
- **Benefits Card** — EBC debit card; lock/unlock, close & replace, extra cards for eligible dependents, push notifications, receipt substantiation (IIAS/SIGIS auto-substantiation = **INFERRED** per akta.pro); digital wallets Apple/Google/Samsung Pay (**INFERRED**).
- **Claims** — submit via EBCentral app, online account (ebcflex.com), or fax (608) 831-4790 with claim form + benefit code ([F],[L],[D],[I],[H],[HF],[DC],[O],[LS]); **digital claims typically processed within 2 business days** — OBSERVED (https://www.ebcflex.com/submittingclaims/ (200), EBC Claim Form P1-9069).
- **Account security** — two-step verification required at account creation; biometric login on app — OBSERVED (FSA Toolkit Implementation Guide P2-91063-T; submittingclaims page).
- **My Account Assistant** — account-recovery/registration assistant on the participant login page (requires JavaScript & Cookies) — OBSERVED (portals.ebcflex.com login copy harvested in `lib/seo-keywords.ts`).
- **IRS 2026 limits (for FAQ content)** — health FSA $3,400; max carryover $680; commuter $340/mo (each) — OBSERVED (IRS Rev. Proc. 2025-32, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf). EBC publishes these at ebcflex.com/PlanLimits (200).

---

## 4. Grounded Helplines (every number sourced)

| Contact | Value | Hours | Source (verified) |
|---|---|---|---|
| Participant Services phone (toll-free) | **(800) 346-2126** | Mon–Fri 7:00 a.m.–7:00 p.m. Central | https://www.ebcflex.com/contactus/ (HTTP 200, 2026-11-02) |
| Participant Services phone (local) | **(608) 831-8445** | same | contactus page; also on EBC Claim Form P1-9069 |
| Participant Services email | **participantservices@ebcflex.com** | — | contactus page; EBC Claim Form; ALA HSA Enrollment Kit PDF |
| Client Services & Onboarding | same main number | Mon–Fri 7:00 a.m.–5:00 p.m. Central | contactus page |
| Employer Services email | employerservices@ebcflex.com | — | contactus page |
| Sales email | sales@ebcflex.com | — | contactus page; EBC Introduction PDF |
| Claims fax | **(608) 831-4790** | — | EBC Claim Form P1-9069 (ebcflex.com PDF) |
| Office hours (general) | Mon–Fri 7:00 a.m.–5:00 p.m., Sat/Sun closed | — | BBB profile (bot-blocked to curl, 403; content observed via search engine index) |

---

## 5. Search-Demand Compilation — 25+ realistic queries across 6 clusters

Queries below mix (a) **OBSERVED** suggest-harvest strings from `seo-intelligence.json` (Google/Bing/DDG suggest APIs, harvested 2026-11-01), (b) existing `lib/seo-keywords.ts` terms, and (c) **INFERRED** realistic user phrasings grounded in verified product/helpline facts. No search-volume claims are made (UNKNOWN — no keyword-volume tool available).

### Cluster 1 — Corporate / Brand (entity + aliases)
1. `employee benefits corporation` — OBSERVED (web)
2. `employee benefits corporation login` — OBSERVED (seo-keywords.ts)
3. `EBC Flex login` — OBSERVED (suggest harvest)
4. `EBC Flex` / `what is ebc flex` — OBSERVED (suggest harvest)
5. `ebcflex.com login` — OBSERVED (suggest harvest)
6. `EBC Benefits Administration Corporation` — OBSERVED (DBA entity)
7. `EBC Middleton WI` — OBSERVED (seo-keywords.ts STEP5)
8. `EBC third party administrator` — OBSERVED (EBC Introduction PDF phrasing)
9. `Ten Solutions One Partner EBC` — OBSERVED (homepage slogan)

### Cluster 2 — Benefits + Plans
10. `EBC FSA` / `ebc flex FSA login` — OBSERVED
11. `EBC HSA login` — OBSERVED (suggest)
12. `EBC HRA` — OBSERVED (product "The EBC HRA℠")
13. `EBC COBRA login` / `ebcflex login cobrasecure` — OBSERVED (suggest)
14. `EBC commuter benefits` / `CommuteEase` — OBSERVED
15. `EBC lifestyle spending account` — OBSERVED (seo-keywords STEP5)
16. `BESTflex plan` / `SimplyHSA` — OBSERVED (LinkedIn showcase)
17. `2026 fsa contribution limit` / `2026 fsa carryover limit` — OBSERVED (seo-keywords STEP5; grounded in Rev. Proc. 2025-32)
18. `ebc flex plan limits` — OBSERVED
19. `what happens to unused fsa money` — OBSERVED (seo-keywords STEP5)
20. `hsa vs fsa` — OBSERVED (seo-keywords STEP5)

### Cluster 3 — Auth / Action Intent
21. `ebcflex participant login` — OBSERVED (suggest)
22. `portals.ebcflex.com login` — OBSERVED (suggest)
23. `EBC Flex sign in` — OBSERVED
24. `ebcflex forgot username` — OBSERVED (seo-keywords)
25. `ebcflex reset password` — OBSERVED
26. `EBC Flex create account` / `Register EBC Flex` — OBSERVED
27. `EBC Flex two step verification` — OBSERVED (seo-keywords STEP5)
28. `My Account Assistant` — OBSERVED (destination login copy)

### Cluster 4 — Participant / Role
29. `EBC participant portal` / `EBC participant login` — OBSERVED
30. `your personal benefit account login` — OBSERVED
31. `individual benefit account login` — OBSERVED (login intro copy)
32. `log in as a participant` vs `log in as an employer` — OBSERVED (login chrome)
33. `EBC Flex dependent care FSA` — OBSERVED
34. `employee benefits corporation retiree` — INFERRED (COBRA continuants = former employees/dependents)
35. `EBC COBRA qualified beneficiary login` — INFERRED (grounded in COBRASecure admin)

### Cluster 5 — Platform / Vendor
36. `EBCentral login` / `EBCentral app` — OBSERVED (suggest + app stores)
37. `EBC Mobile app` (legacy name) — OBSERVED (App Store rebrand note)
38. `download EBCentral` — OBSERVED
39. `COBRASecure` — OBSERVED (LinkedIn showcase)
40. `WealthCare Saver HSA` / `Pacific Life HSA EBC` — INFERRED (partnership reports)
41. `EBC benefits card` / `EBC benefits debit card` — OBSERVED

### Cluster 6 — Self-Service / Mobile / Support
42. `ebc flex customer service telephone number` — OBSERVED (suggest)
43. `ebc flex phone number` — OBSERVED (suggest)
44. `submit a claim EBC Flex` — OBSERVED
45. `ebc flex upload receipt` / `check claim status ebc flex` — OBSERVED
46. `activate ebc benefits card` — OBSERVED (seo-keywords STEP5)
47. `ebc flex direct deposit` — OBSERVED (seo-keywords)
48. `ebc flex claim processing time` — OBSERVED
49. `ebc mobile app` — OBSERVED (suggest)
50. `where to shop FSA EBC Flex` — OBSERVED (seo-keywords)

*(50 queries, ≥25 required. All safe to feed `SITE_VISIBLE_KEYWORDS`; raw host tokens stay in `<meta name="keywords">` per spec.)*

---

## 6. FAQ Material — exactly 6 grounded Q&As (inverted pyramid)

> Format for implementers: sentence 1 = direct 35–50-word answer; then requirements/steps. Pair 1:1 with `<details><summary>` + `FAQPage` JSON-LD on `crawler-seo.astro` only.

**Q1. How do I sign in to the EBC Flex Participant Portal?**
**A.** Sign in at the EBC Flex participant login with the username and password for your individual benefit account, then confirm two-step verification if prompted. Use "log in as a participant" — employers managing an organization's benefit plan use the separate employer login. First-time users select Create Account and follow registration prompts. (OBSERVED — portals.ebcflex.com login copy; FSA Toolkit Implementation Guide P2-91063-T; ebc-login-landing.tsx)

**Q2. How do I recover a forgotten username or reset my password?**
**A.** Use the Forgot Username and Reset Password links on the EBC Flex sign-in page to restore access through self-service verification. Recovery uses the My Account Assistant, which requires JavaScript and cookies, and verifies identity through the email or phone on your account because two-step verification is mandatory. (OBSERVED — destination login copy "Forgot Username", "Reset Password", "My Account Assistant requires JavaScript and Cookies"; FSA Toolkit two-step requirement)

**Q3. How do I submit a claim, and how fast is it processed?**
**A.** Submit claims digitally through the EBCentral mobile app or your online account at ebcflex.com — digital claims are typically processed within two business days. Snap or attach itemized receipts and select the correct benefit code (F, L, D, I, H, HF, DC, O, or LS). Paper alternative: fax the EBC claim form and documentation to (608) 831-4790. (OBSERVED — https://www.ebcflex.com/submittingclaims/; EBC Claim Form P1-9069)

**Q4. What is the EBCentral app and which devices does it support?**
**A.** EBCentral is EBC's free mobile app for managing FSA, HSA, HRA, and commuter accounts — balances, claims, receipt uploads, and Benefits Card controls in one place — available on the Apple App Store and Google Play. It requires iOS 17.5+/Android 10+ per store listings (the mobile-app page states iOS 16+), with biometric login and two-step verification. Formerly named "EBC Mobile," it was rebranded EBCentral in December 2025. (OBSERVED — apps.apple.com/us/app/ebcentral/id1568713296; play.google.com id=com.ebcflex.ebcmoble; ebcflex.com/mobile-app. iOS floor conflict noted: 17.5 store vs 16 marketing — prefer store listing.)

**Q5. What is the deadline for FSA claims and what happens to unused FSA money?**
**A.** Your FSA plan year and claim deadline are set by your employer's plan document; check plan-year end dates in EBCentral or your online account. Unused health FSA funds are forfeited unless your plan offers a grace period (up to 2½ months) or a carryover — for 2026 the IRS caps carryover at $680, and plans may offer either option but not both. (OBSERVED — EBCentral "important dates like when your plan year ends" (app listing); IRS Rev. Proc. 2025-32 ($3,400 limit, $680 carryover); HealthCare.gov grace-period rule)

**Q6. Who do I call for help with my EBC Flex account or Benefits Card?**
**A.** Call EBC Participant Services at (800) 346-2126 or (608) 831-8445, Monday–Friday 7:00 a.m.–7:00 p.m. Central, or email participantservices@ebcflex.com. For lost or stolen Benefits Cards, lock the card instantly in EBCentral and close/replace it from the app; additional cards for eligible dependents can also be requested there. (OBSERVED — https://www.ebcflex.com/contactus/; ebcflex.com/mobile-app card controls)

---

## 7. Knowledge Graph Grounding (verified HTTP status, 2026-11-02; never fabricate `sameAs`)

| Entity URL | Role | HTTP status (curl, 2026-11-02) | sameAs eligible? |
|---|---|---|---|
| https://www.ebcflex.com/ | Official site | **200** | Yes — `Organization.url` |
| https://ebcflex.com/ | Apex twin | **200** | canonical → www |
| https://www.ebcflex.com/contactus/ | Official contact/about | **200** | citation |
| https://portals.ebcflex.com/Participant/AuthenticateUser/Login.aspx | Authentic participant portal | **200** | citation |
| https://www.linkedin.com/company/employeebenefitscorporation | LinkedIn company page | **200** | **Yes — `sameAs`** |
| https://x.com/EBCflex | Official X account (akta.pro social record) | **200** | Yes — `sameAs` |
| https://facebook.com/EmployeeBenefitsCorporation | Facebook page (akta.pro record) | 400 to curl (bot artifact) — **UNKNOWN** | Only if live-verified at build time |
| https://apps.apple.com/us/app/ebcentral/id1568713296 | EBCentral App Store | **200** | citation |
| https://play.google.com/store/apps/details?id=com.ebcflex.ebcmoble | EBCentral Google Play | **200** | citation |
| https://www.certifiedeo.com/company/employee-benefits-corporation | ESOP ownership record | **200** | citation |
| https://www.bbb.org/us/wi/middleton/profile/employee-benefit-plan/employee-benefits-corporation-0694-14005514 | BBB profile (accredited since 2006) | 403 (bot-blocked; indexed content observed) | citation only |
| Wikipedia article | — | **404 — no page exists** | **NO** |
| Wikidata entity | — | **0 search hits** (wbsearchentities) | **NO** |
| Stock ticker | — | **NONE (private company)** | omit `tickerSymbol` |

**Important for implementers:** EBC has **no Wikipedia article and no Wikidata QID**. Do NOT emit `sameAs` links to Wikipedia/Wikidata. Safe `sameAs` set = LinkedIn + X (+ Facebook only if re-verified). Use `Organization` with `legalName: "Employee Benefits Corporation"`, `alternateName: ["EBC", "EBC Flex", "EBC Benefits Administration Corporation"]`, `contactPoint` (telephone +1-800-346-2126, contactType "customer support", hours Mo-Fr 07:00-19:00 America/Chicago), `address` 1350 Deming Way Suite 200, Middleton, WI 53562.

---

## 8. Evidence Ledger & Implementer Notes

- All helplines in §4 are source-URL grounded — safe for `Member Support` copy, FAQ 6, `Organization.contactPoint`, `llms.txt`.
- Brand strings for SERP 5-tier card: `SITE_DISPLAY_NAME` = **"EBC Flex"** (keep as-is); `alternateName` candidates: `EBC`, `Employee Benefits Corporation`, `EBCentral`.
- Suggested twin `<title>` stays existing pattern (`Login | EBC Flex Participant Portal` / action + brand, 30–60 chars) — A13 compliant (OBSERVED from `lib/site-url.ts`).
- Known conflicts to avoid asserting: HQ suite 200 vs 300; COBRASecure vs COBRASource; iOS floor 16 vs 17.5; headcount 100–230. Each is disclosed above with tags.
- Claims of search volume, ranking difficulty, traffic: **UNKNOWN** — none fabricated.
