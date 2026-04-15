import type { IssueCode } from './audioScoring';

interface RemediationEntry {
  title: string;
  steps: string[];
}

export const remediationContent: Record<NonNullable<IssueCode>, RemediationEntry> = {
  low_volume: {
    title: 'Raise Your Microphone Volume',
    steps: [
      "Check if your headset has a physical mute switch — make sure it's OFF (usually a button on the cable or earcup).",
      'Right-click the speaker icon in your taskbar → Open Sound Settings → Under "Input", click your microphone → Device properties → Levels. Increase to 80–100%.',
      'In your CCaaS softphone or browser settings, find Microphone Boost or Input Volume and increase to at least 70%.',
      'Move your microphone boom arm to about 1–2 inches from the corner of your mouth.',
    ]
  },
  clipping: {
    title: 'Lower Your Microphone Volume',
    steps: [
      'Right-click the speaker icon → Open Sound Settings → Input → your microphone → Device properties → Levels. Reduce to 60–70%.',
      'Move your microphone 2–3 inches farther from your mouth.',
      'If your headset cable has a volume dial, reduce it by 20–30%.',
      'In your CCaaS softphone, find Input Gain or Mic Boost — reduce to 50%.',
    ]
  },
  background_noise: {
    title: 'Reduce Background Noise',
    steps: [
      'Mute or turn off the TV, radio, or music in your space.',
      'Close the door to your room, or move to a quieter area.',
      'Close windows if street or outside noise is entering the room.',
      'If your headset has noise cancellation, open the headset app (Jabra Direct, Plantronics Hub, EPOS Connect) and confirm noise cancellation is ON.',
      'In Windows Sound Settings → Input → your microphone → Advanced, enable Noise Suppression if available.',
    ]
  },
  echo: {
    title: 'Fix the Echo',
    steps: [
      'Put on your headset fully — both earpieces on your ears. Do not use speakers while on a call.',
      'Close any other apps using your microphone: Microsoft Teams, Zoom, Discord, Google Meet — close them completely.',
      'In Windows Sound Settings, confirm your headset is set as the default Playback device (not computer speakers or monitor speakers).',
      'Reduce headset speaker volume — if too loud, sound bleeds into the microphone and causes echo.',
      'If using Bluetooth earbuds, turn OFF Transparency Mode or Passthrough Mode.',
    ]
  },
  wrong_mic: {
    title: 'Switch to Your Headset Microphone',
    steps: [
      'Make sure your headset is fully plugged in (3.5mm or USB), or your Bluetooth headset is connected and paired.',
      'Right-click the speaker icon in your taskbar → Open Sound Settings. Under "Input", click the dropdown and select your headset (e.g., "Jabra Evolve", "Plantronics", etc.).',
      'If your headset does not appear, try unplugging and re-plugging it.',
      'Come back to this page and click "Test Again" — the check will now use your headset microphone.',
    ]
  },
  bluetooth_quality: {
    title: 'Fix Your Bluetooth Connection',
    steps: [
      'Disconnect your Bluetooth headset and reconnect it. In Windows, go to Settings → Bluetooth & devices → find your headset → Connect.',
      'After reconnecting, go to Windows Sound Settings → Input and confirm your headset microphone (not speakers) is selected.',
      'Close any music streaming apps (Spotify, Apple Music) — they lock the headset in music mode instead of call mode.',
      'If your headset uses a USB dongle or receiver, move it closer to the headset — within 2 feet is ideal.',
      'Check your headset battery level — if below 20%, plug in or use a wired headset for now.',
    ]
  },
  dropout: {
    title: 'Fix the Audio Dropouts',
    steps: [
      'If using a 3.5mm headset — unplug and firmly re-plug the connector. Wiggle gently to confirm it is fully seated.',
      'Close all other browser tabs and applications before retesting — they compete for audio resources.',
      'If using Bluetooth — move closer to your Bluetooth receiver and reconnect the device.',
      'Open Device Manager (Windows key → search "Device Manager") → Universal Serial Bus Controllers → find your USB audio device → right-click → Properties → Power Management → uncheck "Allow the computer to turn off this device to save power".',
      'Restart your browser completely and try the check again.',
    ]
  }
};
