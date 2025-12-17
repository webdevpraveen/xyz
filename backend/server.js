const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// =======================
// In-memory state
// =======================
const waitingQueue = [];              // socket.id[]
const activePairs = new Map();        // socket.id -> partner.id

// =======================
// Helpers
// =======================
function removeFromQueue(socketId) {
  const index = waitingQueue.indexOf(socketId);
  if (index !== -1) waitingQueue.splice(index, 1);
}

function cleanupSocket(socketId) {
  // remove from waiting queue
  removeFromQueue(socketId);

  // remove from active pair
  const partner = activePairs.get(socketId);
  if (partner) {
    activePairs.delete(partner);
    io.to(partner).emit("partner-left");
  }
  activePairs.delete(socketId);
}

// =======================
// Socket logic
// =======================
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("start", () => {
    // prevent duplicates
    cleanupSocket(socket.id);

    // add to waiting queue
    waitingQueue.push(socket.id);
    socket.emit("waiting");

    // pair if possible
    if (waitingQueue.length >= 2) {
      const userA = waitingQueue.shift();
      const userB = waitingQueue.shift();

      activePairs.set(userA, userB);
      activePairs.set(userB, userA);

      io.to(userA).emit("matched", { initiator: true });
      io.to(userB).emit("matched", { initiator: false });

      console.log("Paired:", userA, userB);
    }
  });

  socket.on("offer", (offer) => {
    const partner = activePairs.get(socket.id);
    if (partner) io.to(partner).emit("offer", offer);
  });

  socket.on("answer", (answer) => {
    const partner = activePairs.get(socket.id);
    if (partner) io.to(partner).emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate) => {
    const partner = activePairs.get(socket.id);
    if (partner) io.to(partner).emit("ice-candidate", candidate);
  });

  socket.on("next", () => {
    cleanupSocket(socket.id);
    socket.emit("reset");
    socket.emit("waiting");
    waitingQueue.push(socket.id);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    cleanupSocket(socket.id);
  });
});

server.listen(3000, () => {
  console.log("Signaling server running on port 3000");
});
