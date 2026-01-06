// ============================================
// UNIVERSAL VIDEO PLAYER - MP4 & HLS
// ============================================

// Configuration from PHP
const availableVideos = <?php echo json_encode($availableVideos); ?>;
const availableAudioTracks = <?php echo json_encode($available_audio_tracks); ?>;
const defaultQuality = '<?php echo $defaultQuality; ?>';
const defaultAudio = '<?php echo $default_audio; ?>';
const primaryType = '<?php echo $primary_type; ?>';
const hlsAvailable = <?php echo $hls_available ? 'true' : 'false'; ?>;
const isMultiAudio = <?php echo !empty($available_audio_tracks) && count($available_audio_tracks) > 1 ? 'true' : 'false'; ?>;
const isPaidUser = <?php echo $is_paid_user ? 'true' : 'false'; ?>;

// DOM Elements
const video = document.getElementById('customVideo');
const playerContainer = document.getElementById('playerContainer');
const premiumIndicator = document.getElementById('premiumIndicator');
const sourceTypeIndicator = document.getElementById('sourceTypeIndicator');
const audioTrackIndicator = document.getElementById('audioTrackIndicator');
const currentAudioIndicator = document.getElementById('currentAudioIndicator');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const closeErrorBtn = document.getElementById('closeErrorBtn');
const bigPlayBtn = document.getElementById('bigPlayBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const progressBar = document.getElementById('progressBar');
const progressBarBg = document.getElementById('progressBarBg');
const bufferBar = document.getElementById('bufferBar');
const progressKnob = document.getElementById('progressKnob');
const mobileSeekKnob = document.getElementById('mobileSeekKnob');
const audioBtn = document.getElementById('audioBtn');
const audioDropdown = document.getElementById('audioDropdown');
const currentAudioIcon = document.getElementById('currentAudioIcon');
const currentAudioName = document.getElementById('currentAudioName');
const muteBtn = document.getElementById('muteBtn');
const muteIcon = document.getElementById('muteIcon');
const volumeSlider = document.getElementById('volumeSlider');
const speedBtn = document.getElementById('speedBtn');
const currentSpeed = document.getElementById('currentSpeed');
const speedDropdown = document.getElementById('speedDropdown');
const speedOptions = document.querySelectorAll('.speed-option');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fullscreenIcon = document.getElementById('fullscreenIcon');
const downloadBtn = document.getElementById('downloadBtn');
const downloadDropdown = document.getElementById('downloadDropdown');
const downloadOptions = document.querySelectorAll('.download-option');
const qualityBtn = document.getElementById('qualityBtn');
const currentQuality = document.getElementById('currentQuality');
const qualityDropdown = document.getElementById('qualityDropdown');
const loadingIndicator = document.getElementById('loadingIndicator');

// State
let currentQualityLevel = defaultQuality;
let currentAudioTrack = defaultAudio;
let currentPlaybackRate = 1.0;
let hls = null;
let hideControlsTimeout;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let isFullscreen = false;
let currentTimeBeforeChange = 0;
let isSeeking = false;
let bufferInterval;
let controlsVisible = true;
let isPlayingBeforeSeek = false;
let playPromise = null;

// Initialize Player
function initPlayer() {
    console.log('Initializing Universal Video Player...');
    console.log('Primary Type:', primaryType);
    console.log('HLS Available:', hlsAvailable);
    console.log('Available Videos:', availableVideos);
    console.log('Available Audio Tracks:', availableAudioTracks);
    
    // Show source type indicator
    if (sourceTypeIndicator) {
        sourceTypeIndicator.classList.add('show');
        setTimeout(() => {
            sourceTypeIndicator.classList.remove('show');
        }, 3000);
    }
    
    // Set initial playback rate
    video.playbackRate = currentPlaybackRate;
    
    // Hide audio button for MP4 or single audio HLS
    if (audioBtn) {
        if (!hlsAvailable || primaryType !== 'hls' || Object.keys(availableAudioTracks).length <= 1) {
            audioBtn.classList.add('hidden');
        }
    }
    
    // Load initial video
    loadVideo(currentQualityLevel, true);
    
    setTimeout(() => {
        if (qualityDropdown) {
            setupQualityDropdown();
        }
        
        if (hlsAvailable && primaryType == 'hls' && audioDropdown && Object.keys(availableAudioTracks).length > 1) {
            setupAudioDropdown();
        }
        
        setupSpeedControl();
        setupOrientationDetection();
        startBufferMonitoring();
        startControlsHideTimer();
        applyMobileVideoFixes();
        setupDownloadButton();
        
        if (isPaidUser) {
            showPremiumIndicator('Premium Member');
        }
        
        // Setup event listeners
        setupEventListeners();
        setupMobileTouchEvents();
        
        // Check mobile orientation
        checkOrientation();
    }, 500);
}

// Load video with proper handling
function loadVideo(quality, isInitialLoad = false) {
    if (!availableVideos[quality]) {
        console.log('Video not available for quality:', quality);
        showError('Video not available for selected quality.');
        return;
    }
    
    // Check if quality requires paid subscription (480p, 720p, 1080p)
    if ((quality === '480' || quality === '720' || quality === '1080') && !isPaidUser) {
        showError('This quality is available for premium members only.');
        return;
    }
    
    console.log(`Loading ${quality} video...`);
    
    const wasPlaying = !video.paused && !video.ended;
    isPlayingBeforeSeek = wasPlaying;
    
    if (video.currentTime && !isInitialLoad) {
        currentTimeBeforeChange = video.currentTime;
    } else {
        currentTimeBeforeChange = 0;
    }
    
    showLoading(true);
    
    video.onerror = null;
    video.onloadeddata = null;
    
    const newSource = availableVideos[quality];
    
    if (video.src === newSource) {
        console.log('Already using this quality');
        showLoading(false);
        return;
    }
    
    // Stop any existing HLS instance
    if (hls) {
        hls.destroy();
        hls = null;
    }
    
    // Check if it's HLS stream
    if (quality === 'hls' || newSource.includes('.m3u8')) {
        initializeHLS(newSource, wasPlaying);
    } else {
        // Direct MP4 file - Hide audio button
        if (audioBtn) {
            audioBtn.classList.add('hidden');
        }
        
        video.src = newSource;
        video.load();
        
        const loadTimeout = setTimeout(() => {
            console.log('Video load timeout');
            showLoading(false);
            showError('Video load timeout. Please try again.');
        }, 15000);
        
        video.onloadeddata = () => {
            clearTimeout(loadTimeout);
            console.log(`${quality} loaded successfully`);
            
            showLoading(false);
            
            if (currentTimeBeforeChange > 0) {
                video.currentTime = currentTimeBeforeChange;
                currentTimeBeforeChange = 0;
            }
            
            updateQualityUI(quality);
            
            if (wasPlaying) {
                playVideo();
            }
        };
        
        video.oncanplay = () => {
            console.log(`${quality} can play`);
        };
        
        video.onerror = (e) => {
            clearTimeout(loadTimeout);
            console.error('Video load error for quality:', quality, e);
            showLoading(false);
            
            // Try different sources in order
            const fallbackOrder = ['360', '240', 'hls'];
            for (const fallbackQuality of fallbackOrder) {
                if (fallbackQuality !== quality && availableVideos[fallbackQuality]) {
                    console.log(`Trying fallback to ${fallbackQuality}...`);
                    showError(`Failed to load ${quality}. Trying ${fallbackQuality}...`);
                    setTimeout(() => loadVideo(fallbackQuality), 1000);
                    return;
                }
            }
            
            showError('Failed to load video. Please try another quality or check your connection.');
        };
    }
}

// Initialize HLS.js (only for HLS)
function initializeHLS(videoUrl, wasPlaying) {
    console.log('Initializing HLS.js for:', videoUrl);
    
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            debug: false,
            autoStartLoad: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5,
            audioTrackSelection: true
        });
        
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
            console.log('HLS manifest parsed');
            console.log('Audio tracks:', hls.audioTracks);
            
            // Show audio button if multiple audio tracks
            if (audioBtn && hls.audioTracks && hls.audioTracks.length > 1) {
                audioBtn.classList.remove('hidden');
                setupHlsAudioTracks();
            } else {
                if (audioBtn) audioBtn.classList.add('hidden');
            }
            
            showLoading(false);
            
            if (currentTimeBeforeChange > 0) {
                video.currentTime = currentTimeBeforeChange;
                currentTimeBeforeChange = 0;
            }
            
            updateQualityUI('hls');
            
            if (wasPlaying) {
                playVideo();
            }
        });
        
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, function(event, data) {
            console.log('Audio tracks updated:', data);
            if (audioBtn && hls.audioTracks && hls.audioTracks.length > 1) {
                audioBtn.classList.remove('hidden');
                setupHlsAudioTracks();
            }
        });
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            console.error('HLS error:', data);
            if (data.fatal) {
                showLoading(false);
                
                // Try to fallback to MP4 if available
                const fallbackOrder = ['360', '240', '720', '480'];
                for (const fallbackQuality of fallbackOrder) {
                    if (availableVideos[fallbackQuality]) {
                        console.log(`HLS failed, falling back to ${fallbackQuality} MP4...`);
                        showError(`Stream failed. Trying ${fallbackQuality} MP4...`);
                        setTimeout(() => loadVideo(fallbackQuality), 1000);
                        return;
                    }
                }
                
                showError('Failed to load video stream. Please try another quality.');
            }
        });
        
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        console.log('Using native HLS support');
        video.src = videoUrl;
        
        video.addEventListener('loadedmetadata', function() {
            showLoading(false);
            updateQualityUI('hls');
            
            // For Safari, we can't easily detect audio tracks
            if (audioBtn && Object.keys(availableAudioTracks).length > 1) {
                audioBtn.classList.remove('hidden');
            } else {
                if (audioBtn) audioBtn.classList.add('hidden');
            }
            
            if (currentTimeBeforeChange > 0) {
                video.currentTime = currentTimeBeforeChange;
                currentTimeBeforeChange = 0;
            }
            
            if (wasPlaying) {
                playVideo();
            }
        });
        
        video.onerror = (e) => {
            showLoading(false);
            // Try to fallback to MP4 if available
            const fallbackOrder = ['360', '240', '720', '480'];
            for (const fallbackQuality of fallbackOrder) {
                if (availableVideos[fallbackQuality]) {
                    console.log(`Native HLS failed, falling back to ${fallbackQuality}...`);
                    showError(`Stream failed. Trying ${fallbackQuality}...`);
                    setTimeout(() => loadVideo(fallbackQuality), 1000);
                    return;
                }
            }
            showError('Failed to load video stream. Please try another quality.');
        };
    } else {
        showLoading(false);
        // Try to fallback to MP4 if available
        const fallbackOrder = ['360', '240', '720', '480'];
        for (const fallbackQuality of fallbackOrder) {
            if (availableVideos[fallbackQuality]) {
                console.log('Stream not supported, falling back to MP4...');
                showError('Stream not supported. Trying MP4...');
                setTimeout(() => loadVideo(fallbackQuality), 1000);
                return;
            }
        }
        showError('Your browser does not support Stream video playback. Please try a different browser.');
    }
}

// Setup HLS audio tracks
function setupHlsAudioTracks() {
    if (!hls || !hls.audioTracks || hls.audioTracks.length <= 1) return;
    
    console.log('Setting up HLS audio tracks:', hls.audioTracks);
    
    // Clear existing audio options
    if (audioDropdown) {
        audioDropdown.innerHTML = '';
    }
    
    // Add audio options
    hls.audioTracks.forEach((track, index) => {
        const audioOption = document.createElement('div');
        audioOption.className = 'audio-option';
        if (index === hls.audioTrack) {
            audioOption.classList.add('active');
        }
        
        audioOption.dataset.trackIndex = index;
        
        // Get language and name
        const lang = track.lang || 'und';
        const name = track.name || `Audio ${index + 1}`;
        
        // Add flag icon
        const flagSpan = document.createElement('span');
        flagSpan.className = 'audio-flag';
        
        switch(lang.toLowerCase()) {
            case 'hin': flagSpan.textContent = '🇮🇳'; break;
            case 'eng': flagSpan.textContent = '🇺🇸'; break;
            case 'jpn': flagSpan.textContent = '🇯🇵'; break;
            case 'kr': flagSpan.textContent = '🇰🇷'; break;
            case 'cn': flagSpan.textContent = '🇨🇳'; break;
            case 'ur': flagSpan.textContent = '🇵🇰'; break;
            case 'ar': flagSpan.textContent = '🇸🇦'; break;
            case 'es': flagSpan.textContent = '🇪🇸'; break;
            case 'fr': flagSpan.textContent = '🇫🇷'; break;
            case 'de': flagSpan.textContent = '🇩🇪'; break;
            default: flagSpan.textContent = '🎵';
        }
        
        // Add name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'audio-name';
        nameSpan.textContent = name;
        
        // Add language code
        const langSpan = document.createElement('span');
        langSpan.style.fontSize = '10px';
        langSpan.style.opacity = '0.7';
        langSpan.style.marginLeft = 'auto';
        langSpan.textContent = `(${lang.toUpperCase()})`;
        
        audioOption.appendChild(flagSpan);
        audioOption.appendChild(nameSpan);
        audioOption.appendChild(langSpan);
        
        // Add click event
        audioOption.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const trackIndex = parseInt(this.dataset.trackIndex);
            
            if (trackIndex === hls.audioTrack) {
                audioDropdown.classList.remove('show');
                return;
            }
            
            // Switch audio track
            hls.audioTrack = trackIndex;
            
            // Update UI
            audioDropdown.querySelectorAll('.audio-option').forEach(opt => {
                opt.classList.remove('active');
            });
            this.classList.add('active');
            
            // Update audio button
            if (currentAudioIcon) {
                currentAudioIcon.textContent = flagSpan.textContent;
            }
            if (currentAudioName) {
                currentAudioName.textContent = name;
            }
            
            audioDropdown.classList.remove('show');
            resetControlsHideTimer();
            
            // Show audio change notification
            showAudioChangeNotification(name);
        });
        
        if (audioDropdown) {
            audioDropdown.appendChild(audioOption);
        }
    });
}

// Setup speed control
function setupSpeedControl() {
    if (!speedBtn || !speedDropdown) return;
    
    speedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isShowing = speedDropdown.classList.contains('show');
        
        if (audioDropdown) audioDropdown.classList.remove('show');
        if (qualityDropdown) qualityDropdown.classList.remove('show');
        if (downloadDropdown) downloadDropdown.classList.remove('show');
        
        if (isShowing) {
            speedDropdown.classList.remove('show');
        } else {
            speedDropdown.classList.add('show');
        }
        
        resetControlsHideTimer();
    });
    
    // Setup speed options
    speedOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const speed = parseFloat(this.dataset.speed);
            
            if (speed === currentPlaybackRate) {
                speedDropdown.classList.remove('show');
                return;
            }
            
            // Update playback rate
            video.playbackRate = speed;
            currentPlaybackRate = speed;
            
            // Update UI
            speedOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            currentSpeed.textContent = speed + 'x';
            speedDropdown.classList.remove('show');
            resetControlsHideTimer();
            
            // Show speed change notification
            showSpeedChangeNotification(speed + 'x');
        });
    });
}

// Setup audio dropdown
function setupAudioDropdown() {
    if (!audioDropdown || !audioBtn) return;
    
    audioBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isShowing = audioDropdown.classList.contains('show');
        
        if (qualityDropdown) qualityDropdown.classList.remove('show');
        if (downloadDropdown) downloadDropdown.classList.remove('show');
        if (speedDropdown) speedDropdown.classList.remove('show');
        
        if (isShowing) {
            audioDropdown.classList.remove('show');
        } else {
            audioDropdown.classList.add('show');
        }
        
        resetControlsHideTimer();
    });
    
    // Setup audio options from PHP data
    const audioOptions = audioDropdown.querySelectorAll('.audio-option');
    audioOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const audioCode = this.dataset.audio;
            const audioName = this.dataset.name;
            const audioLang = this.dataset.lang;
            
            if (audioCode === currentAudioTrack) {
                audioDropdown.classList.remove('show');
                return;
            }
            
            // Update UI
            audioOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            currentAudioTrack = audioCode;
            
            // Update audio button
            if (currentAudioIcon) {
                const flagSpan = this.querySelector('.audio-flag');
                if (flagSpan) {
                    currentAudioIcon.textContent = flagSpan.textContent;
                }
            }
            if (currentAudioName) currentAudioName.textContent = audioName;
            
            audioDropdown.classList.remove('show');
            resetControlsHideTimer();
            
            // Show audio change notification
            showAudioChangeNotification(audioName);
        });
    });
}

// Show audio change notification
function showAudioChangeNotification(audioName) {
    if (!sourceTypeIndicator) return;
    
    const originalText = sourceTypeIndicator.textContent;
    sourceTypeIndicator.textContent = `Audio: ${audioName}`;
    sourceTypeIndicator.classList.add('show');
    
    setTimeout(() => {
        sourceTypeIndicator.textContent = originalText;
        sourceTypeIndicator.classList.remove('show');
    }, 2000);
}

// Show speed change notification
function showSpeedChangeNotification(speed) {
    if (!sourceTypeIndicator) return;
    
    const originalText = sourceTypeIndicator.textContent;
    sourceTypeIndicator.textContent = `Playback Speed: ${speed}`;
    sourceTypeIndicator.classList.add('show');
    
    setTimeout(() => {
        sourceTypeIndicator.textContent = originalText;
        sourceTypeIndicator.classList.remove('show');
    }, 2000);
}

// Setup orientation detection and handling
function setupOrientationDetection() {
    checkOrientation();
    
    // Listen for orientation changes
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    // Handle fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenWithOrientation);
    document.addEventListener('webkitfullscreenchange', handleFullscreenWithOrientation);
    document.addEventListener('mozfullscreenchange', handleFullscreenWithOrientation);
    document.addEventListener('MSFullscreenChange', handleFullscreenWithOrientation);
}

// Handle fullscreen with orientation
function handleFullscreenWithOrientation() {
    const isCurrentlyFullscreen = !!(document.fullscreenElement || 
                                   document.webkitFullscreenElement || 
                                   document.mozFullScreenElement || 
                                   document.msFullscreenElement);
    
    if (isCurrentlyFullscreen !== isFullscreen) {
        isFullscreen = isCurrentlyFullscreen;
        fullscreenIcon.textContent = isFullscreen ? '🗙' : '⛶';
        
        // On mobile, auto rotate to landscape when entering fullscreen
        if (isMobile && isFullscreen) {
            // Force show all controls in fullscreen
            showControls();
            resetControlsHideTimer();
        }
    }
}

// Check and handle orientation
function checkOrientation() {
    if (!isMobile) return;
    
    const isPortrait = window.innerHeight > window.innerWidth;
    
    if (isPortrait && !isFullscreen) {
        playerContainer.style.paddingBottom = '63.25%';
    } else if (!isFullscreen) {
        playerContainer.style.paddingBottom = '56.25%';
    }
}

// Apply mobile video fixes
function applyMobileVideoFixes() {
    if (!isMobile) return;
    
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('x5-playsinline', '');
    video.setAttribute('x5-video-player-type', 'h5');
    video.setAttribute('x5-video-player-fullscreen', 'false');
    
    console.log('Mobile video fixes applied');
}

// Setup mobile touch events for seek
function setupMobileTouchEvents() {
    if (!isMobile) return;
    
    progressBarBg.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetControlsHideTimer();
    });
    
    progressBarBg.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const touch = e.changedTouches[0];
        const rect = progressBarBg.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        seekToPosition(percent);
        resetControlsHideTimer();
    });
}

// Show/hide loading indicator
function showLoading(show) {
    if (show) {
        loadingIndicator.classList.add('show');
    } else {
        loadingIndicator.classList.remove('show');
    }
}

// Show premium indicator
function showPremiumIndicator(message) {
    if (!premiumIndicator) return;
    
    premiumIndicator.textContent = message;
    premiumIndicator.classList.add('show');
    
    setTimeout(() => {
        premiumIndicator.classList.remove('show');
    }, 3000);
}

// Show error message
function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.add('show');
    showControls();
    
    // Auto hide error after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

// Hide error message
function hideError() {
    errorMessage.classList.remove('show');
}

// Update buffer bar
function updateBufferBar() {
    if (!video.buffered.length) return;
    
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    const duration = video.duration;
    
    if (duration > 0) {
        const bufferPercent = (bufferedEnd / duration) * 100;
        bufferBar.style.width = `${bufferPercent}%`;
    }
}

// Format time
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update progress
function updateProgress() {
    if (!video.duration || isNaN(video.duration)) return;
    
    const percent = (video.currentTime / video.duration) * 100;
    progressBar.style.width = `${percent}%`;
    currentTimeEl.textContent = formatTime(video.currentTime);
    durationEl.textContent = formatTime(video.duration);
    
    const knobPosition = percent;
    progressKnob.style.left = `calc(${knobPosition}% - 8px)`;
}

// Controls hide/show functions
function startControlsHideTimer() {
    resetControlsHideTimer();
}

function resetControlsHideTimer() {
    clearTimeout(hideControlsTimeout);
    showControls();
    hideControlsTimeout = setTimeout(() => {
        hideControls();
    }, 3000);
}

function showControls() {
    playerContainer.classList.remove('idle');
    controlsVisible = true;
    if (progressKnob) progressKnob.style.opacity = '1';
}

function hideControls() {
    if (!video.paused) {
        playerContainer.classList.add('idle');
        controlsVisible = false;
        if (progressKnob) progressKnob.style.opacity = '0';
    }
}

// Play video with proper error handling
function playVideo() {
    if (playPromise !== null) {
        playPromise.then(() => {}).catch(() => {});
    }
    
    playPromise = video.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            playIcon.textContent = '⏸';
            bigPlayBtn.style.display = 'none';
            resetControlsHideTimer();
        }).catch(e => {
            console.log('Play error:', e);
            // Don't show error for user interruptions
            if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                showError('Failed to play video: ' + e.message);
            }
            playIcon.textContent = '▶';
            bigPlayBtn.style.display = 'flex';
        }).finally(() => {
            playPromise = null;
        });
    }
}

// Pause video
function pauseVideo() {
    if (!video.paused) {
        video.pause();
        playIcon.textContent = '▶';
        bigPlayBtn.style.display = 'flex';
        showControls();
    }
}

// Toggle play/pause
function togglePlay() {
    if (video.paused || video.ended) {
        playVideo();
    } else {
        pauseVideo();
    }
}

// Toggle mute
function toggleMute() {
    const currentVolume = parseFloat(volumeSlider.value);
    
    if (currentVolume > 0) {
        handleVolumeChange(0);
        volumeSlider.value = 0;
        muteIcon.textContent = '🔇';
    } else {
        handleVolumeChange(1);
        volumeSlider.value = 1;
        muteIcon.textContent = '🔊';
    }
    resetControlsHideTimer();
}

// Handle volume change
function handleVolumeChange(volume) {
    video.volume = volume;
    resetControlsHideTimer();
}

// Toggle fullscreen
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        if (playerContainer.requestFullscreen) {
            playerContainer.requestFullscreen();
        } else if (playerContainer.webkitRequestFullscreen) {
            playerContainer.webkitRequestFullscreen();
        } else if (playerContainer.mozRequestFullScreen) {
            playerContainer.mozRequestFullScreen();
        } else if (playerContainer.msRequestFullscreen) {
            playerContainer.msRequestfullscreen();
        }
        
        isFullscreen = true;
        fullscreenIcon.textContent = '🗙';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        
        isFullscreen = false;
        fullscreenIcon.textContent = '⛶';
    }
    resetControlsHideTimer();
}

// Seek to position
function seekToPosition(percent) {
    if (!video.duration || isNaN(video.duration)) return;
    
    const time = percent * video.duration;
    video.currentTime = time;
    
    const knobPosition = percent * 100;
    progressKnob.style.left = `calc(${knobPosition}% - 8px)`;
    progressBar.style.width = `${knobPosition}%`;
    
    resetControlsHideTimer();
}

// Start buffer monitoring
function startBufferMonitoring() {
    if (bufferInterval) clearInterval(bufferInterval);
    
    bufferInterval = setInterval(() => {
        if (!video.buffered.length) return;
        
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const duration = video.duration;
        
        if (duration > 0) {
            const bufferPercent = (bufferedEnd / duration) * 100;
            bufferBar.style.width = `${bufferPercent}%`;
        }
    }, 500);
}

// Setup download button with dropdown
function setupDownloadButton() {
    if (!downloadBtn) return;
    
    downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isShowing = downloadDropdown.classList.contains('show');
        
        if (audioDropdown) audioDropdown.classList.remove('show');
        if (qualityDropdown) qualityDropdown.classList.remove('show');
        if (speedDropdown) speedDropdown.classList.remove('show');
        
        if (isShowing) {
            downloadDropdown.classList.remove('show');
        } else {
            downloadDropdown.classList.add('show');
        }
        
        resetControlsHideTimer();
    });
    
    // Setup download options
    downloadOptions.forEach(option => {
        if (option.tagName === 'A' && option.href !== '#') {
            option.addEventListener('click', function(e) {
                e.stopPropagation();
                downloadDropdown.classList.remove('show');
                resetControlsHideTimer();
                console.log('Download initiated:', this.href);
            });
        } else if (option.classList.contains('disabled')) {
            option.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                showError('This quality is available for premium members only.');
                downloadDropdown.classList.remove('show');
            });
        }
    });
}

// Setup quality dropdown
function setupQualityDropdown() {
    if (!qualityDropdown) return;
    
    qualityDropdown.innerHTML = '';
    
    // Add HLS option if available
    if (availableVideos['hls']) {
        const hlsOption = document.createElement('div');
        hlsOption.className = 'quality-option';
        hlsOption.textContent = 'Stream';
        hlsOption.dataset.quality = 'hls';
        
        if (currentQualityLevel === 'hls') {
            hlsOption.classList.add('active');
        }
        
        hlsOption.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            loadVideo('hls');
            qualityDropdown.classList.remove('show');
            resetControlsHideTimer();
        });
        
        qualityDropdown.appendChild(hlsOption);
    }
    
    // Add Original option for MP4
    if (availableVideos['original']) {
        const originalOption = document.createElement('div');
        originalOption.className = 'quality-option';
        originalOption.textContent = 'Original';
        originalOption.dataset.quality = 'original';
        
        if (currentQualityLevel === 'original') {
            originalOption.classList.add('active');
        }
        
        originalOption.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            loadVideo('original');
            qualityDropdown.classList.remove('show');
            resetControlsHideTimer();
        });
        
        qualityDropdown.appendChild(originalOption);
    }
    
    // Add MP4 quality options in order
    const qualityOrder = ['1080', '720', '480', '360', '240'];
    
    qualityOrder.forEach(quality => {
        if (availableVideos[quality]) {
            const option = document.createElement('div');
            option.className = 'quality-option';
            
            // Set text based on quality
            if (quality === '1080') {
                option.textContent = '1080p FHD';
            } else if (quality === '720') {
                option.textContent = '720p HD';
            } else if (quality === '480') {
                option.textContent = '480p';
            } else if (quality === '360') {
                option.textContent = '360p SD';
            } else if (quality === '240') {
                option.textContent = '240p';
            } else {
                option.textContent = `${quality}p`;
            }
            
            option.dataset.quality = quality;
            
            // 480p, 720p, 1080p require paid subscription
            if ((quality === '480' || quality === '720' || quality === '1080') && !isPaidUser) {
                option.classList.add('disabled');
                // Add premium badge
                const premiumBadge = document.createElement('span');
                premiumBadge.style.fontSize = '10px';
                premiumBadge.style.color = '#ff5252';
                premiumBadge.style.marginLeft = 'auto';
                premiumBadge.textContent = '(Premium)';
                option.appendChild(premiumBadge);
            }
            
            if (quality === currentQualityLevel) {
                option.classList.add('active');
            }
            
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Check if quality requires paid subscription
                if ((quality === '480' || quality === '720' || quality === '1080') && !isPaidUser) {
                    showError('This quality is available for premium members only.');
                    qualityDropdown.classList.remove('show');
                    return;
                }
                
                loadVideo(quality);
                qualityDropdown.classList.remove('show');
                resetControlsHideTimer();
            });
            
            qualityDropdown.appendChild(option);
        }
    });
}

// Update quality UI
function updateQualityUI(quality) {
    let qualityText;
    if (quality === 'hls') {
        qualityText = 'Stream';
    } else if (quality === 'original') {
        qualityText = 'Quality';
    } else if (quality === '1080') {
        qualityText = '1080p';
    } else if (quality === '720') {
        qualityText = 'HD';
    } else if (quality === '480') {
        qualityText = '480p';
    } else if (quality === '360') {
        qualityText = 'SD';
    } else if (quality === '240') {
        qualityText = '240p';
    } else {
        qualityText = quality;
    }
    
    if (currentQuality) {
        currentQuality.textContent = qualityText;
    }
    currentQualityLevel = quality;
    updateQualityDropdown();
    
    // Show/Hide audio button based on video type
    if (audioBtn) {
        if (quality === 'hls' && hls && hls.audioTracks && hls.audioTracks.length > 1) {
            audioBtn.classList.remove('hidden');
        } else if (quality === 'hls' && Object.keys(availableAudioTracks).length > 1) {
            audioBtn.classList.remove('hidden');
        } else {
            audioBtn.classList.add('hidden');
        }
    }
}

// Update quality dropdown
function updateQualityDropdown() {
    if (!qualityDropdown) return;
    
    document.querySelectorAll('.quality-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.quality === currentQualityLevel) {
            option.classList.add('active');
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Close error button
    closeErrorBtn.addEventListener('click', hideError);
    
    // Video events
    video.addEventListener('play', () => {
        playIcon.textContent = '⏸';
        bigPlayBtn.style.display = 'none';
        resetControlsHideTimer();
    });
    
    video.addEventListener('pause', () => {
        playIcon.textContent = '▶';
        bigPlayBtn.style.display = 'flex';
        showControls();
    });
    
    video.addEventListener('ended', () => {
        playIcon.textContent = '▶';
        bigPlayBtn.style.display = 'flex';
        showControls();
    });
    
    video.addEventListener('waiting', () => {
        showLoading(true);
    });
    
    video.addEventListener('playing', () => {
        showLoading(false);
    });
    
    video.addEventListener('timeupdate', () => {
        updateProgress();
        updateBufferBar();
    });
    
    video.addEventListener('loadedmetadata', () => {
        updateProgress();
    });
    
    // Progress bar
    progressBarBg.addEventListener('click', (e) => {
        const rect = progressBarBg.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        seekToPosition(percent);
    });
    
    // Quality button
    if (qualityBtn) {
        qualityBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isShowing = qualityDropdown.classList.contains('show');
            
            if (audioDropdown) audioDropdown.classList.remove('show');
            if (downloadDropdown) downloadDropdown.classList.remove('show');
            if (speedDropdown) speedDropdown.classList.remove('show');
            
            if (isShowing) {
                qualityDropdown.classList.remove('show');
            } else {
                qualityDropdown.classList.add('show');
            }
            
            resetControlsHideTimer();
        });
    }
    
    // Play/Pause buttons
    playPauseBtn.addEventListener('click', togglePlay);
    bigPlayBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    
    // Volume controls
    muteBtn.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', (e) => {
        handleVolumeChange(parseFloat(e.target.value));
        muteIcon.textContent = parseFloat(e.target.value) > 0 ? '🔊' : '🔇';
    });
    
    // Fullscreen button
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (audioBtn && !audioBtn.classList.contains('hidden') && !audioBtn.contains(e.target) && audioDropdown && !audioDropdown.contains(e.target)) {
            audioDropdown.classList.remove('show');
        }
        
        if (qualityBtn && !qualityBtn.contains(e.target) && qualityDropdown && !qualityDropdown.contains(e.target)) {
            qualityDropdown.classList.remove('show');
        }
        
        if (downloadBtn && !downloadBtn.contains(e.target) && downloadDropdown && !downloadDropdown.contains(e.target)) {
            downloadDropdown.classList.remove('show');
        }
        
        if (speedBtn && !speedBtn.contains(e.target) && speedDropdown && !speedDropdown.contains(e.target)) {
            speedDropdown.classList.remove('show');
        }
    });
    
    // Mouse movement to show controls
    playerContainer.addEventListener('mousemove', resetControlsHideTimer);
    playerContainer.addEventListener('touchstart', resetControlsHideTimer);
    playerContainer.addEventListener('click', resetControlsHideTimer);
}

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', initPlayer);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (hls) {
        hls.destroy();
    }
    if (bufferInterval) clearInterval(bufferInterval);
    if (hideControlsTimeout) clearTimeout(hideControlsTimeout);
});

// Download tracking function
function trackDownload(quality) {
    console.log('Download started:', quality);
    // Add your analytics tracking here
}



// ============================================ //
// LANDSCAPE FULLSCREEN CONTROLS - SIMPLE FIX //
// ============================================ //

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for player to initialize
    setTimeout(initLandscapeControls, 1000);
});

function initLandscapeControls() {
    const playerContainer = document.getElementById('playerContainer');
    const video = document.getElementById('customVideo');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    if (!playerContainer || !video || !fullscreenBtn) {
        console.log('Required elements not found for landscape controls');
        return;
    }
    
    console.log('Initializing landscape controls fix...');
    
    let controlsTimeout;
    let isLandscapeMode = false;
    
    // 1. Check if currently in landscape
    function checkOrientation() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isFullscreen = !!(document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement);
        
        // Update landscape mode flag
        isLandscapeMode = (isLandscape && isFullscreen);
        
        if (isLandscapeMode) {
            playerContainer.classList.add('landscape-fullscreen');
            
            // Force show controls initially
            showControls();
            
            // Start hide timer after 5 seconds
            startHideTimer();
            
            console.log('Landscape fullscreen mode detected');
        } else {
            playerContainer.classList.remove('landscape-fullscreen');
            clearTimeout(controlsTimeout);
        }
    }
    
    // 2. Show controls function
    function showControls() {
        playerContainer.classList.remove('idle');
        
        // Clear existing timeout
        clearTimeout(controlsTimeout);
    }
    
    // 3. Hide controls function (after 5 seconds)
    function hideControls() {
        if (!video.paused && isLandscapeMode) {
            playerContainer.classList.add('idle');
        }
    }
    
    // 4. Start 5-second hide timer
    function startHideTimer() {
        clearTimeout(controlsTimeout);
        
        if (!video.paused && isLandscapeMode) {
            controlsTimeout = setTimeout(() => {
                hideControls();
            }, 5000); // 5 seconds
        }
    }
    
    // 5. Reset timer (when user interacts)
    function resetControlsTimer() {
        showControls();
        startHideTimer();
    }
    
    // 6. Setup event listeners
    function setupEventListeners() {
        // Check orientation on resize
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', function() {
            setTimeout(checkOrientation, 300);
        });
        
        // Fullscreen change events
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        
        // User interaction events
        playerContainer.addEventListener('click', resetControlsTimer);
        playerContainer.addEventListener('touchstart', function() {
            resetControlsTimer();
            playerContainer.classList.add('touch-active');
        }, { passive: true });
        
        playerContainer.addEventListener('touchend', function() {
            setTimeout(() => {
                playerContainer.classList.remove('touch-active');
            }, 3000);
        }, { passive: true });
        
        playerContainer.addEventListener('mousemove', resetControlsTimer);
        
        // Video events
        video.addEventListener('play', function() {
            if (isLandscapeMode) {
                startHideTimer();
            }
        });
        
        video.addEventListener('pause', function() {
            showControls();
            clearTimeout(controlsTimeout);
        });
        
        // Control buttons
        const controlButtons = playerContainer.querySelectorAll(
            '.control-btn, .speed-btn, .quality-btn, .fullscreen-btn, .download-btn, .audio-btn'
        );
        
        controlButtons.forEach(btn => {
            btn.addEventListener('click', resetControlsTimer);
            btn.addEventListener('touchstart', resetControlsTimer, { passive: true });
        });
        
        // Progress bar
        const progressBar = document.getElementById('progressBarBg');
        if (progressBar) {
            progressBar.addEventListener('click', resetControlsTimer);
            progressBar.addEventListener('touchstart', resetControlsTimer, { passive: true });
        }
    }
    
    // 7. Handle fullscreen changes
    function handleFullscreenChange() {
        setTimeout(() => {
            checkOrientation();
            
            // If entering fullscreen on mobile, try to lock landscape
            if (isLandscapeMode && screen.orientation && screen.orientation.lock) {
                try {
                    screen.orientation.lock('landscape');
                } catch(e) {
                    console.log('Orientation lock not supported');
                }
            }
        }, 100);
    }
    
    // 8. Modify fullscreen button behavior for mobile
    const originalClick = fullscreenBtn.onclick;
    
    fullscreenBtn.addEventListener('click', function(e) {
        // On mobile, check if we should auto-rotate to landscape
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            const isCurrentlyFullscreen = !!(document.fullscreenElement || 
                                           document.webkitFullscreenElement || 
                                           document.mozFullScreenElement || 
                                           document.msFullscreenElement);
            
            if (!isCurrentlyFullscreen) {
                // Entering fullscreen - will trigger landscape mode
                console.log('Mobile: Entering fullscreen, will auto-check landscape');
            }
        }
        
        // Call original handler if exists
        if (typeof originalClick === 'function') {
            originalClick.call(this, e);
        }
    });
    
    // 9. Initial check
    checkOrientation();
    setupEventListeners();
    
    console.log('Landscape controls fix initialized successfully');
}

// 10. Auto-initialize with retry
(function autoInit() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initLandscapeControls, 1500);
        });
    } else {
        setTimeout(initLandscapeControls, 1500);
    }
})();



// ============================================ //
// MOBILE AUTO-LANDSCAPE IN FULLSCREEN
// ============================================ //

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initMobileAutoLandscape, 1500);
});

function initMobileAutoLandscape() {
    const playerContainer = document.getElementById('playerContainer');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const video = document.getElementById('customVideo');
    
    if (!playerContainer || !fullscreenBtn || !video) return;
    
    // Check if mobile device
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;
    
    console.log('Initializing mobile auto-landscape...');
    
    let isFullscreen = false;
    
    // Function to force landscape
    function forceLandscape() {
        if (!screen.orientation) return;
        
        // Check if already landscape
        const isLandscape = screen.orientation.type.includes('landscape');
        if (isLandscape) {
            console.log('Already in landscape mode');
            return;
        }
        
        // Try to lock to landscape
        if (screen.orientation.lock) {
            screen.orientation.lock('landscape')
                .then(() => {
                    console.log('Successfully locked to landscape');
                })
                .catch(err => {
                    console.log('Could not lock orientation:', err);
                });
        }
    }
    
    // Function to unlock orientation
    function unlockOrientation() {
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    }
    
    // Handle fullscreen changes
    function handleFullscreenChange() {
        const isNowFullscreen = !!(document.fullscreenElement || 
                                 document.webkitFullscreenElement || 
                                 document.mozFullScreenElement || 
                                 document.msFullscreenElement);
        
        if (isNowFullscreen && !isFullscreen) {
            // Entered fullscreen
            isFullscreen = true;
            console.log('Entered fullscreen on mobile');
            
            // Wait a bit then force landscape
            setTimeout(() => {
                forceLandscape();
            }, 500);
            
        } else if (!isNowFullscreen && isFullscreen) {
            // Exited fullscreen
            isFullscreen = false;
            console.log('Exited fullscreen on mobile');
            
            // Unlock orientation
            unlockOrientation();
        }
    }
    
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    // Also listen for orientation changes
    if (screen.orientation) {
        screen.orientation.addEventListener('change', function() {
            console.log('Orientation changed to:', screen.orientation.type);
            
            // If in fullscreen and not landscape, try to force it
            if (isFullscreen && !screen.orientation.type.includes('landscape')) {
                setTimeout(forceLandscape, 300);
            }
        });
    }
    
    // Override the fullscreen button click for mobile
    const originalOnClick = fullscreenBtn.onclick;
    
    fullscreenBtn.addEventListener('click', function(e) {
        // For mobile, we want to ensure landscape in fullscreen
        if (isMobile) {
            // First let the original handler run
            if (originalOnClick) {
                originalOnClick.call(this, e);
            }
            
            // Then schedule landscape check
            setTimeout(() => {
                if (!document.fullscreenElement && 
                    !document.webkitFullscreenElement) {
                    // We're entering fullscreen
                    console.log('Mobile: Will auto-landscape in fullscreen');
                }
            }, 100);
        }
    });
    
    // Track video pause state for dropdown buttons fix
    video.addEventListener('pause', function() {
        // Add attribute for CSS targeting
        video.setAttribute('data-paused', 'true');
        playerContainer.classList.add('video-paused');
        
        // Ensure controls are clickable
        setTimeout(() => {
            const bottomControls = document.getElementById('bottomControls');
            if (bottomControls) {
                bottomControls.style.pointerEvents = 'auto';
            }
        }, 50);
    });
    
    video.addEventListener('play', function() {
        video.removeAttribute('data-paused');
        playerContainer.classList.remove('video-paused');
    });
    
    console.log('Mobile auto-landscape initialized');
}



