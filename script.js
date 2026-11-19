const audioEl = new Audio();
audioEl.crossOrigin = "anonymous";
audioEl.volume = 0.8;
audioEl.preservesPitch = false;
audioEl.mozPreservesPitch = false;
audioEl.webkitPreservesPitch = false;

// Fallback list if running locally via file:// instead of GitHub Pages
const fallbackRapFiles = [
  "4 LOKO - SMOKEDOPE2016.mp3", "4Raws - EsDeeKid.mp3", "BLEED - SMOKEDOPE2016.mp3", "Back2Back - SMOKEDOPE2016.mp3", "DIRTY 30z - SMOKEDOPE2016.mp3", "Fever - Buckshot.mp3", "Icey Soles - SMOKEDOPE2016.mp3", "Know Dat - SMOKEDOPE2016.mp3", "LV Sandals - EsDeeKid.mp3", "Phantom - EsDeeKid.mp3", "Polo - SMOKEDOPE2016.mp3", "Sleep - SMOKEDOPE2016.mp3"
  // Add filenames here ONLY if testing offline without GitHub Pages, e.g.:
  // "track1.mp3", "track2.mp3"
];

let playlistData = [];
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

// Automatically fetch every audio file inside the "rap" folder on GitHub
async function loadRapFolder() {
  const audioExtensions = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;
  const host = window.location.hostname;
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  // Detect GitHub Pages URL (username.github.io/repo-name)
  if (host.endsWith("github.io") && pathParts.length > 0) {
    const owner = host.split(".")[0];
    const repo = pathParts[0];
    try {
      const res = await fetch(`https://github.com{owner}/${repo}/contents/rap`);
      if (res.ok) {
        const files = await res.json();
        files.forEach((file) => {
          if (file.type === "file" && audioExtensions.test(file.name)) {
            playlistData.push({
              name: file.name,
              url: `rap/${encodeURIComponent(file.name)}`,
              isObjectUrl: false
            });
          }
        });
      }
    } catch (err) {
      console.warn("Could not auto-fetch from GitHub API, using fallback list.", err);
    }
  }

  // Use fallback list if offline or not on GitHub Pages
  if (playlistData.length === 0 && fallbackRapFiles.length > 0) {
    fallbackRapFiles.forEach((fileName) => {
      playlistData.push({
        name: fileName,
        url: `rap/${encodeURIComponent(fileName)}`,
        isObjectUrl: false
      });
    });
  }

  if (playlistData.length > 0) {
    nowPlayingTitle.textContent = playlistData[0].name;
    nowPlayingSub.textContent = `Track 1 of ${playlistData.length} • Ready to play`;
  }
  renderPlaylist();
}
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
  audioEl.play().catch(() => {});
  playPauseBtn.textContent = "Pause";
  nowPlayingTitle.textContent = track.name;
  nowPlayingSub.textContent = `Track ${currentIndex + 1} of ${playlistData.length}`;
  renderPlaylist();
}
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

// ... (keep the rest of Part 4 the same, then end with:)
loadRapFolder();
drawVisualizer();
