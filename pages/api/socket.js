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

const extractMidiData = (data) => {
  const parsed = midiFile.parseMidi(data);

  // Extract tempo
  const tempoEvents = parsed.tracks.flatMap(track =>
    track.filter(event => event.type === 'setTempo')
  );
  const tempos = tempoEvents.map(event => 60000000 / event.microsecondsPerBeat);

  // Extract key signature
  const keySignatureEvents = parsed.tracks.flatMap(track =>
    track.filter(event => event.type === 'keySignature')
  );
  const keySignatures = keySignatureEvents.map(event => ({
    key: event.key,
    scale: event.scale === 0 ? 'major' : 'minor',
  }));

  // Extract instruments
  const instrumentEvents = parsed.tracks.flatMap(track =>
    track.filter(event => event.type === 'programChange')
  );
  const instruments = instrumentEvents.map(event => ({
    channel: event.channel,
    instrument: event.programNumber,
    deltaTime: event.deltaTime,
  }));

  // Extract basic structure and identify potential sections
  const noteEvents = parsed.tracks.flatMap(track =>
    track.filter(event => event.type === 'noteOn' || event.type === 'noteOff')
  );

  const structure = noteEvents.map(event => ({
    noteNumber: event.noteNumber,
    velocity: event.velocity,
    deltaTime: event.deltaTime,
    type: event.type,
  }));

  // Simple heuristic to identify sections (chorus/bridge)
  const sections = identifySections(noteEvents);

  return { tempos, keySignatures, instruments, structure, sections };
};

const identifySections = (noteEvents) => {
  // Placeholder for a more advanced section identification algorithm
  // This heuristic identifies sections based on note density and pitch range

  const sections = [];
  let currentSection = [];
  let lastTime = 0;
  let noteCount = 0;

  noteEvents.forEach((event, index) => {
    if (event.type === 'noteOn') {
      noteCount++;
    }
    currentSection.push(event);

    // Identify potential section change based on note density
    if (event.deltaTime - lastTime > 1000 || noteCount > 100) {
      sections.push({
        type: noteCount > 50 ? 'chorus' : 'verse',
        events: currentSection,
      });
      currentSection = [];
      noteCount = 0;
    }
    lastTime = event.deltaTime;
  });

  if (currentSection.length > 0) {
    sections.push({
      type: noteCount > 50 ? 'chorus' : 'verse',
      events: currentSection,
    });
  }

  return sections;
};

const processMidiFile = (file, callback) => {
  const filePath = `public/uploads/${file.filename}`;
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`Error reading file ${filePath}: ${err.message}`);
      return callback(err);
    }
    try {
      const midiData = extractMidiData(data);
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
