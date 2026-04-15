// Audio scoring engine — client-side DSP
// Runs in the browser on the recorded PCM buffer

export interface AudioScores {
  rmsDb: number;          // RMS level in dBFS
  clippingRate: number;   // % of samples clipping (0-100)
  noiseFloorDb: number;   // Background noise floor in dBFS
  echoScore: number;      // Echo correlation coefficient (0-1)
  deviceLabel: string;
}

export type IssueCode =
  | 'low_volume'
  | 'clipping'
  | 'background_noise'
  | 'echo'
  | 'wrong_mic'
  | 'bluetooth_quality'
  | 'dropout'
  | null;

export type CheckResult = 'pass' | 'warn' | 'fail';

export interface ScoringResult {
  result: CheckResult;
  issueCode: IssueCode;
  scores: AudioScores;
  message: string;
}

function rmsToDb(rms: number): number {
  if (rms <= 0) return -100;
  return 20 * Math.log10(rms);
}

function calcRms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

function calcClipping(samples: Float32Array): number {
  let clipped = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > 0.98) clipped++;
  }
  return (clipped / samples.length) * 100;
}

function detectDropout(samples: Float32Array, sampleRate: number): boolean {
  // Look for silence windows > 150ms
  const windowSamples = Math.floor(sampleRate * 0.15);
  const threshold = 0.005;
  let silenceCount = 0;

  for (let i = 0; i < samples.length - windowSamples; i += windowSamples) {
    const windowRms = calcRms(samples.slice(i, i + windowSamples));
    if (windowRms < threshold) {
      silenceCount++;
      if (silenceCount >= 2) return true; // Two consecutive silent windows
    } else {
      silenceCount = 0;
    }
  }
  return false;
}

function detectEcho(samples: Float32Array): number {
  // Simple autocorrelation at typical echo lag (50-400ms at 48kHz = 2400-19200 samples)
  const lagStart = 2400;
  const lagEnd = 9600;
  let maxCorr = 0;

  for (let lag = lagStart; lag < lagEnd; lag += 480) {
    let corr = 0;
    const len = samples.length - lag;
    for (let i = 0; i < len; i++) {
      corr += samples[i] * samples[i + lag];
    }
    corr = Math.abs(corr / len);
    if (corr > maxCorr) maxCorr = corr;
  }
  return Math.min(maxCorr * 10, 1); // Normalize
}

function isWrongMic(deviceLabel: string): boolean {
  const label = deviceLabel.toLowerCase();
  return label.includes('internal') || label.includes('built-in') ||
    label.includes('laptop') || label.includes('macbook') ||
    label.includes('integrated');
}

export async function analyzeAudio(
  audioBuffer: AudioBuffer,
  deviceLabel: string
): Promise<ScoringResult> {
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);

  // Split: noise window (first 10%) and speech window (middle 80%)
  const noiseEnd = Math.floor(samples.length * 0.1);
  const speechStart = noiseEnd;
  const speechEnd = Math.floor(samples.length * 0.9);

  const noiseSamples = samples.slice(0, noiseEnd);
  const speechSamples = samples.slice(speechStart, speechEnd);

  const speechRms = calcRms(speechSamples);
  const noiseRms = calcRms(noiseSamples);
  const clippingRate = calcClipping(speechSamples);
  const echoScore = detectEcho(samples);
  const hasDropout = detectDropout(speechSamples, sampleRate);

  const rmsDb = rmsToDb(speechRms);
  const noiseFloorDb = rmsToDb(noiseRms);

  const scores: AudioScores = { rmsDb, clippingRate, noiseFloorDb, echoScore, deviceLabel };

  // Wrong mic check (immediate fail)
  if (isWrongMic(deviceLabel)) {
    return { result: 'fail', issueCode: 'wrong_mic', scores, message: "You're using your laptop's built-in microphone, not a headset." };
  }

  // Dropout
  if (hasDropout) {
    return { result: 'fail', issueCode: 'dropout', scores, message: "Your audio is cutting in and out." };
  }

  // Clipping (too loud)
  if (clippingRate > 1) {
    return { result: 'fail', issueCode: 'clipping', scores, message: "Your microphone is distorting — the volume is too high." };
  }

  // Low volume
  if (rmsDb < -40) {
    return { result: 'fail', issueCode: 'low_volume', scores, message: "Your microphone is too quiet — customers may not be able to hear you." };
  }

  // Echo
  if (echoScore > 0.3) {
    return { result: 'fail', issueCode: 'echo', scores, message: "We're detecting echo in your audio." };
  }

  // Background noise — fail
  if (noiseFloorDb > -30) {
    return { result: 'fail', issueCode: 'background_noise', scores, message: "We're detecting significant background noise." };
  }

  // Mild clipping — warn
  if (clippingRate > 0.1) {
    return { result: 'warn', issueCode: 'clipping', scores, message: "Mild distortion detected. Your audio may sound slightly degraded." };
  }

  // Background noise — warn
  if (noiseFloorDb > -45) {
    return { result: 'warn', issueCode: 'background_noise', scores, message: "Some background noise detected. Customers may notice it on quiet calls." };
  }

  // Low volume warn
  if (rmsDb < -32) {
    return { result: 'warn', issueCode: 'low_volume', scores, message: "Your microphone is a bit quiet. Try to speak up or raise your input volume." };
  }

  return { result: 'pass', issueCode: null, scores, message: "Your audio sounds great." };
}
