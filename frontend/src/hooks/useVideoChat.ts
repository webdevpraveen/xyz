import { useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { ConnectionStatus } from "@/components/StatusDisplay";

export const useVideoChat = () => {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);

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
      }

      return true;
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage("Camera permission denied");
      return false;
    }
  }, []);

  // ---------------- PEER ----------------
  const setupPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnectionRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsConnected(true);
        setStatus("connected");
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

    socket.on("waiting", () => {
      setStatus("searching");
    });

    socket.on("matched", async ({ initiator }) => {
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
      } catch (e) {
        console.error("ICE error", e);
      }
    });

    socket.on("partner-left", () => {
      setIsConnected(false);
      setStatus("searching");
    });
  }, []);

  // ---------------- ACTIONS ----------------
  const startCall = useCallback(async () => {
    const ok = await initCamera();
    if (!ok) return;

    setIsStarted(true);
    setStatus("searching");

    setupPeerConnection();
    connectToSignalingServer();

    socketRef.current?.emit("start");
  }, [initCamera, setupPeerConnection, connectToSignalingServer]);

  const nextStranger = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setupPeerConnection();
    socketRef.current?.emit("next");
    socketRef.current?.emit("start");

    setIsConnected(false);
    setStatus("searching");
  }, [setupPeerConnection]);

  const endCall = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    socketRef.current?.disconnect();
    socketRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setIsStarted(false);
    setIsConnected(false);
    setStatus("idle");
  }, []);

  return {
    status,
    errorMessage,
    isStarted,
    isConnected,
    localVideoRef,
    remoteVideoRef,
    startCall,
    nextStranger,
    endCall,
  };
};
``
