const BOOKING_STORAGE_KEY = 'weekendAIHotelBookings';
const BOOKING_COUNTER_KEY = 'weekendAIHotelBookingCounter';
let selectedHotel = null;

const HOTEL_OPTIONS = [
  {
    id: 'sea-pearl',
    destination: "Cox's Bazar",
    name: 'Hotel Sea Pearl',
    detail: 'Beachfront rooms with pool access, breakfast, and ocean views.',
    pricePerNight: 5200,
    price: '৳5,200/night',
    link: 'https://www.google.com/search?q=Hotel+Sea+Pearl+Cox%27s+Bazar',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
    availableRooms: 8,
    rating: 4.6,
    roomTypes: [
      { id: 'standard', label: 'Standard', multiplier: 1 },
      { id: 'deluxe', label: 'Deluxe', multiplier: 1.25 },
      { id: 'suite', label: 'Suite', multiplier: 1.55 }
    ]
  },
  {
    id: 'long-beach',
    destination: "Cox's Bazar",
    name: 'Long Beach Hotel',
    detail: 'Comfortable stay with rooftop dining and easy beach access.',
    pricePerNight: 3800,
    price: '৳3,800/night',
    link: 'https://www.google.com/search?q=Long+Beach+Hotel+Cox%27s+Bazar',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80',
    availableRooms: 6,
    rating: 4.4,
    roomTypes: [
      { id: 'standard', label: 'Standard', multiplier: 1 },
      { id: 'deluxe', label: 'Deluxe', multiplier: 1.2 },
      { id: 'suite', label: 'Suite', multiplier: 1.45 }
    ]
  },
  {
    id: 'peninsula',
    destination: "Cox's Bazar",
    name: 'Hotel The Peninsula',
    detail: 'Ocean-facing hotel near Laboni Beach and local markets.',
    pricePerNight: 4600,
    price: '৳4,600/night',
    link: 'https://www.google.com/search?q=Hotel+The+Peninsula+Cox%27s+Bazar',
    image: 'https://images.unsplash.com/photo-1501117716987-c8e8b4f3f1d3?auto=format&fit=crop&w=900&q=80',
    availableRooms: 5,
    rating: 4.7,
    roomTypes: [
      { id: 'standard', label: 'Standard', multiplier: 1 },
      { id: 'deluxe', label: 'Deluxe', multiplier: 1.3 },
      { id: 'suite', label: 'Suite', multiplier: 1.6 }
    ]
  },
  {
    id: 'noorjahan',
    destination: 'Sylhet',
    name: 'Hotel Noorjahan Grand',
    detail: 'Well-known hotel near Sylhet city with modern rooms and breakfast.',
    pricePerNight: 4000,
    price: '৳4,000/night',
    link: 'https://www.google.com/search?q=Hotel+Noorjahan+Grand+Sylhet',
    image: 'https://images.unsplash.com/photo-1519821172141-bd85ac1b5618?auto=format&fit=crop&w=900&q=80',
    availableRooms: 7,
    rating: 4.5,
    roomTypes: [
      { id: 'standard', label: 'Standard', multiplier: 1 },
      { id: 'deluxe', label: 'Deluxe', multiplier: 1.2 },
      { id: 'suite', label: 'Suite', multiplier: 1.5 }
    ]
  },
  {
    id: 'meghbon',
    destination: 'Sylhet',
    name: 'Meghbon Inn',
    detail: 'Central location with comfortable rooms and tea garden views.',
    pricePerNight: 3200,
    price: '৳3,200/night',
    link: 'https://www.google.com/search?q=Meghbon+Inn+Sylhet',
    image: 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=900&q=80',
    availableRooms: 6,
    rating: 4.2,
    roomTypes: [
      { id: 'standard', label: 'Standard', multiplier: 1 },
      { id: 'deluxe', label: 'Deluxe', multiplier: 1.2 },
      { id: 'suite', label: 'Suite', multiplier: 1.4 }
    ]
  },
  {
    id: 'garden-hotel',
    destination: 'Sylhet',
    name: 'Sylhet Garden Hotel',
    detail: 'Business hotel with free Wi-Fi and easy access to the city center.',
    pricePerNight: 3500,
    price: '৳3,500/night',
    link: 'https://www.google.com/search?q=Sylhet+Garden+Hotel',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
    availableRooms: 4,
    rating: 4.3,
    roomTypes: [
      { id: 'standard', label: 'Standard', multiplier: 1 },
      { id: 'deluxe', label: 'Deluxe', multiplier: 1.25 },
      { id: 'suite', label: 'Suite', multiplier: 1.5 }
    ]
  },
  {
    id: 'hill-garden',
    destination: 'Bandarban',
    name: 'Hill Garden Resort',
    detail: 'Hillside resort with cottages, garden views and trekking support.',
    pricePerNight: 3900,
    price: '৳3,900/night',
    link: 'https://www.google.com/search?q=Hill+Garden+Resort+Bandarban',
    image: 'https://images.unsplash.com/photo-1499153910564-45c57d6b2b05?auto=format&fit=crop&w=900&q=80',
    availableRooms: 5,
    rating: 4.4,
    roomTypes: [
      { id: 'standard', label: 'Standard', multiplier: 1 },
      { id: 'deluxe', label: 'Deluxe', multiplier: 1.2 },
      { id: 'suite', label: 'Suite', multiplier: 1.45 }
    ]
  },
  {
    id: 'hilltop',
    destination: 'Bandarban',
    name: 'Hilltop Hotel',
    detail: 'Peaceful hilltop rooms with scenic views and tour support.',
    pricePerNight: 3300,
    price: '৳3,300/night',
    link: 'https://www.google.com/search?q=Hilltop+Hotel+Bandarban',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
    availableRooms: 4,
    rating: 4.1,
    roomTypes: [
      { id: 'standard', label: 'Standard', multiplier: 1 },
      { id: 'deluxe', label: 'Deluxe', multiplier: 1.15 },
      { id: 'suite', label: 'Suite', multiplier: 1.35 }
    ]
  },
  {
    id: 'royal-tulip',
    destination: 'Bandarban',
    name: 'Royal Tulip Bandarban',
    detail: 'Premium hillside resort with modern amenities and views.',
    pricePerNight: 5100,
    price: '৳5,100/night',
    link: 'https://www.google.com/search?q=Royal+Tulip+Bandarban',
    image: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=900&q=80',
    availableRooms: 3,
    rating: 4.8,
    roomTypes: [
      { id: 'standard', label: 'Standard', multiplier: 1 },
      { id: 'deluxe', label: 'Deluxe', multiplier: 1.3 },
      { id: 'suite', label: 'Suite', multiplier: 1.6 }
    ]
  },
  {
    id: 'sundarban-eco',
    destination: 'Sundarbans',
    name: 'Sundarban Eco Resort',
    detail: 'Eco-friendly resort near the forest with guided boat tours.',
    pricePerNight: 4500,
    price: '৳4,500/night',
    link: 'https://www.google.com/search?q=Sundarban+Eco+Resort',
    image: 'https://images.unsplash.com/photo-1500265110341-27a5c01f7bfc?auto=format&fit=crop&w=900&q=80',
    availableRooms: 4,
    rating: 4.5,
    roomTypes: [
      { id: 'standard', label: 'Standard', multiplier: 1 },
      { id: 'deluxe', label: 'Deluxe', multiplier: 1.25 },
      { id: 'suite', label: 'Suite', multiplier: 1.55 }
    ]
  }
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('weekendai_user') || 'null');
  } catch (error) {
    return null;
  }
}

function isLoggedIn() {
  return localStorage.getItem('loggedIn') === 'true' && !!getCurrentUser();
}

function formatMoney(value) {
  return `৳${Number(value || 0).toLocaleString('en-BD')}`;
}

function getBookings() {
  try {
    const bookings = JSON.parse(localStorage.getItem(BOOKING_STORAGE_KEY) || '[]');
    return Array.isArray(bookings) ? bookings : [];
  } catch (error) {
    return [];
  }
}

function saveBookings(bookings) {
  localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(bookings));
}

function getBookedRoomCount(hotelId) {
  const bookings = getBookings();
  return bookings
    .filter((booking) => booking.hotelId === hotelId && booking.bookingStatus !== 'Cancelled')
    .reduce((sum, booking) => sum + Number(booking.rooms || 0), 0);
}

function getAvailableRooms(hotel) {
  return Math.max(Number(hotel.availableRooms || 0) - getBookedRoomCount(hotel.id), 0);
}

function updateAvailableRooms() {
  renderHotelResults();
}

function renderStars(rating) {
  const fullStars = Math.floor(rating);
  const halfStar = rating - fullStars >= 0.5;
  const stars = '★'.repeat(fullStars) + (halfStar ? '½' : '');
  return `${stars} ${rating.toFixed(1)}`;
}

function updateAuthUI() {
  const authButtons = document.getElementById('auth-buttons');
  const userPanel = document.getElementById('user-panel');

  if (!authButtons || !userPanel) return;

  if (isLoggedIn()) {
    authButtons.style.display = 'none';
    const user = getCurrentUser();
    const name = (user?.full_name || user?.email || 'Traveler').split(' ')[0];
    document.getElementById('user-name').textContent = `Hi, ${escapeHtml(name)}`;
    userPanel.style.display = 'flex';
  } else {
    authButtons.style.display = 'flex';
    userPanel.style.display = 'none';
  }
}

function signOut() {
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('weekendai_user');
  updateAuthUI();
  showToast('Signed out successfully.', 'success');
}

function getStoredDestination() {
  return localStorage.getItem('weekendai_last_destination') || "Cox's Bazar";
}

function saveStoredDestination(destination) {
  localStorage.setItem('weekendai_last_destination', destination);
}

function getHotelResults(destination) {
  const normalized = String(destination || '').toLowerCase();
  const matches = HOTEL_OPTIONS.filter((hotel) => hotel.destination.toLowerCase().includes(normalized));
  return matches.length ? matches : HOTEL_OPTIONS.filter((hotel) => hotel.destination.toLowerCase().includes('cox'));
}

function renderHotelResults() {
  const destination = document.getElementById('destination').value.trim() || getStoredDestination();
  const hotels = getHotelResults(destination);
  const container = document.getElementById('results-container');

  if (!hotels.length) {
    container.innerHTML = '<div class="empty-state">No hotels were found for this destination. Try another destination above.</div>';
    return;
  }

  container.innerHTML = `
    <div style="margin-bottom:16px;color:#334155;font-weight:600;">Showing ${hotels.length} hotel options for ${escapeHtml(destination)}</div>
    <div class="hotel-table-wrapper">
      <table class="hotel-table">
        <thead>
          <tr>
            <th>Hotel</th>
            <th>Destination</th>
            <th>Price</th>
            <th>Rooms</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${hotels
            .map((hotel, index) => {
              const available = getAvailableRooms(hotel);
              return `
                <tr>
                  <td style="display:flex;gap:14px;align-items:center;">
                    <img class="hotel-image" src="${escapeHtml(hotel.image)}" alt="${escapeHtml(hotel.name)}" />
                    <div class="hotel-meta">
                      <div class="hotel-name">${escapeHtml(hotel.name)}</div>
                      <div class="hotel-subtitle">${escapeHtml(hotel.detail)}</div>
                      <div class="hotel-info-row"><span>${renderStars(hotel.rating)}</span><span>${available} rooms available</span></div>
                    </div>
                  </td>
                  <td>${escapeHtml(hotel.destination)}</td>
                  <td>${escapeHtml(hotel.pricePerNight.toLocaleString('en-BD'))} / night</td>
                  <td>${available}</td>
                  <td><button class="signup-btn book-room-btn" type="button" data-index="${index}" ${available === 0 ? 'disabled' : ''}>${available === 0 ? 'Sold out' : 'Book Room'}</button></td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showBookingModal() {
  const overlay = document.getElementById('booking-modal-overlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}

function openBookingModal(hotel) {
  selectedHotel = hotel;
  renderBookingModal(hotel);
}

function closeBookingModal() {
  const overlay = document.getElementById('booking-modal-overlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  const content = document.getElementById('booking-modal-content');
  if (content) content.innerHTML = '';
  selectedHotel = null;
}

function renderBookingModal(hotel) {
  const availableRooms = getAvailableRooms(hotel);
  const today = new Date().toISOString().split('T')[0];
  const user = getCurrentUser();
  const fullNameValue = user?.full_name || '';
  const emailValue = user?.email || '';

  const roomTypeOptions = hotel.roomTypes
    .map((type) => `<option value="${type.id}" data-multiplier="${type.multiplier}">${escapeHtml(type.label)}</option>`)
    .join('');

  const paymentOptions = [
    { value: 'paylater', label: 'Pay Later' },
    { value: 'bkash', label: 'bKash' },
    { value: 'nagad', label: 'Nagad' },
    { value: 'card', label: 'Card Payment' }
  ];

  const paymentOptionsHtml = paymentOptions
    .map((method) => `<option value="${method.value}">${escapeHtml(method.label)}</option>`)
    .join('');

  const modalContent = document.getElementById('booking-modal-content');
  modalContent.innerHTML = `
    <div class="modal-header">
      <div>
        <h1 class="modal-title" id="booking-modal-title">Book Room at ${escapeHtml(hotel.name)}</h1>
        <p class="modal-subtitle">Complete your stay details and review pricing before confirming your hotel reservation.</p>
      </div>
      <div class="hotel-card-summary">
        <img src="${escapeHtml(hotel.image)}" alt="${escapeHtml(hotel.name)}" />
        <div class="hotel-info-row"><span><strong>${escapeHtml(hotel.name)}</strong></span></div>
        <div class="hotel-info-row"><span>${escapeHtml(hotel.destination)}</span></div>
        <div class="hotel-info-row"><span><strong>${renderStars(hotel.rating)}</strong></span></div>
        <div class="hotel-info-row"><span>Available rooms: ${availableRooms}</span></div>
        <div class="hotel-info-row"><span>Price per night: ${formatMoney(hotel.pricePerNight)}</span></div>
      </div>
    </div>
    <form id="booking-form">
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label for="full-name">Full Name</label>
            <input id="full-name" name="fullName" type="text" value="${escapeHtml(fullNameValue)}" />
            <div class="field-error" id="error-full-name"></div>
          </div>
          <div class="form-group">
            <label for="email-address">Email Address</label>
            <input id="email-address" name="email" type="email" value="${escapeHtml(emailValue)}" />
            <div class="field-error" id="error-email-address"></div>
          </div>
          <div class="form-group">
            <label for="phone-number">Phone Number</label>
            <input id="phone-number" name="phone" type="tel" placeholder="01XXXXXXXXX" />
            <div class="field-error" id="error-phone-number"></div>
          </div>
          <div class="form-group">
            <label for="check-in-date">Check-in Date</label>
            <input id="check-in-date" name="checkIn" type="date" min="${today}" />
            <div class="field-error" id="error-check-in-date"></div>
          </div>
          <div class="form-group">
            <label for="check-out-date">Check-out Date</label>
            <input id="check-out-date" name="checkOut" type="date" min="${today}" />
            <div class="field-error" id="error-check-out-date"></div>
          </div>
          <div class="form-group">
            <label for="guest-count">Number of Guests</label>
            <input id="guest-count" name="guests" type="number" min="1" value="2" />
            <div class="field-error" id="error-guest-count"></div>
          </div>
          <div class="form-group">
            <label for="room-count">Number of Rooms</label>
            <input id="room-count" name="rooms" type="number" min="1" max="${availableRooms}" value="1" />
            <div class="field-error" id="error-room-count"></div>
          </div>
          <div class="form-group">
            <label for="room-type">Room Type</label>
            <select id="room-type" name="roomType">${roomTypeOptions}</select>
            <div class="field-error" id="error-room-type"></div>
          </div>
          <div class="form-group">
            <label for="payment-method">Payment Method</label>
            <select id="payment-method" name="paymentMethod">${paymentOptionsHtml}</select>
            <div class="field-error" id="error-payment-method"></div>
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label for="special-request">Special Request</label>
            <textarea id="special-request" name="specialRequest" placeholder="Any preferences or requests?"></textarea>
          </div>
        </div>

        <div class="price-summary-card">
          <h3>Price summary</h3>
          <div class="price-row"><span>Room price</span><strong id="summary-room-price">${formatMoney(hotel.pricePerNight)}</strong></div>
          <div class="price-row"><span>Nights</span><strong id="summary-nights">0</strong></div>
          <div class="price-row"><span>Rooms</span><strong id="summary-rooms">1</strong></div>
          <div class="price-row"><span>Subtotal</span><strong id="summary-subtotal">${formatMoney(0)}</strong></div>
          <div class="price-row"><span>Service charge (5%)</span><strong id="summary-service">${formatMoney(0)}</strong></div>
          <div class="price-row"><span>Tax (10%)</span><strong id="summary-tax">${formatMoney(0)}</strong></div>
          <div class="price-row price-total"><span>Grand total</span><strong id="summary-grand-total">${formatMoney(0)}</strong></div>
        </div>

        <div class="modal-actions">
          <button class="cta-btn" type="submit" id="confirm-booking-button">Confirm Booking</button>
          <button class="auth-btn" type="button" id="close-booking-button">Cancel</button>
        </div>
      </div>
    </form>
  `;

  setTimeout(() => {
    document.getElementById('booking-form')?.addEventListener('submit', handleBookingFormSubmit);
    document.getElementById('close-booking-button')?.addEventListener('click', closeBookingModal);
    document.getElementById('booking-modal-close')?.addEventListener('click', closeBookingModal);
    document.getElementById('booking-modal-overlay')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeBookingModal();
    });

    ['check-in-date', 'check-out-date', 'room-count', 'room-type'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', updateBookingSummary);
      document.getElementById(id)?.addEventListener('change', updateBookingSummary);
    });

    updateBookingSummary();
    showBookingModal();
  }, 0);
}

function calculateNights(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = end.getTime() - start.getTime();
  return diff > 0 ? diff / 86400000 : 0;
}

function calculateBookingTotal(pricePerNight, nights, rooms) {
  const subtotal = pricePerNight * nights * rooms;
  const serviceCharge = subtotal * 0.05;
  const tax = subtotal * 0.1;
  return {
    subtotal,
    serviceCharge,
    tax,
    grandTotal: subtotal + serviceCharge + tax
  };
}

function getSelectedRoomType() {
  const typeSelect = document.getElementById('room-type');
  const typeId = typeSelect?.value;
  return selectedHotel?.roomTypes?.find((type) => type.id === typeId) || selectedHotel.roomTypes[0];
}

function updateBookingSummary() {
  if (!selectedHotel) return;
  const nights = calculateNights(
    document.getElementById('check-in-date')?.value,
    document.getElementById('check-out-date')?.value
  );
  const rooms = Number(document.getElementById('room-count')?.value || 1);
  const roomType = getSelectedRoomType();
  const pricePerNight = selectedHotel.pricePerNight * roomType.multiplier;
  const totals = calculateBookingTotal(pricePerNight, nights, rooms);

  document.getElementById('summary-room-price').textContent = formatMoney(pricePerNight);
  document.getElementById('summary-nights').textContent = String(nights || 0);
  document.getElementById('summary-rooms').textContent = String(rooms || 1);
  document.getElementById('summary-subtotal').textContent = formatMoney(totals.subtotal);
  document.getElementById('summary-service').textContent = formatMoney(totals.serviceCharge);
  document.getElementById('summary-tax').textContent = formatMoney(totals.tax);
  document.getElementById('summary-grand-total').textContent = formatMoney(totals.grandTotal);
}

function clearValidationErrors() {
  ['full-name', 'email-address', 'phone-number', 'check-in-date', 'check-out-date', 'guest-count', 'room-count', 'room-type', 'payment-method']
    .forEach((inputId) => {
      const errorEl = document.getElementById(`error-${inputId}`);
      if (errorEl) errorEl.textContent = '';
    });
}

function validateBookingForm() {
  const fullName = document.getElementById('full-name')?.value.trim();
  const email = document.getElementById('email-address')?.value.trim();
  const phone = document.getElementById('phone-number')?.value.trim();
  const checkIn = document.getElementById('check-in-date')?.value;
  const checkOut = document.getElementById('check-out-date')?.value;
  const guests = Number(document.getElementById('guest-count')?.value || 0);
  const rooms = Number(document.getElementById('room-count')?.value || 0);
  const roomType = document.getElementById('room-type')?.value;
  const paymentMethod = document.getElementById('payment-method')?.value;
  const today = new Date().toISOString().split('T')[0];
  const errors = {};

  if (!fullName) errors['full-name'] = 'Full name is required.';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors['email-address'] = 'Enter a valid email address.';
  if (!phone || !/^\+?\d{9,15}$/.test(phone)) errors['phone-number'] = 'Enter a valid phone number.';
  if (!checkIn) errors['check-in-date'] = 'Check-in date is required.';
  else if (checkIn < today) errors['check-in-date'] = 'Check-in cannot be before today.';
  if (!checkOut) errors['check-out-date'] = 'Check-out date is required.';
  if (checkIn && checkOut) {
    const nights = calculateNights(checkIn, checkOut);
    if (nights <= 0) errors['check-out-date'] = 'Check-out must be after check-in.';
  }
  if (!Number.isInteger(guests) || guests < 1) errors['guest-count'] = 'Enter at least one whole-number guest.';

  const availableRooms = getAvailableRooms(selectedHotel);
  if (!Number.isInteger(rooms) || rooms < 1) errors['room-count'] = 'Enter at least one whole-number room.';
  else if (rooms > availableRooms) errors['room-count'] = `Only ${availableRooms} rooms are available.`;
  if (!roomType) errors['room-type'] = 'Choose a room type.';
  if (!paymentMethod) errors['payment-method'] = 'Choose a payment method.';

  clearValidationErrors();

  Object.entries(errors).forEach(([field, message]) => {
    const errorEl = document.getElementById(`error-${field}`);
    if (errorEl) errorEl.textContent = message;
  });

  return { valid: Object.keys(errors).length === 0, values: { fullName, email, phone, checkIn, checkOut, guests, rooms, roomType, paymentMethod, specialRequest: document.getElementById('special-request')?.value.trim() || '' } };
}

function generateBookingId() {
  const year = new Date().getFullYear();
  const nextCount = Number(localStorage.getItem(BOOKING_COUNTER_KEY) || '0') + 1;
  localStorage.setItem(BOOKING_COUNTER_KEY, String(nextCount));
  return `WA-HOTEL-${year}-${String(nextCount).padStart(4, '0')}`;
}

function saveBooking(booking) {
  const bookings = getBookings();
  bookings.unshift(booking);
  saveBookings(bookings);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function handleBookingFormSubmit(event) {
  event.preventDefault();
  if (!selectedHotel) return;

  const { valid, values } = validateBookingForm();
  if (!valid) {
    showToast('Please fix the highlighted fields.', 'error');
    return;
  }

  const confirmButton = document.getElementById('confirm-booking-button');
  confirmButton.disabled = true;
  confirmButton.textContent = 'Confirming booking…';

  const roomType = selectedHotel.roomTypes.find((type) => type.id === values.roomType);
  const pricePerNight = selectedHotel.pricePerNight * (roomType?.multiplier || 1);
  const nights = calculateNights(values.checkIn, values.checkOut);
  const totals = calculateBookingTotal(pricePerNight, nights, values.rooms);
  const bookingId = generateBookingId();
  const user = getCurrentUser();

  const booking = {
    bookingId,
    userId: user?.user_id || null,
    customerName: values.fullName,
    customerEmail: values.email,
    customerPhone: values.phone,
    hotelId: selectedHotel.id,
    hotelName: selectedHotel.name,
    hotelLocation: selectedHotel.destination,
    hotelImage: selectedHotel.image,
    checkIn: values.checkIn,
    checkOut: values.checkOut,
    numberOfNights: nights,
    guests: values.guests,
    rooms: values.rooms,
    roomType: roomType?.label || 'Standard',
    pricePerNight,
    subtotal: totals.subtotal,
    serviceCharge: totals.serviceCharge,
    tax: totals.tax,
    grandTotal: totals.grandTotal,
    paymentMethod: values.paymentMethod,
    paymentStatus: values.paymentMethod === 'paylater' ? 'Pending' : 'Awaiting Payment',
    bookingStatus: 'Confirmed',
    specialRequest: values.specialRequest,
    createdAt: new Date().toISOString()
  };

  window.setTimeout(() => {
    saveBooking(booking);
    showToast('Hotel booking confirmed!', 'success');
    renderBookingConfirmation(booking);
    updateAvailableRooms();
  }, 350);
}

function renderBookingConfirmation(booking) {
  const panel = document.getElementById('booking-modal-content');
  if (!panel) return;

  panel.innerHTML = `
    <div class="modal-header">
      <div>
        <h1 class="modal-title">Booking Confirmed</h1>
        <p class="modal-subtitle">Your reservation is confirmed. You can review your booking details or continue to payment.</p>
      </div>
    </div>
    <div class="booking-card">
      <h3>${escapeHtml(booking.hotelName)}</h3>
      <div class="booking-row"><span>Booking ID</span><strong>${escapeHtml(booking.bookingId)}</strong></div>
      <div class="booking-row"><span>Guest</span><strong>${escapeHtml(booking.customerName)}</strong></div>
      <div class="booking-row"><span>Email</span><strong>${escapeHtml(booking.customerEmail)}</strong></div>
      <div class="booking-row"><span>Location</span><strong>${escapeHtml(booking.hotelLocation)}</strong></div>
      <div class="booking-row"><span>Check-in</span><strong>${escapeHtml(booking.checkIn)}</strong></div>
      <div class="booking-row"><span>Check-out</span><strong>${escapeHtml(booking.checkOut)}</strong></div>
      <div class="booking-row"><span>Nights</span><strong>${escapeHtml(String(booking.numberOfNights))}</strong></div>
      <div class="booking-row"><span>Guests</span><strong>${escapeHtml(String(booking.guests))}</strong></div>
      <div class="booking-row"><span>Rooms</span><strong>${escapeHtml(String(booking.rooms))}</strong></div>
      <div class="booking-row"><span>Room type</span><strong>${escapeHtml(booking.roomType)}</strong></div>
      <div class="booking-row"><span>Payment method</span><strong>${escapeHtml(booking.paymentMethod === 'paylater' ? 'Pay Later' : booking.paymentMethod === 'bkash' ? 'bKash' : booking.paymentMethod === 'nagad' ? 'Nagad' : 'Card Payment')}</strong></div>
      <div class="booking-row"><span>Payment status</span><strong>${escapeHtml(booking.paymentStatus)}</strong></div>
      <div class="booking-row"><span>Booking status</span><strong>${escapeHtml(booking.bookingStatus)}</strong></div>
      <div class="booking-row price-total"><span>Total amount</span><strong>${formatMoney(booking.grandTotal)}</strong></div>
    </div>
    <div class="modal-actions">
      <button class="cta-btn" type="button" id="view-booking-button">View My Booking</button>
      <button class="signup-btn" type="button" id="continue-payment-button">Continue to Payment</button>
      <button class="auth-btn" type="button" id="print-confirmation-button">Download / Print</button>
    </div>
  `;

  document.getElementById('view-booking-button')?.addEventListener('click', () => {
    window.location.href = `my-bookings.html?bookingId=${encodeURIComponent(booking.bookingId)}`;
  });

  document.getElementById('continue-payment-button')?.addEventListener('click', () => {
    redirectToPayment(booking.bookingId);
  });

  document.getElementById('print-confirmation-button')?.addEventListener('click', () => {
    window.print();
  });
}

function handleBookingButtonClick(event) {
  const button = event.target.closest('.book-room-btn');
  if (!button) return;
  const index = Number(button.dataset.index);
  openHotelBooking(index);
}

function openHotelBooking(index) {
  const destination = document.getElementById('destination').value.trim() || getStoredDestination();
  const hotels = getHotelResults(destination);
  selectedHotel = hotels[index];
  if (!selectedHotel) return;
  if (!isLoggedIn()) {
    showToast('Please sign in before making a hotel booking.', 'error');
    window.setTimeout(() => { window.location.href = 'login.html'; }, 900);
    return;
  }
  openBookingModal(selectedHotel);
}

function redirectToPayment(bookingId) {
  window.location.href = `payment.html?bookingId=${encodeURIComponent(bookingId)}`;
}

function initHotelPage() {
  const destinationInput = document.getElementById('destination');
  destinationInput.value = getStoredDestination();
  destinationInput.addEventListener('input', () => saveStoredDestination(destinationInput.value.trim()));
  document.getElementById('search-button')?.addEventListener('click', () => {
    saveStoredDestination(document.getElementById('destination').value.trim());
    renderHotelResults();
  });
  document.getElementById('sign-out-btn')?.addEventListener('click', signOut);
  updateAuthUI();
  renderHotelResults();
  document.getElementById('results-container')?.addEventListener('click', handleBookingButtonClick);
}

window.addEventListener('DOMContentLoaded', initHotelPage);
