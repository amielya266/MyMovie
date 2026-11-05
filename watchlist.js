// WATCHLIST: READ / UPDATE / DELETE + CALCULATIONS
const { ipcRenderer } = require('electron'); // connected with main.js

const listDiv = document.getElementById('list'); // movie items shown
const statsDiv = document.getElementById('stats'); // statistics panel 
const filterSel = document.getElementById('filter'); // "Show: All / To Watch / Watched" dropdown

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- CALCULATIONS ----------
function minutes(runtime) {            // turn text "148 min" -> 148
  const n = parseInt(runtime);
  return isNaN(n) ? 0 : n;
}

function formatTime(totalMin) {        // turn 345 minutes -> "5h 45m"
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
}

// sum / count
function average(nums) {
  return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '-';
}

// calculate & show in stats panel
function showStats(movies) {
  const watched = movies.filter(m => m.status === 'Watched');
  const toWatch = movies.filter(m => m.status !== 'Watched');

  // average rating of ALL movies
  const avgImdb = average(movies.map(m => parseFloat(m.imdbRating)).filter(n => !isNaN(n)));
  // average rating USER gave
  const avgMine = average(watched.map(m => parseFloat(m.myRating)).filter(n => !isNaN(n)));
  // Total minutes still needed to watch
  const remaining = toWatch.reduce((sum, m) => sum + minutes(m.Runtime), 0);
  // percentage movies watched
  const progress = movies.length ? Math.round((watched.length / movies.length) * 100) : 0;

  statsDiv.innerHTML = `
    <p><b>Total movies:</b> ${movies.length} &nbsp;|&nbsp; <b>Watched:</b> ${watched.length} (${progress}%)</p>
    <p><b>Average IMDb rating:</b> ⭐ ${avgImdb} &nbsp;|&nbsp; <b>My average rating:</b> ⭐ ${avgMine}</p>
    <p><b>Time needed to finish the "To Watch" list:</b> ${formatTime(remaining)}</p>`;
}

// ---------- READ ----------
async function loadMovies() {
  const movies = await ipcRenderer.invoke('get-movies'); // ask main.js for saved movies
  showStats(movies); // update the statistics

  // Apply dropdown filter (All | to Watch | Watched)
  const filter = filterSel.value;
  const visible = movies.filter(m => filter === 'All' || m.status === filter);

  if (visible.length === 0) {
    listDiv.innerHTML = '<p>No movies here yet. Add some from the main window!</p>';
    return;
  }

  // Build one HTML block.
  listDiv.innerHTML = visible.map(m => {
    const hasPoster = m.Poster && m.Poster !== 'N/A';
    return `
    <div class="movie-card wl-item" data-id="${esc(m.imdbID)}">
      ${hasPoster ? `<img src="${esc(m.Poster)}" alt="Poster">` : '<div class="no-poster">No poster</div>'}
      <div class="info">
        <h3>${esc(m.Title)} (${esc(m.Year)})</h3>
        <p>${esc(m.Genre)} · ${esc(m.Runtime)} · IMDb ⭐ ${esc(m.imdbRating)}</p>
        <label>Status:
          <select class="f-status">
            <option ${m.status === 'To Watch' ? 'selected' : ''}>To Watch</option>
            <option ${m.status === 'Watched' ? 'selected' : ''}>Watched</option>
          </select>
        </label>
        <label>My rating (1-10): <input class="f-rating" type="number" min="1" max="10" value="${esc(m.myRating)}" style="width:70px"></label><br>
        <label>Planned date: <input class="f-date" type="date" value="${esc(m.plannedDate)}" style="width:160px"></label><br>
        <label>Note: <input class="f-note" type="text" value="${esc(m.note)}" placeholder="Why this movie?" style="width:260px"></label><br>
        <button class="save-btn">💾 Save</button>
        <button class="delete-btn">🗑 Delete</button>
      </div>
    </div>`;
  }).join('');
}

// ---------- UPDATE + DELETE ----------
listDiv.addEventListener('click', async e => {
  const item = e.target.closest('.wl-item'); // which movie block was clicked inside?
  if (!item) return;
  const id = item.dataset.id; // the movie's ID stored in the block

  // Update : save button was clicked
  if (e.target.closest('.save-btn')) {
    const rating = item.querySelector('.f-rating').value;
    if (rating !== '' && (rating < 1 || rating > 10)) return alert('Rating must be between 1 and 10.');

    // send new values to main.js which saves in movies.json
    await ipcRenderer.invoke('update-movie', {
      imdbID: id,
      changes: {
        status: item.querySelector('.f-status').value,
        myRating: rating,
        plannedDate: item.querySelector('.f-date').value,
        note: item.querySelector('.f-note').value.trim()
      }
    });
    alert('Movie updated!');
  }

  // Delete : delete button was clicked
  if (e.target.closest('.delete-btn')) {
    if (!confirm('Remove this movie from your watchlist?')) return;
    await ipcRenderer.invoke('delete-movie', id);
    // no need to refresh by hand > main.js send 'movies-changed' after save
  }
});

// when dropdown filter changes, reload the list
filterSel.addEventListener('change', loadMovies);
// when main.js says 'movies-changed' (after add / update / delete), auto reload
ipcRenderer.on('movies-changed', loadMovies);

// load the movie once when the page 1st open
loadMovies();