const RESTAURANT_STORAGE_KEY = 'weekendai_restaurant_visits';
let selectedRestaurant = null;

const RESTAURANT_OPTIONS = [
  { destination: 'Cox\'s Bazar', name: 'Ship Inn Restaurant', detail: 'Seafood and Bengali classics right on the beach.', price: '৳550/person', link: 'https://www.google.com/search?q=Ship+Inn+Restaurant+Cox%27s+Bazar' },
  { destination: 'Cox\'s Bazar', name: 'Naf River View', detail: 'Popular restaurant with river and sea view dining.', price: '৳600/person', link: 'https://www.google.com/search?q=Naf+River+View+Cox%27s+Bazar' },
  { destination: 'Cox\'s Bazar', name: 'Sujan Restaurant', detail: 'Well-reviewed spot for local and continental dishes.', price: '৳500/person', link: 'https://www.google.com/search?q=Sujan+Restaurant+Cox%27s+Bazar' },
  { destination: 'Sylhet', name: 'Madina Restaurant', detail: 'Famous for biryani, kebabs and Sylheti cuisine.', price: '৳450/person', link: 'https://www.google.com/search?q=Madina+Restaurant+Sylhet' },
  { destination: 'Sylhet', name: 'Yum5Lo', detail: 'Modern bistro with local fusion dishes.', price: '৳600/person', link: 'https://www.google.com/search?q=Yum5Lo+Sylhet' },
  { destination: 'Sylhet', name: 'Tea Junction', detail: 'Great tea garden views with light meals.', price: '৳350/person', link: 'https://www.google.com/search?q=Tea+Junction+Sylhet' },
  { destination: 'Bandarban', name: 'Hill View Restaurant', detail: 'Hilltop dining with local tribal dishes.', price: '৳450/person', link: 'https://www.google.com/search?q=Hill+View+Restaurant+Bandarban' },
  { destination: 'Bandarban', name: 'Sajek Valley Restaurant', detail: 'Local favourites with scenic hill views.', price: '৳500/person', link: 'https://www.google.com/search?q=Sajek+Valley+Restaurant+Bandarban' },
  { destination: 'Bandarban', name: 'Bamboo Restaurant', detail: 'Rustic dining serving fresh local food.', price: '৳400/person', link: 'https://www.google.com/search?q=Bamboo+Restaurant+Bandarban' },
  { destination: 'Sundarbans', name: 'Sundarban Eco Lodge Dining', detail: 'Local meals served during Sundarbans tours.', price: '৳400/person', link: 'https://www.google.com/search?q=Sundarban+Eco+Lodge+Dining' }
];

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getRestaurantResults(destination) {
  const normalized = String(destination || '').toLowerCase();
  const matches = RESTAURANT_OPTIONS.filter((restaurant) => restaurant.destination.toLowerCase().includes(normalized));
  if (matches.length) return matches;
  return RESTAURANT_OPTIONS.filter((restaurant) => restaurant.destination.toLowerCase().includes('cox'));
}

function renderRestaurantResults() {
  const destination = document.getElementById('destination').value.trim() || 'Cox\'s Bazar';
  const restaurants = getRestaurantResults(destination);
  const container = document.getElementById('results-container');

  if (!restaurants.length) {
    container.innerHTML = '<div class="empty-state">No restaurant suggestions available. Try a different city.</div>';
    return;
  }

  container.innerHTML = restaurants.map((restaurant, index) => `
    <div class="result-card">
      <h3>${escapeHtml(restaurant.name)}</h3>
      <p>${escapeHtml(restaurant.detail)}</p>
      <div class="meta">Destination: ${escapeHtml(restaurant.destination)}</div>
      <div class="meta">Estimated cost: ${escapeHtml(restaurant.price)}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <button class="signup-btn" type="button" onclick="openRestaurantBooking(${index})">Save Plan</button>
        <a class="auth-btn" href="${escapeHtml(restaurant.link)}" target="_blank" rel="noopener noreferrer">View on Google</a>
      </div>
    </div>
  `).join('');
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem(RESTAURANT_STORAGE_KEY) || '[]');
  const container = document.getElementById('history-container');
  if (!history.length) {
    container.innerHTML = '<div class="empty-state">No food plans yet. Save a restaurant suggestion to build your travel menu.</div>';
    return;
  }
  container.innerHTML = history.map((visit) => `
    <div class="history-card">
      <h3>${escapeHtml(visit.name)}</h3>
      <p>${escapeHtml(visit.destination)}</p>
      <div class="meta">Estimated cost: ${escapeHtml(visit.price)} · Guests: ${escapeHtml(visit.guests)}</div>
      <div class="meta">Date: ${escapeHtml(visit.visitDate)}</div>
    </div>
  `).join('');
}

function openRestaurantBooking(index) {
  const destination = document.getElementById('destination').value.trim() || 'Cox\'s Bazar';
  const restaurants = getRestaurantResults(destination);
  selectedRestaurant = restaurants[index];
  if (!selectedRestaurant) return;

  const panel = document.getElementById('booking-panel');
  panel.innerHTML = `
    <h2>Save restaurant suggestion</h2>
    <p>Keep ${escapeHtml(selectedRestaurant.name)} as part of your local dining plan.</p>
    <div class="input-group">
      <label for="visit-date">Visit date</label>
      <input id="visit-date" type="date" />
    </div>
    <div class="input-group">
      <label for="guest-count">Guests</label>
      <input id="guest-count" type="number" min="1" value="2" />
    </div>
    <button class="cta-btn" type="button" onclick="confirmRestaurantBooking()">Save Suggestion</button>
  `;
}

function confirmRestaurantBooking() {
  if (!selectedRestaurant) return;
  const visitDate = document.getElementById('visit-date').value;
  const guests = parseInt(document.getElementById('guest-count').value, 10) || 1;

  if (!visitDate) {
    alert('Please choose a visit date.');
    return;
  }

  const record = {
    id: Date.now(),
    destination: selectedRestaurant.destination,
    name: selectedRestaurant.name,
    visitDate,
    guests,
    price: selectedRestaurant.price,
    createdAt: new Date().toISOString()
  };

  const history = JSON.parse(localStorage.getItem(RESTAURANT_STORAGE_KEY) || '[]');
  history.unshift(record);
  localStorage.setItem(RESTAURANT_STORAGE_KEY, JSON.stringify(history));

  document.getElementById('booking-panel').innerHTML = `
    <h2>Suggestion saved</h2>
    <p>Your restaurant recommendation has been added to your travel plan.</p>
    <div class="booking-summary">
      <div class="row"><span>Restaurant</span><strong>${escapeHtml(record.name)}</strong></div>
      <div class="row"><span>Destination</span><strong>${escapeHtml(record.destination)}</strong></div>
      <div class="row"><span>Visit Date</span><strong>${escapeHtml(record.visitDate)}</strong></div>
      <div class="row"><span>Guests</span><strong>${escapeHtml(String(record.guests))}</strong></div>
      <div class="row"><span>Estimated Cost</span><strong>${escapeHtml(record.price)}</strong></div>
    </div>
  `;

  renderHistory();
}

function initRestaurantPage() {
  document.getElementById('search-button').addEventListener('click', renderRestaurantResults);
  renderRestaurantResults();
  renderHistory();
}

window.addEventListener('DOMContentLoaded', initRestaurantPage);
