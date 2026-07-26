# AI (Claude) manual test checklist

Use this after switching all AI generation from Gemini to Anthropic Claude.

## Prerequisites

- [ ] **Admin → AI Configuration**: Provider set to **Anthropic Claude**, model e.g. `claude-sonnet-4-6`, **API Key** saved (or `ANTHROPIC_API_KEY` in `.env`).
- [ ] At least one workpack with basic data (equipment type, scope, optional joints/activities).

---

## 1. Materials — Generate with AI

- [ ] Open a workpack → **Materials** tab.
- [ ] Click **Generate with AI** (or equivalent).
- [ ] Request runs without error; materials list appears (or “No AI API key” if not configured).
- [ ] If key is set: server log shows `[AI] Calling claude-sonnet-4-6` (or your configured model).
- [ ] Optional: **Save** / **Regenerate** and confirm list updates and count is correct.

---

## 2. Constraints — Generate with AI

- [ ] Same workpack → **Constraints** tab.
- [ ] Click **Generate with AI**.
- [ ] Request succeeds; constraints list appears.
- [ ] Log shows `[AI] Calling …` for Claude.
- [ ] Optional: save/regenerate and confirm count.

---

## 3. Tools — Generate with AI

- [ ] Same workpack → **Tools** tab.
- [ ] Click **Generate with AI**.
- [ ] Request succeeds; tools list appears.
- [ ] Log shows Claude model in use.
- [ ] Optional: save and confirm tools are created.

---

## 4. Vision (joints from drawing)

- [ ] **Joints / Blind** tab (or tab with “Generate from Drawing”).
- [ ] Open the generation modal; upload a **PNG/JPG** (or use equipment spec only).
- [ ] Run generation.
- [ ] If vision provider is **Anthropic**: image is sent and joint list returns.
- [ ] If vision was still **Gemini**: error message says to switch to Anthropic in Admin → AI Configuration.

---

## 5. Errors and messaging

- [ ] With **no API key** configured: error mentions **Anthropic** (e.g. “No Anthropic API key configured … Admin → AI Configuration”), not Gemini.
- [ ] No remaining user-facing text that says “GEMINI_API_KEY” or “Gemini” as the required setup for these flows.

---

## 6. Console / logs

- [ ] On any successful AI call: log line like `[AI] Calling claude-sonnet-4-6` (or your model).
- [ ] No `generativelanguage.googleapis.com` or Gemini API URLs in logs for these features.

---

**Sign-off:** _________________   **Date:** _________
