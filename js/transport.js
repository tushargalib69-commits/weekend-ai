const TRANSPORT_STORAGE_KEY = 'weekendai_transport_bookings';
let selectedTransport = null;

const TRANSPORT_OPTIONS = [
  { route: 'Dhaka → Cox\'s Bazar', type: 'Bus', name: 'Green Line Paribahan', detail: 'Premium coach service with reclining seats and onboard refreshments.', price: '৳1,250' },
  { route: 'Dhaka → Cox\'s Bazar', type: 'Flight', name: 'Biman Bangladesh Airlines', detail: 'Daily flight with checked baggage and seat selection.', price: '৳6,500' },
  { route: 'Dhaka → Sylhet', type: 'Train', name: 'Parabat Express', detail: 'Intercity train with reserved seats and scenic countryside views.', price: '৳900' },
  { route: 'Dhaka → Sylhet', type: 'Bus', name: 'Shyamoli Paribahan', detail: 'Night bus service with AC seats and entertainment.', price: '৳950' },
  { route: 'Dhaka → Bandarban', type: 'Bus', name: 'S Alam Service', detail: 'Day coach service to Bandarban with comfortable seating.', price: '৳1,500' },
  { route: 'Dhaka → Bandarban', type: 'Private Car', name: 'Door-to-door transfer', detail: 'Private car with driver for flexible timing and comfort.', price: '৳4,200' },
  { route: 'Dhaka → Sundarbans', type: 'Launch', name: 'Katcha Launch', detail: 'Boat transfer to Sundarbans entry point from Khulna.', price: '৳850' }
];

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getTransportResults(from, to) {
  const normalized = String(to || '').toLowerCase();
  const matches = TRANSPORT_OPTIONS.filter((item) => item.route.toLowerCase().includes(normalized));
  if (matches.length) return matches;
  return TRANSPORT_OPTIONS.filter((item) => item.route.toLowerCase().includes('dhaka'));
}

function renderTransportResults() {
  const from = document.getElementById('from-location').value.trim() || 'Dhaka';
  const to = document.getElementById('to-location').value.trim() || 'Cox\'s Bazar';
  const options = getTransportResults(from, to);
  const container = document.getElementById('results-container');

  if (!options.length) {
    container.innerHTML = '<div class="empty-state">No transport options found for this route. Try a different destination.</div>';
    return;
  }

  container.innerHTML = options.map((option, index) => `
    <div class="result-card">
      <h3>${escapeHtml(option.name)}</h3>
      <p>${escapeHtml(option.detail)}</p>
      <div class="meta">Route: ${escapeHtml(option.route)}</div>
      <div class="meta">Type: ${escapeHtml(option.type)} · Price: ${escapeHtml(option.price)}</div>
      <button class="signup-btn" type="button" onclick="openTransportBooking(${index})">Book Transport</button>
    </div>
  `).join('');
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem(TRANSPORT_STORAGE_KEY) || '[]');
  const container = document.getElementById('history-container');
  if (!history.length) {
    container.innerHTML = '<div class="empty-state">No transport bookings yet. Choose a route to book your first ride.</div>';
    return;
  }
  container.innerHTML = history.map((record) => `
    <div class="history-card">
      <h3>${escapeHtml(record.name)}</h3>
      <p>${escapeHtml(record.route)}</p>
      <div class="meta">Date: ${escapeHtml(record.travelDate)} · Seats: ${escapeHtml(record.seats)}</div>
      <div class="meta">Total: ${escapeHtml(record.price)}</div>
    </div>
  `).join('');
}

function openTransportBooking(index) {
  const from = document.getElementById('from-location').value.trim() || 'Dhaka';
  const to = document.getElementById('to-location').value.trim() || 'Cox\'s Bazar';
  const options = getTransportResults(from, to);
  selectedTransport = options[index];
  if (!selectedTransport) return;

  const panel = document.getElementById('booking-panel');
  panel.innerHTML = `
    <h2>Confirm your transport booking</h2>
    <p>Book ${escapeHtml(selectedTransport.name)} from ${escapeHtml(from)} to ${escapeHtml(to)}.</p>
    <div class="input-group">
      <label for="travel-date">Travel date</label>
      <input id="travel-date" type="date" />
    </div>
    <div class="input-group">
      <label for="seat-count">Number of seats</label>
      <input id="seat-count" type="number" min="1" value="1" />
    </div>
    <button class="cta-btn" type="button" onclick="confirmTransportBooking()">Confirm Booking</button>
  `;
}

function confirmTransportBooking() {
  if (!selectedTransport) return;
  const travelDate = document.getElementById('travel-date').value;
  const seats = parseInt(document.getElementById('seat-count').value, 10) || 1;
  if (!travelDate) {
    alert('Please choose a travel date.');
    return;
  }

  const booking = {
    id: Date.now(),
    route: selectedTransport.route,
    name: selectedTransport.name,
    travelDate,
    seats,
    price: selectedTransport.price,
    createdAt: new Date().toISOString()
  };

  const history = JSON.parse(localStorage.getItem(TRANSPORT_STORAGE_KEY) || '[]');
  history.unshift(booking);
  localStorage.setItem(TRANSPORT_STORAGE_KEY, JSON.stringify(history));

  document.getElementById('booking-panel').innerHTML = `
    <h2>Transport booking confirmed</h2>
    <p>Your ride has been saved locally and is ready to review anytime.</p>
    <div class="booking-summary">
      <div class="row"><span>Route</span><strong>${escapeHtml(booking.route)}</strong></div>
      <div class="row"><span>Provider</span><strong>${escapeHtml(booking.name)}</strong></div>
      <div class="row"><span>Date</span><strong>${escapeHtml(booking.travelDate)}</strong></div>
      <div class="row"><span>Seats</span><strong>${escapeHtml(String(booking.seats))}</strong></div>
      <div class="row"><span>Price</span><strong>${escapeHtml(booking.price)}</strong></div>
    </div>
  `;

  renderHistory();
}

function initTransportPage() {
  document.getElementById('search-button').addEventListener('click', renderTransportResults);
  renderTransportResults();
  renderHistory();
}

window.addEventListener('DOMContentLoaded', initTransportPage);
