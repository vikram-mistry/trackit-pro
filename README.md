# 🥛 Trackit Pro

**Trackit Pro** is a premium, mobile-first personal tracking application designed specifically for iOS Safari. Built with an offline-first philosophy, it allows you to track daily essentials like milk, gas, water, and household expenses without needing a backend server.

![Trackit Pro Banner](https://img.shields.io/badge/Trackit--Pro-Premium-blue?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Ready-green?style=for-the-badge)
![Offline First](https://img.shields.io/badge/Offline-First-orange?style=for-the-badge)

---

## ✨ Features

### 🥛 Milk Tracker
*   **Monthly Calendar View**: Visual tracking of daily milk intake.
*   **Bulk Actions**: Easily "Bulk Pause" milk delivery for vacations or holidays.
*   **Automatic Totals**: Real-time calculation of monthly quantity and total cost.
*   **Smart Entry**: Quick-add or edit entries with a single tap.
*   **Premium Aesthetic**: Features a custom "Buffalo Milk" glass icon for a personalized touch.

### 🌊 Water Intake (Hydration)
*   **Apple-Style Animation**: Premium "Liquid Glass" animation with curvy waves and rising bubbles.
*   **Interactive History**: Tap any date in the calendar to update the glass and view/delete that day's intake.
*   **Daily Goals**: Set your 4L (or custom) target and watch the glass fill up.
*   **Monthly Trends**: A dedicated calendar view showing total hydration for every day of the month.

### ⛽ Gas Management
*   **Cylinder Lifecycle**: Track installation and uninstallation dates.
*   **Usage Insights**: Automatically calculates how many days each cylinder lasted.
*   **History**: Maintain a complete log of your gas consumption and spending.

### ➕ Household Expenses
*   **Categorized Tracking**: Dedicated modules for **Grocery**, **Electricity (Lotus & Sadri)**, **Water Bill**, and **Other**.
*   **Detailed Records**: Track purchase dates, payment accounts, and specific notes.
*   **Monthly Summaries**: View exactly where your money is going each month.

### 🔒 Privacy & Performance
*   **100% Local Storage**: All data is stored on your device using IndexedDB. No cloud, no tracking.
*   **PWA Support**: "Add to Home Screen" for a full-screen, native app experience on iPhone.
*   **Instant UI**: Powered by Framer Motion for buttery-smooth animations and glassmorphic design.

---

## 🛠 Tech Stack

*   **Frontend**: React + Vite
*   **Styling**: Tailwind CSS v4
*   **Animations**: Framer Motion
*   **Icons**: Lucide React
*   **Database**: IndexedDB (Native Browser Storage)

---

## 🚀 Installation (iPhone)

1.  Open the [Live URL](https://vikram-mistry.github.io/trackit-pro/) in **Safari**.
2.  Tap the **Share** button (box with upward arrow).
3.  Scroll down and select **"Add to Home Screen"**.
4.  The app will now appear on your home screen with a custom icon and work exactly like a native app.

---

## 💻 Development & Deployment

### Local Setup
```bash
npm install
npm run dev
```

### Deploy to GitHub Pages
```bash
npm run deploy
```

### Backup & Restore
You can export your entire database as a JSON file from the **Settings** menu and restore it on any other device.

---

*Made with ❤️ by Vikram Mistry*
