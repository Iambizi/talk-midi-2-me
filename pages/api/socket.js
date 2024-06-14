import { Server } from "socket.io";
import multer from "multer";
import path from "path";
import fs from "fs";
import midiFile from "midi-file";
import async from "async";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage }).array("midiFiles", 10);

const processMidiFile = (file, callback) => {
  const filePath = `public/uploads/${file.filename}`;
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`Error reading file ${filePath}: ${err.message}`);
      return callback(err);
    }
    try {
      const midiData = midiFile.parseMidi(data);
      callback(null, { filePath, midiData });
    } catch (parseError) {
      console.error(
        `Error parsing MIDI file ${filePath}: ${parseError.message}`
      );
      callback(parseError);
    }
  });
};

const midiQueue = async.queue((task, done) => {
  processMidiFile(task.file, (err, result) => {
    if (err) {
      task.io.emit("file-error", { file: task.file.filename, error: err.message });
    } else {
      task.io.emit("file-processed", { file: task.file.filename, data: result });
    }
    done();
  });
}, 2);

midiQueue.drain(() => {
  console.log("All files have been processed.");
});

const ioHandler = (req, res) => {
  if (!res.socket.server.io) {
    console.log("Socket.io server is starting...");
    const io = new Server(res.socket.server, {
      path: "/api/socket_io",
      addTrailingSlash: false,
    });

    io.on("connection", (socket) => {
      console.log("A client connected");

      socket.on("disconnect", () => {
        console.log("Client disconnected");
      });
    });

    res.socket.server.io = io;
  }
  res.end();
};

export default function handler(req, res) {
  if (req.method === "POST") {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(500).json({ error: err.message });
      } else if (err) {
        return res.status(500).json({ error: err.message });
      }
      req.files.forEach((file) => midiQueue.push({ file, io: res.socket.server.io }));
      res.status(200).send({ message: "Files are being processed" });
    });
  } else {
    ioHandler(req, res);
  }
}

export const config = {
  api: {
    bodyParser: false, // Disallow body parsing, since we're using multer
  },
};
