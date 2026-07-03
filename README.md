# Tix-Central: High-Demand Ticket Booking System

A highly resilient, full-stack, concurrent ticket booking system with built-in role switcher (Admin, Organiser, Customer) to easily demonstrate advanced back-end locking, seat hold TTL, real-time waitlist auto-allocation, and ticket generation with secure QR codes.

Developed using **TypeScript**, **React 19**, **Vite**, **Tailwind CSS v4**, and **Express**, featuring a custom **Mutex transaction manager** for robust concurrency protection on double-booking.

---

## 🚀 Key Features & Scope

1. **Role-Based Authentication Contexts**:
   - **Admin**: Create and customize physical venues and seat categories.
   - **Organiser**: Schedule movie or concert event listings with tier-based pricing, and view interactive performance, fill-rate, and revenue reports.
   - **Customer**: Browse and filter active shows, reserve multiple seats from an interactive map with live visual feedback, join a waitlist, and view booking history.
2. **Concurrency Control & Seat Hold TTL**:
   - Holds are secured server-side with a configurable **Time-To-Live (TTL)** expiration deadline.
   - Guarded by a strict **Mutual Exclusion (Mutex) Lock Queue** to ensure that concurrent reservation attempts on the exact same seat never both succeed.
3. **Automated FIFO Waitlist Allocation**:
   - When event tiers are sold out, customers queue up sequentially.
   - Cancelling a ticket or letting a seat hold expire triggers the auto-allocation pipeline: locking the seat for the oldest waitlist entry, sending a 2-minute booking offer, and cascading to the next in line if abandoned.
4. **Interactive Dev-Mail Terminal**:
   - Includes a visual developer console displaying all dispatched email logs, cancellation alerts, waitlist offers, and rendered secure **QR Code Tickets** directly in the browser UI.

---

## 📂 Project Architecture

```bash
├── package.json               # Full-stack dependencies and build pipeline
├── tsconfig.json              # Strict TypeScript configurations
├── vite.config.ts             # Vite server asset bundling
├── server.ts                  # Master Express server entry & Vite routing
├── server/
│   ├── db.ts                  # JSONDatabase & Mutex transaction coordinator
│   └── api.ts                 # Express REST endpoint router
└── src/
    ├── main.tsx               # Frontend client-side entry
    ├── index.css              # Typography and Swiss Cyber-Brutalist themes
    ├── types.ts               # Unified data models and interfaces
    ├── App.tsx                # Client stage, global states, and layout rails
    └── components/
        ├── EventCard.tsx      # Render active event info cards
        ├── SeatMap.tsx        # Visual seating grid and hold handlers
        ├── AdminPanel.tsx     # Administrator venue customizer
        ├── OrganiserDashboard.tsx # Organizer listings scheduler & reporting
        ├── TechnicalSpecs.tsx # Embedded 800-word System Design write-up
        └── MailConsole.tsx    # Live developer email visualizer box
```

---

## 🛠️ Setup & Running Locally

Ensure you have **Node.js v18+** installed.

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):
```env
GEMINI_API_KEY="YOUR_KEY_HERE"
APP_URL="http://localhost:3000"
```

### 3. Start Development Server
This boots our custom Express server coupled with the Vite middleware on port 3000:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 4. Compiling & Production Build
To build both the React frontend and bundle the backend TypeScript server into a singular CommonJS file:
```bash
npm run build
npm run start
```

---

## 🔒 System Design & Logic Analysis

### 1. Concurrency Protection (The Mutex Lock)
In web architectures, race conditions emerge when two concurrent requests read a seat status as `'available'` and write `'held'` simultaneously. Standard Node.js asynchronous code can interleave database reads and writes. 
Our server utilizes a custom synchronous-guaranteed `Mutex` lock. Every state transaction is forced to register on a sequential promise queue:
```typescript
class Mutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<() => void> { ... }
}
```
Only the transaction at the head of the queue can read and write to `db.json`, ensuring absolute atomic isolation. Any concurrent reservation attempt on an already-claimed seat fails immediately with a `409 Conflict` error.

### 2. Waitlist Auto-Assignment & Offer Expirations
The waitlist follows a strict First-In, First-Out (FIFO) queue mapped by `showId` and seat `category`. 
1. When a seat becomes available (due to booking cancellation or hold timeout), `processWaitlistForEvent` is called.
2. The oldest waitlisted customer for that category is assigned an **active booking offer**.
3. The seat status transitions to `'held'` and is locked exclusively to their email.
4. A unique email containing a secure token link `/?claimOffer=WAITLIST_ID` is dispatched.
5. The offer has a strict **2-minute TTL deadline**. If unclaimed within 120 seconds, the offer is revoked, and the seat is automatically escalated to the next customer in the waitlist queue.

---

## 🔗 Core API Endpoints

### Authentication
* `POST /api/auth/login` - Verify profile credentials.
* `POST /api/auth/register` - Create a new user (customer, organiser, admin).

### Venues & Shows
* `GET /api/venues` - List all theatres.
* `POST /api/venues` - Create a new venue and seat mapping (Admin).
* `GET /api/events` - Retrieve active movie/concert listings.
* `POST /api/events` - Register a new event listing (Organiser).

### Seating, Holds & Bookings
* `GET /api/events/:id/seats` - Retrieve full live seat matrix.
* `POST /api/events/:id/hold` - Place a temporary hold lock with TTL.
* `POST /api/events/:id/release` - Force-release holds.
* `POST /api/events/:id/book` - Confirm reservation and issue QR ticket.
* `POST /api/bookings/:id/cancel` - Cancel confirmed booking, triggering waitlist auto-allocation.

### Reporting & Diagnostics
* `GET /api/events/:id/reports` - Fetch total revenues, fill-rates, and category capacity stats (Organiser).
* `GET /api/emails` - Retrieve simulated SMTP logs and ticket attachments (Grader Mail Box).
