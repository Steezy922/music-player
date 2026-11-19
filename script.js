const audioEl = new Audio();
audioEl.crossOrigin = "anonymous";
audioEl.volume = 0.8;
audioEl.preservesPitch = false;
audioEl.mozPreservesPitch = false;
audioEl.webkitPreservesPitch = false;

const defaultRapSongs = [
  "4 LOKO - SMOKEDOPE2016.mp3",
  "4Raws - EsDeeKid.mp3",
  "BLEED - SMOKEDOPE2016.mp3",
  "Back2Back - SMOKEDOPE2016.mp3",
  "DIRTY 30z - SMOKEDOPE2016.mp3",
  "Fever - Buckshot.mp3",
  "Icey Soles - SMOKEDOPE2016.mp3",
  "Know Dat - SMOKEDOPE2016.mp3",
  "LV Sandals - EsDeeKid.mp3",
  "Phantom - EsDeeKid.mp3",
  "Polo - SMOKEDOPE2016.mp3",
  "Sleep - SMOKEDOPE2016.mp3"
];

let playlistData = defaultRapSongs.map((fileName) => ({
  name: fileName,
  url: `rap/${encodeURIComponent(fileName)}`,
  isObjectUrl: false
}));

let currentIndex = 0;
let isShuffle = false;
let loopMode = "all"; // "all" | "one" | "off"
let isSeeking = false;
let previousVolume = 0.8;

let audioCtx, sourceNode, bassFilter, compressor, analyser, freqData, waveData;

const playlistEl = document.getElementById("playlist");
const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const loopBtn = document.getElementById("loopBtn");
const randomBtn = document.getElementById("randomBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const loadExamplesBtn = document.getElementById("loadExamplesBtn");
const vizModeSelect = document.getElementById("vizModeSelect");

const seekSlider = document.getElementById("seekSlider");
const currentTimeEl = document.getElementById("currentTime");
const totalDurationEl = document.getElementById("totalDuration");

const bassSlider = document.getElementById("bassSlider");
const bassValue = document.getElementById("bassValue");
const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");
const resetSpeedBtn = document.getElementById("resetSpeedBtn");
const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");
const muteBtn = document.getElementById("muteBtn");

const nowPlayingTitle = document.getElementById("nowPlayingTitle");
const nowPlayingSub = document.getElementById("nowPlayingSub");
const fileInput = document.getElementById("fileInput");

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function initAudioContext() {
  if (audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();

  sourceNode = audioCtx.createMediaElementSource(audioEl);

  bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = "lowshelf";
  bassFilter.frequency.value = 100;
  bassFilter.gain.value = parseFloat(bassSlider.value);

  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 15;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.15;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  freqData = new Uint8Array(bufferLength);
  waveData = new Uint8Array(bufferLength);

  sourceNode.connect(bassFilter);
  bassFilter.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(audioCtx.destination);
}
function renderPlaylist() {
  playlistEl.innerHTML = "";
  playlistData.forEach((track, index) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.index = index;
    if (index === currentIndex) li.classList.add("playing");

    li.innerHTML = `
      <span class="song-title" title="${track.name}">${index + 1}. ${track.name}</span>
      <button class="icon-btn delete-btn" title="Delete Song">✕</button>
    `;

    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-btn")) return;
      playTrack(index);
    });

    li.querySelector(".delete-btn").addEventListener("click", () => {
      deleteTrack(index);
    });

    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", index);
      li.classList.add("dragging");
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
    });

    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      const draggingIdx = parseInt(e.dataTransfer.getData("text/plain"));
      if (!isNaN(draggingIdx) && draggingIdx !== index) {
        const [movedItem] = playlistData.splice(draggingIdx, 1);
        playlistData.splice(index, 0, movedItem);
        if (currentIndex === draggingIdx) currentIndex = index;
        else if (draggingIdx < currentIndex && index >= currentIndex) currentIndex--;
        else if (draggingIdx > currentIndex && index <= currentIndex) currentIndex++;
        renderPlaylist();
      }
    });

    playlistEl.appendChild(li);
  });
}

function playTrack(index) {
  if (playlistData.length === 0) return;
  initAudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();

  currentIndex = index;
  const track = playlistData[currentIndex];
  audioEl.src = track.url;
  audioEl.playbackRate = parseFloat(speedSlider.value);
  audioEl.play().catch((err) => console.error("Playback error:", err));
  playPauseBtn.textContent = "Pause";
  nowPlayingTitle.textContent = track.name;
  nowPlayingSub.textContent = `Track ${currentIndex + 1} of ${playlistData.length}`;
  renderPlaylist();
}

function resetPlayerUI() {
  audioEl.pause();
  audioEl.removeAttribute("src");
  audioEl.load();
  seekSlider.value = 0;
  seekSlider.max = 100;
  currentTimeEl.textContent = "0:00";
  totalDurationEl.textContent = "0:00";
  nowPlayingTitle.textContent = "No Track Loaded";
  nowPlayingSub.textContent = 'Click "+ Add Songs" to load local audio';
  playPauseBtn.textContent = "Play";
  currentIndex = 0;
}

function deleteTrack(index) {
  if (playlistData[index].isObjectUrl) {
    URL.revokeObjectURL(playlistData[index].url);
  }
  playlistData.splice(index, 1);
  if (playlistData.length === 0) {
    resetPlayerUI();
  } else if (index === currentIndex) {
    currentIndex = Math.min(index, playlistData.length - 1);
    playTrack(currentIndex);
  } else if (index < currentIndex) {
    currentIndex--;
  }
  renderPlaylist();
}

clearAllBtn.addEventListener("click", () => {
  playlistData.forEach((t) => {
    if (t.isObjectUrl) URL.revokeObjectURL(t.url);
  });
  playlistData = [];
  resetPlayerUI();
  renderPlaylist();
});

loadExamplesBtn.addEventListener("click", () => {
  const wasEmpty = playlistData.length === 0;
  defaultRapSongs.forEach((fileName) => {
    const url = `rap/${encodeURIComponent(fileName)}`;
    const alreadyExists = playlistData.some((track) => track.name === fileName && !track.isObjectUrl);
    if (!alreadyExists) {
      playlistData.push({
        name: fileName,
        url: url,
        isObjectUrl: false
      });
    }
  });
  renderPlaylist();
  if (wasEmpty && playlistData.length > 0) {
    nowPlayingTitle.textContent = playlistData.name;
    nowPlayingSub.textContent = `Track 1 of ${playlistData.length} • Click Play to start`;
  }
});
playPauseBtn.addEventListener("click", () => {
  if (playlistData.length === 0) return;
  initAudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();

  if (audioEl.paused) {
    if (!audioEl.src) playTrack(currentIndex);
    else {
      audioEl.play();
      playPauseBtn.textContent = "Pause";
    }
  } else {
    audioEl.pause();
    playPauseBtn.textContent = "Play";
  }
});

prevBtn.addEventListener("click", () => {
  if (playlistData.length === 0) return;
  if (audioEl.currentTime > 3) {
    audioEl.currentTime = 0;
    return;
  }
  currentIndex = (currentIndex - 1 + playlistData.length) % playlistData.length;
  playTrack(currentIndex);
});

nextBtn.addEventListener("click", () => {
  if (playlistData.length === 0) return;
  if (isShuffle) playRandomTrack();
  else {
    currentIndex = (currentIndex + 1) % playlistData.length;
    playTrack(currentIndex);
  }
});

// Seeking & Timeline Scrubber
audioEl.addEventListener("loadedmetadata", () => {
  if (isFinite(audioEl.duration)) {
    seekSlider.max = audioEl.duration;
    totalDurationEl.textContent = formatTime(audioEl.duration);
  }
});

audioEl.addEventListener("durationchange", () => {
  if (isFinite(audioEl.duration)) {
    seekSlider.max = audioEl.duration;
    totalDurationEl.textContent = formatTime(audioEl.duration);
  }
});

audioEl.addEventListener("timeupdate", () => {
  if (!isSeeking && isFinite(audioEl.duration)) {
    seekSlider.max = audioEl.duration;
    seekSlider.value = audioEl.currentTime;
    currentTimeEl.textContent = formatTime(audioEl.currentTime);
  }
});

seekSlider.addEventListener("pointerdown", () => {
  isSeeking = true;
});

seekSlider.addEventListener("input", () => {
  const targetTime = parseFloat(seekSlider.value);
  currentTimeEl.textContent = formatTime(targetTime);
  if (isFinite(audioEl.duration)) {
    audioEl.currentTime = targetTime;
  }
});

window.addEventListener("pointerup", () => {
  if (isSeeking) {
    isSeeking = false;
  }
});

// Volume & Mute Controls
volumeSlider.addEventListener("input", (e) => {
  const vol = parseFloat(e.target.value);
  audioEl.volume = vol;
  volumeValue.textContent = `${Math.round(vol * 100)}%`;
  muteBtn.textContent = vol === 0 ? "(Unmute)" : "(Mute)";
});

muteBtn.addEventListener("click", () => {
  if (audioEl.volume > 0) {
    previousVolume = audioEl.volume;
    audioEl.volume = 0;
    volumeSlider.value = 0;
    volumeValue.textContent = "0%";
    muteBtn.textContent = "(Unmute)";
  } else {
    audioEl.volume = previousVolume || 0.8;
    volumeSlider.value = audioEl.volume;
    volumeValue.textContent = `${Math.round(audioEl.volume * 100)}%`;
    muteBtn.textContent = "(Mute)";
  }
});
audioEl.addEventListener("ended", () => {
  if (loopMode === "one") {
    audioEl.currentTime = 0;
    audioEl.play();
  } else if (isShuffle) {
    playRandomTrack();
  } else if (currentIndex < playlistData.length - 1) {
    playTrack(currentIndex + 1);
  } else if (loopMode === "all") {
    playTrack(0);
  } else {
    playPauseBtn.textContent = "Play";
  }
});

shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle("active", isShuffle);
  shuffleBtn.textContent = `Shuffle: ${isShuffle ? "On" : "Off"}`;
});

loopBtn.addEventListener("click", () => {
  if (loopMode === "all") {
    loopMode = "one";
    loopBtn.textContent = "Loop: One";
  } else if (loopMode === "one") {
    loopMode = "off";
    loopBtn.textContent = "Loop: Off";
  } else {
    loopMode = "all";
    loopBtn.textContent = "Loop: All";
  }
});

function playRandomTrack() {
  if (playlistData.length === 0) return;
  let nextIdx = Math.floor(Math.random() * playlistData.length);
  if (playlistData.length > 1 && nextIdx === currentIndex) {
    nextIdx = (nextIdx + 1) % playlistData.length;
  }
  playTrack(nextIdx);
}

randomBtn.addEventListener("click", playRandomTrack);

bassSlider.addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  bassValue.textContent = `${val} dB`;
  if (bassFilter) bassFilter.gain.setValueAtTime(val, audioCtx.currentTime);
});

speedSlider.addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  speedValue.textContent = `${val.toFixed(2)}x`;
  audioEl.playbackRate = val;
});

resetSpeedBtn.addEventListener("click", () => {
  speedSlider.value = 1.0;
  speedValue.textContent = "1.00x";
  audioEl.playbackRate = 1.0;
});

fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  const wasEmpty = playlistData.length === 0;
  files.forEach((file) => {
    playlistData.push({
      name: file.name,
      url: URL.createObjectURL(file),
      isObjectUrl: true
    });
  });
  renderPlaylist();
  if (wasEmpty && playlistData.length > 0) playTrack(0);
});

// Keyboard Shortcuts (Space = Play/Pause, Arrows = Seek +/- 5s)
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.code === "Space") {
    e.preventDefault();
    playPauseBtn.click();
  } else if (e.code === "ArrowRight" && isFinite(audioEl.duration)) {
    audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 5);
  } else if (e.code === "ArrowLeft" && isFinite(audioEl.duration)) {
    audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
  }
});

// Multi-Mode Visualizer Engine
const canvas = document.getElementById("visualizer");
const canvasCtx = canvas.getContext("2d");
const specCanvas = document.createElement("canvas");
const specCtx = specCanvas.getContext("2d");

function resizeCanvases() {
  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    specCanvas.width = canvas.width;
    specCanvas.height = canvas.height;
    specCtx.fillStyle = "#10121a";
    specCtx.fillRect(0, 0, specCanvas.width, specCanvas.height);
  }
}

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  resizeCanvases();
  const mode = vizModeSelect.value;

  if (!analyser) {
    canvasCtx.fillStyle = "#10121a";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  if (mode === "bars") {
    canvasCtx.fillStyle = "#10121a";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    analyser.getByteFrequencyData(freqData);
    const barWidth = (canvas.width / freqData.length) * 2.2;
    let x = 0;
    for (let i = 0; i < freqData.length; i++) {
      const barHeight = (freqData[i] / 255) * canvas.height;
      const grad = canvasCtx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      grad.addColorStop(0, "#b388ff");
      grad.addColorStop(1, "#7c4dff");
      canvasCtx.fillStyle = grad;
      canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 2;
    }
  } else if (mode === "mirror") {
    canvasCtx.fillStyle = "#10121a";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    analyser.getByteFrequencyData(freqData);
    const barWidth = (canvas.width / freqData.length) * 2.2;
    const midY = canvas.height / 2;
    let x = 0;
    for (let i = 0; i < freqData.length; i++) {
      const halfH = ((freqData[i] / 255) * canvas.height) / 2;
      canvasCtx.fillStyle = `hsl(${255 + (freqData[i] / 255) * 45}, 85%, 65%)`;
      canvasCtx.fillRect(x, midY - halfH, barWidth, halfH * 2);
      x += barWidth + 2;
    }
  } else if (mode === "wave") {
    canvasCtx.fillStyle = "#10121a";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    analyser.getByteTimeDomainData(waveData);
    canvasCtx.lineWidth = 2.5;
    canvasCtx.strokeStyle = "#b388ff";
    canvasCtx.beginPath();
    const sliceWidth = canvas.width / waveData.length;
    let x = 0;
    for (let i = 0; i < waveData.length; i++) {
      const v = waveData[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
      x += sliceWidth;
    }
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  } else if (mode === "spectrogram") {
    analyser.getByteFrequencyData(freqData);
    specCtx.drawImage(specCanvas, -2, 0);
    const sliceH = canvas.height / freqData.length;
    for (let i = 0; i < freqData.length; i++) {
      const val = freqData[i];
      const hue = 275 - (val / 255) * 240;
      const light = (val / 255) * 60;
      specCtx.fillStyle = `hsl(${hue}, 90%, ${light}%)`;
      const y = canvas.height - (i + 1) * sliceH;
      specCtx.fillRect(specCanvas.width - 2, y, 2, Math.ceil(sliceH));
    }
    canvasCtx.drawImage(specCanvas, 0, 0);
  }
}

// Display first track title on load and render queue
if (playlistData.length > 0) {
  nowPlayingTitle.textContent = playlistData.name;
  nowPlayingSub.textContent = `Track 1 of ${playlistData.length} • Click Play to start`;
}
renderPlaylist();
drawVisualizer();
