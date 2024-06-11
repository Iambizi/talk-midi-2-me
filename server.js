// server.js
const express = require('express');
const next = require('next');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const midiFile = require('midi-file');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage }).single('midiFile');

app.prepare().then(() => {
    const server = express();

    server.use(express.static('public'));

    server.post('/api/upload', (req, res) => {
        upload(req, res, function(err) {
            if (err instanceof multer.MulterError) {
                return res.status(500).json(err);
            } else if (err) {
                return res.status(500).json(err);
            }

            const filePath = `public/uploads/${req.file.filename}`;
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    return res.status(500).send('Error processing file');
                }
                const midiData = midiFile.parseMidi(data);
                console.log(midiData);
                res.status(200).send({
                    message: 'File uploaded and processed',
                    midiData: midiData
                });
            });
        });
    });

    server.all('*', (req, res) => {
        return handle(req, res);
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`> Ready on http://localhost:${PORT}`);
    });
});
