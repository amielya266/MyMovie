// MAIN PAGE CODE
// SEARCH + SUGGEST
const { ipcRenderer } = require('electron');

const API_KEY = 'b7282359'; // API KEY
const BASE_URL = 'https://www.omdbapi.com/'; // API URL

// OMDb CAN'T search by genre. So we keep a list of famous movie IDs
// filter the list by genre
const SEED_IDS = [
  'tt0111161', 'tt0068646', 'tt0468569', 'tt0110912', 'tt1375666', 'tt0137523',
  'tt0133093', 'tt0114369', 'tt0816692', 'tt0120815', 'tt0245429', 'tt0172495',
  'tt0114709', 'tt0482571', 'tt0078748', 'tt0088763', 'tt0407887', 'tt0209144',
  'tt0910970', 'tt2582802', 'tt0848228', 'tt0076759', 'tt0120338', 'tt0083658',
  'tt0081505', 'tt0054215', 'tt0109830', 'tt0107048', 'tt0119217', 'tt1049413',
  'tt2380307', 'tt0361748', 'tt0253474', 'tt0102926', 'tt0095327', 'tt1431045'
];

const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
let pool = null; // cached details of the seed movies

// esc() = make text safe before put in HTML
// turns < into &lt; so internet can't break page
// "?? ''" : if  the value empty, use empty text
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// omdb() : ask OMDb website for data
async function omdb(params) {
  // Build the URL
  const query = new URLSearchParams({ ...params, apikey: API_KEY });
  const res = await fetch(`${BASE_URL}?${query}`);
  return res.json();
}

//Remember every movie showed, so "ADD" button can find its data later
const shown = new Map(); // imdbID -> movie data (used by the Add button)

// movieCard() = takes 1 movie object & return HTML text for its card
function movieCard(m) {
  shown.set(m.imdbID, m); // remember this movie
  const hasPoster = m.Poster && m.Poster !== 'N/A'; //if OMDB says no poster, so check
  return `
    <div class="movie-card">
      ${hasPoster ? `<img src="${esc(m.Poster)}" alt="Poster">` : '<div class="no-poster">No poster</div>'}
      <div class="info">
        <h3>${esc(m.Title)} (${esc(m.Year)})</h3>
        <p><b>Genre:</b> ${esc(m.Genre)}</p>
        <p><b>IMDb:</b> ⭐ ${esc(m.imdbRating)} &nbsp; <b>Runtime:</b> ${esc(m.Runtime)}</p>
        <p class="plot">${esc(m.Plot)}</p>
        <button class="add-btn" data-id="${esc(m.imdbID)}">➕ Add to Watchlist</button>
      </div>
    </div>`;
}

// ---------- SEARCH BY TITLE ----------
async function searchMovies() {
  const title = document.getElementById('title').value.trim();
  if (!title) return alert('Please enter a movie title.');  // stop if empty

  statusDiv.textContent = 'Searching...';
  resultDiv.innerHTML = ''; // clear old result

  try {
    // search by name
    const list = await omdb({ s: title, type: 'movie' });
    if (list.Response === 'False') throw new Error(list.Error || 'Movie not found'); // not found

    // the search list has no genre/rating, so load full details of the top results
    const top = list.Search.slice(0, 5);
    const details = await Promise.all(top.map(m => omdb({ i: m.imdbID, plot: 'short' })));

    // turn each movie into a card
    resultDiv.innerHTML = details.filter(d => d.Response === 'True').map(movieCard).join('');
    statusDiv.textContent = `Found ${list.totalResults} result(s). Showing top ${details.length}.`;
  } catch (err) {
    statusDiv.innerHTML = `<span class="error">${esc(err.message)}</span>`; // show error in red
  }
}

// ---------- SUGGEST BY GENRE ----------
async function loadPool() {
  if (pool) return pool; // already dw? use it
  const all = await Promise.all(SEED_IDS.map(id => omdb({ i: id, plot: 'short' })));
  pool = all.filter(m => m.Response === 'True'); // keep only succcessful
  return pool;
}

async function suggestMovies() {
  const genre = document.getElementById('genre').value; // selected genre from dropdown
  statusDiv.textContent = 'Finding suggestions...';
  resultDiv.innerHTML = '';

  try {
    const movies = await loadPool();
    const matches = movies
      .filter(m => m.Genre.split(', ').includes(genre))
      .sort((a, b) => parseFloat(b.imdbRating) - parseFloat(a.imdbRating)); // sort highest rating 1st (descending)

    if (matches.length === 0) {
      statusDiv.textContent = `No suggestions for ${genre} yet. Try another genre.`;
      return;
    }

    // take the 6 best-rated, shuffle, then shown 3 randomly
    const picks = matches.slice(0, 6).sort(() => Math.random() - 0.5).slice(0, 3);
    resultDiv.innerHTML = picks.map(movieCard).join('');
    statusDiv.textContent = `Top-rated ${genre} picks for you:`;
  } catch (err) {
    statusDiv.innerHTML = `<span class="error">Could not load suggestions.</span>`;
  }
}

// ---------- ADD TO WATCHLIST (CREATE) ----------
resultDiv.addEventListener('click', async e => {
  const btn = e.target.closest('.add-btn'); // user click button?
  if (!btn) return; // no? ignore.
  const m = shown.get(btn.dataset.id); // get full movie data using id stored in button

  // invoke() send data to main.js & waits for reply
  const reply = await ipcRenderer.invoke('add-movie', {
    imdbID: m.imdbID,
    Title: m.Title,
    Year: m.Year,
    Genre: m.Genre,
    Runtime: m.Runtime,
    imdbRating: m.imdbRating,
    Poster: m.Poster,
    Plot: m.Plot,
    status: 'To Watch',
    myRating: '',
    plannedDate: '',
    note: ''
  });
  alert(reply.message); // show "added" | "already in your watchlist"
});

// button path
document.getElementById('searchBtn').addEventListener('click', searchMovies);
document.getElementById('title').addEventListener('keydown', e => { if (e.key === 'Enter') searchMovies(); });
document.getElementById('suggestBtn').addEventListener('click', suggestMovies);
document.getElementById('watchlistBtn').addEventListener('click', () => ipcRenderer.send('open-watchlist-window'));