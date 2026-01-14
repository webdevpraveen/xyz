import { useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { ConnectionStatus } from "@/components/StatusDisplay";

export const useVideoChat = () => {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const [hasLocalStream, setHasLocalStream] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const joinAudioRef = useRef<HTMLAudioElement | null>(null);
  const leaveAudioRef = useRef<HTMLAudioElement | null>(null);

  const vibrate = (pattern: number | number[]) => {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  };

  // ---------------- CAMERA ----------------
  const initCamera = useCallback(async () => {
    try {
      setStatus("requesting-camera");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        await localVideoRef.current.play();
      }

      setHasLocalStream(true);
      return true;
    } catch {
      setStatus("error");
      setErrorMessage("Camera permission denied");
      return false;
    }
  }, []);

  // ---------------- PEER ----------------
  const setupPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "YOUR_USERNAME",
          credential: "YOUR_PASSWORD",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "YOUR_USERNAME",
          credential: "YOUR_PASSWORD",
        },
        {
          urls: "turn:global.relay.metered.ca:443?transport=tcp",
          username: "4d1a2e03c2879c896d2aa9fc",
          credential: "lmKVk1svJmWyu7iS",
        },
      ],
    });

    peerConnectionRef.current = pc;
    remoteStreamRef.current = new MediaStream();

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.ontrack = (event) => {
      const remoteStream = remoteStreamRef.current!;
      event.streams[0].getTracks().forEach((track) => {
        if (!remoteStream.getTracks().includes(track)) {
          remoteStream.addTrack(track);
        }
      });

      if (
        remoteVideoRef.current &&
        remoteVideoRef.current.srcObject !== remoteStream
      ) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.playsInline = true;
        remoteVideoRef.current.play().catch(() => {});
      }

      setHasRemoteStream(true);
    };

    //  ICE STATE CONTROL
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log("ICE state:", state);

      if (state === "connected" || state === "completed") {
        setIsConnected(true);
        setStatus("connected");
      }

      if (state === "failed" || state === "disconnected") {
        console.warn("ICE failed, restarting...");
        pc.restartIce();
        setIsConnected(false);
        setStatus("searching");
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", event.candidate);
      }
    };

    return pc;
  }, []);

  // ---------------- SOCKET ----------------
  const connectToSignalingServer = useCallback(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL as string);
    socketRef.current = socket;

    socket.on("waiting", () => setStatus("searching"));

    socket.on("matched", async ({ initiator }) => {
      joinAudioRef.current?.play().catch(() => {});
      vibrate([150, 100, 150]);

      if (!peerConnectionRef.current) return;

      if (initiator) {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit("offer", offer);
      }
    });

    socket.on("offer", async (offer) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socket.emit("answer", answer);
    });

    socket.on("answer", async (answer) => {
      await peerConnectionRef.current?.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async (candidate) => {
      try {
        await peerConnectionRef.current?.addIceCandidate(candidate);
      } catch {}
    });

    socket.on("partner-left", () => {
      leaveAudioRef.current?.play().catch(() => {});
      vibrate(250);

      setHasRemoteStream(false);
      setIsConnected(false);
      setStatus("searching");

      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });
  }, []);

  // ---------------- ACTIONS ----------------
  const startCall = useCallback(async () => {
    joinAudioRef.current = new Audio("/assets/join.mp3");
    leaveAudioRef.current = new Audio("/assets/leave.mp3");

    joinAudioRef.current
      .play()
      .then(() => {
        joinAudioRef.current?.pause();
        joinAudioRef.current!.currentTime = 0;
      })
      .catch(() => {});

    const ok = await initCamera();
    if (!ok) return;

    setIsStarted(true);
    setStatus("searching");

    setupPeerConnection();
    connectToSignalingServer();
    socketRef.current?.emit("start");
  }, [initCamera, setupPeerConnection, connectToSignalingServer]);

  const nextStranger = useCallback(() => {
    leaveAudioRef.current?.play().catch(() => {});
    vibrate(200);

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    setHasRemoteStream(false);
    setIsConnected(false);
    setStatus("searching");

    setupPeerConnection();
    socketRef.current?.emit("next");
    socketRef.current?.emit("start");
  }, [setupPeerConnection]);

  const endCall = useCallback(() => {
    leaveAudioRef.current?.play().catch(() => {});
    vibrate(300);

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    socketRef.current?.disconnect();
    socketRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setHasLocalStream(false);
    setHasRemoteStream(false);
    setIsStarted(false);
    setIsConnected(false);
    setStatus("idle");
  }, []);

  return {
    status,
    errorMessage,
    isStarted,
    isConnected,
    hasLocalStream,
    hasRemoteStream,
    localVideoRef,
    remoteVideoRef,
    startCall,
    nextStranger,
    endCall,
  };
};

// ---------------- KHATAM ----------------
