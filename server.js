const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const midiFile = require('midi-file');

const app = express();
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: function(req, file, cb){
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function(req, file, cb){
    checkFileType(file, cb);
  }
}).single('midiFile');

function checkFileType(file, cb){
  const filetypes = /mid|midi/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if(mimetype && extname){
    return cb(null,true);
  } else {
    cb('Error: MIDI Files Only!');
  }
}

app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if(err){
      res.render('index', { msg: err });
    } else if(req.file == undefined){
      res.render('index', { msg: 'Error: No File Selected!' });
    } else {
      const filePath = `uploads/${req.file.filename}`;
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.render('index', { msg: 'Error: Failed to read the MIDI file' });
        } else {
          const midiData = midiFile.parseMidi(data);
          // You can now process the midiData as needed
          console.log(midiData);
          res.render('index', {
            msg: 'File Uploaded and processed!',
            file: filePath,
            midiData: JSON.stringify(midiData, null, 2) // Displaying MIDI data in a readable format
          });
        }
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
