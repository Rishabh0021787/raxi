# RAXI .WIN - Official Gaming Platform & Authentication System

A pixel-perfect, fully responsive mobile gaming web application featuring the **Strict Dark Burgundy & Crimson Red Colour Palette**, the official **RAXI .WIN** crown logo, and a **14-banner automatic sliding hero carousel**.

---

## 🎨 Strict Website Colour Palette

Defined as CSS variables inside `:root` and strictly applied across the entire UI:

```css
:root {
  --bg-primary: #2C0001;        /* Primary page background */
  --bg-secondary: #3E1919;      /* Secondary background */
  --bg-panel: #552122;          /* Panel and card background */
  --accent-red: #FA484C;        /* Primary accent red */
  --accent-red-dark: #9D1322;   /* Dark red accent */
  --accent-red-bright: #E52539; /* Bright red highlight */
  --text-primary: #FFFFFF;      /* Primary text */
  --text-secondary: #D09B9B;    /* Secondary text */
  --accent-gold: #EA9B1F;       /* Gold/orange accent */
  --accent-gold-light: #F5E5A0; /* Gold promotional text */
  --accent-blue: #0858A9;       /* Blue game-card accent */
  --accent-green: #9FD063;      /* Green game-card accent */
  --bg-outer: #9195A3;          /* Outer page background */
}
```

---

## 🎠 Automatic Sliding Hero Banner Section

Includes all **14 high-definition official banners** from `C:\Users\anoct\OneDrive\Desktop\banner` imported directly into [`banners/`](file:///C:/Users/anoct/.gemini/antigravity/scratch/yaarwin-auth/banners/):

1. `Banner_20260504162738s7ro.png`
2. `Banner_20260504163022oos4.png`
3. `Banner_202605041630437q1y.png`
4. `Banner_202605041631513kmu.png`
5. `Banner_20260504163352unjf.png`
6. `Banner_202605041716408si6.png`
7. `Banner_202605051403104uhf.png`
8. `Banner_20260505140350y9d7.png`
9. `Banner_202605051404339dx6.png`
10. `Banner_2026050713062831pj.jpg`
11. `Banner_20260922123853jtcl.png`
12. `Banner_20260925145903y8ws.png`
13. `Banner_20261002194250sfr3.png`
14. `Banner_202610081529352pqb.png`

### ⚙️ Slider Features
- **Auto-Play**: Automatically slides every 3.2 seconds with smooth cubic-bezier transitions.
- **Dynamic Pagination**: Glowing red pill dot indicator tracking the active banner.
- **Gesture Support**: Touch swipe on mobile & drag navigation on desktop.
- **Smart Pause**: Automatically pauses when hovered or touched, resumes seamlessly when released.

---

## 📱 Page Views (Interactive Bottom Navigation)

1. **Home Page**:
   - Header with RAXI .WIN logo, app download, customer support
   - 14-banner automatic sliding hero carousel
   - Marquee ticker announcement
   - 5 Category squircle icons (Popular, Lottery, Mini games, Slots, Sports)
   - 3-column game cards with RTP badges (Aviator, Cricket, Money Coming, Boom, Chicken Road 2, Aviator Classic)
   - Popular games (Fortune Gem 500, Money Coming, Lucky Jaguar 500)
   - Sticky floating "Get ₹13 Add to Desktop" bar

2. **Activity Page**:
   - Today's & Total bonus stats with "Bonus details" button
   - 5 Activity icons (Award, Invite, Rebate, Jackpot, Gift)
   - Gifts & Attendance bonus duo cards
   - 4 Event promo cards (Launch, First Deposit ₹488, 5% Recharge, iPhone 18 Lucky Spin)

3. **Wallet Page**:
   - Total balance header (₹0.00)
   - Main vs 3rd party wallet dial gauges
   - Main wallet transfer button
   - Deposit, Withdraw, Deposit history, Withdrawal history
   - ARGame & Lottery sub-wallets

4. **Profile / Account Page**:
   - User card with avatar, VIP0 badge, UID copy
   - Total balance card with quick actions
   - 2x2 History grid (Game history, Transactions, Deposit, Withdraw)
   - Menu list items (Notification badge, Gifts, Coupons, Statistics, Language)
   - 6-item Service Center grid (Settings, Feedback, Announcement, Telegram Customer Service, Guide, About)
   - Log Out / Switch Account button

---

## 🚀 Live Preview
Server is running at:
👉 **`http://localhost:3005/`**
