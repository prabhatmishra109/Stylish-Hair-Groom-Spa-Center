# Aura Studio: Salon & Clinic Booking Page

A responsive booking website built with **HTML, CSS, JavaScript and Bootstrap 5**. A customer picks a service, date and time, enters their details, and the booking opens in **WhatsApp** (or email) as a ready-written message.

## Folder structure

```
aura-booking/
├── index.html            Page structure (Bootstrap grid, sections, wizard markup)
├── css/
│   ├── style.css         Design tokens, components, dark theme, responsive rules
│   └── animations.css    All keyframes and motion (respects reduced-motion)
└── js/
    ├── config.js         Business name, WhatsApp number, hours, services (edit this)
    ├── main.js           Theme toggle, content binding, scroll reveal, counters
    └── booking.js        Booking wizard, slot logic, validation, WhatsApp/email, .ics, My bookings
```

## Run it

Open `index.html` in a browser. It needs internet once for Bootstrap, Bootstrap Icons and Google Fonts (loaded from CDNs).

## Customise for a client

Everything about the business is in `js/config.js`:

| Setting | What it does |
| --- | --- |
| `business.whatsapp` | Number that receives bookings. Country code + number, no `+` or spaces. |
| `business.email` | Used by the "Send by email" button. |
| `schedule.open / close` | Working hours. |
| `schedule.slotMinutes` | Gap between start times (30 = 10:00, 10:30 ...). |
| `schedule.breakStart / breakEnd` | Lunch break. No booking overlaps it. |
| `schedule.offDays` | Closed weekdays (0 = Sunday). |
| `schedule.daysAhead` | How many days ahead people can book. |
| `services` | Name, description, duration, price and a Bootstrap Icons class. |

Placeholder content to replace before going live: reviews, stats numbers (visits, rating, years), address and email.

## Features

- 4-step booking wizard with progress stepper
- Slot logic that respects service duration, lunch break, closed days and lead time
- Booked times are greyed out and overlapping slots are blocked
- WhatsApp message built with `wa.me` + `encodeURIComponent`
- Email option, "Add to calendar" (.ics) and confetti confirmation
- "My bookings" modal with cancel
- Light and dark theme (remembers choice)
- Animated hero, scroll reveal, counters, marquee, spotlight hover cards
- Accessible: keyboard focus styles, ARIA states, reduced-motion support

## Important limitation

Bookings are saved in the browser's `localStorage`, so slots are blocked **on that device only**. Two different customers can still pick the same time. The owner confirms on WhatsApp, which is why the FAQ calls a booking a request until confirmed.

To make slots shared across all users, add a backend, for example **Spring Boot + MySQL**:

1. `GET /api/slots?date=YYYY-MM-DD&serviceId=...` returns booked intervals.
2. `POST /api/bookings` saves a booking and rejects overlaps.
3. In `booking.js`, replace `loadBookings()` / `saveBookings()` with `fetch` calls.

## Deploy free

Drag the folder onto **Netlify Drop**, or push to GitHub and enable **GitHub Pages**.
