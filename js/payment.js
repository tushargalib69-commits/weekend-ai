const HOTEL_BOOKINGS_KEY = 'weekendAIHotelBookings';
const PAYMENT_HISTORY_KEY = 'weekendai_payment_history';

function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function money(value) { return `৳${Number(value || 0).toLocaleString('en-BD')}`; }
function getBookings() { try { const value = JSON.parse(localStorage.getItem(HOTEL_BOOKINGS_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function saveBookings(bookings) { localStorage.setItem(HOTEL_BOOKINGS_KEY, JSON.stringify(bookings)); }
function paymentMethodName(method) { return { bkash: 'bKash', nagad: 'Nagad', card: 'Card Payment' }[method] || 'Payment'; }
function getBooking() { const id = new URLSearchParams(location.search).get('bookingId'); return getBookings().find((item) => item.bookingId === id) || null; }

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div'); toast.className = `toast toast-${type}`; toast.textContent = message;
  container.append(toast); setTimeout(() => toast.remove(), 3500);
}

function bookingSummary(booking) {
  if (!booking) return '<div class="empty-state">Open payment from a booking to see its complete invoice.</div>';
  return `<div class="booking-summary">
    <div class="row"><span>Booking ID</span><strong>${escapeHtml(booking.bookingId)}</strong></div>
    <div class="row"><span>Hotel</span><strong>${escapeHtml(booking.hotelName)}</strong></div>
    <div class="row"><span>Guest</span><strong>${escapeHtml(booking.customerName)}</strong></div>
    <div class="row"><span>Dates</span><strong>${escapeHtml(booking.checkIn)} → ${escapeHtml(booking.checkOut)}</strong></div>
    <div class="row"><span>Subtotal</span><strong>${money(booking.subtotal)}</strong></div>
    <div class="row"><span>Service charge</span><strong>${money(booking.serviceCharge)}</strong></div>
    <div class="row"><span>Tax</span><strong>${money(booking.tax)}</strong></div>
    <div class="row price-total"><span>Grand total</span><strong>${money(booking.grandTotal)}</strong></div>
  </div>`;
}

function renderPaymentPanel() {
  const booking = getBooking();
  const method = document.getElementById('payment-method').value;
  const panel = document.getElementById('payment-panel');
  if (!booking) { panel.innerHTML = bookingSummary(null); return; }
  if (booking.bookingStatus === 'Cancelled') { panel.innerHTML = '<div class="empty-state">This booking has been cancelled and cannot be paid.</div>'; return; }
  if (booking.paymentStatus === 'Paid') { panel.innerHTML = `${bookingSummary(booking)}<p class="booking-note">This booking has already been paid.</p>`; return; }
  panel.innerHTML = `<h2>${escapeHtml(paymentMethodName(method))}</h2>
    <p class="booking-note">Demo payment only — do not enter card, wallet, or banking credentials.</p>
    ${bookingSummary(booking)}
    <div class="input-group"><label for="payment-reference">Demo payment reference (optional)</label><input id="payment-reference" maxlength="50" placeholder="For example: DEMO-12345" /></div>
    <div class="modal-actions"><button class="cta-btn" id="confirm-payment-button" type="button">Confirm Demo Payment · ${money(booking.grandTotal)}</button><a class="auth-btn" href="my-bookings.html?bookingId=${encodeURIComponent(booking.bookingId)}">Back to booking</a></div>`;
  document.getElementById('confirm-payment-button').addEventListener('click', confirmPayment);
}

function confirmPayment() {
  const booking = getBooking();
  if (!booking || booking.bookingStatus === 'Cancelled') return;
  const button = document.getElementById('confirm-payment-button'); button.disabled = true; button.textContent = 'Processing…';
  const method = document.getElementById('payment-method').value;
  setTimeout(() => {
    const bookings = getBookings(); const index = bookings.findIndex((item) => item.bookingId === booking.bookingId);
    if (index < 0) { showToast('Booking could not be found.', 'error'); return; }
    bookings[index].paymentStatus = 'Paid'; bookings[index].paidAt = new Date().toISOString(); saveBookings(bookings);
    const history = JSON.parse(localStorage.getItem(PAYMENT_HISTORY_KEY) || '[]');
    history.unshift({ id: `PAY-${Date.now()}`, bookingId: booking.bookingId, method: paymentMethodName(method), amount: money(booking.grandTotal), status: 'Paid', date: new Date().toISOString(), note: 'Demo hotel booking payment' });
    localStorage.setItem(PAYMENT_HISTORY_KEY, JSON.stringify(history)); showToast('Payment recorded successfully.', 'success'); renderPaymentPanel(); renderPaymentHistory();
  }, 500);
}

function renderPaymentHistory() {
  const records = JSON.parse(localStorage.getItem(PAYMENT_HISTORY_KEY) || '[]');
  document.getElementById('history-container').innerHTML = records.length ? records.slice(0, 5).map((item) => `<div class="history-card"><h3>${escapeHtml(item.method)}</h3><div class="meta">${escapeHtml(item.bookingId || 'General payment')} · ${escapeHtml(item.amount)}</div><div class="meta">${escapeHtml(item.status)} · ${escapeHtml(new Date(item.date).toLocaleDateString())}</div></div>`).join('') : '<div class="empty-state">No payment records yet.</div>';
}
window.addEventListener('DOMContentLoaded', () => { document.getElementById('start-payment-button').addEventListener('click', renderPaymentPanel); document.getElementById('payment-method').addEventListener('change', renderPaymentPanel); renderPaymentPanel(); renderPaymentHistory(); });
