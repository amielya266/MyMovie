const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let watchlistWindow = null;

const dataDir = path.join(__dirname, 'data');
const filePath = path.join(dataDir, 'movies.json'); // SAVE TO MOVIES.JSON

// ---------- LOCAL STORAGE (movies.json) ----------
// read all movies from json file & return them as js array
function readMovies() {
  try {
    if (!fs.existsSync(filePath)) return []; // no file yet | empty list
    return JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]'); // empty text > array []
  } catch (err) {
    return []; // if the file broken > use empty list []
  }
}

// save whole movie array into json file
function writeMovies(list) {
  fs.mkdirSync(dataDir, { recursive: true }); // make sure "data" folder exist
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2)); 
  if (watchlistWindow && !watchlistWindow.isDestroyed()) { // if watchlist window open > tell it data changed, refresh
    watchlistWindow.webContents.send('movies-changed');
  }
}

// ---------- WINDOWS (MAIN PAGE) ----------
// create main window (search + suggest page)
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  mainWindow.loadFile('renderer/index.html'); // show this html page inside window
}

// create watchlist window
function createWatchlistWindow() { // if already open, bring to the front instead of open second one.
  if (watchlistWindow && !watchlistWindow.isDestroyed()) {
    watchlistWindow.focus();
    return;
  }
  watchlistWindow = new BrowserWindow({
    width: 900,
    height: 750,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  watchlistWindow.loadFile('renderer/watchlist.html');
  watchlistWindow.on('closed', () => (watchlistWindow = null)); // when closed, reset variable
}

// when main page sends 'open-watchlist-window' (button), open watchlist
ipcMain.on('open-watchlist-window', createWatchlistWindow);

// ---------- CRUD (CREATE, READ, UPDATE, DELETE) ----------
// CREATE - add movie to watchlist
ipcMain.handle('add-movie', (event, movie) => {
  const list = readMovies();
  if (list.some(m => m.imdbID === movie.imdbID)) { // check if ANY movie has same ID
    return { ok: false, message: `"${movie.Title}" is already in your watchlist.` }; // IF THE MOVIE ALREADY IN WATCHLIST
  }
  list.push(movie); // add to the end of the array
  writeMovies(list); // save to file
  return { ok: true, message: `"${movie.Title}" added to your watchlist!` }; // reply to page
});

// READ - send back all saved movies
ipcMain.handle('get-movies', () => readMovies()); // READ WATCHLIST

// UPDATE - change some fields of one movie (status, rating, date, note)
ipcMain.handle('update-movie', (event, { imdbID, changes }) => {
  const list = readMovies();
  const index = list.findIndex(m => m.imdbID === imdbID); // find position of the movie
  if (index === -1) return { ok: false }; // not found
  list[index] = { ...list[index], ...changes }; // copy the old, overwrite only the changed fields
  writeMovies(list);
  return { ok: true };
});

// DELETE - remove 1 movie
ipcMain.handle('delete-movie', (event, imdbID) => {
  writeMovies(readMovies().filter(m => m.imdbID !== imdbID)); // by ID
  return { ok: true };
});

// start the app when Electron is ready. open Main Window
app.whenReady().then(createMainWindow);