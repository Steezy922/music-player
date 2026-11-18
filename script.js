const audioEl = new Audio();
let playlistData = [
  // Example initial local track references (you can replace or add via "+ Add Songs")
  { name: "Sample Synthwave.mp3", url: "https://google.com" }
];

let currentIndex = 0;
let isShuffle = false;
let audioCtx, sourceNode, bassFilter, analyser, dataArray;

const playlistEl = document.getElementById("playlist");
const playPauseBtn = document.getElementById("playPauseBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const randomBtn = document.getElementById("randomBtn");
const bassSlider = document.getElementById("bassSlider");
const bassValue = document.getElementById("bassValue");
const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");
const nowPlayingTitle = document.getElementById("nowPlayingTitle");
const nowPlayingSub = document.getElementById("nowPlayingSub");
const fileInput = document.getElementById("fileInput");

// Initialize Web Audio API graph
function initAudioContext() {
  if (audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();

  sourceNode = audioCtx.createMediaElementSource(audioEl);

  // Real LowShelf Bass Boost filter for punchy low-end
  bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = "lowshelf";
  bassFilter.frequency.value = 110;
  bassFilter.gain.value = parseFloat(bassSlider.value);

  // Analyser for visualizer
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  sourceNode.connect(bassFilter);
  bassFilter.connect(analyser);
  analyser.connect(audioCtx.destination);
}

// Render Playlist
function renderPlaylist() {
  playlistEl.innerHTML = "";
  playlistData.forEach((track, index) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.index = index;
    if (index === currentIndex) li.classList.add("playing");

    li.innerHTML = `
      <span class="song-title" title="${track.name}">${index + 1}. ${track.name}</span>
      <div class="song-actions">
        <button class="icon-btn delete-btn" title="Delete Song">✕</button>
      </div>
    `;

    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-btn")) return;
      playTrack(index);
    });

    li.querySelector(".delete-btn").addEventListener("click", () => {
      deleteTrack(index);
    });

    // Drag and drop ordering
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
      if (draggingIdx !== index) {
        const movedItem = playlistData.splice(draggingIdx, 1)[0];
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

function deleteTrack(index) {
  playlistData.splice(index, 1);
  if (playlistData.length === 0) {
    audioEl.pause();
    audioEl.src = "";
    nowPlayingTitle.textContent = "No Track Loaded";
    nowPlayingSub.textContent = "Add or select local songs";
    playPauseBtn.textContent = "Play";
    currentIndex = 0;
  } else {
    if (index === currentIndex) {
      currentIndex = Math.min(index, playlistData.length - 1);
      playTrack(currentIndex);
    } else if (index < currentIndex) {
      currentIndex--;
    }
  }
  renderPlaylist();
}

// Play/Pause
playPauseBtn.addEventListener("click", () => {
  initAudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();

  if (playlistData.length === 0) return;

  if (audioEl.paused) {
    if (!audioEl.src) playTrack(currentIndex);
    else audioEl.play();
    playPauseBtn.textContent = "Pause";
  } else {
    audioEl.pause();
    playPauseBtn.textContent = "Play";
  }
});

// Next / Shuffle track on end
audioEl.addEventListener("ended", () => {
  if (isShuffle || randomBtn.dataset.randomMode === "true") {
    playRandomTrack();
  } else {
    currentIndex = (currentIndex + 1) % playlistData.length;
    playTrack(currentIndex);
  }
});

// Shuffle toggle
shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle("active", isShuffle);
  shuffleBtn.textContent = `Shuffle: ${isShuffle ? "On" : "Off"}`;
});

function playRandomTrack() {
  if (playlistData.length === 0) return;
  const nextIdx = Math.floor(Math.random() * playlistData.length);
  playTrack(nextIdx);
}

randomBtn.addEventListener("click", () => {
  playRandomTrack();
});

// Bass Boost Slider
bassSlider.addEventListener("input", (e) => {
  const val = e.target.value;
  bassValue.textContent = `${val} dB`;
  if (bassFilter) {
    bassFilter.gain.setValueAtTime(val, audioCtx.currentTime);
  }
});

// Speed / Pitch Slider
speedSlider.addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  speedValue.textContent = `${val.toFixed(2)}x`;
  audioEl.playbackRate = val;
});

// Add local files
fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  files.forEach((file) => {
    const objectUrl = URL.createObjectURL(file);
    playlistData.push({ name: file.name, url: objectUrl });
  });
  renderPlaylist();
});

// Visualizer Canvas loop
const canvas = document.getElementById("visualizer");
const canvasCtx = canvas.getContext("2d");

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  if (!analyser) {
    canvasCtx.fillStyle = "#161822";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  analyser.getByteFrequencyData(dataArray);

  canvasCtx.fillStyle = "#161822";
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  const barWidth = (canvas.width / dataArray.length) * 2.2;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const barHeight = (dataArray[i] / 255) * canvas.height;

    const gradient = canvasCtx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
    gradient.addColorStop(0, "#b388ff");
    gradient.addColorStop(1, "#7c4dff");

    canvasCtx.fillStyle = gradient;
    canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

    x += barWidth + 2;
  }
}

renderPlaylist();
drawVisualizer();
