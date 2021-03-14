const express = require('express');
const bodyParser = require('body-parser')
const cors = require('cors')
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const YoutubeDlWrap = require('youtube-dl-wrap');
const fs = require('fs')

const youtubeDlWrap = new YoutubeDlWrap("./src/youtube");

(async () => {
  await YoutubeDlWrap.downloadFromWebsite("./src/youtube", "linux");
  fs.chmod("./src/youtube", fs.constants.S_IXUSR | fs.constants.S_IRUSR | fs.constants.S_IWUSR, (error) => {
    if(error) console.error(error)
    console.log('Changed file permissions');
  });
  console.log(`Set youtube dl path: ${youtubeDlWrap}`)
})()


const app = express();

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({limit: '50mb'}));
app.use(cors())

app.post('/info', async (req, res) => {
  const {url} = req.body;

  let final = "["
  const proc = spawn(youtubeDlWrap.binaryPath, [url, '-i', '--dump-json', '--restrict-filenames'], {})
  proc.stderr.on('data', (val) => {console.log('\x1b[31m%s\x1b[0m', val.toString())})
  proc.stdout.on('data', (val) => {final += val.toString()})
  proc.on('close', () => {
    let finalString = final.replace(/(?:\r\n|\r|\n)/g, ",").substring(0, final.length - 1);
    // let newFinal = final.substring(0, final.length - 2);
	  finalString += "]";
    res.send(finalString);
	  console.log('close');
	})
})

app.post('/video', (req, res) => {
  const video = execStream([req.body.url, '-f', 'bestvideo'])
  // const audio = execStream([req.body.url, '-f', 'bestaudio'])
  video.on('close', () => {
    console.log('done')
    video.destroy()
    res.end()
  })
  video.pipe(res);
  // audio.on('close', () => audio.destroy())

  // const ffmpegProcess = spawn(ffmpeg, [
  //   '-loglevel', '8', '-hide_banner',
  //   '-i', 'pipe:4',
  //   '-i', 'pipe:5',
  //   '-map', '0:a',
  //   '-map', '1:v',
  //   '-c:v', 'copy',
  //   '-f', 'matroska',
  //   'pipe:3',
  // ], {
  //   windowsHide: true,
  //   stdio: [
  //     'inherit', 'inherit', 'inherit',
  //     'pipe', 'pipe', 'pipe',
  //   ],
  // });

  // audio.pipe(ffmpegProcess.stdio[4]);
  // video.pipe(ffmpegProcess.stdio[5]);

  // ffmpegProcess.stdio[3].on('close', () => {
  //   console.log('done')
  //   res.end()
  // });
  // ffmpegProcess.stdio[3].pipe(res);
})

app.post('/audio', (req, res) => {
  const audio = execStream([req.body.url, '-f', 'bestaudio'])
  audio.on('close', () => {
    audio.destroy();
    res.end();
  })
  audio.pipe(res);
})


const execStream = (youtubeDlArguments = []) => {
  youtubeDlArguments = youtubeDlArguments.concat(["-o", "-"]);
  const youtubeDlProcess = spawn(youtubeDlWrap.binaryPath, youtubeDlArguments, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 1024
  });

  let stderrData = "";
  youtubeDlProcess.stderr.on("data", (data) =>
  {
    let stringData = data.toString();
    stderrData += stringData
  });
  youtubeDlProcess.on("error", (error) => console.log(`Youtube DL exited with code ${error}, heres some error data: ${stderrData}`));
  return youtubeDlProcess.stdout;
}

app.get('/', (req, res) => {
  res.json({message: 'Welcome to the WebDL Api! 🎈🎈'})
})

const port = process.env.PORT || 8080;

app.listen(port, () => {console.log(`Server open on port 8080`)})
