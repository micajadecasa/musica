/**
 * Main Application Logic
 */

const AppState = {
    songs: [],
    currentSong: null,
    isPlaying: false,
    client: window.SynologyClient
};

// DOM Elements
const elements = {
    loginOverlay: document.getElementById('login-overlay'),
    nasUrl: document.getElementById('nas-url'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    loginBtn: document.getElementById('login-btn'),
    loginError: document.getElementById('login-error'),
    songContainer: document.getElementById('song-container'),
    audioPlayer: document.getElementById('audio-player'),
    masterPlay: document.getElementById('master-play'),
    currentTitle: document.getElementById('current-title'),
    currentArtist: document.getElementById('current-artist'),
    timeCurrent: document.getElementById('time-current'),
    timeTotal: document.getElementById('time-total'),
    seekBar: document.getElementById('seek-bar'),
    seekFill: document.getElementById('seek-fill')
};

/**
 * Initialize the App
 */
async function init() {
    // Check for saved session
    const savedUrl = localStorage.getItem('syno_url');
    const savedSid = localStorage.getItem('syno_sid');

    if (savedUrl && savedSid) {
        AppState.client.setNasUrl(savedUrl);
        AppState.client.sid = savedSid;
        elements.loginOverlay.style.display = 'none';
        loadLibrary();
    }

    setupEventListeners();
}

/**
 * Event Listeners
 */
function setupEventListeners() {
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.masterPlay.addEventListener('click', togglePlay);

    // Audio Player events
    elements.audioPlayer.addEventListener('timeupdate', updateProgress);
    elements.audioPlayer.addEventListener('loadedmetadata', () => {
        elements.timeTotal.textContent = formatTime(elements.audioPlayer.duration);
    });

    elements.seekBar.addEventListener('click', (e) => {
        const rect = elements.seekBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        elements.audioPlayer.currentTime = pos * elements.audioPlayer.duration;
    });

    // Enter to login
    [elements.nasUrl, elements.username, elements.password].forEach(el => {
        el.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    });
}

/**
 * Authentication Handler
 */
async function handleLogin() {
    const url = elements.nasUrl.value.trim();
    const user = elements.username.value.trim();
    const pass = elements.password.value;

    if (!url || !user || !pass) {
        showError("Por favor, completa todos los campos.");
        return;
    }

    elements.loginBtn.disabled = true;
    elements.loginBtn.textContent = "Conectando...";
    elements.loginError.style.display = 'none';

    try {
        AppState.client.setNasUrl(url);
        await AppState.client.login(user, pass);

        elements.loginOverlay.style.opacity = '0';
        setTimeout(() => {
            elements.loginOverlay.style.display = 'none';
        }, 300);

        loadLibrary();
    } catch (error) {
        if (error.message === "ERROR_CORS_OR_NETWORK") {
            showError("Bloqueo de red (CORS). Si usas HTTP local, asegúrate de que el navegador no lo esté bloqueando o usa una extensión para permitir CORS.");
        } else if (error.message.includes("verification")) {
            showError("Tu cuenta requiere verificación en 2 pasos (2FA), lo cual no está soportado en esta versión simple.");
        } else {
            showError(`Error: ${error.message}`);
        }
        console.error(error);
    } finally {
        elements.loginBtn.disabled = false;
        elements.loginBtn.textContent = "Conectar";
    }
}

/**
 * Load Song Library
 */
async function loadLibrary() {
    try {
        const { songs } = await AppState.client.getSongs();
        AppState.songs = songs;
        renderSongs(songs);
    } catch (error) {
        console.error("Failed to load library", error);
        // If SID expired, show login
        if (error.message.includes('105') || error.message.includes('106')) {
            elements.loginOverlay.style.display = 'flex';
        }
    }
}

/**
 * Render Songs into the UI
 */
function renderSongs(songs) {
    elements.songContainer.innerHTML = '';

    if (songs.length === 0) {
        elements.songContainer.innerHTML = '<p style="padding: 20px;">No se encontraron canciones.</p>';
        return;
    }

    songs.forEach((song, index) => {
        const songEl = document.createElement('div');
        songEl.className = 'song-item';
        songEl.innerHTML = `
            <div class="index">${index + 1}</div>
            <div class="song-info">
                <h4>${song.title}</h4>
                <p>${song.additional.song_tag.artist || 'Artista desconocido'}</p>
            </div>
            <div class="album">${song.additional.song_tag.album || ''}</div>
            <div class="duration">${formatTime(song.additional.song_audio.duration)}</div>
        `;

        songEl.addEventListener('click', () => playSong(song));
        elements.songContainer.appendChild(songEl);
    });
}

/**
 * Playback Control
 */
function playSong(song) {
    AppState.currentSong = song;
    const streamUrl = AppState.client.getStreamUrl(song.id);

    elements.audioPlayer.src = streamUrl;
    elements.audioPlayer.play();

    AppState.isPlaying = true;
    updatePlayerUI();
}

function togglePlay() {
    if (!AppState.currentSong) return;

    if (AppState.isPlaying) {
        elements.audioPlayer.pause();
    } else {
        elements.audioPlayer.play();
    }

    AppState.isPlaying = !AppState.isPlaying;
    updatePlayerUI();
}

/**
 * UI Updates
 */
function updatePlayerUI() {
    if (AppState.currentSong) {
        elements.currentTitle.textContent = AppState.currentSong.title;
        elements.currentArtist.textContent = AppState.currentSong.additional.song_tag.artist;
    }

    const playIcon = elements.masterPlay.querySelector('i');
    if (AppState.isPlaying) {
        playIcon.setAttribute('data-lucide', 'pause');
    } else {
        playIcon.setAttribute('data-lucide', 'play');
    }
    lucide.createIcons();
}

function updateProgress() {
    const { currentTime, duration } = elements.audioPlayer;
    if (isNaN(duration)) return;

    const percent = (currentTime / duration) * 100;
    elements.seekFill.style.width = `${percent}%`;
    elements.timeCurrent.textContent = formatTime(currentTime);
}

/**
 * Helpers
 */
function formatTime(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showError(msg) {
    elements.loginError.textContent = msg;
    elements.loginError.style.display = 'block';
}

// Kickstart the app
init();
