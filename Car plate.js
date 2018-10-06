// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// always-run-in-app: true; icon-color: brown;
// icon-glyph: car-alt; share-sheet-inputs: file-url, url, plain-text;
// Capture an image from a dashcam, analyze and display car make and plate number
// Image recognition is done using openalpr.com cloud API
// Debug mode allows capture from local image file

const DEBUG = true;
const DEBUG_SIRI = true;
const ALLOW_ONLY_DIGITS = true;
const IMAGE_WIDTH = 2592; // DDPai mini2
const IMAGE_HEIGHT = 1520;
const TOP_CROP = Math.round(IMAGE_HEIGHT/3); // remove sky
const BOTTOM_CROP = Math.round(IMAGE_HEIGHT/6); // remove car bonnet
const ALPR_KEY = Keychain.get("ALPR_KEY");

let image = await getImage();
let alpr = await recognize(image);
let finalImage = alpr.cropped ? alpr.cropped: image;
displayResults(finalImage, alpr.carId);
Pasteboard.copyImage(finalImage);

function zeroPad(number) {
  return number < 10 ? "0" + number : "" + number
}

// DDPai mini2 specific
function getDashcamUrl() {
  let now = new Date();
  let year = now.getFullYear();
  let month = zeroPad(now.getMonth()+1);
  let day = zeroPad(now.getDate());
  let hour = zeroPad(now.getHours());
  let minute = zeroPad(now.getMinutes());
  let second = zeroPad(now.getSeconds());
  let timestamp = `${year}${month}${day}${hour}${minute}${second}`; // 20180922125258
  let url = `http://193.168.0.1/A_${timestamp}.jpg`;
  return url;
}
  
// capture image from dashcam and return as Image when ready
async function getLiveImage() {
  let url = getDashcamUrl();
  console.log(`get live image via ${url}`);
  let r = new Request(url);
  let image = await r.loadImage();
  console.log(`got ${image ? "a valid" : "an invalid"} live image`);
  return image;
}

// get image from iCloud drive for debug
async function getDebugImage(){
  let fm = FileManager.iCloud();
//   let filePath = fm.joinPath(fm.documentsDirectory(), "DDPai/A_20180810222450.JPG");
//   let filePath = fm.joinPath(fm.documentsDirectory(), "DDPai/A_20180922125012.JPG");
//   let filePath = fm.joinPath(fm.documentsDirectory(), "DDPai/N_MCfa_20180902174122_0096_L.JPG");
  let filePath = fm.joinPath(fm.documentsDirectory(), "DDPai/N_MCfa_20180815083721_0024_L.JPG");
//   let filePath = fm.joinPath(fm.documentsDirectory(), "DDPai/A_20180922125012_2.jpg");
//   let filePath = fm.joinPath(fm.documentsDirectory(), "DDPai/IMG_0919.jpg");
  console.log(`get debug image from file: ${filePath}`);
  let image = await Image.fromFile(filePath);
  console.log(`got ${image ? "a valid" : "an invalid"} debug image`);
  return image;
}

async function getImage(){
  if (DEBUG) {
    return await getDebugImage();
  } else {
    return await getLiveImage();
  }
}

// resize image by the given area factor
function resizeImage(image, factor) {
  let perAxisRatio = Math.sqrt(factor);
  const w = IMAGE_WIDTH/perAxisRatio;
  const h = (IMAGE_HEIGHT-TOP_CROP-BOTTOM_CROP)/perAxisRatio;

  let dc = new DrawContext();
  dc.opaque = true;
  dc.size = new Size(w,h);
//   dc.beginDrawing()
  dc.drawImageInRect(image, new Rect(0, 0, w, h));
  let result = dc.getImage();
//   dc.endDrawing()
  return result;
}

// crop image according to the region containg the car.
// location should be supplied as type Rect (x, y, width, height). 
// factor should match the factor used for scaling the image
function cropImage(image, location, factor) {
  let perAxisRatio = Math.sqrt(factor);
  let l = new Rect(
    Math.round(location.x * perAxisRatio),
    Math.round(location.y * perAxisRatio),
    Math.round(location.width * perAxisRatio),
    Math.round(location.height * perAxisRatio)
  );
  let dc = new DrawContext();
  dc.opaque = true;
  dc.size = new Size(l.width, l.height);
//   dc.beginDrawing();
  dc.drawImageAtPoint(image, new Point(-l.x, -l.y));
  let result = dc.getImage();
//   dc.endDrawing();
  return result;
}

function isDigits(plate) {
  return /^\d+$/.test(plate);
}

// the main "thing"
// processing includes:
// 1. crop top (sky) and bottom (bonnet) parts of the image
// 2. resize by an area factor of 2 to save time on upload
// 3. convert to base64 (temp step) and upload for car plate image recongition
// 4. if car was fiund in the photo, get make and car plate number. 
// 5. crop original image according to the car coordinates on the image
async function recognize(image) {
  const resizeScale = 2;
  
  // crop
  let initialCropped = cropImage(image, new Rect(
    0,
    TOP_CROP,
    IMAGE_WIDTH,
    IMAGE_HEIGHT-TOP_CROP-BOTTOM_CROP
  ), 1);
  
  // scale
  let scaled = resizeImage(initialCropped, resizeScale);
  
  // upload for image recognition
  let req = new Request(`https://api.openalpr.com/v2/recognize?recognize_vehicle=1&country=eu&secret_key=${ALPR_KEY}`);
  req.method = "POST"
  let imageData = Data.fromJPEG(scaled);
  req.addFileDataToMultipart(imageData, "image/jpeg", "image", "image.jpeg");
  console.log(`Sending image for detection`);
  
  let result = await req.loadJSON();
  console.log(result);
  
  // check results and find vehicle data and location
  if (result && result.results && result.results.length >= 1) {
    let topResult = result.results[0];
    let cropped = cropImage(initialCropped, topResult.vehicle_region, resizeScale);
    let make = topResult.vehicle.make[0].name;
    let plate = topResult.plate;
    if (ALLOW_ONLY_DIGITS && !isDigits(plate)) {
      console.log(`looking for numeric alternatives to "${plate}"`);
      for (let i = 0; i < topResult.candidates.length; i++) {
        let c = topResult.candidates[i];
        if (c.confidence < 75) {
          console.log(`confidence of ${c.confidence} too low`);
          break;
        }
        if (isDigits(c.plate)) {
          console.log(`switching from ${plate} to ${c.plate}`);
          plate = c.plate;
          break;
        }
      }
    }
    let formattedPlate = plate
          .replace(/^(\d{2-3})(\d{3})$/, "$1-$2")
          .replace(/^(\d{2})(\d{3})(\d{2})$/, "$1-$2-$3")
          .replace(/^(\d{3})(\d{2})(\d{3})$/, "$1-$2-$3");
    return {
      "cropped": cropped,
      "carId": `a ${make}, plate number: ${formattedPlate}`
    };
  }
  return {
    "cropped": null,
    "carId": "not found"
  };
}

// display the results using a UITable
function displayResults(image, carId) {
  let table = new UITable();
  let row = new UITableRow();
  row.addText(carId);
  table.addRow(row);
  row = new UITableRow();
  row.addImage(image);
  row.height = 500;
  table.addRow(row);
  QuickLook.present(table);
  let siriReply = `Photo saved. Car in photo is ${carId}`;
  if (config.runsWithSiri || DEBUG_SIRI) {
    Speech.speak(siriReply);
  } else {
    console.log(siriReply);
  }
}
