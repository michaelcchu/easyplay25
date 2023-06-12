const audioContext = new AudioContext();
const canvas = byId("tap-area");
const fileInput = byId("fileInput");
const gainNodes = [];
const library = byId("library");
const normalGain = 0.15; 
const reader = new FileReader();

let activePress; let chords = []; let index; let midi; let notes; 
let on = false; let press; let ticks = []; let tuning;

let noteWidth; let minDistance;

const myGameArea = {
  canvas: document.getElementById("canvas"),
  start: function() {
    this.context = this.canvas.getContext("2d");
    this.context.globalAlpha = 0.5;
  },
  clear: function() {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

function startGame() {
  myGameArea.start();
}

function updateGameArea() {
  myGameArea.clear();

  let startIndex = index;
  // adjust startIndex in special case
  if (index >= chords.length) {
    startIndex = chords.length - 1;
  }

    // loop through chords
  const time = chords[startIndex][0].ticks;
  const ctx = myGameArea.context;

  // starts by drawing the current chord (startIndex)
  // then continues to draw chords (as tick-marks on the page)
  // until reaching the end of the canvas
  let i = startIndex;

  while ((i < chords.length) && 
    (chords[i][0].ticks - time < myGameArea.canvas.width)) {

    // draw game piece

    // need to determine what noteWidth should be
    // find shortest note in chord:
    let minDuration = Infinity;
    for (let j = 0; j < chords[i].length; j++) {
      if (chords[i][j].durationTicks < minDuration) {
        minDuration = chords[i][j].durationTicks;
      }
    }

    if (i < chords.length - 1) {
      const timeTillNextNote = chords[i+1][0].ticks - chords[i][0].ticks;
      if (timeTillNextNote < minDuration) {
        minDuration = timeTillNextNote;
      }
    }
    
    // determine line width / height
    // should always visually appear to be 5 pixels
    const lineHeight = 5 / myGameArea.canvas.clientHeight
      * myGameArea.canvas.height;
    const lineWidth = 5 / myGameArea.canvas.clientWidth 
      * myGameArea.canvas.width;

    const x = chords[i][0].ticks - time;

    // draw pointer
    if (i === startIndex) {
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, minDuration, myGameArea.canvas.height); 
    }

    ctx.fillStyle = "black";
    ctx.fillRect(x, 0, minDuration, lineHeight); // top edge
    ctx.fillRect(x, myGameArea.canvas.height - lineHeight, minDuration, 
      lineHeight); // bottom edge
    ctx.fillRect(x, 0, lineWidth, myGameArea.canvas.height); // left edge
    ctx.fillRect(x + minDuration, 0, lineWidth, 
      myGameArea.canvas.height); // right edge
    
    // increment i
    i++;
  }
}

startGame();

function byId(id) {return document.getElementById(id);};

function setChord(i, gain) {
  const chord = chords[i];
  for (let note of chord) {
    gainNodes[note.midi].gain.setTargetAtTime(gain,
      audioContext.currentTime, 0.015);
  }  
}


function getChords(notes) {
  ticks = []; chords = [];
  for (let note of notes) {
    let index = ticks.indexOf(note.ticks);
    if (index > -1) {
      chords[index].push(note);
    } else {
      let i = 0;
      while ((i < ticks.length) && (ticks[i] < note.ticks)) {i++;}
      chords.splice(i, 0, [note]); // should insert chord in correct location
      ticks.splice(i, 0, note.ticks);
    }
  }
  return chords;
}

function key(e) {
  function down(e) {
    const strPress = "" + press;
    const badKeys = ["Alt","Arrow","Audio","Enter","Home","Launch","Meta",
        "Play","Tab"];
    if (on && !badKeys.some(badKey => strPress.includes(badKey)) && !e.repeat
      && (index < chords.length) && (press !== activePress)) {
        if (index > 0) {
          setChord(index-1, 0); // turn the old oscillators off
        }
        setChord(index, normalGain); // turn the new oscillators on
        updateGameArea();
        activePress = press; index++;
    }
  }

  function up() {
    if (on && (press === activePress)) {
        setChord(index-1, 0); // turn the old oscillators off
        activePress = null;
    }
  }

  if (e.type.includes("key")) {press = e.key;} 
  else {press = e.pointerId;}
  if (["keydown","pointerdown"].includes(e.type)) {down(e);} else {up();}
}

function resetVars() {
    activePress = null; index = 0; updateGameArea();
    for (let gainNode of gainNodes) {gainNode.gain.value = 0;}
}

function start() { 
    window.setTimeout(() => {
        if (!on) {
          tuning = {pitch: 9, octave: 4, text: "a4", frequency: 440}; 

          const tuningMidiNumber = tuning.pitch + 12 * (tuning.octave + 1);
      
          for (let i = 0; i < 128; i++) {
            const freq = tuning.frequency * 2**((i - tuningMidiNumber) / 12);
          
            const oscillator = new OscillatorNode(audioContext, 
              {frequency: freq});
            const gainNode = new GainNode(audioContext, {gain: 0});
          
            oscillator.connect(gainNode).connect(audioContext.destination);
            oscillator.start();

            gainNodes.push(gainNode);
          }

          on = true;
        }
        resetVars();
        document.activeElement.blur();
    });
}

// Add Chorale options
let optgroup = document.createElement("optgroup");
optgroup.label = "Chorales";
for (let i = 1; i <= 371; i++) {
    const option = document.createElement("option");
    option.text = i; optgroup.append(option);
}
library.add(optgroup);

library.addEventListener("change", loadMusic);
loadMusic();

function loadMusic() {
  const option = library.options[library.selectedIndex];
  let number = option.text;
  let optgroup = option.parentElement.label;

  let url;

  if (optgroup === "Chorales") {
      //url = "https://proxy.cors.sh/"
      // + "https://www.tobis-notenarchiv.de/bach/07-Choraele/02-Vierstimmig/"
      // + "BWV_0" + number + ".mid"
      number = ("00" + number).slice(-3);
      url = "https://kern.humdrum.org/cgi-bin/ksdata?file=chor"
      + number + ".krn&l=users/craig/classical/bach/371chorales&format=midi";
  }

  fetch(url)
  .then( response => response.arrayBuffer())
  .then( data => {setup(data);})
  .catch( e => {console.log( e );} );

  document.activeElement.blur();
}

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0]; 
    if (file) {reader.readAsArrayBuffer(file);}
    document.activeElement.blur();
});

function setup(arrayBuffer) {
  midi = new Midi(arrayBuffer);
  notes = [];
  for (let track of midi.tracks) {
    for (let note of track.notes) {
      notes.push(note);
    }
  }
  chords = getChords(notes);

  // calculate the minimum distance (between two consecutive chords)
  minDistance = 10000;
  for (let i = 1; i < chords.length; i++) {
    const distance = chords[i][0].ticks - chords[i-1][0].ticks;
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  myGameArea.canvas.width = minDistance * 40;
  noteWidth = minDistance / 2;
  
  resetVars();
}

reader.addEventListener("load", (e) => {setup(e.target.result);});

for (let et of ["down","up"]) {
  canvas.addEventListener("pointer"+et, key, {passive: false});
  document.addEventListener("key"+et, key, {passive: false});
}

byId("start").addEventListener("click", start);

function resize() {
  // resize tap pad
  document.getElementsByClassName("wrapper")[0].style.height = 
    (window.innerHeight - 17)  + "px";
  // redraw canvas
  if (chords.length > 0) {
    updateGameArea();
  }
}

resize();
window.addEventListener('resize', resize);

// Turn off default event listeners
const ets = ['focus', 'pointerover', 'pointerenter', 'pointerdown', 
  'touchstart', 'gotpointercapture', 'pointermove', 'touchmove', 'pointerup', 
  'lostpointercapture', 'pointerout', 'pointerleave', 'touchend'];
for (let et of ets) {
  canvas.addEventListener(et, function(event) {
    event.preventDefault();
    event.stopPropagation();
  }, {passive: false}); 
}