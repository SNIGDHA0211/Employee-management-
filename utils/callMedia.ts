/**
 * SFU-optimized config for 10–15 users per room.
 * Balances quality with server bandwidth efficiency.
 */
export const VIDEO_BITRATE_MIN = 800_000; // 800 kbps - adaptive floor
export const VIDEO_BITRATE_MAX = 1_000_000; // 1 Mbps - cap for bandwidth efficiency

/**
 * Video constraints for getUserMedia - 720p @ 24–30 fps.
 * Optimized for medium-load SFU (10–15 users per room).
 */
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1280 },
  height: { ideal: 720, max: 720 },
  frameRate: { ideal: 30, max: 30 },
};

/**
 * Audio constraints - echo cancellation, noise suppression, auto gain control.
 * Production-ready for clear audio in group calls.
 */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
};

/** Build getUserMedia constraints with optimized audio for calls. */
function getAudioConstraints(): MediaStreamConstraints['audio'] {
  return { ...AUDIO_CONSTRAINTS };
}

function getVideoConstraints(): MediaStreamConstraints['video'] {
  return { ...VIDEO_CONSTRAINTS };
}

function handleMediaError(err: unknown): void {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      console.warn('[callMedia] Permission denied - user denied microphone/camera access');
    } else if (err.name === 'NotFoundError') {
      console.warn('[callMedia] No microphone or camera found');
    } else if (err.name === 'NotReadableError' || err.name === 'OverconstrainedError') {
      console.warn('[callMedia] Device in use or constraint not supported:', err.message);
    } else {
      console.warn('[callMedia] getUserMedia error:', err.name, err.message);
    }
  } else {
    console.warn('[callMedia] Unexpected error:', err);
  }
}

/**
 * Request microphone and/or camera permission for calls.
 * Triggers browser prompt; stops tracks immediately after to release devices.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints() });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err) {
    handleMediaError(err);
    return false;
  }
}

export async function requestCameraAndMicrophonePermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: getAudioConstraints(),
      video: getVideoConstraints(),
    });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err) {
    handleMediaError(err);
    return false;
  }
}

export async function requestCallMediaPermissions(callType: 'audio' | 'video'): Promise<boolean> {
  return callType === 'audio' ? requestMicrophonePermission() : requestCameraAndMicrophonePermission();
}

/**
 * Get media stream for receiver when accepting a call. Returns the stream without stopping it
 * so it can be reused for WebRTC. Caller must stop tracks when call ends.
 * Uses noise suppression, echo cancellation, and auto gain control for audio.
 */
export async function requestAndGetCallMediaStream(callType: 'audio' | 'video'): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  try {
    const constraints: MediaStreamConstraints =
      callType === 'video'
        ? { audio: getAudioConstraints(), video: getVideoConstraints() }
        : { audio: getAudioConstraints() };
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    handleMediaError(err);
    return null;
  }
}

/** Get local audio-only stream for audio call. Caller must stop tracks when done. */
export async function getLocalAudioStream(): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints() });
  } catch (err) {
    handleMediaError(err);
    return null;
  }
}

/** Get local camera+mic stream for video call. Caller must stop tracks when done. */
export async function getLocalVideoStream(): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: getAudioConstraints(),
      video: getVideoConstraints(),
    });
  } catch (err) {
    handleMediaError(err);
    return null;
  }
}

/**
 * Get screen share stream via getDisplayMedia. Video only (no system audio).
 * Caller must stop tracks when done. Returns null if user cancels or on error.
 */
export async function getDisplayMediaStream(): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
    console.warn('[callMedia] getDisplayMedia not supported');
    return null;
  }
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      console.warn('[callMedia] Screen share cancelled or permission denied');
    } else {
      handleMediaError(err);
    }
    return null;
  }
}

/**
 * Apply video bitrate limits to RTCPeerConnection senders.
 * Uses RTCRtpSender.setParameters() - adaptive bitrate within cap.
 * Call after setLocalDescription(offer|answer).
 * SFU-optimized: 800kbps–1Mbps per video track for 10–15 users.
 */
export async function applyVideoSenderBitrate(pc: RTCPeerConnection): Promise<void> {
  const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
  if (!sender) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = VIDEO_BITRATE_MAX;
    params.encodings[0].minBitrate = VIDEO_BITRATE_MIN;
    await sender.setParameters(params);
  } catch (err) {
    console.warn('[callMedia] applyVideoSenderBitrate failed:', err);
  }
}
