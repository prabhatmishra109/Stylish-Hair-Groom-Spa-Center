/* ==========================================================
   CONFIG: change everything about the business here.
   No other file needs editing for a new client.
   ========================================================== */
window.BOOKING_CONFIG = {
  business: {
    name: "Aura Studio",
    tagline: "Salon & Skin Clinic",
    whatsapp: "916392147312",        // country code + number, no +, spaces or dashes
    email: "hello@example.com",      // replace with the owner's email
    address: "Shop 12, Main Market, Delhi"
  },

  schedule: {
    open: "10:00",
    close: "20:00",
    slotMinutes: 30,                 // gap between start times
    breakStart: "13:30",             // lunch break (no bookings overlap it)
    breakEnd: "14:30",
    offDays: [0],                    // 0 = Sunday, 1 = Monday ... 6 = Saturday
    daysAhead: 14,                   // how many days can be booked in advance
    minLeadMinutes: 30               // today's slots need at least this much notice
  },

  services: [
    { id: "haircut",  name: "Haircut & Styling",  desc: "Consultation, wash, precision cut and blow-dry.",       duration: 30,  price: 399,  icon: "bi-scissors" },
    { id: "hairspa",  name: "Hair Spa",           desc: "Deep conditioning treatment with a scalp massage.",     duration: 60,  price: 1199, icon: "bi-droplet-half" },
    { id: "facial",   name: "Glow Facial",        desc: "Cleanse, exfoliate and hydrate for visible glow.",      duration: 45,  price: 899,  icon: "bi-stars" },
    { id: "colour",   name: "Hair Colour",        desc: "Global colour, highlights or a root touch-up.",         duration: 90,  price: 2499, icon: "bi-palette" },
    { id: "skin",     name: "Skin Consultation",  desc: "One-to-one skin review with a simple care plan.",       duration: 30,  price: 499,  icon: "bi-clipboard2-pulse" },
    { id: "bridal",   name: "Bridal Makeup Trial", desc: "A full trial look so the big day has no surprises.",   duration: 120, price: 3999, icon: "bi-gem" }
  ]
};
