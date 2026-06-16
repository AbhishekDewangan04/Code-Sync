import { io } from "socket.io-client";

const socket = io(
  import.meta.env.VITE_BACKEND_API,
  {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
  }
);

export default socket;