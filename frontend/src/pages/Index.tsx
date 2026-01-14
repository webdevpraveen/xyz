import React from 'react';
import Header from '@/components/Header';
import VideoContainer from '@/components/VideoContainer';
import StatusDisplay from '@/components/StatusDisplay';
import ControlButtons from '@/components/ControlButtons';
import { useVideoChat } from '@/hooks/useVideoChat';

const Index: React.FC = () => {
  const {
    status,
    errorMessage,
    isStarted,
    isConnected,
    hasLocalStream,
    hasRemoteStream,
    localVideoRef,
    remoteVideoRef,
    startCall,
    endCall,
    nextStranger,
  } = useVideoChat();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 container max-w-6xl mx-auto px-4 pb-8 flex flex-col items-center justify-center gap-6">
        {/* Video Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Local Video */}
          <VideoContainer
            id="localVideo"
            label="You"
            isLocal
            videoRef={localVideoRef}
            hasStream={hasLocalStream}
          />

          {/* Remote Video */}
          <VideoContainer
            id="remoteVideo"
            label="Stranger"
            videoRef={remoteVideoRef}
            hasStream={hasRemoteStream}
          />
        </div>

        {/* Status Display */}
        <StatusDisplay status={status} errorMessage={errorMessage} />

        {/* Control Buttons */}
        <ControlButtons
          onStart={startCall}
          onNext={nextStranger}
          onStop={endCall}
          isStarted={isStarted}
          isConnected={isConnected}
          isLoading={status === 'requesting-camera'}
        />

        {/* Info Footer */}
        <footer className="mt-auto pt-8 text-center relative w-full">
          <p className="text-xs text-muted-foreground/60 max-w-md mx-auto leading-relaxed">
            An Omegle like Software where you can video chat with random strangers anonymously. No
            registration required. Built with React, TypeScript, and WebRTC.
          </p>

          {/* GitHub Icon Right Corner */}
          <a
            href="https://github.com/webdevpraveen"
            target="_blank"
            rel="noreferrer"
            className="absolute right-0 bottom-0 p-2 opacity-70 hover:opacity-100 transition"
            aria-label="GitHub Profile"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="currentColor"
            >
              <path d="M12 2C6.477 2 2 6.484 2 12.02c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.467-1.11-1.467-.908-.62.069-.608.069-.608 1.003.071 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.952 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.336 1.909-1.296 2.748-1.026 2.748-1.026.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.338 4.696-4.566 4.945.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.749 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.02C22 6.484 17.523 2 12 2z" />
            </svg>
          </a>
        </footer>
      </main>
    </div>
  );
};

export default Index;
