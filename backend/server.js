import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;

const httpServer = createServer(app);

// ================= API =================

app.get("/", (req, res) => {
  res.json({
    message: "Backend running",
  });
});

// ================= EXECUTE =================

app.post("/execute", async (req, res) => {
  try {
    const sourceCode =
      req.body?.files?.[0]?.content || "";

    const stdin =
      req.body?.stdin || "";

    const response = await fetch(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          language_id: 54, // C++

          source_code:
            sourceCode,

          stdin:
            stdin,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Judge0 Error ${response.status}`
      );
    }

    const result =
      await response.json();

    const output =
      result.stdout ||
      result.stderr ||
      result.compile_output ||
      "No Output";

    res.json({
      run: {
        stdout:
          output,
      },
    });

  } catch (err) {
    console.log(
      "EXECUTION ERROR:",
      err
    );

    res.status(500).json({
      run: {
        stderr:
          err.message,
      },
    });
  }
});

// ================= SOCKET =================

const io = new Server(
  httpServer,
  {
    cors: {
      origin: "*",
    },
  }
);

const roomParticipants = {};
io.on("connection", (socket) => {

  socket.on("join-room", ({ roomId, currentUserName }) => {

    socket.join(roomId);

    socket.roomId = roomId;
    socket.username = currentUserName;

    const clients =
      Array.from(
        io.sockets.adapter.rooms.get(roomId) || []
      ).map((id) => ({
        socketId: id,
        username:
          io.sockets.sockets.get(id)?.username
      }));

    io.to(roomId).emit(
      "participants-updated",
      clients
    );

    socket.to(roomId).emit(
      "new-user-join",
      {
        roomId,
        currentUserName,
      }
    );
  });

  socket.on("code-change", ({ roomId, code }) => {

    socket
      .to(roomId)
      .emit(
        "code-update",
        { code }
      );
  });

  socket.on("typing", ({ roomId, username }) => {

    socket
      .to(roomId)
      .emit(
        "user-typing",
        { username }
      );
  });

  socket.on("stop-typing", ({ roomId }) => {

    socket
      .to(roomId)
      .emit(
        "user-stop-typing"
      );
  });

  socket.on(
    "leave-room",
    ({ roomId }) => {

      socket.leave(roomId);

      const clients =
        Array.from(
          io.sockets.adapter.rooms.get(roomId) || []
        ).map((id) => ({
          socketId: id,
          username:
            io.sockets.sockets.get(id)?.username
        }));

      io.to(roomId).emit(
        "participants-updated",
        clients
      );
    }
  );

  socket.on("disconnect", () => {

    if (socket.roomId) {

      socket
        .to(socket.roomId)
        .emit(
          "user-left",
          {
            username:
              socket.username
          }
        );
    }
  });

});

// ================= START =================

httpServer.listen(
  PORT,
  () => {
    console.log(
      `Backend running on port ${PORT}`
    );
  }
);