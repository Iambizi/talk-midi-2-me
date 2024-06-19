const { createServer } = require('http');
const next = require('next');
const { Server: SocketIOServer } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseMidi } = require('midi-file');
const async = require('async');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handler = app.getRequestHandler();

// Setup storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage }).array('midiFiles', 10);

app.prepare().then(() => {
  const server = createServer(handler);
  const io = new SocketIOServer(server, { path: '/api/socket_io/'});

  // Set up a queue for processing MIDI files
  const midiQueue = async.queue((task, done) => {
    const filePath = `public/uploads/${task.file.filename}`;
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error(`Error reading file ${filePath}: ${err.message}`);
        io.emit('file-error', { file: task.file.filename, error: err.message });
        return done(err);
      }
      try {
        const midiData = parseMidi(data);
        io.emit('file-processed', { file: task.file.filename, data: midiData });
        done();
      } catch (parseError) {
        console.error(`Error parsing MIDI file ${filePath}: ${parseError.message}`);
        io.emit('file-error', { file: task.file.filename, error: parseError.message });
        done(parseError);
      }
    });
  }, 2);

  io.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  server.on('request', (req, res) => {
    if (req.method === 'POST' && req.url === '/api/upload') {
      upload(req, res, (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        req.files.forEach((file) => {
          midiQueue.push({ file, io });
        });
        res.status(200).send({ message: 'Files are being processed' });
      });
    } else {
      return handler(req, res);
    }
  });

  server.listen(3000, () => {
    console.log('> Ready on http://localhost:3000');
  });
});