/**
 * Prismic Flare - Synology Music Player
 * Core Logic & API Interaction
 */

class MusicPlayer {
    constructor() {
        this.audio = new Audio();
        this.currentTrack = null;
        this.playlist = [];
        this.session = null;
        this.isDemoMode = false;

        this.initEventListeners();
        this.initMediaSession();
        this.checkExistingSession();
    }

    initEventListeners() {
        // UI Elements
        this.loginBtn = document.getElementById('login-btn');
        this.demoBtn = document.createElement('button');
        this.demoBtn.id = 'demo-btn';
        this.demoBtn.textContent = 'Probar Modo Demo';
        this.demoBtn.style.marginTop = '10px';
        this.demoBtn.style.background = 'transparent';
        this.demoBtn.style.color = '#b3b3b3';
        this.demoBtn.style.border = '1px solid #404040';

        document.querySelector('.form-group').appendChild(this.demoBtn);

        this.loginOverlay = document.getElementById('login-overlay');
        this.mainContent = document.getElementById('main-content');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.progressBar = document.querySelector('.progress-bar');
        this.progressFilled = document.getElementById('progress-filled');
        this.currentTimeEl = document.getElementById('current-time');
        this.totalTimeEl = document.getElementById('total-time');

        // Handlers
        this.loginBtn.addEventListener('click', () => this.login());
        this.demoBtn.addEventListener('click', () => this.startDemoMode());
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());

        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.onMetadataLoaded());
        this.audio.addEventListener('ended', () => this.next());

        this.progressBar.addEventListener('click', (e) => this.seek(e));
    }

    async login() {
        const url = document.getElementById('nas-url').value;
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;

        if (!url || !user || !pass) return alert('Por favor, completa todos los campos');

        try {
            // Clean URL (remove trailing slash)
            const cleanUrl = url.replace(/\/+$/, '');

            // Synology API Login URL
            const loginUrl = `${cleanUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=6&method=login&account=${encodeURIComponent(user)}&passwd=${encodeURIComponent(pass)}&session=AudioStation&format=sid`;

            console.log('Connecting to:', loginUrl);

            const response = await fetch(loginUrl, {
                mode: 'cors',
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();

            if (data.success) {
                this.session = {
                    sid: data.data.sid,
                    baseUrl: cleanUrl
                };
                localStorage.setItem('syno_session', JSON.stringify(this.session));
                this.showMainApp();
                this.loadLibrary();
            } else {
                alert('Error de inicio de sesión: ' + this.getErrorCode(data.error.code));
            }
        } catch (error) {
            console.error('Login error:', error);
            if (error.name === 'TypeError' && (window.location.protocol === 'file:')) {
                alert('⚠️ ERROR DE CORS/SEGURIDAD:\n\nNo puedes conectar al NAS abriendo el archivo directamente. Para que funcione debes:\n\n1. Subir estos archivos a una carpeta en tu Synology (ej: carpeta "web").\n2. Acceder mediante la URL de tu NAS.\n\nO usa una extensión de navegador "Allow CORS" para pruebas locales.');
            } else {
                alert('Error de conexión. Revisa que el NAS sea accesible y usa HTTPS si es necesario.');
            }
        }
    }

    checkExistingSession() {
        const saved = localStorage.getItem('syno_session');
        if (saved) {
            this.session = JSON.parse(saved);
            this.showMainApp();
            this.loadLibrary();
        }
    }

    showMainApp() {
        this.loginOverlay.classList.add('hidden');
        this.mainContent.classList.remove('hidden');
    }

    startDemoMode() {
        this.isDemoMode = true;
        this.session = { baseUrl: '', sid: 'demo' };
        this.showMainApp();
        this.loadDemoLibrary();
    }

    loadDemoLibrary() {
        const albumsGrid = document.getElementById('albums-grid');
        albumsGrid.innerHTML = '';

        const demoAlbums = [
            { name: 'After Hours', artist: 'The Weeknd', art: 'https://upload.wikimedia.org/wikipedia/en/c/c1/The_Weeknd_-_After_Hours.png' },
            { name: 'Future Nostalgia', artist: 'Dua Lipa', art: 'https://upload.wikimedia.org/wikipedia/en/f/f5/Dua_Lipa_-_Future_Nostalgia_%28Official_Album_Cover%29.png' },
            { name: 'Fine Line', artist: 'Harry Styles', art: 'https://upload.wikimedia.org/wikipedia/en/b/b1/Harry_Styles_-_Fine_Line.png' },
            { name: 'Discovery', artist: 'Daft Punk', art: 'https://upload.wikimedia.org/wikipedia/en/a/ae/Daft_Punk_-_Discovery.jpg' }
        ];

        demoAlbums.forEach(album => {
            const div = document.createElement('div');
            div.className = 'album-card';
            div.innerHTML = `
                <img src="${album.art}" alt="${album.name}">
                <div class="title">${album.name}</div>
                <div class="subtitle">${album.artist}</div>
            `;
            div.onclick = () => {
                const track = {
                    title: 'Canción Demo',
                    additional: { song_tag: { artist: album.artist, album: album.name } },
                    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
                };
                this.playTrack(track);
            };
            albumsGrid.appendChild(div);
        });
    }

    async loadLibrary() {
        if (this.isDemoMode) return;
        const albumsGrid = document.getElementById('albums-grid');
        albumsGrid.innerHTML = '<p>Cargando biblioteca...</p>';

        try {
            const url = `${this.session.baseUrl}/webapi/AudioStation/album.cgi?api=SYNO.AudioStation.Album&version=3&method=list&library=all&_sid=${this.session.sid}`;
            const resp = await fetch(url);
            const data = await resp.json();

            if (data.success) {
                albumsGrid.innerHTML = '';
                data.data.albums.slice(0, 20).forEach(album => {
                    const card = this.createAlbumCard(album);
                    albumsGrid.appendChild(card);
                });
            }
        } catch (err) {
            console.error('Library load error:', err);
            albumsGrid.innerHTML = '<p>Error al cargar la biblioteca. Revisa la consola.</p>';
        }
    }

    createAlbumCard(album) {
        const div = document.createElement('div');
        div.className = 'album-card';

        // Artwork URL
        const artUrl = `${this.session.baseUrl}/webapi/AudioStation/cover.cgi?api=SYNO.AudioStation.Cover&version=3&method=getcover&library=all&album_name=${encodeURIComponent(album.name)}&album_artist_name=${encodeURIComponent(album.artist)}&_sid=${this.session.sid}`;

        div.innerHTML = `
            <img src="${artUrl}" onerror="this.src='placeholder.png'" alt="${album.name}">
            <div class="title">${album.name}</div>
            <div class="subtitle">${album.artist || 'Artista desconocido'}</div>
        `;

        div.onclick = () => this.loadAlbumTracks(album);
        return div;
    }

    async loadAlbumTracks(album) {
        // For simplicity, we just play the first track for now
        // In a real app, this would open a track list selection
        try {
            const url = `${this.session.baseUrl}/webapi/AudioStation/song.cgi?api=SYNO.AudioStation.Song&version=3&method=list&album=${encodeURIComponent(album.name)}&album_artist=${encodeURIComponent(album.artist)}&_sid=${this.session.sid}`;
            const resp = await fetch(url);
            const data = await resp.json();

            if (data.success && data.data.songs.length > 0) {
                this.playTrack(data.data.songs[0]);
            }
        } catch (err) {
            console.error('Track load error:', err);
        }
    }

    playTrack(track) {
        this.currentTrack = track;

        // Stream URL
        const streamUrl = this.isDemoMode ? track.url : `${this.session.baseUrl}/webapi/AudioStation/stream.cgi?api=SYNO.AudioStation.Stream&version=2&method=stream&id=${track.id}&_sid=${this.session.sid}`;

        this.audio.src = streamUrl;
        this.audio.play();

        this.updateUI();
        this.updateMediaSession(track);
    }

    togglePlay() {
        if (this.audio.paused) {
            this.audio.play();
            this.playPauseBtn.textContent = '⏸';
        } else {
            this.audio.pause();
            this.playPauseBtn.textContent = '▶';
        }
    }

    updateUI() {
        document.getElementById('track-title').textContent = this.currentTrack.title;
        document.getElementById('track-artist').textContent = this.currentTrack.additional.song_tag.artist;
        this.playPauseBtn.textContent = '⏸';

        let artUrl = 'placeholder.png';
        if (this.isDemoMode) {
            // Find album art from demo list
            const albumName = this.currentTrack.additional.song_tag.album;
            artUrl = 'https://upload.wikimedia.org/wikipedia/en/c/c1/The_Weeknd_-_After_Hours.png'; // Fallback for demo
        } else {
            artUrl = `${this.session.baseUrl}/webapi/AudioStation/cover.cgi?api=SYNO.AudioStation.Cover&version=3&method=getcover&library=all&album_name=${encodeURIComponent(this.currentTrack.additional.song_tag.album)}&album_artist_name=${encodeURIComponent(this.currentTrack.additional.song_tag.artist)}&_sid=${this.session.sid}`;
        }
        document.getElementById('track-art').src = artUrl;
    }

    updateProgress() {
        if (!this.audio.duration) return;
        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        this.progressFilled.style.width = `${percent}%`;
        this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }

    onMetadataLoaded() {
        this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
    }

    seek(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        this.audio.currentTime = pos * this.audio.duration;
    }

    formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    }

    initMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
            navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        }
    }

    updateMediaSession(track) {
        if ('mediaSession' in navigator) {
            let artUrl = 'https://cdn-icons-png.flaticon.com/512/3669/3669483.png';

            if (!this.isDemoMode) {
                artUrl = `${this.session.baseUrl}/webapi/AudioStation/cover.cgi?api=SYNO.AudioStation.Cover&version=3&method=getcover&library=all&album_name=${encodeURIComponent(track.additional.song_tag.album)}&album_artist_name=${encodeURIComponent(track.additional.song_tag.artist)}&_sid=${this.session.sid}`;
            }

            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.additional.song_tag.artist,
                album: track.additional.song_tag.album,
                artwork: [
                    { src: artUrl, sizes: '512x512', type: 'image/png' }
                ]
            });
        }
    }

    prev() { console.log('Prev'); }
    next() { console.log('Next'); }

    getErrorCode(code) {
        const errors = {
            400: 'Cuenta no encontrada',
            401: 'Contraseña incorrecta',
            402: 'Permiso denegado',
            403: 'Cuenta deshabilitada',
            404: 'OTP requerido'
        };
        return errors[code] || `Error desconocido (${code})`;
    }
}

// Initialize on load
window.addEventListener('load', () => {
    window.app = new MusicPlayer();
});
