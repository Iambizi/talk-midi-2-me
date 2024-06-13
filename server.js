const express = require('express');
const next = require('next');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const midiFile = require('midi-file');
const http = require('http');
const socketIo = require('socket.io');
const async = require('async');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Setup storage for Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/')
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Multer configuration to handle multiple file uploads
const upload = multer({ storage }).array('midiFiles', 10);

// Prepare the Next.js app
app.prepare().then(() => {
    const server = http.createServer(app);
    const io = socketIo(server);

    // Define MIDI file processing function
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
                console.error(`Error parsing MIDI file ${filePath}: ${parseError.message}`);
                callback(parseError);
            }
        });
    };

    // Setup async queue for processing files
    const midiQueue = async.queue((task, done) => {
        processMidiFile(task.file, (err, result) => {
            if (err) {
                io.emit('file-error', { file: task.file.filename, error: err.message });
            } else {
                io.emit('file-processed', { file: task.file.filename, data: result });
            }
            done();
        });
    }, 2); // Concurrent file processing limit

    // Notify when all files are processed
    midiQueue.drain(() => {
        console.log('All files have been processed.');
        io.emit('processing-complete', { message: 'All files processed' });
    });

    // Server and express app setup
    const expressApp = express();

    expressApp.post('/api/upload', (req, res) => {
        upload(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ error: err.message });
            } else if (err) {
                return res.status(500).json({ error: err.message });
            }
            req.files.forEach(file => midiQueue.push({ file }));
            res.status(200).send({ message: 'Files are being processed' });
        });
    });

    expressApp.all('*', (req, res) => {
        return handle(req, res);
    });

    server.on('request', expressApp);
    server.listen(3000, () => {
        console.log('> Ready on http://localhost:3000');
    });
});
