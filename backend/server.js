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

io.on(
  "connection",
  (socket) => {
    console.log(
      "User Connected:",
      socket.id
    );

    socket.on(
      "join-room",
      ({
        currentUserName,
        roomId,
      }) => {

        socket.join(
          roomId
        );

        socket.roomId =
          roomId;

        if (
          !roomParticipants[
            roomId
          ]
        ) {
          roomParticipants[
            roomId
          ] = [];
        }

       const alreadyExists =
roomParticipants[
roomId
].some(
(p)=>
p.username ===
currentUserName
);

if(
!alreadyExists
){

roomParticipants[
roomId
].push({

socketId:
socket.id,

username:
currentUserName

});

}
        console.log(
roomParticipants[roomId]
);

        console.log(
"Sending participants:",
roomParticipants[roomId]
);


        io.to(
          roomId
        ).emit(
          "participants-updated",
          roomParticipants[
            roomId
          ]
        );
      }
    );

    socket.on(
      "leave-room",

      ({ roomId }) => {
        socket.leave(
          roomId
        );

        if (
          roomParticipants[
            roomId
          ]
        ) {
          roomParticipants[
            roomId
          ] =
            roomParticipants[
              roomId
            ].filter(
              (p) =>
                p.socketId !==
                socket.id
            );

          io.to(
            roomId
          ).emit(
            "participants-updated",
            roomParticipants[
              roomId
            ]
          );

          io.to(
            roomId
          ).emit(
            "user-left",
            {
              username:
                "Someone",
            }
          );
        }
      }
    );

    socket.on(
      "code-change",

      ({
        roomId,
        code,
      }) => {
        socket
          .to(
            roomId
          )
          .emit(
            "code-update",
            {
              code,
            }
          );
      }
    );

    socket.on(
      "typing",

      ({
        roomId,
        username,
      }) => {
        socket
          .to(
            roomId
          )
          .emit(
            "user-typing",
            {
              username,
            }
          );
      }
    );

    socket.on(
      "stop-typing",

      ({
        roomId,
      }) => {
        socket
          .to(
            roomId
          )
          .emit(
            "user-stop-typing"
          );
      }
    );

    socket.on(
      "output-changed",

      ({
        roomId,
        output,
      }) => {
        socket
          .to(
            roomId
          )
          .emit(
            "output-updated",
            {
              output,
            }
          );
      }
    );

    socket.on(
"disconnect",

() => {

console.log(
"Disconnected:",
socket.id
);

const roomId =
socket.roomId;

if(
roomId &&
roomParticipants[
roomId
]
){

roomParticipants[
roomId
]=
roomParticipants[
roomId
].filter(
(p)=>
p.socketId
!==
socket.id
);

io
.to(
roomId
)
.emit(
"participants-updated",

roomParticipants[
roomId
]
);

}

}
);
  }
);

// ================= START =================

httpServer.listen(
  PORT,
  () => {
    console.log(
      `Backend running on port ${PORT}`
    );
  }
);