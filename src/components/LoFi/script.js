// This is script is heavily adapted from https://github.com/magenta/lofi-player
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import SampleLibrary from './Tonejs-instruments';
import workerScript from './worker';

function importAll(r) {
  return r.keys().map(r);
}

const drums = importAll(require.context('./samples/drums', false, /\.(mp3)$/));
// TODO: filter fx
const FX = importAll(require.context('./samples/fx', false, /\.(mp3)$/));
const Beep = require('./samples/effects/beep.mp3');

const LOAD_ML_MODELS = true;
const LOAD_EVENTS_COUNTS_THRESHOLD = LOAD_ML_MODELS ? 10 : 6;
const TOTAL_BAR_COUNTS = 8;
const TICKS_PER_BAR = 384;
const BEATS_PER_BAR = 4;
const MODEL_BAR_COUNT = 2;
const NUM_INTERPOLATIONS = 5;
const TRANSITION_PROB = 0.2;
const SYNTHS = 0;
const PIANO = 1;
const ACOUSTIC_GUITAR = 2;
const ELETRIC_GUITAR = 3;
const NUM_INSTRUMENTS = 4;
const NUM_PRESET_MELODIES = 4;
const NUM_PRESET_CHORD_PROGRESSIONS = 3;

const worker = LOAD_ML_MODELS ? new Worker(workerScript) : null;
const callbacks = {};
const state = {
  loading: true,
  started: false,
  pageVisible: true,
  loadEventsCount: 0,
  commands: [],
  showPanel: false,
  idleBarsCount: 0,
  barsCount: 0,
  backgroundSounds: {
    mute: false,
    samples: [],
    names: ['rain', 'waves', 'street', 'kids'],
    index: 0,
    tone: 1,
  },
  instruments: {},
  melody: {
    mute: false,
    part: null,
    gain: 1,
    swing: 0,
    instrumentIndex: 1,
    waitingInterpolation: true,
    midis: [],
    toneNotes: [],
    index: 0,
    secondIndex: 1,
    interpolationToneNotes: [],
    interpolationData: [],
    interpolationIndex: 0,
  },
  chords: {
    mute: true,
    part: null,
    index: 0,
    gain: 1,
    swing: 0,
    midis: null,
    instrumentIndex: 0,
  },
  bass: {
    mute: true,
    toneSliderValue: 20,
    notes: [
      { time: '0:0:0', note: 'F2', duration: { '1m': 0.7 }, velocity: 1.0 },
      { time: '1:0:0', note: 'F2', duration: { '1m': 0.7 }, velocity: 1.0 },
      { time: '2:0:0', note: 'C2', duration: { '1m': 0.7 }, velocity: 1.0 },
      { time: '3:0:0', note: 'C2', duration: { '1m': 0.7 }, velocity: 1.0 },
    ],
  },
  seq: {},
  drum: {
    mute: false,
    gain: 1,
    tone: 0.5,
    names: ['hh', 'kk', 'sn'],
    samples: [],
    auto: false,
    patternIndex: 0,
    scale: {
      kk: 1,
      sn: 1,
      hh: 1,
    },
  },
  master: {
    autoBreak: false,
    masterCompressor: new Tone.Compressor({
      threshold: -15,
      ratio: 7,
    }),
    lpf: new Tone.Filter(20000, 'lowpass'),
    reverb: new Tone.Reverb({
      decay: 1.0,
      preDelay: 0.01,
    }),
    bpm: 75,
    gain: new Tone.Gain(0.3),
  },
  effects: {},
  assets: {},
};

function toggleDrum(value, changeFilter = false, time = 0) {
  if (value === undefined) {
    state.drum.mute = !state.drum.mute;
  } else {
    state.drum.mute = value;
  }

  if (state.drum.mute) {
    // assets.clock.childNodes[0].classList.add('transparent');
    // assets.clock.childNodes[2].classList.add('transparent');
    // assets.clock.childNodes[1].classList.remove('hidden');
  } else {
    // assets.clock.childNodes[0].classList.remove('transparent');
    // assets.clock.childNodes[2].classList.remove('transparent');
    // assets.clock.childNodes[1].classList.add('hidden');
  }

  if (changeFilter) {
    if (!state.drum.mute) {
      state.master.lpf.frequency.linearRampTo(20000, 1, time);
    } else {
      state.master.lpf.frequency.linearRampTo(200, 0.5, time);
    }
  }

  // sync ui
  // drumToggle.checked = !state.drum.mute;
  // assets.plsSwitchAvatar(state.drum.mute);
}

function checkStarted() {
  return Tone.Transport.state === 'started';
}

function toggleBackgroundSounds(value) {
  if (value !== undefined) {
    state.backgroundSounds.mute = value;
  } else {
    state.backgroundSounds.mute = !state.backgroundSounds.mute;
  }

  if (state.backgroundSounds.mute) {
    // assets.cactus.childNodes[0].classList.add('transparent');
    // assets.cactus.childNodes[1].classList.remove('hidden');
    state.backgroundSounds.gate.gain.value = 0;
    // assets.window.src = assets.windowUrls[1];
  } else {
    // assets.cactus.childNodes[0].classList.remove('transparent');
    // assets.cactus.childNodes[1].classList.add('hidden');
    state.backgroundSounds.gate.gain.value = 1;
    // assets.window.src = assets.windowUrls[0];

    if (checkStarted()) {
      state.backgroundSounds.samples
        .player(state.backgroundSounds.names[state.backgroundSounds.index])
        .start(0);
    }
  }

  // backgroundSoundsMuteCheckbox.checked = !state.backgroundSounds.mute;
}

function toggleChords(value) {
  if (value !== undefined) {
    state.chords.mute = value;
  } else {
    state.chords.mute = !state.chords.mute;
  }

  if (state.chords.mute) {
    // assets.chordsInstruments.forEach((i) => {
    //   i.classList.add('transparent');
    //   i.childNodes[1].classList.remove('hidden');
    // });
  } else {
    // assets.chordsInstruments.forEach((i) => {
    //   i.classList.remove('transparent');
    //   i.childNodes[1].classList.add('hidden');
    // });
  }

  // chordsMuteCheckbox.checked = !state.chords.mute;
}

function toggleMelody(value) {
  if (value !== undefined) {
    state.melody.mute = value;
  } else {
    state.melody.mute = !state.melody.mute;
  }

  if (state.melody.mute) {
    // assets.melodyInstruments.forEach((i) => {
    //   i.classList.add('transparent');
    //   i.childNodes[1].classList.remove('hidden');
    // });
  } else {
    // assets.melodyInstruments.forEach((i) => {
    //   i.classList.remove('transparent');
    //   i.childNodes[1].classList.add('hidden');
    // });
  }

  // melodyMuteCheckbox.checked = !state.melody.mute;
}

function toggleBass(value) {
  if (value !== undefined) {
    state.bass.mute = value;
  } else {
    state.bass.mute = !state.bass.mute;
  }

  if (state.bass.mute) {
    state.bass.gate.gain.value = 0;
    // assets.bass.classList.add('transparent');
    // assets.bassGroup.childNodes[1].classList.remove('hidden');
  } else {
    state.bass.gate.gain.value = 1;
    // assets.bass.classList.remove('transparent');
    // assets.bassGroup.childNodes[1].classList.add('hidden');
  }

  // bassMuteCheckbox.checked = !state.bass.mute;
}

function plsSwitch(index) {
  state.backgroundSounds.samples
    .player(state.backgroundSounds.names[state.backgroundSounds.index])
    .stop();
  state.backgroundSounds.index = index;
  if (checkStarted()) {
    state.backgroundSounds.samples
      .player(state.backgroundSounds.names[state.backgroundSounds.index])
      .start(0);
  }
}

function changeMasterVolume(v) {
  // masterVolumeSlider.value = v * 100;
  state.master.gain.gain.value = v;
}

function changeMasterBpm(v) {
  const limV = Math.min(Math.max(60, v), 100);
  // bpmInput.value = limV;
  state.master.bpm = limV;
  Tone.Transport.bpm.value = limV;
}

function changeMasterReverb(v) {
  // masterReverbSlider.value = v * 100;
  state.master.reverb.wet.linearRampTo(v, 1, Tone.now());
}

function changeMasterFilter(v) {
  // masterToneSlider.value = (v / 20000) * 100;
  state.master.lpf.frequency.linearRampTo(v, 1, Tone.now());
}

function changeDrumPattern(index) {
  state.drum.patternIndex = index;
  // drumPatternsSelect.value = index;
}

function sendContinueMessage() {
  worker.postMessage({
    id: 1,
    msg: 'continue',
  });
}

function toFreq(m) {
  return Tone.Frequency(m, 'midi');
}

function midiToModelFormat(midi, resolution = 2) {
  const totalQuantizedSteps = MODEL_BAR_COUNT * 16;

  // console.log("parse this midi", midi);
  const totalTicks = (TOTAL_BAR_COUNTS * TICKS_PER_BAR) / resolution;

  const notes = midi.tracks[0].notes.map((note) => ({
    pitch: note.midi,
    quantizedStartStep: Math.round((note.ticks / totalTicks) * totalQuantizedSteps),
    quantizedEndStep: Math.round(
      ((note.ticks + note.durationTicks) / totalTicks) * totalQuantizedSteps,
    ),
  }));

  return {
    notes,
    quantizationInfo: { stepsPerQuarter: 4 },
    tempos: [{ time: 0, qpm: 120 }],
    totalQuantizedSteps,
  };
}

function sendInterpolationMessage(m1, m2, id = 0) {
  state.melody.waitingInterpolation = true;

  // console.log(`interpolate ${state.melody.index} ${state.melody.secondIndex}`);
  const firstMelody = state.melody.midis[state.melody.index];
  const left = m1 || midiToModelFormat(firstMelody);

  const secondMelody = state.melody.midis[state.melody.secondIndex];
  const right = m2 || midiToModelFormat(secondMelody);

  state.melody.interpolationData[0] = left;
  state.melody.interpolationData[NUM_INTERPOLATIONS - 1] = right;

  // eslint-disable-next-line
  LOAD_ML_MODELS &&
    worker.postMessage({
      id,
      msg: 'interpolate',
      left,
      right,
    });
}

function changeMelodyByIndex(index = 0) {
  if (state.melody.part) {
    state.melody.part.cancel(0);
  }
  state.melody.index = index;
  if (index === state.melody.toneNotes.length - 1) {
    sendContinueMessage();
    return;
  }

  state.melody.part = new Tone.Part((time, note) => {
    // eslint-disable-next-line
    !state.melody.mute &&
      state.melody.instrument.triggerAttackRelease(
        toFreq(note.pitch - 12),
        note.duration,
        time + Math.random() * (75 / state.master.bpm) * 0.3 * state.melody.swing,
        note.velocity * state.melody.gain,
      );
  }, state.melody.toneNotes[state.melody.index]).start(0);

  state.melody.part.loop = false;

  // firstMelodySelect.value = index;
  sendInterpolationMessage();
}

function randomlyChangeMelodyByIndex() {
  const index = Math.floor(Math.random() * NUM_PRESET_MELODIES);
  changeMelodyByIndex(index);
}

function changeMelody(readyMidi) {
  if (state.melody.part) {
    state.melody.part.cancel(0);
  }
  state.melody.part = new Tone.Part((time, note) => {
    // eslint-disable-next-line
    !state.melody.mute &&
      state.melody.instrument.triggerAttackRelease(
        toFreq(note.pitch - 12),
        note.duration,
        time + Math.random() * (75 / state.master.bpm) * 0.3 * state.melody.swing,
        note.velocity * state.melody.gain,
      );
  }, readyMidi).start(0);
  state.melody.part.loop = true;
  state.melody.part.loopEnd = '4:0:0';
}

function changeInterpolationIndex(index) {
  state.melody.interpolationIndex = index;
  changeMelody(state.melody.interpolationToneNotes[index]);

  // interpolationSlider.value = index;
  // secondInterpolationSlider.value = index;
}

function randomlyChangeInterpolationIndex() {
  const index = Math.floor(Math.random() * state.melody.interpolationToneNotes.length);
  changeInterpolationIndex(index);
}

function changeChordsInstrument(index) {
  for (let j = 0; j < NUM_INSTRUMENTS; j++) {
    if (j === parseInt(index, 10)) {
      // assets.chordsInstruments[j].style.display = 'block';
    } else {
      // assets.chordsInstruments[j].style.display = 'none';
    }
  }

  state.chords.instrumentIndex = index;
}

function randomlyChangeChordsInstrument() {
  const index = Math.floor(Math.random() * NUM_INSTRUMENTS);
  changeChordsInstrument(index);
}

function changeMelodyInstrument(index) {
  for (let j = 0; j < NUM_INSTRUMENTS; j++) {
    if (j === parseInt(index, 10)) {
      // assets.melodyInstruments[j].style.display = 'block';
    } else {
      // assets.melodyInstruments[j].style.display = 'none';
    }
  }

  // melodyInstrumentSelect.value = index;
  state.melody.instrumentIndex = index;
  state.melody.instrument = state.instruments[index];
}

function randomlyChangeMelodyInstrument() {
  const index = Math.floor(Math.random() * NUM_INSTRUMENTS);
  changeMelodyInstrument(index);
}

function midiToToneNotes(midi) {
  // console.log("parse this midi", midi);
  const ticksPerBeat = TICKS_PER_BAR / BEATS_PER_BAR;
  const ticksPerFourthNote = ticksPerBeat / 4;

  return midi.tracks[0].notes.map((note) => {
    return {
      time: `${Math.floor(note.ticks / TICKS_PER_BAR)}:${
        Math.floor(note.ticks / ticksPerBeat) % BEATS_PER_BAR
      }:${(note.ticks / ticksPerFourthNote) % 4}`,
      pitch: note.midi,
      duration: note.duration,
      velocity: note.velocity,
    };
  });
}

function changeChords(index = 0) {
  // eslint-disable-next-line
  index = index % state.chords.midis.length;
  if (state.chords.part) {
    state.chords.part.cancel(0);
  }
  state.chords.index = index;
  state.chords.part = new Tone.Part((time, note) => {
    // eslint-disable-next-line
    !state.chords.mute &&
      state.instruments[state.chords.instrumentIndex].triggerAttackRelease(
        toFreq(note.pitch - (state.chords.instrumentIndex === 0 ? 0 : 12)),
        note.duration,
        time + state.chords.swing * (75 / state.master.bpm) * Math.random() * 0.1,
        note.velocity * state.chords.gain,
      );
  }, midiToToneNotes(state.chords.midis[state.chords.index])).start(0);
}

function reset() {
  changeMasterBpm(90);
  changeDrumPattern(0);
  toggleMelody(false);
  toggleChords(false);
  toggleBass(false);
  toggleDrum(false);
  toggleBackgroundSounds(false);
  changeChords(1);
  changeChordsInstrument(2);
  changeMelodyByIndex(1);
  changeInterpolationIndex(0);
  changeMelodyInstrument(3);
  plsSwitch(1);
  state.backgroundSounds.gainNode.gain.value = 0.7;
}

function randomChange() {
  let seed = Math.random();
  if (seed > 0.95) {
    randomlyChangeChordsInstrument();
  } else if (seed < 0.05) {
    randomlyChangeMelodyInstrument();
  }

  seed = Math.random();
  if (seed > 0.5) {
    randomlyChangeInterpolationIndex();
    return;
  }

  seed = Math.random();
  if (seed > 0.9) {
    randomlyChangeMelodyByIndex();
    return;
  }
  if (seed < 0.1) {
    sendContinueMessage();
    return;
  }

  seed = Math.random();
  if (seed > 0.95) {
    const index = Math.floor(Math.random() * NUM_PRESET_CHORD_PROGRESSIONS);
    changeChords(index);
    return;
  }
  if (seed < 0.05) {
    const index = Math.floor(Math.random() * 4);
    plsSwitch(index);
  }
}

function seqCallback(time, b) {
  if (!state.drum.mute) {
    if (state.drum.patternIndex === 0) {
      if (b % 16 === 0) {
        state.drum.scale.kk = 1;
        state.drum.samples.player('kk').start(time);
      }
      if (b % 16 === 8) {
        state.drum.scale.sn = 1;
        state.drum.samples.player('sn').start(time);
      }
      if (b % 2 === 0) {
        state.drum.scale.hh = 1;
        state.drum.samples.player('hh').start(time);
      }
    } else if (state.drum.patternIndex === 1) {
      if (b % 32 === 0 || b % 32 === 20) {
        state.drum.samples.player('kk').start(time);
      }
      if (b % 16 === 8) {
        state.drum.samples.player('sn').start(time);
      }
      if (b % 2 === 0) {
        state.drum.samples.player('hh').start(time + 0.07);
      }
    } else if (state.drum.patternIndex === 2) {
      if (b % 16 === 0 || b % 16 === 10 || (b % 32 >= 16 && b % 16 === 11)) {
        state.drum.samples.player('kk').start(time);
      }
      if (b % 8 === 4) {
        state.drum.samples.player('sn').start(time);
      }
      if (b % 2 === 0) {
        state.drum.samples.player('hh').start(time + 0.07);
      }
    }
  }

  // Markov chain
  if (state.master.autoBreak) {
    if (b % 32 === 31) {
      state.idleBarsCount += 1;
      state.barsCount += 1;

      if (state.drum.mute) {
        if (Math.random() > 0.05) {
          toggleDrum(false, true, time);
          if (state.idleBarsCount > 8) {
            state.idleBarsCount = 0;
            randomChange();
          }

          if (state.barsCount > 400) {
            state.barsCount = 0;
            reset();
          }
        }
      } else if (Math.random() < TRANSITION_PROB) {
        toggleDrum(true, true, time);
      }
    }
  }
}

function onTransportStart() {
  if (state.backgroundSounds.mute) {
    return;
  }
  state.backgroundSounds.samples
    .player(state.backgroundSounds.names[state.backgroundSounds.index])
    .start(0);
}

function onTransportStop() {
  state.backgroundSounds.samples
    .player(state.backgroundSounds.names[state.backgroundSounds.index])
    .stop();
}

function startTransport() {
  Tone.Transport.start(0);
  onTransportStart();
  // startButton.textContent = 'stop';
  // assets.light.src = './assets/light-on.png';
  // canvasOverlay.style.display = 'none';
}

function stopTransport() {
  Tone.Transport.stop();
  onTransportStop();
  // startButton.textContent = 'start';
  // assets.light.src = './assets/light-off.png';
  // canvasOverlay.style.display = 'flex';
}

function toggleStart() {
  const ac = Tone.context._context;
  if (ac.state !== 'started') {
    ac.resume();
  }

  if (checkStarted()) {
    stopTransport();
  } else {
    startTransport();
  }
}

function onFinishLoading() {
  // startButton.addEventListener('click', () => {
  //   if (!state.started) {
  //     state.started = true;
  //     onFirstTimeStarted();
  //   }
  //   toggleStart();
  // });

  setTimeout(() => {
    toggleStart();
  }, 2000);

  // callbacks

  state.drum.changeGain = function (v) {
    state.drum.gain = v;
    // drumVolumeSlider.value = v * 100;
    state.drum.gainNode.gain.value = v;
  };

  state.drum.changeFilter = function (v) {
    state.drum.tone = v;
    const frq = v * 10000 + 200;
    state.drum.lpf.frequency.value = frq;
    // drumToneSlider.value = v * 100;
  };

  state.melody.changeGain = function (v) {
    state.melody.gain = v;
    // melodyVolumeSlider.value = v * 100;
  };

  state.melody.changeSwing = function (v) {
    state.melody.swing = v;
    // melodySwingSlider.value = v * 100;
  };

  state.chords.changeGain = function (v) {
    state.chords.gain = v;
    // chordsVolumeSlider.value = v * 100;
  };

  state.chords.changeSwing = function (v) {
    state.chords.swing = v;
    // chordsSwingSlider.value = v * 100;
  };

  state.bass.changeFilter = function (v) {
    const frq = v * 4;
    state.bass.lpf.frequency.value = frq;
    // bassToneSlider.value = v;
  };
  state.bass.changeGain = function (v) {
    state.bass.gain.gain.value = v;
    // bassVolumeSlider.value = v * 100;
  };

  state.backgroundSounds.changeVolume = function (v) {
    state.backgroundSounds.gainNode.gain.value = v;
    // backgroundVolumeSlider.value = v * 100;
  };
  state.backgroundSounds.changeFilter = function (v) {
    const frq = v * 20000;
    state.backgroundSounds.hpf.frequency.value = frq;
    // backgroundToneSlider.value = v * 100;
  };

  state.master.changeReverb = function (v) {
    // masterReverbSlider.value = v * 100;
    state.master.reverb.wet.linearRampTo(v, 1, Tone.now());
  };

  state.master.changeFilter = function (v) {
    // masterToneSlider.value = (v / 20000) * 100;
    state.master.lpf.frequency.linearRampTo(v, 1, Tone.now());
  };

  // add event listeners

  changeMasterBpm(state.master.bpm);
  // bpmInput.addEventListener('input', (e) => {
  //   changeMasterBpm(bpmInput.value);
  // });

  // drumToggle.checked = !state.drum.mute;
  // drumToggle.addEventListener('change', (e) => {
  //   toggleDrum(!drumToggle.checked);
  // });

  if (state.drum.volumeSliderValue) {
    state.drum.changeGain(state.drum.volumeSliderValue / 100);
  } else {
    state.drum.changeGain(state.drum.gain);
  }
  // drumVolumeSlider.addEventListener('input', () => {
  //   state.drum.changeGain(drumVolumeSlider.value / 100);
  // });

  if (state.drum.toneSliderValue) {
    state.drum.changeFilter(state.drum.toneSliderValue / 100);
  } else {
    state.drum.changeFilter(state.drum.tone);
  }
  // drumToneSlider.addEventListener('input', () => {
  //   state.drum.changeFilter(drumToneSlider.value / 100);
  // });

  changeDrumPattern(state.drum.patternIndex);
  // drumPatternsSelect.addEventListener('change', () => {
  //   changeDrumPattern(parseInt(drumPatternsSelect.value, 10));
  // });

  toggleChords(state.chords.mute);
  // chordsMuteCheckbox.addEventListener('change', () => {
  //   toggleChords(!chordsMuteCheckbox.checked);
  // });
  // chordsSelect.addEventListener('change', () => {
  //   changeChords(chordsSelect.value);
  // });

  changeChordsInstrument(state.chords.instrumentIndex);
  // chordsInstrumentSelect.addEventListener('change', () => {
  //   changeChordsInstrument(chordsInstrumentSelect.value);
  // });

  // firstMelodySelect.addEventListener('change', () => {
  //   changeMelodyByIndex(parseInt(firstMelodySelect.value));
  // });

  // secondMelodySelect.addEventListener('change', () => {
  //   state.melody.secondIndex = secondMelodySelect.value;
  //   sendInterpolationMessage(state.melody.interpolationData[0]);
  // });

  plsSwitch(state.backgroundSounds.index);
  toggleBackgroundSounds(state.backgroundSounds.mute);
  // backgroundSoundsMuteCheckbox.addEventListener('change', () => {
  //   toggleBackgroundSounds(!backgroundSoundsMuteCheckbox.checked);
  // });

  // backgroundSoundsSelect.addEventListener('change', () => {
  //   plsSwitch(Number(backgroundSoundsSelect.value));
  // });

  toggleMelody(state.melody.mute);
  // melodyMuteCheckbox.addEventListener('change', () => {
  //   toggleMelody(!melodyMuteCheckbox.checked);
  // });

  changeMelodyInstrument(state.melody.instrumentIndex);
  // melodyInstrumentSelect.addEventListener('change', () => {
  //   changeMelodyInstrument(melodyInstrumentSelect.value);
  // });

  // interpolationSlider.addEventListener('change', (e) => {
  //   e.stopPropagation();
  //   const index = Math.floor(interpolationSlider.value);
  //   changeInterpolationIndex(index);
  // });

  // secondInterpolationSlider.addEventListener('mousedown', (e) => {
  //   e.stopPropagation();
  // });
  // secondInterpolationSlider.addEventListener('change', (e) => {
  //   const index = Math.floor(secondInterpolationSlider.value);
  //   changeInterpolationIndex(index);
  // });

  if (state.melody.volumeSliderValue) {
    state.melody.changeGain(state.melody.volumeSliderValue / 100);
  }
  // melodyVolumeSlider.addEventListener('input', () => {
  //   state.melody.changeGain(melodyVolumeSlider.value / 100);
  // });

  toggleChords(state.chords.mute);
  if (state.chords.volumeSliderValue) {
    state.chords.changeGain(state.chords.volumeSliderValue / 100);
  }
  // chordsVolumeSlider.addEventListener('input', () => {
  //   state.chords.changeGain(chordsVolumeSlider.value / 100);
  // });

  toggleBass(state.bass.mute);
  // bassMuteCheckbox.addEventListener('change', () => {
  //   toggleBass(!bassMuteCheckbox.checked);
  // });

  if (state.bass.volumeSliderValue) {
    state.bass.changeGain(state.bass.volumeSliderValue / 100);
  }
  // bassVolumeSlider.addEventListener('input', () => {
  //   state.bass.changeGain(bassVolumeSlider.value / 100);
  // });

  if (state.bass.toneSliderValue) {
    state.bass.changeFilter(state.bass.toneSliderValue);
  }
  // bassToneSlider.addEventListener('input', () => {
  //   state.bass.changeFilter(bassToneSlider.value);
  // });

  if (state.backgroundSounds.volumeSliderValue) {
    state.backgroundSounds.changeVolume(state.backgroundSounds.volumeSliderValue / 100);
  }

  if (state.backgroundSounds.toneSliderValue) {
    state.backgroundSounds.changeFilter(state.backgroundSounds.toneSliderValue / 100);
  }

  // backgroundVolumeSlider.addEventListener('input', () => {
  //   state.backgroundSounds.changeVolume(backgroundVolumeSlider.value / 100);
  // });

  // backgroundToneSlider.addEventListener('input', () => {
  //   state.backgroundSounds.changeFilter(backgroundToneSlider.value / 100);
  // });

  // masterAutoBreakCheckbox.addEventListener('change', () => {
  //   state.master.autoBreak = masterAutoBreakCheckbox.checked;
  // });

  // masterReverbSlider.addEventListener('input', () => {
  //   const wet = masterReverbSlider.value / 100;
  //   state.master.reverb.wet.value = wet;
  // });

  // masterToneSlider.addEventListener('input', () => {
  //   const frq = masterToneSlider.value * 198 + 200;
  //   state.master.lpf.frequency.value = frq;
  // });

  // masterVolumeSlider.addEventListener('input', () => {
  //   changeMasterVolume(masterVolumeSlider.value / 100);
  // });

  state.melody.changeSwing(state.melody.swing);
  // melodySwingSlider.addEventListener('input', () => {
  //   state.melody.changeSwing(melodySwingSlider.value / 100);
  // });

  state.chords.changeSwing(state.chords.swing);
  // chordsSwingSlider.addEventListener('input', () => {
  //   state.chords.changeSwing(chordsSwingSlider.value / 100);
  // });

  // model
  sendInterpolationMessage();
}

function checkFinishLoading() {
  state.loadEventsCount += 1;
  console.log(`[${state.loadEventsCount}/${LOAD_EVENTS_COUNTS_THRESHOLD}]`);
  if (state.loading && state.loadEventsCount >= LOAD_EVENTS_COUNTS_THRESHOLD) {
    state.loading = false;
    console.log('Finish loading!');
    onFinishLoading();
  } else if (state.loading) {
    // const percentage = Math.floor((state.loadEventsCount / LOAD_EVENTS_COUNTS_THRESHOLD) * 100);
    // startButton.textContent = `loading...${percentage}/100%`;
  }
}

function consumeNextCommand() {
  if (!state.commands) {
    return;
  }
  if (state.commands.length === 0) {
    return;
  }

  // const { authorName, content, id, args } = state.commands.shift();
  const data = state.commands.shift();

  if (callbacks[data.id]) {
    state.idleBarsCount = 0;
    callbacks[data.id](data.args);
  }
}

function initSounds() {
  Tone.Transport.bpm.value = state.master.bpm;
  Tone.Transport.loop = true;
  Tone.Transport.loopStart = '0:0:0';
  Tone.Transport.loopEnd = '8:0:0';

  Tone.Master.chain(
    state.master.masterCompressor,
    state.master.reverb,
    state.master.lpf,
    state.master.gain,
  );
  state.master.reverb.generate().then(() => {
    console.log('master reverb ready');
    checkFinishLoading();
  });
  // state.master.reverb.wet.value = masterReverbSlider.value / 100;
  state.master.reverb.wet.value = 1;

  const drumUrls = {};
  state.drum.names.forEach((n, i) => { drumUrls[n] = drums[i]; });
  state.drum.gainNode = new Tone.Gain(1).toMaster();
  state.drum.lpf = new Tone.Filter(10000, 'lowpass').connect(state.drum.gainNode);
  state.drum.samples = new Tone.Players(drumUrls, () => {
    console.log('drums loaded');
    checkFinishLoading();
  }).connect(state.drum.lpf);

  state.backgroundSounds.gate = new Tone.Gain(state.backgroundSounds.mute ? 0 : 1).toMaster();
  state.backgroundSounds.gainNode = new Tone.Gain(1).connect(state.backgroundSounds.gate);
  state.backgroundSounds.hpf = new Tone.Filter(20000, 'lowpass').connect(
    state.backgroundSounds.gainNode,
  );
  const sampleUrls = {};
  state.backgroundSounds.names.forEach((n, i) => { sampleUrls[n] = FX[i]; });
  state.backgroundSounds.samples = new Tone.Players(sampleUrls, () => {
    state.backgroundSounds.names.forEach((name) => {
      state.backgroundSounds.samples.player(name).loop = true;
    });
    console.log('fx loaded');
    checkFinishLoading();
  }).connect(state.backgroundSounds.hpf);

  state.effects.beep = new Tone.Player(Beep, () => {
    console.log('beep loaded');
    checkFinishLoading();
  }).toMaster();
  state.seq = new Tone.Sequence(
    seqCallback,
    Array(128)
      .fill(null)
      .map((_, i) => i),
    '16n',
  );
  state.seq.start(0);

  const reverb = new Tone.Reverb({
    decay: 8.5,
    preDelay: 0.1,
  }).toMaster();
  reverb.generate().then(() => {
    console.log('reverb ready');
    checkFinishLoading();
  });
  reverb.wet.value = 0.3;
  const lpf = new Tone.Filter(1000, 'lowpass').connect(reverb);
  const hpf = new Tone.Filter(1, 'highpass').connect(lpf);
  const chorus = new Tone.Chorus(4, 2.5, 0.1).connect(hpf);

  const { bass } = state;
  bass.gate = new Tone.Gain(0).connect(reverb);
  bass.gain = new Tone.Gain(1).connect(bass.gate);
  bass.lpf = new Tone.Filter(200, 'lowpass').connect(bass.gain);
  bass.instrument = new Tone.Synth({
    oscillator: {
      type: 'square',
    },
    envelope: {
      attack: 0.0,
      decay: 0.1,
      sustain: 0.3,
      release: 0.8,
    },
  }).connect(bass.lpf);
  bass.part = new Tone.Part((time, note) => {
    bass.instrument.triggerAttackRelease(note.note, note.duration, time, note.velocity);
  }, bass.notes);
  // ^ removed .start(0)
  console.log(bass);
  bass.part.loop = true;
  bass.part.loopEnd = '4:0:0';

  state.instruments[SYNTHS] = new Tone.PolySynth().toDestination()
    .set({
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 1,
      },
      maxPolphony: 10,
    }).connect(chorus);

  state.instruments[PIANO] = SampleLibrary.load({
    instruments: 'piano',
  }, () => {
    console.log('piano loaded');
    checkFinishLoading();
  });
  state.instruments[ACOUSTIC_GUITAR] = SampleLibrary.load({
    instruments: 'guitar-acoustic',
  }, () => {
    console.log('guitar-acoustic loaded');
    checkFinishLoading();
  });
  state.instruments[ELETRIC_GUITAR] = SampleLibrary.load({
    instruments: 'guitar-electric',
  }, () => {
    console.log('guitar-electric loaded');
    checkFinishLoading();
  });
  state.instruments[PIANO].connect(chorus);
  state.instruments[ACOUSTIC_GUITAR].connect(chorus);
  state.instruments[ELETRIC_GUITAR].connect(chorus);

  state.melody.instrument = state.instruments[state.melody.instrumentIndex];
  // console.log(Tone.Buffer.onload);
  // Tone.Buffer.on('load', () => {
  //   checkFinishLoading();
  //   console.log('buffers loaded');
  // });

  // event
  state.handleMessageLoop = new Tone.Loop(() => {
    consumeNextCommand();
  }, '1m').start(0);
}

function filterNotesInScale(data) {
  return data.map((d) => {
    // eslint-disable-next-line
    d.notes = d.notes.filter(({ pitch }) => {
      const p = pitch % 12;
      return [0, 2, 4, 5, 7, 9, 11].includes(p);
    });
    return d;
  });
}

function modelFormatToToneNotes(d) {
  const { notes } = d;
  return notes.map((note) => {
    const { pitch, quantizedStartStep, quantizedEndStep } = note;

    return {
      time: `${Math.floor(quantizedStartStep / 8)}:${Math.floor((quantizedStartStep % 8) / 2)}:${
        (quantizedStartStep % 2) * 2
      }`,
      pitch,
      duration: (quantizedEndStep - quantizedStartStep) * (state.master.bpm / 60) * (1 / 4),
      velocity: 0.7,
    };
  });
}

function filterNotesInScaleSingle(notes) {
  return notes.filter(({ pitch }) => {
    const p = pitch % 12;
    return [0, 2, 4, 5, 7, 9, 11].includes(p);
  });
}

function initModel() {
  worker.postMessage({ msg: 'init' });
  let loaded = false;
  worker.onmessage = (e) => {
    if (e.data.msg === 'init' && !loaded) {
      loaded = true;
      console.log('model loaded');
      checkFinishLoading();
    }
    if (e.data.msg === 'interpolate') {
      // let { id, result } = e.data;
      let result = e.data.result;
      // console.log("interpolation result", result);
      result = filterNotesInScale(result);
      state.melody.interpolationData.splice(
        1,
        NUM_INTERPOLATIONS - 2,
        ...result.slice(1, NUM_INTERPOLATIONS - 1),
      );
      // state.melody.interpolationData = result;

      state.melody.interpolationToneNotes = result.map(modelFormatToToneNotes);
      state.melody.interpolationToneNotes[0] = state.melody.toneNotes[state.melody.index];
      state.melody.interpolationToneNotes[state.melody.interpolationToneNotes.length - 1] = state.melody.toneNotes[state.melody.secondIndex];

      state.melody.waitingInterpolation = false;

      changeInterpolationIndex(state.melody.interpolationIndex);

      // console.log("interpolationData", state.melody.interpolationData);
      // console.log("interpolationToneNotes", state.melody.interpolationToneNotes);
      // state.canvas.melodyCanvas.style.opacity = 1;
    }
    if (e.data.msg === 'continue') {
      // let { id, result } = e.data;
      let result = e.data.result;
      result.notes = filterNotesInScaleSingle(result.notes);
      result.notes = result.notes.map((note) => {
        // eslint-disable-next-line
        note.pitch += 24;
        return note;
      });

      if (state.melody.retrivedRnnGeneratedResult) {
        result = state.melody.retrivedRnnGeneratedResult;
        state.melody.retrivedRnnGeneratedResult = undefined;
      }
      state.melody.cachedRnnGeneratedResult = result;

      state.melody.interpolationData[0] = result[0];
      const notes = modelFormatToToneNotes(result);
      const n = state.melody.toneNotes.length;
      state.melody.toneNotes[n - 1] = notes; // update toneNotes
      changeMelody(notes); // change played melody part
      state.melody.index = n - 1; // change index
      // firstMelodySelect.value = n - 1; // change ui index
      sendInterpolationMessage(result); // update interpolation

      state.melody.interpolationIndex = 0;
      // interpolationSlider.value = 0;
      // secondInterpolationSlider.value = 0;
    }
  };
}

async function loadMidiFiles() {
  state.chords.midis = await Promise.all([
    Midi.fromUrl('../../assets/midi/IV_IV_I_I/IV_IV_I_I_C_1.mid'),
    Midi.fromUrl('../../assets/midi/IV_IV_I_I/IV_IV_I_I_C_3.mid'),
    Midi.fromUrl('../../assets/midi/IV_IV_I_I/IV_IV_I_I_C_2.mid'),
  ]);

  changeChords(state.chords.index);

  state.melody.midis = await Promise.all([
    Midi.fromUrl('../../assets/midi/IV_IV_I_I/melody/m_1_C.mid'),
    Midi.fromUrl('../../assets/midi/IV_IV_I_I/melody/m_2_C.mid'),
    Midi.fromUrl('../../assets/midi/IV_IV_I_I/melody/m_3_C.mid'),
    Midi.fromUrl('../../assets/midi/IV_IV_I_I/melody/m_4_C.mid'), // NUM_PRESET_MELODIES -> 4
  ]);
  state.melody.midis[NUM_PRESET_MELODIES] = state.melody.midis[0]; // placeholder
  state.melody.toneNotes = state.melody.midis.map(midiToToneNotes);

  // secondMelodySelect.value = state.melody.secondIndex;
  changeMelodyByIndex(state.melody.index);

  console.log('midi loaded');
  checkFinishLoading();
}

/**
 *
 * Save & Restore
 *
 */

// function stateToUrlParams() {
//   const savedState = {
//     master: {
//       bpm: state.master.bpm,
//       reverb: state.master.reverb.wet.value,
//       filter: state.master.lpf.frequency.value,
//       volume: state.master.gain.gain.value,
//     },
//     melody: {
//       mute: state.melody.mute,
//       index: state.melody.index,
//       secondIndex: state.melody.secondIndex,
//       interpolationIndex: state.melody.interpolationIndex,
//       instrumentIndex: state.melody.instrumentIndex,
//       volumeSliderValue: melodyVolumeSlider.value,
//       swing: state.melody.swing,
//       retrivedRnnGeneratedResult: state.melody.cachedRnnGeneratedResult,
//     },
//     chords: {
//       mute: state.chords.mute,
//       index: state.chords.index,
//       instrumentIndex: state.chords.instrumentIndex,
//       volumeSliderValue: chordsVolumeSlider.value,
//       swing: state.chords.swing,
//     },
//     backgroundSounds: {
//       mute: state.backgroundSounds.mute,
//       volumeSliderValue: backgroundVolumeSlider.value,
//       toneSliderValue: backgroundToneSlider.value,
//       index: state.backgroundSounds.index,
//     },
//     drum: {
//       mute: state.drum.mute,
//       patternIndex: state.drum.patternIndex,
//       volumeSliderValue: drumVolumeSlider.value,
//       toneSliderValue: drumToneSlider.value,
//     },
//     bass: {
//       mute: state.bass.mute,
//       volumeSliderValue: bassVolumeSlider.value,
//       toneSliderValue: bassToneSlider.value,
//     },
//     assets: {
//       boardText: assets.textInput.value,
//     },
//   };

//   // save position to urls
//   const names = Object.keys(state.assets);
//   for (let i = 0; i < names.length; i++) {
//     const name = names[i];
//     if (name === 'boardText') {
//       // eslint-disable-next-line
//       continue;
//     }
//     savedState.assets[name] = {
//       top: state.assets[name].top,
//       left: state.assets[name].left,
//     };
//   }

//   const urlParams = new URLSearchParams(window.location.search);
//   const result = JSON.stringify(savedState);
//   urlParams.set('data', result);
//   window.history.pushState(null, null, `?${urlParams.toString()}`);
//   return window.location.href;
// }

function urlParamsToState() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const ss = JSON.parse(urlParams.get('data'));
    if (!ss) {
      return;
    }

    if (ss.master) {
      const { master } = ss;
      changeMasterVolume(master.volume);
      changeMasterBpm(master.bpm);
      changeMasterFilter(master.filter);
      changeMasterReverb(master.reverb);
    }

    const groups = ['melody', 'chords', 'bass', 'drum', 'backgroundSounds', 'assets'];
    for (let k = 0; k < groups.length; k++) {
      const group = groups[k];
      if (!ss[group]) {
        /* eslint-disable-next-line */
        continue;
      }
      const paramKeys = Object.keys(ss[group]);
      for (let i = 0; i < paramKeys.length; i++) {
        const key = paramKeys[i];
        state[group][key] = ss[group][key];
      }
    }
  } catch (e) {
    console.error(e);
    window.history.pushState(null, null, '/');
  }
}

urlParamsToState();
loadMidiFiles();
// eslint-disable-next-line
LOAD_ML_MODELS && initModel();
initSounds();
