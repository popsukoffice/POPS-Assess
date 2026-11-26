# POPS Assess (remote assessment for educational psychologists)

Informal, assessor-led, criterion-referenced activities given over a video call. The child opens a link and types a 6-character code (no sign-in). The educational psychologist (EP) runs the session from a signed-in console. No norms, standard scores or reading ages. All items are original.

Stack: GitHub -> Vercel (static pages) + Supabase. This product is separate from Help at School: its own repository, Vercel project, domain and database.

## Files (repository root)
- `index.html` child page (open as `/?c=CODE`)
- `assessor.html` EP console (sign in, create account, forgot password, preview, report, user management for the admin)
- `config.js` Supabase URL and publishable key for the POPS Assess database
- `logo.jpg`
- `lib.js` scoring helpers (confidence bands, response-time summary, spelling error analysis); loaded by `assessor.html`
- `supabase/assess_schema.sql`, `supabase/seed_items_v2.sql`, `supabase/assess_v4_schema.sql`, `supabase/seed_v4.sql` (all already applied to the database)
- `analysis/calibrate.py`, `analysis/simulate.py` (Rasch calibration and reliability from pooled data)
- `tests/` unit tests for `lib.js` (run with node)
- `.github/workflows/keepalive.yml` (only needed while the database is on the Free plan)

## Set-up
1. Create a new GitHub repository (for example `pops-assess`) and upload everything in this folder to its root, keeping the `.github/workflows` path.
2. In Vercel: Add New Project, import that repository, framework "Other", no build command. Add your own domain if you have one.
3. Supabase (project "popsukoffice@gmail.com's Project", Authentication -> URL Configuration): set Site URL to the Vercel address of `assessor.html` and add it to Redirect URLs, so confirmation and password-reset emails return to the console.
4. Open `assessor.html`, choose Create account, and sign up with popsukoffice@gmail.com. Then ask Claude to switch that account on as admin (one SQL line), or do it yourself (below).
5. Run the keepalive workflow once from the repository's Actions tab.

Make yourself admin (SQL editor):
`update public.assessors set status='active', is_admin=true where user_id=(select id from auth.users where email='popsukoffice@gmail.com');`
If the confirmation email does not arrive: `update auth.users set email_confirmed_at=now() where email='popsukoffice@gmail.com';`

## Selling it: how accounts work
- An EP clicks Create account and enters name, practice, HCPC number, email and password. The account is pending: they can sign in but see only a waiting message.
- You open Manage users (admin only), check the HCPC number on the register, set the status to active and optionally a licence end date. Suspending or an expired licence blocks the console and all data access immediately.
- Every EP sees only their own sessions and results (database row-level security). Other EPs and the admin cannot read them through the app. The item bank is shared.
- Reports carry the EP's name and practice. Items and report format carry the POPS UK copyright and "used under licence" line.
- Payment is outside the app for now (invoice, then set the licence end date).

## Activities
Letter recognition (capitals then small letters, jumbled), word reading, reading comprehension, maths, listening comprehension, digits forwards, digits backwards, remembering words (unrelated common words). Tick the ones you want, order them with the arrows, and press Begin for each.

## Preview run
Tick Preview when creating a session to check how it works. It has a normal 24-hour code, so open the child link on a second device to see the child's screen. Jump to any activity or item. Nothing is recorded; end it to delete it.

## Recording and totals
- Letters: the child sees the 26 letters in a fixed jumbled order. Tap the ones read wrongly (and optionally type what was said). Capitals and small letters are scored out of 26 each.
- Word reading: mark, and type what the child said if wrong.
- Digit and word span: read one per second (Pace guide), type the response; auto-marked with error type (omission, order, substitution, extra). Stops when both tries at one length fail.
- Listening: read the story once, type the answer, mark against the accepted answer.
- Comprehension and maths: recorded from the child's screen.

## Report
Editable HTML: setting, summary, results by level, accuracy by word type or skill, error tables, patterns across activities, observations and points to consider (for the EP to complete), appendix on levels. Print/PDF, Word (.doc), copy, CSV.

## How year level and age are estimated
A level is secure at 80% correct (word reading, maths) or 75% (comprehension, listening); the next level is "emerging" at 50% or more. The estimate is the curriculum year of the highest secure level and the typical England age for it. It is not a reading age.
- Word reading: 12 levels, one year group each (Reception to Year 11), 10 words each. Reception CVC words; Year 1 phonics and Year 1 common exception words; Year 2 common exception words; Years 3 to 6 only from the statutory Appendix 1 lists. The DfE gives one list for Years 3/4 and one for Years 5/6, so the earlier year gets the higher-frequency half and the later year the lower-frequency half: approximate. Years 7 to 11 have no statutory list, so each is a band by word frequency and spelling difficulty: indicative only.
- Reading and listening passages: readability (Flesch-Kincaid, England year = US grade + 1), sentence length, vocabulary frequency, KS1/KS2 reading domains.
- Maths: Years 1 to 6 follow the year-by-year National Curriculum programmes of study, 5 items each. Key Stage 3 is one programme with no year split, so Years 7, 8 and 9 follow typical schemes of work: indicative.
- Letters and span: no age conversion.
- Letter shapes depend on the device font (for example single-storey or double-storey a and g). The page asks for a child-friendly font first and falls back to the device default.

## Before selling
Terms of use and a data processing agreement (each EP or service is the data controller for the children they assess; POPS UK is their processor), a privacy notice, a DPIA template for schools, ICO registration for POPS UK, a retention job (the database keeps sessions until deleted), rate limiting on the child code, and the Supabase Pro plan (backups, no pausing). The database is in Stockholm (eu-north-1).

## Reading voice and misread words
- **Digit and word spans**: tap "Read digits at 1 per second" when the child is ready. The voice on the child's device says one item per second, once. Backwards: digits are read forwards, the child answers backwards.
- **Listening comprehension**: "Read story" and "Read question" play through the child's device. The child must tap "Turn on sound" once (browser rule). The console shows when sound is on. "Play here" plays on your own device instead.
- **Reading comprehension**: if the child reads the passage aloud, tap misread words (optionally type what they said). They appear in the report and CSV with word accuracy per passage.
- Voice is the device's built-in British English voice where available. Quality varies by device; check on the child's device in preview.

## Saving and emailing
- Every mark, misread word and screen change is saved to the database as you go; the console shows "✓ Saved hh:mm" (or a red warning if offline). A session can be reopened from the home list at any time.
- Report edits autosave 1.5 seconds after you stop typing, and are restored when you reopen the session.
- "Save case file" downloads one self-contained HTML file: the report plus every question, expected answer, the child's response and the mark.
- "Email case file" uses the device share sheet to attach it where supported (phones/tablets). On desktop it downloads the file and opens a blank email for you to attach it to. A web page cannot send email itself. Use secure/encrypted email, as the file contains a child's assessment data.

## Date of birth and age
The assessor can enter the child's date of birth when setting up a session. The tool shows the age in years and months, suggests the typical England year group (age on 31 August; you can override it), shows the age in the console header, and puts date of birth, age at assessment and an age-versus-level comparison in the report. The date of birth is stored with the session (not shown to the child, and not sent to the child page). It is personal data: include it in your DPIA, and consider whether a case code alone is enough. Sessions created before this update simply show "not recorded".

## Dyslexia
The tool is not a diagnostic instrument. See the report's "Limits of this assessment" paragraph.

## Spelling, one-minute reading, phonological awareness (added)
- **Run `supabase/seed_new_v3.sql`** in the Supabase SQL editor once (already applied to the POPS Assess project) to add the new activities.
- **Spelling**: 96 dictated words (8 per level, Reception to Year 11), read by the child's device or by you. The child types the word; marking is automatic; levels use the same method as word reading.
- **One-minute reading**: three original passages (easier, middle, harder). Tap errors during the 60 seconds, tap the last word read, save. Gives words correct per minute and accuracy, an England-median "fluency equivalent" in years and months, and a US percentile band (Hasbrouck and Tindal 2017; England Year = US grade + 1).
- **Phonological awareness**: blending, segmenting, removing sounds, finding sounds (10 items each, informal, no norms).
- **Digit span**: report adds an approximate typical range for the child's age. These ranges are indicative only; sources differ and they are not UK standardisation norms.
- Norms are for a rough indication. They are not a reading age or standard score, and not a substitute for a standardised, SASC-listed test.

## Choosing activities as you go; nonword reading
- Ticking activities when you create a session only suggests an order. During the session open "Choose or change the activity" to start any activity (part-finished ones carry on where you left off). After an activity ends the session pauses between activities so you decide what comes next. "Finish session and create report" ends it at any point.
- The report, case file and CSV cover only the activities you actually gave.
- Nonword reading (64 original made-up words, 8 levels from simple CVC to long complex words) is graded like word reading. The report compares nonword and real-word reading. Run `supabase/seed_nonword_v3.sql` once if you are setting up a new project (already applied to the POPS Assess project).


## Version 4 additions

### Test forms, practice, sound check
- Each session uses Form A or Form B (chosen when creating the session; "Automatic" alternates for repeat sessions with the same child reference). Spelling (96 items per form), nonword reading (64 per form) and the one-minute reading passages (three parallel passages per level band) have two forms. Word reading and maths have one form. Use Form B for retest or monitoring.
- Practice items (unscored) run before word, nonword, spelling, comprehension and maths. A sound check runs at the start of every session (a random word is played to the child's device; record whether they could repeat it). Both go into the report.
- Conditions: the create form records device, connection, quiet space, adult, how the child is today, English as an additional language and home language. At the end the assessor ticks any interruptions, sound problems, adult help or tiredness. These produce an overall confidence rating (Good, Moderate or Limited) and flags in the report.

### Confidence bands and boundary probes
- Each level result is an 80% Wilson interval. A level is "secure" only if the point estimate reaches the threshold and, with at least four items, the lower bound does too. The report says, for example, "secure at Year 3, probably emerging at Year 4", or "probably secure at Year 3 (too few items to be firm)".
- When a graded activity ends by its stop rule or by running out of items, and the boundary is uncertain, the console offers 8 to 12 extra items at up to three levels near the boundary (4 per level). The assessor can skip. Probe items are a separate pool, shared by both forms, so the same probe items can appear on a retest: practice effects are possible.
- Age equivalents are off by default (tick the option when creating a session to include them). The year-group comparison and approximate norm comparisons for fluency and span remain, labelled as indicative.

### New activities and scoring
- Response time (word and nonword reading): the existing `ms` column, timed by the assessor from the word appearing to the mark. It is approximate (includes assessor reaction time and video delay) and has no norms. It is reported as medians, correct words only, so it describes accuracy against efficiency within the child. Keyboard shortcuts C (correct), X (incorrect) and S (skipped) improve timing precision.
- Rapid naming (RAN): four 5 x 10 tasks (digits, letters, colours, objects) with a naming check, assessor-timed. No norms are claimed. The colour task uses red and green: note possible colour vision difficulty. Not ticked by default.
- Spelling error analysis: automatically classifies each misspelling as phonologically plausible or not (and tags such as letters swapped, vowel omitted, doubling missed, b/d/p/q confusion). It is a rule-based estimate (it passes the 88 unit cases in `tests/` and 64 of 65 plausible respellings of the longer test words that I tried; those were chosen by me, not drawn from children, so treat accuracy on real children as unknown), the assessor can override the class on each item, and the report says so.
- Open comprehension (`comp_open`): two oral questions per passage, Years 1 to 8, scored 0, 1 or 2 against a rubric; a level is secure at 75% of points. Not ticked by default.
- Multiple-choice comprehension: the report adds a guess-corrected score (right minus one third of wrong) and a binomial check against the 25% chance level.
- Retest: if the same assessor has an earlier finished session with the same child reference, the report adds a comparison and says what is within measurement error.

### Collecting data (the main commercial asset)
- Two levels of consent. Each EP opts in under Your details. For each session the EP ticks that the parent or carer has consented. Only then can the EP choose Contribute anonymised data on the finished report; they can withdraw that session later.
- The pool (`assess_pool`) holds item id, level, form, whether a probe, mark, response time, whole years of age, year group, device, connection, quiet, adult, EAL flag, sound check, and the month. No names, dates of birth, free text, notes or typed answers. The contributor is a random key, not the account id. EPs cannot read the pool; only the admin can (stats and CSV export under Manage users).
- Analysis: export the CSV, then `python3 analysis/calibrate.py pooled.csv out/`. It fits a Rasch model per test (items not given are treated as missing), reports item difficulty, infit and outfit, person-separation reliability and KR-20, flags items that misfit, shows mean difficulty by level, whether levels are in order and spaced, and the ability at which each level reaches the accuracy threshold. `analysis/simulate.py` generates data from known difficulties to check recovery (correlation about 0.98 with 400 sessions). Do not change thresholds on fewer than about 100 sessions per test.
- Before you collect from other EPs: a data processing agreement and privacy notice that cover pooling; decide your lawful basis and who is controller for the pooled data; complete a DPIA; check anonymisation with a data protection adviser (ICO guidance treats anonymisation as a risk assessment, not a label; year group, age in years, device and month are low-risk but not zero in small settings); add a retention rule. These are legal decisions, not something the software can settle.

### Limits to keep in mind
- Item difficulties and level thresholds are author-judged until calibrated. The confidence bands show the uncertainty, but they do not fix it.
- Short, informal, assessor-timed, remotely delivered. It can raise questions for a full assessment; it cannot identify or rule out dyslexia or any other difficulty.

## Version 5 additions (psychometric diagnostics)

- **Second marking (spelling).** After a session ends, the report toolbar shows "Second marking (spelling)". A colleague classifies each wrong attempt as phonologically plausible or not, with the first marker's decision hidden. Agreement and Cohen's kappa for that child are shown on saving; the meaningful figure comes from pooled data.
- **Co-rated open comprehension.** While scoring an open question, an optional "Second rater's score" selector records a colleague's independent 0/1/2.
- **Pooled fields added** (`supabase/assess_v5_schema.sql`, already applied to the live project): `cls`, `cls2`, `score`, `score2`, `child_link`, `week`. `child_link` is an MD5 hash of the contributor key and child reference, used only to pair a child's sessions for test-retest; it is pseudonymous, not anonymous, so keep it in the DPA and privacy notice. `week` is the week commencing date. Withdrawal removes all of these.
- **`analysis/calibrate.py` now also reports** residual-PCA dimensionality, DIF (EAL and older/younger), test-retest with SEM and reliable-change thresholds, and kappa for the two second-marker fields. `analysis/simulate_v5.py` checks the diagnostics on simulated data (injected DIF, second dimension, retest pairs).
- DIF uses separate group calibrations with a |contrast| >= 0.5 logits and |t| >= 3 screen. Use it to review items, not to delete them automatically. Sex is not collected, so sex DIF cannot be tested.

## Devices and browsers

- **Supported:** current Chrome, Edge, Firefox and Safari on Windows, macOS, ChromeOS, iPadOS and Android. Minimum: Chrome/Edge 90, Firefox 98, Safari and iPadOS 15.4 (the console uses the HTML `dialog` element; the code is ES2020). Older browsers see a "please update your browser" banner instead of a blank page.
- **Layouts checked** (Chromium emulation): 1920x1080, 1366x768, 1280x720 at 125%, 1024x600, 200% zoom, iPad and iPad Pro (portrait and landscape), Galaxy Tab, Pixel 7, iPhone SE and 13. No horizontal scrolling, no JavaScript errors, inputs 16px or larger (no iOS zoom-on-focus), and touch targets 44px or larger on touch screens.
- **Not tested on real Safari or Firefox engines.** Before relying on it, do one run on an iPad (Safari) and one in Firefox: create a session, join with the child link, hear the dictated word (tap the sound button first; iOS needs a tap to allow speech), mark items, print the report to PDF.
- Browser text-to-speech voices differ by device; the audio check at the start of each session catches a missing or silent voice.
- Copy buttons fall back to a legacy copy method when the clipboard API is unavailable (for example on plain http).

## Version 6 additions (conclusions, bio details, PDF and Word)

- **Conclusions in the report.** After the activity sections the report now has: Summary of strengths and difficulties; Conclusions and implications for learning; and Suggestions for school (in the classroom, targeted intervention, monitoring and further assessment, home and school). They are drafted by `conclusions.js` from the child's results, compared with the year group (or the year estimated from age), and the suggestions change with the age phase (Reception, KS1, lower KS2, upper KS2, KS3, KS4, post-16). The wording is hypothesis-led and never diagnostic, adds cautions for EAL and for low-confidence sessions, and the whole report stays editable. `tests/conclusions.test.js` runs seven example profiles.
- **First name and bio details, kept on your computer.** "Report details" (under the session header) holds first name, surname, school, class teacher or SENCo, assessor name, role and HCPC number, reason for assessment, background, the child's and parent's views, and your observations. They are stored only in this browser (localStorage), never sent to Supabase, the child page or the pool. The report uses the first name throughout. There is a button to clear them. The first name can also be typed when the session is created. Use a computer you control; anyone with access to the same browser profile could see the stored details.
- **Assessor.** The assessor defaults to the name on the account (Willem van Rooyen), role "Educational Psychologist" and the HCPC number on the account, and each can be changed per report. A signature block closes the report.
- **PDF and Word.** "Download PDF" creates a real text PDF and "Download Word (.docx)" a real Word file, named `<first name>-<reference>-POPS-Assess-report-<date>`. Both are made in the browser from the report as it appears on screen, including your edits. The libraries (pdfmake, docx; both MIT) are self-hosted in `vendor/` and load only when a button is pressed. If creation fails the page offers Print (Save as PDF) or a simple .doc.
- **Data protection.** The downloaded report contains the child's name and background, so store and send it as you would any report. The case-file and email buttons also carry it.

## Numerosity (v7)
Two activities sit under Maths: **Quantity at a glance** (`numer_sub`, 18 dot patterns shown for 1 s, child types the number) and **Which has more?** (`numer_cmp`, 24 dot-pair comparisons shown for 1.5 s, half with area congruent and half incongruent). Layouts are generated deterministically in `numerosity.js` from stored seeds, so the same item looks the same on every device. Informal only: no norms; the Weber fraction is indicative and cannot diagnose dyscalculia. Database seed: `supabase/seed_numer_v7.sql` (already applied). Upload `numerosity.js` alongside `index.html` and `assessor.html`.

## Reading numbers (v8)
`numid` ("Maths: reading numbers") runs first in the Maths block: part 1 is the numbers 0 to 10 in a mixed-up order (11 items), part 2 is ten numbers from 11 to 100 (including 16, 90, 53, 47 and 100, chosen so that teen/tens mix-ups and reversals can show). The assessor taps any number read wrongly and a pop-up asks what the child said (digits or words). `POPSNUM.classifyNumErr` sorts each error into reversal (14 as 41), teen/tens mix-up (16 as sixty), one digit right, close, different number or no response. Seed: `supabase/seed_numid_v8.sql` (already applied). No child-page change was needed.

## Video link (v9)
`video.js` adds optional two-way video. The assessor console has a "Start video" panel (bottom right). The child page shows an allow/decline prompt, then a small picture of the assessor (bottom left) with Mute / Hide camera / Stop buttons. Video is peer-to-peer WebRTC and is never recorded or stored; Supabase only passes the connection messages (table `assess_signal`, function `video_signal`, migration `video_signal_v9`, rows deleted when the session ends or after 2 hours). Uses a public STUN server by default. For school networks that block peer-to-peer, add a TURN relay by setting `iceServers` in `config.js` (e.g. `ASSESS_CFG.iceServers = [{urls:"turn:...",username:"...",credential:"..."}]`). Not shown in preview runs.
