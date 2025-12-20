/**
 * Synology API Client for Audio Station
 * Documentation based on Synology API Guide
 */
class SynologyClient {
    constructor() {
        this.baseUrl = '';
        this.sid = null;
        this.isLoading = false;
    }

    setNasUrl(url) {
        // Ensure ends with /
        this.baseUrl = url.endsWith('/') ? url : url + '/';
    }

    /**
     * Internal helper for API calls using JSONP to bypass CORS
     */
    async request(cgiPath, apiName, methodName, version, params = {}) {
        const callbackName = `syno_cb_${Math.round(Math.random() * 1000000)}`;
        const url = new URL(`${this.baseUrl}webapi/${cgiPath}`);
        url.searchParams.append('api', apiName);
        url.searchParams.append('version', version);
        url.searchParams.append('method', methodName);
        url.searchParams.append('callback', callbackName); // Enable JSONP

        if (this.sid) {
            url.searchParams.append('_sid', this.sid);
        }

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.append(key, value);
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.id = callbackName;

            // Timeout handler
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("ERROR_CORS_OR_NETWORK"));
            }, 10000);

            const cleanup = () => {
                clearTimeout(timeout);
                if (script.parentNode) script.parentNode.removeChild(script);
                delete window[callbackName];
            };

            window[callbackName] = (data) => {
                cleanup();
                if (!data.success) {
                    const errorMap = {
                        400: "No such account or password",
                        401: "Account disabled",
                        402: "Permission denied",
                        403: "2-step verification needed",
                        404: "Two-step verification code error"
                    };
                    const msg = errorMap[data.error.code] || `Error Code ${data.error.code}`;
                    reject(new Error(msg));
                } else {
                    resolve(data.data);
                }
            };

            script.onerror = () => {
                cleanup();
                reject(new Error("ERROR_CORS_OR_NETWORK"));
            };

            console.log(`Calling Syno API: ${apiName}.${methodName}`);
            script.src = url.toString();
            document.body.appendChild(script);
        });
    }

    /**
     * Authenticate with the NAS
     */
    async login(username, password) {
        const data = await this.request('auth.cgi', 'SYNO.API.Auth', 'login', 3, {
            account: username,
            passwd: password,
            session: 'AudioStation',
            format: 'sid'
        });
        this.sid = data.sid;
        localStorage.setItem('syno_sid', this.sid);
        localStorage.setItem('syno_url', this.baseUrl);
        return data;
    }

    /**
     * Get list of songs
     */
    async getSongs(offset = 0, limit = 100) {
        return await this.request('AudioStation/song.cgi', 'SYNO.AudioStation.Song', 'list', 1, {
            offset: offset,
            limit: limit,
            additional: 'song_tag,song_audio,path'
        });
    }

    /**
     * Generate streaming URL for a song
     */
    getStreamUrl(songId) {
        const url = new URL(`${this.baseUrl}webapi/AudioStation/stream.cgi`);
        url.searchParams.append('api', 'SYNO.AudioStation.Stream');
        url.searchParams.append('version', 2);
        url.searchParams.append('method', 'stream');
        url.searchParams.append('id', songId);
        if (this.sid) {
            url.searchParams.append('_sid', this.sid);
        }
        return url.toString();
    }

    /**
     * Logout
     */
    async logout() {
        if (this.sid) {
            try {
                await this.request('auth.cgi', 'SYNO.API.Auth', 1, { method: 'logout', session: 'AudioStation' });
            } catch (e) { }
        }
        this.sid = null;
        localStorage.removeItem('syno_sid');
    }
}

window.SynologyClient = new SynologyClient();
